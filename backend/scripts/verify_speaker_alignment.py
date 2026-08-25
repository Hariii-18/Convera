"""Verify Speaker System Part 3: mapping diarization output onto transcript
segments (`app.services.speaker_alignment_service`).

Reuses the same synthetic 3-voice audio and diarization run as
`scripts.verify_diarization` (so this exercises the real diarization
provider, not a stub), then builds Whisper-shaped `TranscriptSegment`s at the
same turn boundaries as the synthesis script and checks the alignment layer
end to end, including the real DB for `MeetingSpeaker` sync.

Checks:
  A. 3 real speakers -> transcript segments get 3 distinct, correct
     speaker_key values (matched against ground truth by dominant overlap).
  B. Speaker A, who returns after B and C, gets the same speaker_key both
     times it appears.
  C. A segment placed entirely inside an inter-turn silence gap (no
     diarization overlap) gets speaker_key=None -- never a guess.
  D. Re-running diarize + align on the same audio/segments twice produces
     byte-identical speaker_key assignments (reprocessing determinism).
  E. Syncing the same speaker_keys against the DB twice creates each
     MeetingSpeaker exactly once -- no duplicates on rerun.
  F. A transcript segment dict without a speaker_key (pre-existing data)
     still deserializes through TranscriptSegmentRead, defaulting to None.

Usage: python -m scripts.verify_speaker_alignment
"""

from __future__ import annotations

import sys
import tempfile
import uuid
from pathlib import Path

from app.crud.meeting import create_meeting
from app.crud.meeting_speaker import list_speakers_by_meeting
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.meeting_speaker import MeetingSpeaker
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.schemas.transcript import TranscriptSegmentRead
from app.services.diarization.base import DiarizationSegment
from app.services.diarization.factory import get_diarization_provider
from app.services.speaker_alignment_service import (
    align_transcript_segments,
    sync_meeting_speakers_from_keys,
)
from app.services.transcription.audio import extract_audio
from app.services.transcription.base import TranscriptSegment

from scripts.verify_diarization import _SCRIPT, _synthesize_meeting

PRIMARY_EMAIL = "verify-speaker-alignment@convera.test"

failures: list[str] = []


def check(label: str, condition: bool, detail: object = "") -> None:
    if condition:
        print(f"PASS: {label}")
    else:
        print(f"FAIL: {label} {detail}")
        failures.append(label)


def _get_or_create_user(db) -> User:
    user = db.query(User).filter(User.email == PRIMARY_EMAIL).first()
    if user is not None:
        return user
    user = User(email=PRIMARY_EMAIL, full_name="Speaker Alignment Verify", hashed_password="not-a-real-hash", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def main() -> int:
    tmp_ctx = tempfile.TemporaryDirectory()
    try:
        print("Synthesizing a 3-voice test recording with espeak-ng...")
        audio_path, ground_truth = _synthesize_meeting(Path(tmp_ctx.name))
        print(f"OK: synthesized {audio_path} ({len(_SCRIPT)} turns, 3 voices)")

        waveform, _duration = extract_audio(audio_path.read_bytes())
        provider = get_diarization_provider()
        diarization_segments = provider.diarize(waveform)
        print(f"diarization: {len(diarization_segments)} segment(s), "
              f"{len({s.speaker_key for s in diarization_segments})} speaker(s)")

        # Whisper-shaped segments at exactly the synthesized turn boundaries,
        # one per script line -- this is what real Whisper output would look
        # like for this audio, decoupled from diarization's own windowing.
        whisper_segments = [
            TranscriptSegment(start=g["start"], end=g["end"], text=script_line[4])
            for g, script_line in zip(ground_truth, _SCRIPT)
        ]

        aligned = align_transcript_segments(whisper_segments, diarization_segments)

        # A. 3 distinct speaker_key values assigned, matched to ground truth
        # by dominant overlap (mirrors verify_diarization's own scoring).
        overlap: dict[str, dict[str, float]] = {}
        for truth, seg in zip(ground_truth, aligned):
            bucket = overlap.setdefault(truth["speaker"], {})
            key = seg["speaker_key"]
            if key is not None:
                bucket[key] = bucket.get(key, 0.0) + (truth["end"] - truth["start"])
        dominant_key = {
            speaker: max(bucket.items(), key=lambda kv: kv[1])[0]
            for speaker, bucket in overlap.items()
            if bucket
        }
        check(
            "A. all 3 real speakers got a predicted speaker_key",
            len(dominant_key) == 3,
            dominant_key,
        )
        check(
            "A. the 3 real speakers map to 3 distinct speaker_keys",
            len(set(dominant_key.values())) == 3,
            dominant_key,
        )

        # B. speaker "A" (script lines 0, 2, 5) gets the same key every time.
        a_indices = [i for i, line in enumerate(_SCRIPT) if line[0] == "A"]
        a_keys = {aligned[i]["speaker_key"] for i in a_indices}
        check(
            "B. speaker A gets the same speaker_key across all 3 of her turns "
            "(including the one after B and C spoke)",
            len(a_keys) == 1 and None not in a_keys,
            [aligned[i]["speaker_key"] for i in a_indices],
        )

        # C1. pure unit check, independent of the real diarizer's tendency to
        # leave no gaps between segments: a Whisper segment landing entirely
        # inside a deliberate gap between two synthetic DiarizationSegments
        # must come back speaker_key=None, never the nearer speaker.
        synthetic_diarization = [
            DiarizationSegment(start=0.0, end=5.0, speaker_key="speaker_1"),
            DiarizationSegment(start=10.0, end=15.0, speaker_key="speaker_2"),
        ]
        synthetic_probe = TranscriptSegment(start=6.0, end=9.0, text="(in the gap)")
        synthetic_aligned = align_transcript_segments([synthetic_probe], synthetic_diarization)
        check(
            "C1. a segment entirely inside a deliberate gap between two diarization "
            "segments gets speaker_key=None, not the nearer speaker",
            synthetic_aligned[0]["speaker_key"] is None,
            synthetic_aligned[0],
        )

        # C2. real-diarizer end-to-end check: the diarizer's own inter-turn
        # silence handling pads/merges across the short gaps *within* the
        # recording (see C1's comment), so this checks a segment placed well
        # past the end of the whole diarized recording instead, where no
        # overlap is possible by construction.
        last_end = max(seg.end for seg in diarization_segments)
        gap_probe = TranscriptSegment(start=last_end + 5.0, end=last_end + 6.0, text="(after recording ends)")
        gap_aligned = align_transcript_segments([gap_probe], diarization_segments)
        check(
            "C2. a segment past the end of the diarized recording gets speaker_key=None",
            gap_aligned[0]["speaker_key"] is None,
            gap_aligned[0],
        )

        # D. reprocessing determinism: diarize + align again, same audio/segments.
        diarization_segments_2 = provider.diarize(waveform)
        aligned_2 = align_transcript_segments(whisper_segments, diarization_segments_2)
        check("D. re-running diarize + align is byte-identical (deterministic)", aligned == aligned_2, None)

        # E/F need a real meeting + DB.
        db = SessionLocal()
        meeting_id: uuid.UUID | None = None
        try:
            user = _get_or_create_user(db)
            meeting = create_meeting(
                db, user_id=user.id,
                meeting_in=MeetingCreate(title="speaker-alignment-verify", source_type="upload-recording"),
            )
            meeting_id = meeting.id

            speaker_keys = {seg["speaker_key"] for seg in aligned if seg["speaker_key"]}
            sync_meeting_speakers_from_keys(db, meeting_id, speaker_keys)
            sync_meeting_speakers_from_keys(db, meeting_id, speaker_keys)  # rerun: must not duplicate

            speakers = list_speakers_by_meeting(db, meeting_id)
            check(
                "E. syncing the same speaker_keys twice creates each MeetingSpeaker exactly once",
                len(speakers) == len(speaker_keys),
                [s.speaker_key for s in speakers],
            )
            check(
                "E. every synced MeetingSpeaker.speaker_key came from diarization output",
                {s.speaker_key for s in speakers} == speaker_keys,
                [s.speaker_key for s in speakers],
            )

            # F. a pre-existing transcript segment dict with no speaker_key
            # key at all must still validate, defaulting to None.
            legacy_segment = TranscriptSegmentRead.model_validate(
                {"start": 0.0, "end": 1.0, "text": "legacy segment, no speaker_key"}
            )
            check("F. a legacy segment dict without speaker_key still deserializes", legacy_segment.speaker_key is None, legacy_segment)
        finally:
            if meeting_id is not None:
                db.query(MeetingSpeaker).filter(MeetingSpeaker.meeting_id == meeting_id).delete(synchronize_session=False)
                db.query(Meeting).filter(Meeting.id == meeting_id).delete(synchronize_session=False)
                db.commit()
            db.close()
    finally:
        tmp_ctx.cleanup()

    print()
    if failures:
        print(f"{len(failures)} check(s) FAILED: {failures}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
