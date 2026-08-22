"""Live Meeting session lifecycle (Phase 2) and finalization (Phase 6).

Owns the state machine for a Live Meeting session, independent of the
Meeting model's own `status` field (which stays in its existing
scheduled/processing/completed/failed vocabulary — see `LiveMeetingSession`
docstring in the model module for why this is a separate table rather than
widening that field).

State machine:

    new -> live -> stopping -> finalizing -> completed
                 \\-> failed / cancelled (from live, stopping, or finalizing)
                 (failed -> finalizing -> completed via `retry_live_meeting`)

`start_live_meeting`, `get_live_session_read`, `stop_live_meeting`, and
(Phase 6) `finalize_live_meeting` / `retry_live_meeting` are reachable from
the public API. `begin_live_finalization`, `complete_live_meeting`,
`fail_live_meeting`, and `cancel_live_meeting` are internal transition
helpers that `finalize_live_meeting`/`retry_live_meeting` drive.
"""

import logging
import uuid
from dataclasses import asdict
from datetime import datetime, timezone

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.crud.live_meeting_session import (
    create_live_session,
    get_active_live_session_for_user,
    get_live_session,
    lock_live_session,
)
from app.crud.meeting import create_meeting
from app.crud.processing_job import list_processing_jobs
from app.crud.transcript import get_transcript_by_meeting_id, upsert_transcript
from app.crud.upload import create_upload, list_uploads_by_meeting_id
from app.models.live_meeting_session import LiveMeetingSession
from app.models.user import User
from app.schemas.live_meeting import TERMINAL_LIVE_STATES, LiveMeetingSessionRead
from app.schemas.meeting import MeetingCreate
from app.services.pipeline_service import run_post_transcription_pipeline
from app.services.transcription.base import TranscriptSegment

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
    """`live -> stopping`. Idempotent for `stopping`/`finalizing`/`completed`
    — states reachable via a normal stop that the WebSocket-driven
    `finalize_live_meeting` (see `app.api.v1.live_meetings`) can race ahead
    to before this REST call lands, since the frontend's Stop button drives
    both the WebSocket's `{"type": "stop"}` message and this endpoint. A
    `failed`/`cancelled` session is still rejected (409): those are a
    distinct outcome, not "already stopped", so the caller should still see
    a conflict rather than a silent no-op.
    """
    locked = lock_live_session(db, session.id)
    if locked is None:
        raise AppError("Live session not found", status.HTTP_404_NOT_FOUND)
    if locked.state in ("stopping", "finalizing", "completed"):
        return locked
    return _transition(
        db,
        locked,
        allowed_sources=("live",),
        target="stopping",
        stopped_at=datetime.now(timezone.utc),
    )


def begin_live_finalization(db: Session, session: LiveMeetingSession) -> LiveMeetingSession:
    """`stopping -> finalizing`. Called by `finalize_live_meeting` once it
    starts merging/persisting the live transcript. Does not touch any
    transcript data itself.
    """
    return _transition(db, session, allowed_sources=("stopping",), target="finalizing")


def complete_live_meeting(db: Session, session: LiveMeetingSession) -> LiveMeetingSession:
    """`finalizing -> completed`. Called by `finalize_live_meeting` /
    `retry_live_meeting` once a final transcript has been persisted and
    `run_post_transcription_pipeline` has run.
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


# Live audio is never persisted anywhere (Phase 4/5 only ever hold it
# transiently in memory for transcription) -- the shared `Transcript` model's
# `upload_id` FK assumes a recorded-upload origin, though, so finalizing a
# live session needs *some* `Upload` row to point it at. This placeholder
# carries no real file: `size_bytes=0` and a `storage_path` nothing is ever
# written to. Reusing the existing `Upload` model/CRUD as-is (rather than
# widening `Transcript.upload_id` to be nullable) keeps this a same-shape
# citizen of the existing delete cascade (`meeting_service.delete_meeting_cascade`
# already deletes every upload for a meeting) with no schema migration.
_LIVE_PLACEHOLDER_MIME_TYPE = "audio/webm"


def _get_or_create_live_placeholder_upload(db: Session, session: LiveMeetingSession) -> uuid.UUID:
    existing = list_uploads_by_meeting_id(db, session.meeting_id)
    if existing:
        return existing[0].id
    upload = create_upload(
        db,
        user_id=session.user_id,
        meeting_id=session.meeting_id,
        original_filename=f"live-meeting-{session.meeting_id}.webm",
        stored_filename=f"live-{session.id}.webm",
        storage_path=f"live-meetings/{session.meeting_id}/audio.webm",
        bucket=get_settings().supabase_storage_bucket,
        mime_type=_LIVE_PLACEHOLDER_MIME_TYPE,
        size_bytes=0,
    )
    return upload.id


def finalize_live_meeting(
    db: Session, session: LiveMeetingSession, segments: list[TranscriptSegment]
) -> LiveMeetingSession:
    """Phase 6: `live/stopping -> stopping -> finalizing -> completed`.

    Called once from the WebSocket handler's teardown (`app.api.v1.live_meetings`)
    after `LiveTranscriptionPipeline.stop()` has drained whatever was queued
    — on a clean `{"type": "stop"}`, an unexpected disconnect, or an
    unhandled error alike, so a session never gets stuck in `live` forever.
    `segments` is that pipeline's already ordered/deduplicated committed
    transcript (see `LiveTranscriptionPipeline.get_transcript_segments`) —
    this function does no further merging, only persists it.

    Idempotent and bounded: a session already in a terminal state (this
    connection's own prior finalize call, or a fatal-error path that already
    called `fail_live_meeting`) is returned unchanged. Translation is never
    triggered here — it stays a separate, user-initiated action, as it is
    for recorded uploads.

    Drives `live -> stopping -> finalizing` itself rather than going through
    the public `stop_live_meeting` — that REST-facing function intentionally
    rejects an already-`failed` session (409, see its docstring), which
    would wrongly turn a fatal-error path that already called
    `fail_live_meeting` before this runs into an unhandled exception here.
    """
    locked = lock_live_session(db, session.id)
    if locked is None:
        raise AppError("Live session not found", status.HTTP_404_NOT_FOUND)

    if locked.state in TERMINAL_LIVE_STATES:
        return locked

    if locked.state == "live":
        locked = _transition(
            db,
            locked,
            allowed_sources=("live",),
            target="stopping",
            stopped_at=datetime.now(timezone.utc),
        )

    if locked.state == "stopping":
        locked = begin_live_finalization(db, locked)

    try:
        existing_transcript = get_transcript_by_meeting_id(db, locked.meeting_id)
        if existing_transcript is None:
            # Only ever written once per live session -- a second finalize
            # call for the same meeting only reaches here if the first one
            # never got this far (it would already be terminal above), so
            # this can't clobber a transcript a prior run already persisted.
            transcript_text = " ".join(segment.text for segment in segments).strip()
            upload_id = _get_or_create_live_placeholder_upload(db, locked)
            upsert_transcript(
                db,
                meeting_id=locked.meeting_id,
                upload_id=upload_id,
                language="en",  # Live Meeting V1 is English-only, per Phase 5.
                transcript=transcript_text,
                segments=[asdict(segment) for segment in segments],
                duration=segments[-1].end if segments else 0.0,
                word_count=len(transcript_text.split()),
            )
        run_post_transcription_pipeline(db, locked.meeting_id)
    except Exception as exc:
        logger.exception("live meeting finalization failed meeting_id=%s", locked.meeting_id)
        message = exc.message if isinstance(exc, AppError) else str(exc)
        return fail_live_meeting(db, locked, error_message=message)

    return complete_live_meeting(db, locked)


def retry_live_meeting(db: Session, session: LiveMeetingSession) -> LiveMeetingSession:
    """Retries a failed live-meeting finalization: `failed -> finalizing ->
    completed`.

    Live audio itself is never persisted, so unlike a recorded upload's
    `ProcessingJob` retry, this can never re-run transcription — it only
    resumes `run_post_transcription_pipeline` against the transcript
    `finalize_live_meeting` already saved (that pipeline is itself
    resumable: it skips normalization/summary steps that already succeeded,
    so this never redoes work that already completed).
    """
    locked = lock_live_session(db, session.id)
    if locked is None:
        raise AppError("Live session not found", status.HTTP_404_NOT_FOUND)

    if locked.state != "failed":
        raise AppError(
            f"Cannot retry live session in state '{locked.state}'", status.HTTP_409_CONFLICT
        )

    if get_transcript_by_meeting_id(db, locked.meeting_id) is None:
        raise AppError(
            "Cannot retry: no transcript was saved for this live session.",
            status.HTTP_409_CONFLICT,
        )

    locked = _transition(
        db, locked, allowed_sources=("failed",), target="finalizing", error_message=None
    )

    try:
        run_post_transcription_pipeline(db, locked.meeting_id)
    except Exception as exc:
        logger.exception("live meeting retry failed meeting_id=%s", locked.meeting_id)
        message = exc.message if isinstance(exc, AppError) else str(exc)
        return fail_live_meeting(db, locked, error_message=message)

    return complete_live_meeting(db, locked)
