import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.transcript import get_transcript_by_meeting_id, update_normalized_transcript
from app.models.transcript import Transcript
from app.services.ai.base import TranscriptChunk
from app.services.ai.factory import get_ai_provider


def generate_normalized_transcript(db: Session, meeting_id: uuid.UUID) -> Transcript:
    """Builds a readability-normalized transcript from the raw one: fixes
    punctuation, spacing, and obvious grammar issues per segment via the
    configured `AIProvider`, then stores it alongside (never over) the raw
    transcript. Segment count, order, and timestamps are always taken from
    the raw transcript, so a normalization failure or partial AI response can
    only leave a segment's text unchanged — never drop or reorder a segment.
    """
    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        raise AppError("Transcript not found", status.HTTP_404_NOT_FOUND)

    raw_segments = transcript.segments
    chunks = [
        TranscriptChunk(start=segment["start"], end=segment["end"], text=segment["text"])
        for segment in raw_segments
    ]
    try:
        result = get_ai_provider().normalize_transcript(chunks, language=transcript.language)
    except AppError:
        raise
    except Exception as exc:
        raise AppError(
            f"Normalization failed: the AI provider is unavailable or returned an error ({exc}).",
            status.HTTP_502_BAD_GATEWAY,
        ) from exc
    normalized_text_by_index = {segment.index: segment.text for segment in result.segments}

    normalized_segments = [
        {
            "start": segment["start"],
            "end": segment["end"],
            "text": normalized_text_by_index.get(index) or segment["text"],
        }
        for index, segment in enumerate(raw_segments)
    ]
    normalized_transcript = " ".join(segment["text"] for segment in normalized_segments).strip()

    return update_normalized_transcript(
        db,
        transcript,
        normalized_transcript=normalized_transcript,
        normalized_segments=normalized_segments,
    )
