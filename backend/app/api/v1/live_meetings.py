import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.live_meeting import (
    LiveMeetingSessionRead,
    LiveMeetingStartRequest,
)
from app.services.live_meeting_service import (
    build_session_read,
    get_live_session_read,
    get_owned_live_session,
    start_live_meeting,
    stop_live_meeting,
)

router = APIRouter(prefix="/live-meetings", tags=["live-meetings"])


@router.post("/start", response_model=LiveMeetingSessionRead, status_code=status.HTTP_201_CREATED)
def start(
    body: LiveMeetingStartRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveMeetingSessionRead:
    session = start_live_meeting(db, current_user, title=body.title if body else None)
    return build_session_read(db, session)


@router.get("/{meeting_id}", response_model=LiveMeetingSessionRead)
def get(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveMeetingSessionRead:
    return get_live_session_read(db, meeting_id, current_user)


@router.post("/{meeting_id}/stop", response_model=LiveMeetingSessionRead)
def stop(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveMeetingSessionRead:
    session = get_owned_live_session(db, meeting_id, current_user)
    session = stop_live_meeting(db, session)
    return build_session_read(db, session)
