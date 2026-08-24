import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.summary import SummaryTextItemRead, SummaryTopicRead
from app.schemas.transcript import TranscriptSegmentRead


class MeetingNotesActionItemRead(BaseModel):
    """Mirrors `SummaryActionItemRead` (see `app/schemas/summary.py`) plus a
    `status` field. Nothing generates a status automatically - the OpenAI
    structured-summary prompt explicitly forbids inferring one - but a user
    can now set one by hand via `PATCH /meeting-notes`.
    """

    text: str
    owner: str | None = None
    due_date: str | None = None
    status: str | None = None


class MeetingNotesRead(BaseModel):
    """Meeting Notes for a completed meeting: the persisted, editable
    `MeetingNotes` row (`id`/`title`/`executive_summary`/.../`timestamped_discussion`)
    merged with fields that are always recomposed live from `Meeting` and
    `Transcript` — `date_time_utc`/`date_time_ist`/`duration_seconds`/
    `participants_count`/`full_transcript` — so those can never drift out of
    sync with a transcript re-run, and the transcript body itself is never
    duplicated into `MeetingNotes` (see `app/models/meeting_notes.py`).
    """

    id: uuid.UUID
    meeting_id: uuid.UUID
    title: str

    date_time_utc: datetime
    date_time_ist: str
    duration_seconds: int | None
    participants_count: int | None

    executive_summary: str
    discussion_topics: list[SummaryTopicRead]
    decisions: list[SummaryTextItemRead]
    action_items: list[MeetingNotesActionItemRead]
    risks: list[SummaryTextItemRead]
    open_questions: list[SummaryTextItemRead]
    next_steps: list[SummaryTextItemRead]

    timestamped_discussion: list[TranscriptSegmentRead]
    full_transcript: str

    created_at: datetime
    updated_at: datetime


class MeetingNotesActionItemInput(BaseModel):
    text: str
    owner: str | None = None
    due_date: str | None = None
    status: str | None = None


class MeetingNotesUpdate(BaseModel):
    """Partial update for a meeting's `MeetingNotes` row — every field is
    optional and only the ones supplied are changed (`exclude_unset`, see
    `crud.meeting_notes.update_meeting_notes`). Deliberately has no field for
    the transcript body or the live-derived fields on `MeetingNotesRead`
    (`date_time_*`/`duration_seconds`/`participants_count`/`full_transcript`)
    - none of those are stored on `MeetingNotes`, so there is nothing here to
    update them with.
    """

    title: str | None = None
    executive_summary: str | None = None
    discussion_topics: list[SummaryTopicRead] | None = None
    decisions: list[SummaryTextItemRead] | None = None
    action_items: list[MeetingNotesActionItemInput] | None = None
    risks: list[SummaryTextItemRead] | None = None
    open_questions: list[SummaryTextItemRead] | None = None
    next_steps: list[SummaryTextItemRead] | None = None
    timestamped_discussion: list[TranscriptSegmentRead] | None = None


class MeetingNotesEmailRequest(BaseModel):
    format: Literal["pdf", "docx", "pptx"]


class MeetingNotesEmailResponse(BaseModel):
    sent: bool
    recipient: str
