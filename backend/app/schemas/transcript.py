import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

TranslationLanguage = Literal["en", "hi", "te"]


class TranscriptSegmentRead(BaseModel):
    start: float
    end: float
    text: str
    # The stable `MeetingSpeaker.speaker_key` diarization assigned this
    # segment (`app.services.speaker_alignment_service`), `None` when no
    # reliable diarization overlap was found. Defaults to `None` so
    # transcripts persisted before this field existed still deserialize.
    speaker_key: str | None = None
    # Presentation-only: `speaker_key` resolved to the current
    # `MeetingSpeaker.display_name` (see `app.services.speaker_resolution`),
    # `Speaker N` when no `MeetingSpeaker` row exists for the key, or `None`
    # when `speaker_key` itself is `None`. Never stored — always computed
    # fresh at read time, and never sent back on a write (`MeetingNotesUpdate`
    # reuses this schema for input but nothing ever persists this field).
    speaker_name: str | None = None


class TranscriptSegmentTextUpdate(BaseModel):
    """One edited segment. Only `text` is client-writable — `start`/`end`/
    `speaker_key` are never accepted here (see `TranscriptUpdate`), so there
    is nothing in this schema a client could use to move a segment in time
    or reassign it to a different speaker.
    """

    text: str


class TranscriptUpdate(BaseModel):
    """Body for `PATCH /transcripts`. `segments` must be the same length as
    the meeting's currently stored raw `Transcript.segments` — one entry per
    existing segment, in the same order — so the update can only ever
    replace segment text in place, never add, remove, or reorder segments.
    `crud.transcript.update_transcript_segments` rejects a length mismatch.
    Only the raw `transcript`/`segments` columns are touched; `normalized_*`
    and `translated_*` are separate columns this never writes to.
    """

    segments: list[TranscriptSegmentTextUpdate]


class TranscriptNormalize(BaseModel):
    meeting_id: uuid.UUID


class TranscriptTranslate(BaseModel):
    meeting_id: uuid.UUID
    target_language: TranslationLanguage


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
    normalized_transcript: str | None
    normalized_segments: list[TranscriptSegmentRead] | None
    normalized_at: datetime | None
    translated_transcript: str | None
    translated_segments: list[TranscriptSegmentRead] | None
    translated_language: str | None
    translated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ConversationEmailRequest(BaseModel):
    """Body for `POST /transcripts/{meeting_id}/conversation/email`. Mirrors
    `MeetingNotesEmailRequest` (`app.schemas.meeting_notes`) field-for-field
    — `send_to_me` and `recipients` are merged, trimmed, and deduplicated
    server-side by the same `resolve_email_recipients` helper (see
    `app.services.conversation_email_service`), capped at
    `MAX_MEETING_NOTES_EMAIL_RECIPIENTS` total addresses. This schema only
    validates that each individual address is well-formed; the raw list is
    capped well above that so an oversized payload fails fast instead of
    paying per-address validation cost.
    """

    format: Literal["pdf", "docx"]
    send_to_me: bool = True
    recipients: list[EmailStr] = Field(default_factory=list, max_length=50)

    @field_validator("recipients", mode="before")
    @classmethod
    def _strip_recipients(cls, value: object) -> object:
        if isinstance(value, list):
            return [item.strip() if isinstance(item, str) else item for item in value]
        return value


class ConversationEmailResponse(BaseModel):
    sent: bool
    recipients: list[str]
