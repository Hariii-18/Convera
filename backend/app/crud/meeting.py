import uuid

from fastapi import status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.meeting import MEETING_STATUS_TRANSITIONS, Meeting
from app.schemas.meeting import MeetingCreate, MeetingUpdate


def create_meeting(db: Session, user_id: int, meeting_in: MeetingCreate) -> Meeting:
    meeting = Meeting(
        user_id=user_id,
        title=meeting_in.title,
        source_type=meeting_in.source_type,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def list_meetings(db: Session, user_id: int) -> list[Meeting]:
    return (
        db.query(Meeting)
        .filter(Meeting.user_id == user_id, Meeting.deleted_at.is_(None))
        .order_by(Meeting.created_at.desc())
        .all()
    )


def get_meeting(db: Session, meeting_id: uuid.UUID, user_id: int) -> Meeting | None:
    return (
        db.query(Meeting)
        .filter(
            Meeting.id == meeting_id,
            Meeting.user_id == user_id,
            Meeting.deleted_at.is_(None),
        )
        .first()
    )


def update_meeting(db: Session, meeting: Meeting, meeting_in: MeetingUpdate) -> Meeting:
    if meeting_in.title is not None:
        meeting.title = meeting_in.title
    db.commit()
    db.refresh(meeting)
    return meeting


def update_meeting_status(db: Session, meeting: Meeting, new_status: str) -> Meeting:
    """Internal-only status transition, used by the processing/live-meeting
    lifecycle services (never by the public PATCH endpoint - see
    `MeetingUpdate`). Enforces `MEETING_STATUS_TRANSITIONS` so a bug in a
    caller can't silently move a meeting through an edge that no legitimate
    flow produces.
    """
    if new_status == meeting.status:
        return meeting
    allowed = MEETING_STATUS_TRANSITIONS.get(meeting.status, ())
    if new_status not in allowed:
        raise AppError(
            f"Cannot transition meeting from '{meeting.status}' to '{new_status}'",
            status.HTTP_409_CONFLICT,
        )
    meeting.status = new_status
    db.commit()
    db.refresh(meeting)
    return meeting


def get_meeting_status_counts(db: Session, user_id: int) -> dict[str, int]:
    rows = (
        db.query(Meeting.status, func.count(Meeting.id))
        .filter(Meeting.user_id == user_id, Meeting.deleted_at.is_(None))
        .group_by(Meeting.status)
        .all()
    )
    return dict(rows)
