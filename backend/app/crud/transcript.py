import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.summary import Summary
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
    produced_by_job_id: uuid.UUID | None = None,
) -> Transcript:
    """Creates or replaces the transcript for a meeting.

    A meeting has at most one transcript, so a retried processing job
    (re-transcribing the same meeting) overwrites the prior result rather
    than leaving a stale row behind.

    `produced_by_job_id` records which `ProcessingJob` (if any) produced this
    transcript content, so `execute_processing_job` can tell "retry of the
    same job that already transcribed this" (skip re-transcription) apart
    from "a brand-new job for an already-processed meeting" (re-transcribe).
    It's `None` for transcripts not tied to a processing job, e.g. Live
    Meeting finalization.

    When this call *replaces* content that was already there (reprocessing
    a meeting that already had a transcript), any summary already generated
    was derived from that prior content and no longer describes the new
    transcript. It's deleted here, in the same transaction as the transcript
    update, so a crash or failure anywhere downstream (normalization,
    summary generation) can never leave the old summary looking valid for
    the new transcript — the DB commit that updates the transcript is the
    same commit that removes it. `run_post_transcription_pipeline`'s
    "summary already exists, skip" check then naturally regenerates it.
    """
    existing = get_transcript_by_meeting_id(db, meeting_id)
    if existing is not None:
        db.query(Summary).filter(Summary.meeting_id == meeting_id).delete()
        existing.upload_id = upload_id
        existing.language = language
        existing.transcript = transcript
        existing.segments = segments
        existing.duration = duration
        existing.word_count = word_count
        existing.produced_by_job_id = produced_by_job_id
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
        produced_by_job_id=produced_by_job_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_transcript_segments(
    db: Session,
    transcript: Transcript,
    *,
    edited_segments: list[dict],
) -> Transcript:
    """Applies a user edit to the raw transcript's segment text.

    Only `text` ever changes. `start`/`end`/`speaker_key` are always carried
    over from the segment already stored at that index — never taken from
    the caller — so an edit can never shift a segment's timing or reassign
    it to a different speaker, regardless of what the request body contains.
    `edited_segments` must be the same length as `transcript.segments`
    (raises `ValueError` otherwise, translated to a 400 by the caller): a
    segment can be re-worded but never added, removed, or reordered.

    Recomputes `transcript` (the flat text) and `word_count` from the edited
    segments the same way the transcription pipeline derives them initially
    (`" ".join` of segment texts — see `faster_whisper.py`), so both stay
    consistent with the edited segments.

    Never touches `normalized_transcript`/`normalized_segments`/
    `translated_transcript`/`translated_segments` — those are separate
    AI-generated columns an edit to the raw transcript must not silently
    change; regenerating them is only ever triggered explicitly via
    `/transcripts/normalize` and `/transcripts/translate`.
    """
    existing_segments = transcript.segments
    if len(edited_segments) != len(existing_segments):
        raise ValueError("Segment count does not match the stored transcript")

    merged_segments = [
        {**existing, "text": edited["text"]}
        for existing, edited in zip(existing_segments, edited_segments)
    ]
    text_parts = [segment["text"].strip() for segment in merged_segments if segment["text"].strip()]
    joined_text = " ".join(text_parts)

    transcript.segments = merged_segments
    transcript.transcript = joined_text
    transcript.word_count = len(joined_text.split()) if joined_text else 0
    db.commit()
    db.refresh(transcript)
    return transcript


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
