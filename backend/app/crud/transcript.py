import uuid

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
