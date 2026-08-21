import uuid

from sqlalchemy.orm import Session

from app.models.live_meeting_session import LiveMeetingSession
from app.schemas.live_meeting import ACTIVE_LIVE_STATES


def create_live_session(
    db: Session, *, meeting_id: uuid.UUID, user_id: int
) -> LiveMeetingSession:
    session = LiveMeetingSession(meeting_id=meeting_id, user_id=user_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_live_session(
    db: Session, meeting_id: uuid.UUID, user_id: int
) -> LiveMeetingSession | None:
    return (
        db.query(LiveMeetingSession)
        .filter(
            LiveMeetingSession.meeting_id == meeting_id,
            LiveMeetingSession.user_id == user_id,
        )
        .first()
    )


def get_live_session_by_meeting_id(
    db: Session, meeting_id: uuid.UUID
) -> LiveMeetingSession | None:
    """Ownerless lookup, for the meeting delete-cascade service."""
    return (
        db.query(LiveMeetingSession)
        .filter(LiveMeetingSession.meeting_id == meeting_id)
        .first()
    )


def get_active_live_session_for_user(db: Session, user_id: int) -> LiveMeetingSession | None:
    return (
        db.query(LiveMeetingSession)
        .filter(
            LiveMeetingSession.user_id == user_id,
            LiveMeetingSession.state.in_(ACTIVE_LIVE_STATES),
        )
        .first()
    )


def lock_live_session(db: Session, session_id: uuid.UUID) -> LiveMeetingSession | None:
    """Row-locks the session for the duration of the current transaction so
    concurrent transition requests (e.g. two clients calling stop at once)
    serialize instead of racing.
    """
    return (
        db.query(LiveMeetingSession)
        .filter(LiveMeetingSession.id == session_id)
        .with_for_update()
        .first()
    )


def delete_live_session(db: Session, session: LiveMeetingSession) -> None:
    db.delete(session)
    db.commit()
