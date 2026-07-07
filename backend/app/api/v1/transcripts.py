import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.crud.transcript import get_transcript_by_meeting_id
from app.db.session import get_db
from app.models.transcript import Transcript
from app.models.user import User
from app.schemas.transcript import TranscriptRead

router = APIRouter(prefix="/transcripts", tags=["transcripts"])


@router.get("", response_model=TranscriptRead)
def get_by_meeting(
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Transcript:
    if get_meeting(db, meeting_id, current_user.id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        raise AppError("Transcript not found", status.HTTP_404_NOT_FOUND)
    return transcript
