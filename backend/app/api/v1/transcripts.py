import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.db.session import get_db
from app.models.user import User
from app.schemas.transcript import (
    ConversationEmailRequest,
    ConversationEmailResponse,
    TranscriptNormalize,
    TranscriptRead,
    TranscriptTranslate,
    TranscriptUpdate,
)
from app.services.conversation_email_service import send_conversation_email
from app.services.export.conversation_export_service import export_conversation
from app.services.normalization_service import generate_normalized_transcript
from app.services.transcript_service import get_transcript, to_transcript_read, update_transcript
from app.services.translation_service import generate_translated_transcript

router = APIRouter(prefix="/transcripts", tags=["transcripts"])


@router.get("", response_model=TranscriptRead)
def get_by_meeting(
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TranscriptRead:
    return get_transcript(db, meeting_id, current_user.id)


@router.patch("", response_model=TranscriptRead)
def update(
    update_in: TranscriptUpdate,
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TranscriptRead:
    return update_transcript(db, meeting_id, current_user.id, update_in)


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


@router.get("/{meeting_id}/conversation/export")
def export_conversation_route(
    meeting_id: uuid.UUID,
    format: Literal["pdf", "docx"] = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    content, filename, content_type = export_conversation(
        db, meeting_id, current_user.id, format
    )
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{meeting_id}/conversation/email", response_model=ConversationEmailResponse)
def email_conversation_route(
    meeting_id: uuid.UUID,
    body: ConversationEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationEmailResponse:
    recipients = send_conversation_email(
        db, meeting_id, current_user, body.format, body.send_to_me, body.recipients
    )
    return ConversationEmailResponse(sent=True, recipients=recipients)
