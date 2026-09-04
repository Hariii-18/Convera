"""Maps diarization output (`app.services.diarization`, "who spoke when")
onto Whisper transcript segments (`app.services.transcription`, "what was
said when"), so each transcript segment carries the stable `speaker_key` of
whoever most likely said it.

Split into two independently reusable halves so Live Meeting finalization
can call the same logic later without any DB dependency for the first part:

- `align_transcript_segments` is a pure function (no DB, no I/O): given the
  Whisper segments and the diarization segments for one meeting, it returns
  enriched segment dicts. This is the function a future Live Meeting
  finalization step would call with its own committed segments.
- `sync_meeting_speakers_from_keys` is the DB-touching half: it ensures a
  `MeetingSpeaker` row exists for every `speaker_key` diarization actually
  used, reusing rows already there on a rerun rather than creating
  duplicates.

Neither function invents a speaker identity: `align_transcript_segments`
only ever assigns a key that came out of diarization (or `None`), and
`sync_meeting_speakers_from_keys` only ever creates placeholder
`Speaker N` rows for keys diarization produced, matching the existing
manual-creation convention in `meeting_speaker_service.create_speaker`.
"""

from __future__ import annotations

import logging
import re
import uuid

from sqlalchemy.orm import Session

from app.crud.meeting_speaker import create_speaker, list_speakers_by_meeting
from app.services.diarization.base import DiarizationSegment
from app.services.transcription.base import TranscriptSegment

logger = logging.getLogger("converra")

_KEY_INDEX_PATTERN = re.compile(r"^speaker_(\d+)$")


def align_transcript_segments(
    segments: list[TranscriptSegment], diarization_segments: list[DiarizationSegment]
) -> list[dict]:
    """Assigns each Whisper segment the `speaker_key` of the diarization
    segment it overlaps with the most, by wall-clock time (start/end are
    preserved exactly; only `speaker_key` is added).

    A segment with no positive-duration overlap against any diarization
    segment -- e.g. diarization found no speech there, or diarization
    produced nothing at all -- gets `speaker_key=None` rather than a guess.
    Ties (equal overlap against two speakers) keep whichever diarization
    segment was checked first, which is stable since both inputs are
    time-ordered.
    """
    enriched: list[dict] = []
    for segment in segments:
        best_key: str | None = None
        best_overlap = 0.0
        for dseg in diarization_segments:
            overlap = min(segment.end, dseg.end) - max(segment.start, dseg.start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_key = dseg.speaker_key
        enriched.append(
            {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
                "speaker_key": best_key,
            }
        )
    return enriched


def _sort_key(speaker_key: str) -> tuple[int, str]:
    """Numeric-first ordering so `speaker_2` sorts before `speaker_10` (a
    plain string sort would not), which matters here because diarization
    (`mfcc_diarizer._stable_speaker_keys`) assigns its raw keys in strict
    first-appearance order -- sorting keys this way reproduces that
    chronological order without needing timestamps at this layer.
    """
    match = _KEY_INDEX_PATTERN.match(speaker_key)
    return (int(match.group(1)), speaker_key) if match else (10**9, speaker_key)


def sync_meeting_speakers_from_keys(
    db: Session, meeting_id: uuid.UUID, speaker_keys: set[str]
) -> None:
    """Ensures a `MeetingSpeaker` row exists for every `speaker_key` actually
    assigned to this meeting's transcript, reusing rows that already exist
    (e.g. from a prior alignment run, or one a user created by hand) instead
    of creating duplicates. The unique `(meeting_id, speaker_key)` constraint
    on `MeetingSpeaker` backs this up at the DB level too.

    Never called with `None` -- `align_transcript_segments`'s `None` results
    (no reliable overlap) are filtered out by the caller before this runs.

    The placeholder `display_name` given to a new row is a *contiguous*
    "Speaker N" counted from the number of `MeetingSpeaker` rows this meeting
    already has, not the numeric suffix of `speaker_key` itself. Diarization
    can produce more internal clusters (`speaker_1`, `speaker_2`, ...) than
    ever end up the closest overlap for a real transcript segment -- e.g.
    `speaker_2`/`speaker_3` cluster a few short interjections that always
    lose the overlap contest to a longer neighboring segment -- so the surviving
    keys passed in here (`speaker_1`, `speaker_4`) can already have gaps.
    Renumbering only the display label (never `speaker_key` itself, which
    stays the stable identity used for `Transcript.segments`,
    `MeetingSpeaker.speaker_key`, and rename lookups) keeps what's shown to
    users contiguous without touching persistence, renames, or the
    diarization/clustering output itself.
    """
    if not speaker_keys:
        return

    existing = list_speakers_by_meeting(db, meeting_id)
    existing_keys = {speaker.speaker_key for speaker in existing}
    new_keys = sorted(speaker_keys - existing_keys, key=_sort_key)

    next_ordinal = len(existing) + 1
    for key in new_keys:
        create_speaker(
            db,
            meeting_id=meeting_id,
            speaker_key=key,
            display_name=f"Speaker {next_ordinal}",
            role=None,
            company=None,
            notes=None,
        )
        logger.info(
            "Created MeetingSpeaker %s for meeting %s from diarization (display name Speaker %d)",
            key, meeting_id, next_ordinal,
        )
        next_ordinal += 1
