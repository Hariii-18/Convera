import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.meeting_speaker import (
    MeetingSpeakerCreate,
    MeetingSpeakerRead,
    MeetingSpeakerUpdate,
)
from app.services.meeting_speaker_service import (
    create_speaker,
    delete_speaker,
    list_speakers,
    update_speaker,
)

router = APIRouter(prefix="/meeting-speakers", tags=["meeting-speakers"])


@router.get("", response_model=list[MeetingSpeakerRead])
def list_by_meeting(
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MeetingSpeakerRead]:
    return list_speakers(db, meeting_id, current_user.id)


@router.post("", response_model=MeetingSpeakerRead, status_code=status.HTTP_201_CREATED)
def create(
    speaker_in: MeetingSpeakerCreate,
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeetingSpeakerRead:
    return create_speaker(db, meeting_id, current_user.id, speaker_in)


@router.patch("/{speaker_id}", response_model=MeetingSpeakerRead)
def update(
    speaker_id: uuid.UUID,
    speaker_in: MeetingSpeakerUpdate,
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeetingSpeakerRead:
    return update_speaker(db, meeting_id, speaker_id, current_user.id, speaker_in)


@router.delete("/{speaker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    speaker_id: uuid.UUID,
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    delete_speaker(db, meeting_id, speaker_id, current_user.id)
