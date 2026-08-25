import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.db.session import get_db
from app.models.user import User
from app.schemas.transcript import TranscriptNormalize, TranscriptRead, TranscriptTranslate
from app.services.normalization_service import generate_normalized_transcript
from app.services.transcript_service import get_transcript, to_transcript_read
from app.services.translation_service import generate_translated_transcript

router = APIRouter(prefix="/transcripts", tags=["transcripts"])


@router.get("", response_model=TranscriptRead)
def get_by_meeting(
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TranscriptRead:
    return get_transcript(db, meeting_id, current_user.id)


@router.post("/normalize", response_model=TranscriptRead, status_code=status.HTTP_201_CREATED)
def normalize(
    payload: TranscriptNormalize,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TranscriptRead:
    if get_meeting(db, payload.meeting_id, current_user.id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    transcript = generate_normalized_transcript(db, payload.meeting_id)
    return to_transcript_read(db, transcript)


@router.post("/translate", response_model=TranscriptRead, status_code=status.HTTP_201_CREATED)
def translate(
    payload: TranscriptTranslate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TranscriptRead:
    if get_meeting(db, payload.meeting_id, current_user.id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    transcript = generate_translated_transcript(db, payload.meeting_id, payload.target_language)
    return to_transcript_read(db, transcript)
