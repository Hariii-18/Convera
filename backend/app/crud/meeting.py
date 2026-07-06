import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.meeting import Meeting
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
    if meeting_in.status is not None:
        meeting.status = meeting_in.status
    db.commit()
    db.refresh(meeting)
    return meeting


def soft_delete_meeting(db: Session, meeting: Meeting) -> None:
    meeting.deleted_at = datetime.now(timezone.utc)
    db.commit()
