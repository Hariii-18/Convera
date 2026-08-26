import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.crud.notification import (
    count_unread_notifications,
    get_notification,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationRead, UnreadCountResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
def list_all(
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Notification]:
    return list_notifications(db, current_user.id, unread_only=unread_only)


@router.get("/unread-count", response_model=UnreadCountResponse)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    return UnreadCountResponse(count=count_unread_notifications(db, current_user.id))


@router.patch("/{notification_id}/read", response_model=NotificationRead)
def mark_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Notification:
    notification = get_notification(db, notification_id, current_user.id)
    if notification is None:
        raise AppError("Notification not found", status.HTTP_404_NOT_FOUND)
    return mark_notification_read(db, notification)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    mark_all_notifications_read(db, current_user.id)
