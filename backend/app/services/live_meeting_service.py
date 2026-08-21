"""Live Meeting session lifecycle (Phase 2).

Owns the state machine for a Live Meeting session, independent of the
Meeting model's own `status` field (which stays in its existing
scheduled/processing/completed/failed vocabulary — see `LiveMeetingSession`
docstring in the model module for why this is a separate table rather than
widening that field).

State machine:

    new -> live -> stopping -> finalizing -> completed
                 \\-> failed / cancelled (from live, stopping, or finalizing)

Only `start_live_meeting`, `get_live_session_read`, and `stop_live_meeting`
are reachable from the public API in this phase. `begin_live_finalization`,
`complete_live_meeting`, `fail_live_meeting`, and `cancel_live_meeting` are
internal hooks for later phases (audio/chunk finalization, transcript
merging) that own calling them once that work exists — Phase 2 does not call
`run_post_transcription_pipeline` itself.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.live_meeting_session import (
    create_live_session,
    get_active_live_session_for_user,
    get_live_session,
    lock_live_session,
)
from app.crud.meeting import create_meeting
from app.crud.processing_job import list_processing_jobs
from app.crud.transcript import get_transcript_by_meeting_id
from app.models.live_meeting_session import LiveMeetingSession
from app.models.user import User
from app.schemas.live_meeting import LiveMeetingSessionRead
from app.schemas.meeting import MeetingCreate

logger = logging.getLogger("converra")


def get_owned_live_session(db: Session, meeting_id: uuid.UUID, user: User) -> LiveMeetingSession:
    """Owned lookup for API handlers: 404s rather than leaking whether a
    session exists for a meeting the caller doesn't own.
    """
    session = get_live_session(db, meeting_id, user.id)
    if session is None:
        raise AppError("Live session not found", status.HTTP_404_NOT_FOUND)
    return session


def _transition(
    db: Session,
    session: LiveMeetingSession,
    *,
    allowed_sources: tuple[str, ...],
    target: str,
    **fields: object,
) -> LiveMeetingSession:
    """Applies one state transition under a row lock, atomically.

    Idempotent when the session is already in the target state (a repeated
    call is a no-op, not an error). Any other source state outside
    `allowed_sources` is rejected with a clear `AppError` rather than
    silently overwriting whatever the session was doing.
    """
    locked = lock_live_session(db, session.id)
    if locked is None:
        raise AppError("Live session not found", status.HTTP_404_NOT_FOUND)

    if locked.state == target:
        return locked

    if locked.state not in allowed_sources:
        raise AppError(
            f"Cannot transition live session from '{locked.state}' to '{target}'",
            status.HTTP_409_CONFLICT,
        )

    locked.state = target
    for field_name, value in fields.items():
        setattr(locked, field_name, value)

    db.commit()
    db.refresh(locked)
    return locked


def start_live_meeting(db: Session, user: User, *, title: str | None = None) -> LiveMeetingSession:
    """Starts a Live Meeting session, creating its backing Meeting record.

    Idempotent against duplicate starts: if the user already has an active
    (live/stopping/finalizing) session, that same session is returned
    instead of creating a second one. A unique partial index on
    `live_meeting_sessions` backs this at the database level too, so two
    concurrent start requests can't both slip past the check above and
    create two active sessions.
    """
    existing = get_active_live_session_for_user(db, user.id)
    if existing is not None:
        return existing

    meeting_title = title or f"Live Meeting - {datetime.now(timezone.utc):%b %d, %Y %H:%M}"
    meeting = create_meeting(
        db,
        user.id,
        MeetingCreate(title=meeting_title, source_type="live-browser-meeting"),
    )

    try:
        return create_live_session(db, meeting_id=meeting.id, user_id=user.id)
    except IntegrityError:
        db.rollback()
        existing = get_active_live_session_for_user(db, user.id)
        if existing is not None:
            return existing
        raise


def get_live_session_read(db: Session, meeting_id: uuid.UUID, user: User) -> LiveMeetingSessionRead:
    session = get_owned_live_session(db, meeting_id, user)
    return build_session_read(db, session)


def build_session_read(db: Session, session: LiveMeetingSession) -> LiveMeetingSessionRead:
    transcript = get_transcript_by_meeting_id(db, session.meeting_id)
    jobs = list_processing_jobs(db, session.user_id, meeting_id=session.meeting_id)
    latest_job = jobs[0] if jobs else None

    duration_seconds: float | None = None
    if session.stopped_at is not None:
        duration_seconds = (session.stopped_at - session.started_at).total_seconds()

    return LiveMeetingSessionRead(
        id=session.id,
        meeting_id=session.meeting_id,
        state=session.state,
        started_at=session.started_at,
        stopped_at=session.stopped_at,
        ended_at=session.ended_at,
        duration_seconds=duration_seconds,
        transcript_id=transcript.id if transcript is not None else None,
        processing_job_id=latest_job.id if latest_job is not None else None,
        processing_job_status=latest_job.status if latest_job is not None else None,
        error_message=session.error_message,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def stop_live_meeting(db: Session, session: LiveMeetingSession) -> LiveMeetingSession:
    """`live -> stopping`. Idempotent if already stopping.

    Does not finalize a transcript — that's Phase 6's responsibility, via
    `begin_live_finalization` once audio/chunk finalization exists.
    """
    return _transition(
        db,
        session,
        allowed_sources=("live",),
        target="stopping",
        stopped_at=datetime.now(timezone.utc),
    )


def begin_live_finalization(db: Session, session: LiveMeetingSession) -> LiveMeetingSession:
    """`stopping -> finalizing`. Internal hook for a future phase to call
    once it starts merging/finalizing the live transcript. Does not touch
    any transcript data itself.
    """
    return _transition(db, session, allowed_sources=("stopping",), target="finalizing")


def complete_live_meeting(db: Session, session: LiveMeetingSession) -> LiveMeetingSession:
    """`finalizing -> completed`. Internal hook for a future phase to call
    once a final transcript has been persisted and
    `run_post_transcription_pipeline` has run. Not reachable from the public
    API in this phase.
    """
    return _transition(
        db,
        session,
        allowed_sources=("finalizing",),
        target="completed",
        ended_at=datetime.now(timezone.utc),
    )


def fail_live_meeting(
    db: Session, session: LiveMeetingSession, *, error_message: str
) -> LiveMeetingSession:
    """`live/stopping/finalizing -> failed`, preserving `error_message`."""
    return _transition(
        db,
        session,
        allowed_sources=("live", "stopping", "finalizing"),
        target="failed",
        error_message=error_message,
        ended_at=datetime.now(timezone.utc),
    )


def cancel_live_meeting(db: Session, session: LiveMeetingSession) -> LiveMeetingSession:
    """`live/stopping/finalizing -> cancelled`."""
    return _transition(
        db,
        session,
        allowed_sources=("live", "stopping", "finalizing"),
        target="cancelled",
        ended_at=datetime.now(timezone.utc),
    )
