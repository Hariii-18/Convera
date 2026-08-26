import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

NotificationType = Literal["processing_completed", "processing_failed", "processing_cancelled"]


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: NotificationType
    title: str
    message: str
    meeting_id: uuid.UUID | None
    processing_job_id: uuid.UUID | None
    is_read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    count: int
