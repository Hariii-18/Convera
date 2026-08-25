"""Resolves stable `speaker_key`s (assigned by diarization/alignment, see
`app.services.speaker_alignment_service`) to human-readable identity at
presentation time, without ever touching stored transcript/notes content.

`MeetingSpeaker` (`app.models.meeting_speaker`) is the single source of
truth for a meeting's speaker identities (Speaker System Part 5). Every
surface that shows a `speaker_key` to a user — the Transcript tab, Meeting
Notes' Detailed Discussion/Full Transcript, and PDF/DOCX/PPTX exports/emails
— resolves through this module, so a rename in the Speakers panel is
reflected everywhere the next time that content is read, with no write-back
to `Transcript.segments` or `MeetingNotes.timestamped_discussion`.
"""

import re
import uuid

from sqlalchemy.orm import Session

from app.crud.meeting_speaker import list_speakers_by_meeting
from app.schemas.transcript import TranscriptSegmentRead

_KEY_INDEX_PATTERN = re.compile(r"^speaker_(\d+)$")


def build_speaker_name_map(db: Session, meeting_id: uuid.UUID) -> dict[str, str]:
    """`{speaker_key: display_name}` for every `MeetingSpeaker` row on this
    meeting. Empty for a meeting with no speaker rows yet (never raises) —
    callers fall back to `fallback_speaker_name` for any key missing here.
    """
    return {
        speaker.speaker_key: speaker.display_name
        for speaker in list_speakers_by_meeting(db, meeting_id)
    }


def fallback_speaker_name(speaker_key: str) -> str:
    """`Speaker N` derived straight from the key, for a `speaker_key` that
    has no `MeetingSpeaker` row (yet) — e.g. a row deleted after alignment
    ran, or a read that races the alignment pass's own sync. Mirrors the
    same `Speaker {N}` placeholder `meeting_speaker_service.create_speaker`
    and `speaker_alignment_service.sync_meeting_speakers_from_keys` already
    use, so the label a user sees never depends on which of those code
    paths happened to run first.
    """
    match = _KEY_INDEX_PATTERN.match(speaker_key)
    return f"Speaker {match.group(1)}" if match else speaker_key


def resolve_speaker_name(speaker_key: str | None, name_map: dict[str, str]) -> str | None:
    """`None` when `speaker_key` itself is `None` — a legacy transcript with
    no diarization, or a segment diarization couldn't confidently attribute
    — so callers render no speaker label at all rather than inventing one.
    """
    if speaker_key is None:
        return None
    return name_map.get(speaker_key) or fallback_speaker_name(speaker_key)


def resolve_segments(
    segments: list[dict] | None, name_map: dict[str, str]
) -> list[TranscriptSegmentRead]:
    """Turns raw segment dicts (as stored in `Transcript.segments`/
    `normalized_segments`/`translated_segments`, or copied onto
    `MeetingNotes.timestamped_discussion`) into `TranscriptSegmentRead`s with
    `speaker_name` resolved for presentation. Never mutates `segments` or
    writes anything back — `speaker_key` passes through unchanged, and a
    segment predating the `speaker_key` field (missing the key entirely)
    resolves to `speaker_name=None` the same as an explicit `None`.
    """
    if not segments:
        return []
    resolved = []
    for segment in segments:
        speaker_key = segment.get("speaker_key")
        resolved.append(
            TranscriptSegmentRead(
                start=segment["start"],
                end=segment["end"],
                text=segment["text"],
                speaker_key=speaker_key,
                speaker_name=resolve_speaker_name(speaker_key, name_map),
            )
        )
    return resolved
