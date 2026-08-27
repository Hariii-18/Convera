import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# `new` is not a real stored state (there is no row until a session starts);
# it only appears as the source side of the `new -> live` transition.
LiveSessionState = Literal["live", "stopping", "finalizing", "completed", "failed", "cancelled"]

# States in which a session still owns "the" active live meeting for its
# user/meeting — used for idempotent-start lookups and delete-cascade checks.
ACTIVE_LIVE_STATES: tuple[LiveSessionState, ...] = ("live", "stopping", "finalizing")
TERMINAL_LIVE_STATES: tuple[LiveSessionState, ...] = ("completed", "failed", "cancelled")


class LiveMeetingStartRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)

    @field_validator("title")
    @classmethod
    def _trim_title(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title must not be empty or whitespace-only")
        return trimmed


class LiveMeetingSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID
    title: str
    state: LiveSessionState
    started_at: datetime
    stopped_at: datetime | None
    ended_at: datetime | None
    duration_seconds: float | None
    transcript_id: uuid.UUID | None
    processing_job_id: uuid.UUID | None
    processing_job_status: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
