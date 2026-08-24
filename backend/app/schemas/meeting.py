import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MeetingStatus = Literal["scheduled", "processing", "completed", "failed"]
MeetingSourceType = Literal[
    "upload-recording", "live-browser-meeting", "microphone-recording"
]


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    source_type: MeetingSourceType


class MeetingUpdate(BaseModel):
    """User-facing PATCH body. `status` is deliberately not a field here -
    it is a lifecycle-managed value (see `MEETING_STATUS_TRANSITIONS`) driven
    only by internal processing/live-meeting flows, never by direct client
    edits. `extra="forbid"` turns an attempt to PATCH it into a clear 422
    instead of silently ignoring it.
    """

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)


class MeetingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: MeetingStatus
    source_type: MeetingSourceType
    duration_seconds: int | None
    participants_count: int | None
    created_at: datetime
    updated_at: datetime
