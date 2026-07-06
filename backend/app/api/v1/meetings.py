import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.crud.meeting import (
    create_meeting,
    get_meeting,
    list_meetings,
    soft_delete_meeting,
    update_meeting,
)
from app.db.session import get_db
from app.models.meeting import Meeting
from app.models.user import User
from app.schemas.meeting import MeetingCreate, MeetingRead, MeetingUpdate

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
    soft_delete_meeting(db, meeting)
