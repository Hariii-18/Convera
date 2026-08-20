import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.transcript import Transcript


def get_transcript_by_meeting_id(db: Session, meeting_id: uuid.UUID) -> Transcript | None:
    return db.query(Transcript).filter(Transcript.meeting_id == meeting_id).first()


def upsert_transcript(
    db: Session,
    *,
    meeting_id: uuid.UUID,
    upload_id: uuid.UUID,
    language: str | None,
    transcript: str,
    segments: list[dict],
    duration: float | None,
    word_count: int,
) -> Transcript:
    """Creates or replaces the transcript for a meeting.

    A meeting has at most one transcript, so a retried processing job
    (re-transcribing the same meeting) overwrites the prior result rather
    than leaving a stale row behind.
    """
    existing = get_transcript_by_meeting_id(db, meeting_id)
    if existing is not None:
        existing.upload_id = upload_id
        existing.language = language
        existing.transcript = transcript
        existing.segments = segments
        existing.duration = duration
        existing.word_count = word_count
        db.commit()
        db.refresh(existing)
        return existing

    record = Transcript(
        meeting_id=meeting_id,
        upload_id=upload_id,
        language=language,
        transcript=transcript,
        segments=segments,
        duration=duration,
        word_count=word_count,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_normalized_transcript(
    db: Session,
    transcript: Transcript,
    *,
    normalized_transcript: str,
    normalized_segments: list[dict],
) -> Transcript:
    """Stores the normalized (readability-cleaned) transcript alongside the
    raw one. The raw `transcript`/`segments` columns are never touched here.
    """
    transcript.normalized_transcript = normalized_transcript
    transcript.normalized_segments = normalized_segments
    transcript.normalized_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(transcript)
    return transcript


def update_translated_transcript(
    db: Session,
    transcript: Transcript,
    *,
    translated_transcript: str,
    translated_segments: list[dict],
    target_language: str,
) -> Transcript:
    """Stores the translated transcript alongside the raw one. Only one
    translated language is cached at a time; translating into a different
    language overwrites the previously cached translation.
    """
    transcript.translated_transcript = translated_transcript
    transcript.translated_segments = translated_segments
    transcript.translated_language = target_language
    transcript.translated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(transcript)
    return transcript
