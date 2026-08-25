"""Verify Speaker System Part 4: Live Meeting diarization + transcript
alignment (`app.services.diarization.live_session.LiveDiarizationSession`,
wired into `LiveTranscriptionPipeline` and `finalize_live_meeting`).

Reuses the same synthetic 3-voice recording as `scripts.verify_diarization`
and `scripts.verify_speaker_alignment` (real MFCC/pitch/clustering, no
mocks) but drives it the way the live pipeline actually would: growing
*prefixes* of the decoded waveform fed to `LiveDiarizationSession.update()`
one script-line "chunk" at a time, exactly mirroring how
`LiveTranscriptionPipeline._process_chunk` calls it every cycle with the
cumulative buffer decoded so far. This is what exercises "stable identity
across chunks" for real, rather than just checking one batch call's output.

Checks:
  A. Every diarization segment returned at each incremental step is ordered
     and non-overlapping.
  B/C/D. Speaker A -> speaker_1, speaker B -> speaker_2, and A's *later*
     turn (committed on a later chunk, after B/C have already been seen)
     gets the same key it got on its first turn -- never a fresh one.
  E. A third speaker (C) gets a third, distinct key.
  F. A segment placed after the whole streamed-so-far recording ends -- no
     diarization overlap possible -- gets speaker_key=None, never a guess.
  G. Live Meeting finalization (`finalize_live_meeting`) with the full
     session's real audio persists a Transcript whose segments carry the
     correct speaker_key per real speaker (dominant-overlap scored, same
     method as `verify_diarization`'s ground-truth check).
  H. MeetingSpeaker rows for the finalized meeting are duplicate-free and
     match exactly the speaker_keys actually used.
  I. Finalization reaches a terminal state (stop/finalization completes).

Usage: python -m scripts.verify_live_diarization
"""

from __future__ import annotations

import sys
import tempfile
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from app.crud.live_meeting_session import get_live_session
from app.crud.meeting_speaker import list_speakers_by_meeting
from app.crud.transcript import get_transcript_by_meeting_id
from app.db.session import SessionLocal
from app.main import app
from app.models.user import User
from app.services.diarization.live_session import LiveDiarizationSession
from app.services.live_meeting_service import finalize_live_meeting
from app.services.speaker_alignment_service import align_transcript_segments
from app.services.transcription.audio import extract_audio
from app.services.transcription.base import TranscriptSegment

from scripts.verify_diarization import _SCRIPT, _synthesize_meeting

client = TestClient(app)

failures: list[str] = []


def check(label: str, condition: bool, detail: object = "") -> None:
    if condition:
        print(f"PASS: {label}")
    else:
        print(f"FAIL: {label} {detail}")
        failures.append(label)


def register(email: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "TestPass123!", "full_name": "Verify Bot"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


SAMPLE_RATE = 16000


def main() -> int:
    tmp_ctx = tempfile.TemporaryDirectory()
    try:
        print("Synthesizing a 3-voice test recording with espeak-ng...")
        audio_path, ground_truth = _synthesize_meeting(Path(tmp_ctx.name))
        print(f"OK: synthesized {audio_path} ({len(_SCRIPT)} turns, 3 voices)")

        waveform, duration = extract_audio(audio_path.read_bytes(), sample_rate=SAMPLE_RATE)
        print(f"OK: decoded {waveform.shape[0]} samples ({duration:.2f}s) at {SAMPLE_RATE}Hz")

        # --- Incremental, live-pipeline-shaped driving of LiveDiarizationSession ---
        session = LiveDiarizationSession()
        committed_key_by_line: list[str | None] = []
        ordering_problems: list[str] = []

        for g, line in zip(ground_truth, _SCRIPT):
            cutoff = min(waveform.shape[0], int(round(g["end"] * SAMPLE_RATE)))
            diarization_segments = session.update(waveform[:cutoff], sample_rate=SAMPLE_RATE)

            for prev, cur in zip(diarization_segments, diarization_segments[1:]):
                if cur.start < prev.start or cur.start < prev.end:
                    ordering_problems.append(f"{prev} then {cur}")

            new_segment = TranscriptSegment(start=g["start"], end=g["end"], text=line[4])
            [aligned] = align_transcript_segments([new_segment], diarization_segments)
            committed_key_by_line.append(aligned["speaker_key"])

        check(
            "A. every incremental diarization update's segments are ordered and non-overlapping",
            not ordering_problems,
            ordering_problems,
        )

        real_speaker_by_line = [line[0] for line in _SCRIPT]
        print("\ncommitted speaker_key per line (as the live pipeline would have sent it):")
        for i, (real, key) in enumerate(zip(real_speaker_by_line, committed_key_by_line)):
            print(f"    line {i}: real={real!r} -> committed speaker_key={key!r}")

        key_by_real_speaker: dict[str, set[str | None]] = {}
        for real, key in zip(real_speaker_by_line, committed_key_by_line):
            key_by_real_speaker.setdefault(real, set()).add(key)

        check(
            "B. speaker A gets exactly one committed speaker_key across all her turns "
            "(first turn and the turn after B/C have spoken)",
            key_by_real_speaker.get("A") is not None and len(key_by_real_speaker["A"]) == 1
            and None not in key_by_real_speaker["A"],
            key_by_real_speaker.get("A"),
        )
        check(
            "C. speaker B gets exactly one committed speaker_key across both her turns",
            key_by_real_speaker.get("B") is not None and len(key_by_real_speaker["B"]) == 1
            and None not in key_by_real_speaker["B"],
            key_by_real_speaker.get("B"),
        )
        check(
            "D. speaker A's later turn (committed after B and C already spoke) reuses "
            "her first turn's key -- not a fresh one",
            committed_key_by_line[0] == committed_key_by_line[2] == committed_key_by_line[5],
            committed_key_by_line,
        )
        check(
            "E. a third speaker (C) gets a third key, distinct from A's and B's",
            key_by_real_speaker.get("C") is not None
            and len(key_by_real_speaker["C"]) == 1
            and key_by_real_speaker["C"] != key_by_real_speaker.get("A")
            and key_by_real_speaker["C"] != key_by_real_speaker.get("B"),
            key_by_real_speaker,
        )

        # F. a segment placed after everything streamed so far ends must get
        # speaker_key=None -- no diarization overlap is possible there.
        final_diarization_segments = session.update(waveform, sample_rate=SAMPLE_RATE)
        last_end = max((s.end for s in final_diarization_segments), default=0.0)
        gap_probe = TranscriptSegment(start=last_end + 5.0, end=last_end + 6.0, text="(after the stream ends)")
        [gap_aligned] = align_transcript_segments([gap_probe], final_diarization_segments)
        check(
            "F. a segment past the end of everything streamed so far gets speaker_key=None",
            gap_aligned["speaker_key"] is None,
            gap_aligned,
        )

        # --- Finalization: full session audio -> authoritative diarization pass ---
        suffix = uuid.uuid4().hex[:10]
        email = f"live-diarization-verify-{suffix}@example.com"
        token = register(email)

        resp = client.post(
            "/api/v1/live-meetings/start",
            headers=auth(token),
            json={"title": "Verify Live Diarization"},
        )
        check("start returns 201", resp.status_code == 201, resp.text)
        meeting_id = resp.json()["meeting_id"]

        # The segments a live pipeline would have committed, each already
        # carrying its incrementally-assigned speaker_key (as above) -- same
        # shape `LiveTranscriptionPipeline.get_transcript_segments()` hands
        # `finalize_live_meeting` for real.
        live_segments = [
            TranscriptSegment(start=g["start"], end=g["end"], text=line[4], speaker_key=key)
            for g, line, key in zip(ground_truth, _SCRIPT, committed_key_by_line)
        ]
        final_audio_bytes = audio_path.read_bytes()

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            live_session = get_live_session(db, uuid.UUID(meeting_id), user.id)

            finalized = finalize_live_meeting(
                db, live_session, live_segments, final_audio_bytes=final_audio_bytes
            )
            check(
                "I. finalization reaches a terminal state",
                finalized.state in ("completed", "failed"),
                finalized.state,
            )

            transcript = get_transcript_by_meeting_id(db, uuid.UUID(meeting_id))
            check("finalization persisted exactly one Transcript row", transcript is not None)

            if transcript is not None:
                overlap: dict[str, dict[str, float]] = {}
                for truth, seg in zip(ground_truth, transcript.segments):
                    bucket = overlap.setdefault(truth["speaker"], {})
                    key = seg.get("speaker_key")
                    if key is not None:
                        bucket[key] = bucket.get(key, 0.0) + (truth["end"] - truth["start"])
                dominant_key = {
                    speaker: max(bucket.items(), key=lambda kv: kv[1])[0]
                    for speaker, bucket in overlap.items()
                    if bucket
                }
                check(
                    "G. final persisted transcript: all 3 real speakers got a speaker_key",
                    len(dominant_key) == 3,
                    dominant_key,
                )
                check(
                    "G. final persisted transcript: the 3 real speakers map to 3 distinct speaker_keys",
                    len(set(dominant_key.values())) == 3,
                    dominant_key,
                )

                speakers = list_speakers_by_meeting(db, uuid.UUID(meeting_id))
                persisted_keys = {seg["speaker_key"] for seg in transcript.segments if seg.get("speaker_key")}
                check(
                    "H. MeetingSpeaker rows have no duplicates (one row per persisted speaker_key)",
                    len(speakers) == len(persisted_keys) == len({s.speaker_key for s in speakers}),
                    [s.speaker_key for s in speakers],
                )
                check(
                    "H. every MeetingSpeaker row's key came from the persisted transcript",
                    {s.speaker_key for s in speakers} == persisted_keys,
                    ([s.speaker_key for s in speakers], persisted_keys),
                )
        finally:
            db.close()

        resp = client.delete(f"/api/v1/meetings/{meeting_id}", headers=auth(token))
        check("cleanup: delete meeting returns 204", resp.status_code == 204, resp.text)
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
