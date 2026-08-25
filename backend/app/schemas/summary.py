import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class SummaryGenerate(BaseModel):
    meeting_id: uuid.UUID


class SummaryTopicRead(BaseModel):
    title: str
    description: str | None = None


class SummaryTextItemRead(BaseModel):
    text: str


# Explicit allowed values only — never inferred (e.g. defaulted to
# "not-started") for an item nothing has stated a status for. Mirrors the
# frontend's `ActionItemStatus` (`src/components/meetings/summary/types.ts`).
ActionItemStatus = Literal["not-started", "in-progress", "completed", "blocked"]


class SummaryActionItemRead(BaseModel):
    text: str
    owner: str | None = None
    due_date: str | None = None
    # Never produced by the AI provider (`generate_structured_summary`) —
    # stays unset until a user explicitly sets one via `PATCH
    # /summaries/action-items/{index}`.
    status: ActionItemStatus | None = None


class SummaryActionItemUpdate(BaseModel):
    """Partial edit for one `Summary.action_items` entry, identified by its
    position in the list (see `PATCH /summaries/action-items/{index}`). Only
    fields the client actually sends are changed (`exclude_unset`, applied in
    `crud.summary.update_action_item`) — omitting a field keeps its current
    stored value, while sending it as `null` clears it. `text` is the one
    exception: it's never cleared to `null` since it's required content, not
    an optional annotation (see `update_action_item`).
    """

    text: str | None = None
    owner: str | None = None
    due_date: str | None = None
    status: ActionItemStatus | None = None


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
