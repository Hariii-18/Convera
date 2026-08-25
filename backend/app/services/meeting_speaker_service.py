"""Manual speaker records for a meeting.

Deliberately has no diarization, voice-recognition, or automatic-detection
path: `create_speaker` never invents an identity, it only ever hands back
the next placeholder (`Speaker N`, keyed `speaker_N`). That key is the
reusable handle a future diarization pass would key its output to, so
speakers created by hand today stay compatible with it. Never reads from or
writes to `Transcript.segments`.
"""

import re
import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.crud.meeting_speaker import (
    create_speaker as _create_speaker_row,
    delete_speaker as _delete_speaker_row,
    get_speaker_for_meeting,
    list_speakers_by_meeting,
    update_speaker as _update_speaker_row,
)
from app.models.meeting_speaker import MeetingSpeaker
from app.schemas.meeting_speaker import MeetingSpeakerCreate, MeetingSpeakerUpdate

_KEY_INDEX_PATTERN = re.compile(r"^speaker_(\d+)$")


def _next_speaker_index(speakers: list[MeetingSpeaker]) -> int:
    """Highest existing `speaker_N` index + 1, not `len(speakers) + 1` — this
    keeps `speaker_key` collision-free against the unique
    `(meeting_id, speaker_key)` constraint even after a speaker in the
    middle has been deleted and a new one added afterwards.
    """
    highest = 0
    for speaker in speakers:
        match = _KEY_INDEX_PATTERN.match(speaker.speaker_key)
        if match:
            highest = max(highest, int(match.group(1)))
    return highest + 1


def _require_meeting(db: Session, meeting_id: uuid.UUID, user_id: int) -> None:
    if get_meeting(db, meeting_id, user_id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)


def list_speakers(db: Session, meeting_id: uuid.UUID, user_id: int) -> list[MeetingSpeaker]:
    _require_meeting(db, meeting_id, user_id)
    return list_speakers_by_meeting(db, meeting_id)


def create_speaker(
    db: Session, meeting_id: uuid.UUID, user_id: int, speaker_in: MeetingSpeakerCreate
) -> MeetingSpeaker:
    _require_meeting(db, meeting_id, user_id)

    existing = list_speakers_by_meeting(db, meeting_id)
    index = _next_speaker_index(existing)

    return _create_speaker_row(
        db,
        meeting_id=meeting_id,
        speaker_key=f"speaker_{index}",
        display_name=speaker_in.display_name or f"Speaker {index}",
        role=speaker_in.role,
        company=speaker_in.company,
        notes=speaker_in.notes,
    )


def _get_owned_speaker(
    db: Session, meeting_id: uuid.UUID, speaker_id: uuid.UUID, user_id: int
) -> MeetingSpeaker:
    _require_meeting(db, meeting_id, user_id)
    speaker = get_speaker_for_meeting(db, speaker_id, meeting_id)
    if speaker is None:
        raise AppError("Speaker not found", status.HTTP_404_NOT_FOUND)
    return speaker


def update_speaker(
    db: Session,
    meeting_id: uuid.UUID,
    speaker_id: uuid.UUID,
    user_id: int,
    speaker_in: MeetingSpeakerUpdate,
) -> MeetingSpeaker:
    speaker = _get_owned_speaker(db, meeting_id, speaker_id, user_id)
    return _update_speaker_row(db, speaker, speaker_in)


def delete_speaker(db: Session, meeting_id: uuid.UUID, speaker_id: uuid.UUID, user_id: int) -> None:
    speaker = _get_owned_speaker(db, meeting_id, speaker_id, user_id)
    _delete_speaker_row(db, speaker)
