import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.crud.summary import get_summary_by_meeting_id
from app.db.session import get_db
from app.models.summary import Summary
from app.models.user import User
from app.schemas.summary import SummaryActionItemUpdate, SummaryGenerate, SummaryRead
from app.services.export.export_service import export_summary
from app.services.summary_service import generate_summary, update_summary_action_item

router = APIRouter(prefix="/summaries", tags=["summaries"])


@router.get("", response_model=SummaryRead)
def get_by_meeting(
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Summary:
    if get_meeting(db, meeting_id, current_user.id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    summary = get_summary_by_meeting_id(db, meeting_id)
    if summary is None:
        raise AppError("Summary not found", status.HTTP_404_NOT_FOUND)
    return summary


@router.post("", response_model=SummaryRead, status_code=status.HTTP_201_CREATED)
def generate(
    payload: SummaryGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Summary:
    if get_meeting(db, payload.meeting_id, current_user.id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    return generate_summary(db, payload.meeting_id)


@router.patch("/action-items/{index}", response_model=SummaryRead)
def update_action_item(
    index: int,
    payload: SummaryActionItemUpdate,
    meeting_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Summary:
    """Persists a status/owner/due_date/text edit to one action item. Scoped
    to a single `action_items` entry — never touches the rest of the
    Summary row, the transcript, or Meeting Notes (see
    `services.summary_service.update_summary_action_item`).
    """
    return update_summary_action_item(db, meeting_id, current_user.id, index, payload)


@router.get("/{meeting_id}/export")
def export(
    meeting_id: uuid.UUID,
    format: Literal["pdf", "docx", "pptx"] = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    content, filename, content_type = export_summary(
        db, meeting_id, current_user.id, format
    )
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
