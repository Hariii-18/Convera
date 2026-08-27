import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MeetingSpeakerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID
    speaker_key: str
    display_name: str
    role: str | None
    company: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class MeetingSpeakerCreate(BaseModel):
    """Body for `POST /meeting-speakers`. Every field is optional - the
    service assigns the next `speaker_key` (`speaker_N`) and defaults
    `display_name` to `Speaker N` when not supplied, so callers can add a
    placeholder speaker with a single click (see
    `meeting_speaker_service.create_speaker`).
    """

    display_name: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, max_length=255)
    company: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class MeetingSpeakerUpdate(BaseModel):
    """Partial update for a `MeetingSpeaker` row - every field is optional
    and only the ones supplied are changed (`exclude_unset`). `speaker_key`
    is deliberately not editable - it's the stable handle diarization output
    would key against.
    """

    display_name: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, max_length=255)
    company: str | None = Field(default=None, max_length=255)
    notes: str | None = None
