import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.transcript import get_transcript_by_meeting_id, update_translated_transcript
from app.models.transcript import Transcript
from app.services.ai.base import TranscriptChunk
from app.services.ai.factory import get_ai_provider


def generate_translated_transcript(
    db: Session, meeting_id: uuid.UUID, target_language: str
) -> Transcript:
    """Builds a translated transcript from the raw one: translates each
    segment's text into `target_language` via the configured `AIProvider`,
    then stores it alongside (never over) the raw transcript. Segment count,
    order, and timestamps are always taken from the raw transcript, so a
    translation failure or partial AI response can only leave a segment's
    text untranslated — never drop or reorder a segment.
    """
    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        raise AppError("Transcript not found", status.HTTP_404_NOT_FOUND)

    raw_segments = transcript.segments
    chunks = [
        TranscriptChunk(start=segment["start"], end=segment["end"], text=segment["text"])
        for segment in raw_segments
    ]
    result = get_ai_provider().translate_transcript(
        chunks, target_language=target_language, source_language=transcript.language
    )
    translated_text_by_index = {segment.index: segment.text for segment in result.segments}

    translated_segments = [
        {
            "start": segment["start"],
            "end": segment["end"],
            "text": translated_text_by_index.get(index) or segment["text"],
        }
        for index, segment in enumerate(raw_segments)
    ]
    translated_transcript = " ".join(segment["text"] for segment in translated_segments).strip()

    return update_translated_transcript(
        db,
        transcript,
        translated_transcript=translated_transcript,
        translated_segments=translated_segments,
        target_language=target_language,
    )
