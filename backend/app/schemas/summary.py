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
