import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


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


class SummaryEmailRequest(BaseModel):
    """Body for `POST /summaries/{meeting_id}/email`. Mirrors
    `ConversationEmailRequest`/`MeetingNotesEmailRequest` field-for-field —
    `send_to_me` and `recipients` are merged, trimmed, and deduplicated
    server-side by the same `resolve_email_recipients` helper (see
    `app.services.summary_email_service`), capped at
    `MAX_MEETING_NOTES_EMAIL_RECIPIENTS` total addresses (that constant is
    reused as-is by every email flow, not just Meeting Notes). This schema
    only validates that each individual address is well-formed; the raw
    list is capped well above that so an oversized payload fails fast
    instead of paying per-address validation cost.
    """

    format: Literal["pdf", "docx", "pptx"]
    send_to_me: bool = True
    recipients: list[EmailStr] = Field(default_factory=list, max_length=50)

    @field_validator("recipients", mode="before")
    @classmethod
    def _strip_recipients(cls, value: object) -> object:
        if isinstance(value, list):
            return [item.strip() if isinstance(item, str) else item for item in value]
        return value


class SummaryEmailResponse(BaseModel):
    sent: bool
    recipients: list[str]
