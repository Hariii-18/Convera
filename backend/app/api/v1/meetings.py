import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.crud.meeting import (
    create_meeting,
    get_meeting,
    list_meetings,
    update_meeting,
)
from app.crud.summary import get_summary_by_meeting_id
from app.db.session import get_db
from app.models.meeting import Meeting
from app.models.user import User
from app.schemas.meeting import MeetingCreate, MeetingRead, MeetingUpdate
from app.schemas.summary import TimelineEventRead, TimelineRead
from app.services.meeting_service import delete_meeting_cascade

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _get_owned_meeting(db: Session, meeting_id: uuid.UUID, current_user: User) -> Meeting:
    meeting = get_meeting(db, meeting_id, current_user.id)
    if meeting is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)
    return meeting


@router.post("", response_model=MeetingRead, status_code=status.HTTP_201_CREATED)
def create(
    meeting_in: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Meeting:
    return create_meeting(db, current_user.id, meeting_in)


@router.get("", response_model=list[MeetingRead])
def list_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Meeting]:
    return list_meetings(db, current_user.id)


@router.get("/{meeting_id}", response_model=MeetingRead)
def get(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Meeting:
    return _get_owned_meeting(db, meeting_id, current_user)


@router.get("/{meeting_id}/timeline", response_model=TimelineRead)
def get_timeline(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TimelineRead:
    """Returns the meeting's timeline events, ordered by `start`. Never 404s
    on "no timeline yet" (unprocessed meeting, or a provider that produced no
    events) — that's an honest empty list, not an error; only an unowned or
    nonexistent meeting 404s.
    """
    _get_owned_meeting(db, meeting_id, current_user)

    summary = get_summary_by_meeting_id(db, meeting_id)
    raw_events = summary.timeline_events if summary is not None else []
    ordered_events = sorted(raw_events, key=lambda event: event["start"])
    return TimelineRead(
        meeting_id=meeting_id,
        events=[
            TimelineEventRead(start=event["start"], title=event["label"])
            for event in ordered_events
        ],
    )


@router.patch("/{meeting_id}", response_model=MeetingRead)
def update(
    meeting_id: uuid.UUID,
    meeting_in: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Meeting:
    meeting = _get_owned_meeting(db, meeting_id, current_user)
    return update_meeting(db, meeting, meeting_in)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    meeting = _get_owned_meeting(db, meeting_id, current_user)
    delete_meeting_cascade(db, meeting)
