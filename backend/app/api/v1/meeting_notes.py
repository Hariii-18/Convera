import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.meeting_notes import MeetingNotesRead, MeetingNotesUpdate
from app.services.export.export_service import export_meeting_notes
from app.services.meeting_notes_service import get_meeting_notes, update_meeting_notes

router = APIRouter(prefix="/meeting-notes", tags=["meeting-notes"])


@router.get("", response_model=MeetingNotesRead)
def get_by_meeting(
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeetingNotesRead:
    return get_meeting_notes(db, meeting_id, current_user.id)


@router.patch("", response_model=MeetingNotesRead)
def update(
    notes_in: MeetingNotesUpdate,
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeetingNotesRead:
    return update_meeting_notes(db, meeting_id, current_user.id, notes_in)


@router.get("/{meeting_id}/export")
def export(
    meeting_id: uuid.UUID,
    format: Literal["pdf", "docx", "pptx"] = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    content, filename, content_type = export_meeting_notes(
        db, meeting_id, current_user.id, format
    )
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
