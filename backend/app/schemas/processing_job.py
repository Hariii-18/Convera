import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

ProcessingStatus = Literal["queued", "preparing", "processing", "completed", "failed"]


class ProcessingJobCreate(BaseModel):
    upload_id: uuid.UUID


class ProcessingJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    upload_id: uuid.UUID
    meeting_id: uuid.UUID
    user_id: int
    status: ProcessingStatus
    progress: int
    stage: str
    worker_name: str | None
    attempts: int
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class ProcessingStats(BaseModel):
    currently_processing: int
    queued_jobs: int
    completed_today: int
    failed_jobs: int
