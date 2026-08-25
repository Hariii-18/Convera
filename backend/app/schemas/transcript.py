import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

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
