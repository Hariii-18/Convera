import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SummaryGenerate(BaseModel):
    meeting_id: uuid.UUID


class SummaryTopicRead(BaseModel):
    title: str
    description: str | None = None


class SummaryTextItemRead(BaseModel):
    text: str


class SummaryActionItemRead(BaseModel):
    text: str
    owner: str | None = None
    due_date: str | None = None


class TimelineEventRead(BaseModel):
    """One key moment from `Summary.timeline_events`. `description` and
    `event_type` are placeholders for richer AI output later — the current
    `AIProvider.generate_timeline` only produces a timestamp and a label, so
    both stay unset rather than being fabricated.
    """

    start: float
    title: str
    description: str | None = None


class TimelineRead(BaseModel):
    meeting_id: uuid.UUID
    events: list[TimelineEventRead]


class SummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    meeting_id: uuid.UUID
    executive_summary: str
    topics: list[SummaryTopicRead]
    decisions: list[SummaryTextItemRead]
    action_items: list[SummaryActionItemRead]
    risks: list[SummaryTextItemRead]
    open_questions: list[SummaryTextItemRead]
    next_steps: list[SummaryTextItemRead]
    created_at: datetime
    updated_at: datetime
