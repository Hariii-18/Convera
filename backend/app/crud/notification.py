import uuid

from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    user_id: int,
    type: str,
    title: str,
    message: str,
    meeting_id: uuid.UUID | None = None,
    processing_job_id: uuid.UUID | None = None,
    commit: bool = True,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        meeting_id=meeting_id,
        processing_job_id=processing_job_id,
    )
    db.add(notification)
    if commit:
        db.commit()
        db.refresh(notification)
    else:
        db.flush()
    return notification


def list_notifications(
    db: Session, user_id: int, *, unread_only: bool = False, limit: int = 50
) -> list[Notification]:
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(Notification.created_at.desc()).limit(limit).all()


def get_notification(db: Session, notification_id: uuid.UUID, user_id: int) -> Notification | None:
    return (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )


def count_unread_notifications(db: Session, user_id: int) -> int:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .count()
    )


def mark_notification_read(db: Session, notification: Notification) -> Notification:
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_notifications_read(db: Session, user_id: int) -> int:
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .update({Notification.is_read: True})
    )
    db.commit()
    return updated
