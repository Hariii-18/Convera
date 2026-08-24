import uuid
from zoneinfo import ZoneInfo

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.meeting import get_meeting, get_meeting_by_id
from app.crud.meeting_notes import (
    create_meeting_notes,
    get_meeting_notes_by_meeting_id,
    update_meeting_notes as _update_meeting_notes_row,
)
from app.crud.summary import get_summary_by_meeting_id
from app.crud.transcript import get_transcript_by_meeting_id
from app.models.meeting import Meeting
from app.models.meeting_notes import MeetingNotes
from app.models.transcript import Transcript
from app.schemas.meeting_notes import MeetingNotesRead, MeetingNotesUpdate

_PRESENTATION_TIMEZONE = ZoneInfo("Asia/Kolkata")


def ensure_meeting_notes(db: Session, meeting_id: uuid.UUID) -> MeetingNotes | None:
    """Auto-creates the `MeetingNotes` row for a meeting the first time its
    transcript+summary are both available, composing the AI-sourced fields
    from them exactly once. Idempotent and non-destructive:

    - If a row already exists, it is returned untouched. A `Summary`
      regeneration (meeting reprocessing) must never clobber a user's saved
      edits, so this never re-copies AI data over an existing row - "one
      record per meeting" holds for its whole lifetime, not just at creation.
    - Returns `None` (does not raise) if the transcript and/or summary
      aren't ready yet - this is a routine "not yet" state, not a failure;
      callers decide what that means for them (the pipeline just skips it
      for now, `get_meeting_notes` turns it into a 404).

    Takes only a `meeting_id`, no `user_id`: called from the post-transcription
    pipeline, which runs in a trusted internal context with no request-scoped
    user to check ownership against (mirrors `run_post_transcription_pipeline`
    itself). Endpoints must never call this directly - go through
    `get_meeting_notes`/`update_meeting_notes`, which check ownership first.
    """
    existing = get_meeting_notes_by_meeting_id(db, meeting_id)
    if existing is not None:
        return existing

    transcript = get_transcript_by_meeting_id(db, meeting_id)
    summary = get_summary_by_meeting_id(db, meeting_id)
    if transcript is None or summary is None:
        return None

    meeting = get_meeting_by_id(db, meeting_id)
    if meeting is None:
        return None

    segments = transcript.normalized_segments or transcript.segments
    action_items = [
        {
            "text": item.get("text", ""),
            "owner": item.get("owner"),
            "due_date": item.get("due_date"),
            "status": None,
        }
        for item in summary.action_items
    ]

    return create_meeting_notes(
        db,
        meeting_id=meeting_id,
        title=meeting.title,
        executive_summary=summary.executive_summary,
        discussion_topics=summary.topics,
        decisions=summary.decisions,
        action_items=action_items,
        risks=summary.risks,
        open_questions=summary.open_questions,
        next_steps=summary.next_steps,
        timestamped_discussion=segments,
    )


def _to_read(meeting: Meeting, notes: MeetingNotes, transcript: Transcript | None) -> MeetingNotesRead:
    duration_seconds = meeting.duration_seconds
    if duration_seconds is None and transcript is not None and transcript.duration is not None:
        duration_seconds = round(transcript.duration)

    full_transcript = ""
    if transcript is not None:
        # Same normalized-preferred precedence as everywhere else the
        # transcript body is surfaced (see `summary_service.generate_summary`).
        full_transcript = transcript.normalized_transcript or transcript.transcript

    meeting_datetime = meeting.created_at

    return MeetingNotesRead(
        id=notes.id,
        meeting_id=meeting.id,
        title=notes.title,
        date_time_utc=meeting_datetime,
        date_time_ist=meeting_datetime.astimezone(_PRESENTATION_TIMEZONE).strftime(
            "%Y-%m-%d %H:%M:%S %Z"
        ),
        duration_seconds=duration_seconds,
        participants_count=meeting.participants_count,
        executive_summary=notes.executive_summary,
        discussion_topics=notes.discussion_topics,
        decisions=notes.decisions,
        action_items=notes.action_items,
        risks=notes.risks,
        open_questions=notes.open_questions,
        next_steps=notes.next_steps,
        timestamped_discussion=notes.timestamped_discussion,
        full_transcript=full_transcript,
        created_at=notes.created_at,
        updated_at=notes.updated_at,
    )


def get_meeting_notes(db: Session, meeting_id: uuid.UUID, user_id: int) -> MeetingNotesRead:
    """Ownership-checked read of a meeting's Meeting Notes, auto-creating the
    persisted row first if this is the first time it's been requested (lazy
    backfill for meetings summarized before this table existed, alongside the
    pipeline hook - see `ensure_meeting_notes`).
    """
    meeting = get_meeting(db, meeting_id, user_id)
    if meeting is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    notes = ensure_meeting_notes(db, meeting_id)
    if notes is None:
        raise AppError(
            "Meeting notes not ready: transcript and summary must complete first",
            status.HTTP_404_NOT_FOUND,
        )

    transcript = get_transcript_by_meeting_id(db, meeting_id)
    return _to_read(meeting, notes, transcript)


def update_meeting_notes(
    db: Session, meeting_id: uuid.UUID, user_id: int, notes_in: MeetingNotesUpdate
) -> MeetingNotesRead:
    """Ownership-checked partial update of a meeting's Meeting Notes. Only
    ever touches the `MeetingNotes` row - `Transcript` and `Summary` aren't
    reachable from this call path, so an edit here can never modify either.
    """
    meeting = get_meeting(db, meeting_id, user_id)
    if meeting is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    notes = ensure_meeting_notes(db, meeting_id)
    if notes is None:
        raise AppError(
            "Meeting notes not ready: transcript and summary must complete first",
            status.HTTP_404_NOT_FOUND,
        )

    notes = _update_meeting_notes_row(db, notes, notes_in)
    transcript = get_transcript_by_meeting_id(db, meeting_id)
    return _to_read(meeting, notes, transcript)
