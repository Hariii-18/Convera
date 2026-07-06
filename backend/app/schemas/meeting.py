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
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: MeetingStatus | None = None


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
