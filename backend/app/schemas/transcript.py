import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TranscriptSegmentRead(BaseModel):
    start: float
    end: float
    text: str


class TranscriptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID
    upload_id: uuid.UUID
    language: str | None
    transcript: str
    segments: list[TranscriptSegmentRead]
    duration: float | None
    word_count: int
    created_at: datetime
    updated_at: datetime
