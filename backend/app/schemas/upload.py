import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

UploadStatus = Literal["uploading", "uploaded", "failed", "deleted"]


class UploadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID | None
    original_filename: str
    stored_filename: str
    storage_path: str
    bucket: str
    mime_type: str
    size_bytes: int
    duration_seconds: int | None
    status: UploadStatus
    created_at: datetime
    updated_at: datetime


class UploadPlaybackRead(BaseModel):
    """A short-lived, direct-to-storage URL for playing back a recording."""

    url: str
    mime_type: str
    expires_in: int
