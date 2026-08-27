import uuid

from fastapi import status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.meeting import MEETING_STATUS_TRANSITIONS, Meeting
from app.schemas.meeting import MeetingCreate, MeetingUpdate

_DUPLICATE_TITLE_MESSAGE = "A meeting with this title already exists."


def _title_taken(
    db: Session, user_id: int, title: str, *, exclude_meeting_id: uuid.UUID | None = None
) -> bool:
    """Case-insensitive, whitespace-insensitive duplicate check, scoped to
    the user's non-deleted meetings (recorded and Live alike -- both live in
    this same table). `title` is expected already trimmed (see
    `MeetingCreate`/`MeetingUpdate` validators); `func.lower(func.trim(...))`
    on the stored side still normalizes existing rows so a pre-existing title
    with incidental whitespace/casing still collides correctly.
    """
    query = db.query(Meeting.id).filter(
        Meeting.user_id == user_id,
        Meeting.deleted_at.is_(None),
        func.lower(func.trim(Meeting.title)) == title.lower(),
    )
    if exclude_meeting_id is not None:
        query = query.filter(Meeting.id != exclude_meeting_id)
    return db.query(query.exists()).scalar()


def create_meeting(db: Session, user_id: int, meeting_in: MeetingCreate) -> Meeting:
    if _title_taken(db, user_id, meeting_in.title):
        raise AppError(_DUPLICATE_TITLE_MESSAGE, status.HTTP_409_CONFLICT)

    meeting = Meeting(
        user_id=user_id,
        title=meeting_in.title,
        source_type=meeting_in.source_type,
    )
    db.add(meeting)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(_DUPLICATE_TITLE_MESSAGE, status.HTTP_409_CONFLICT) from exc
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


def get_meeting_by_id(db: Session, meeting_id: uuid.UUID) -> Meeting | None:
    """Unfiltered by `user_id` — for internal call sites that already run in
    a trusted context (e.g. the post-transcription pipeline, which only ever
    has a `meeting_id`). Never expose this behind an API endpoint; use
    `get_meeting` there so ownership is enforced.
    """
    return db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.deleted_at.is_(None)).first()


def update_meeting(db: Session, meeting: Meeting, meeting_in: MeetingUpdate) -> Meeting:
    if meeting_in.title is not None:
        if _title_taken(db, meeting.user_id, meeting_in.title, exclude_meeting_id=meeting.id):
            raise AppError(_DUPLICATE_TITLE_MESSAGE, status.HTTP_409_CONFLICT)
        meeting.title = meeting_in.title
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(_DUPLICATE_TITLE_MESSAGE, status.HTTP_409_CONFLICT) from exc
    db.refresh(meeting)
    return meeting


def update_meeting_status(
    db: Session, meeting: Meeting, new_status: str, *, commit: bool = True
) -> Meeting:
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
    if not commit:
        db.flush()
        return meeting
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
