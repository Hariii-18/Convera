import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.upload import Upload


def create_upload(
    db: Session,
    *,
    user_id: int,
    meeting_id: uuid.UUID | None,
    original_filename: str,
    stored_filename: str,
    storage_path: str,
    bucket: str,
    mime_type: str,
    size_bytes: int,
) -> Upload:
    upload = Upload(
        user_id=user_id,
        meeting_id=meeting_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        storage_path=storage_path,
        bucket=bucket,
        mime_type=mime_type,
        size_bytes=size_bytes,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


def list_uploads(db: Session, user_id: int) -> list[Upload]:
    return (
        db.query(Upload)
        .filter(Upload.user_id == user_id, Upload.deleted_at.is_(None))
        .order_by(Upload.created_at.desc())
        .all()
    )


def get_upload(db: Session, upload_id: uuid.UUID, user_id: int) -> Upload | None:
    return (
        db.query(Upload)
        .filter(
            Upload.id == upload_id,
            Upload.user_id == user_id,
            Upload.deleted_at.is_(None),
        )
        .first()
    )


def list_uploads_by_meeting_id(db: Session, meeting_id: uuid.UUID) -> list[Upload]:
    return (
        db.query(Upload)
        .filter(Upload.meeting_id == meeting_id, Upload.deleted_at.is_(None))
        .all()
    )


def upload_exists_with_filename(db: Session, user_id: int, original_filename: str) -> bool:
    return (
        db.query(Upload.id)
        .filter(
            Upload.user_id == user_id,
            Upload.original_filename == original_filename,
            Upload.deleted_at.is_(None),
        )
        .first()
        is not None
    )


def mark_upload_completed(db: Session, upload: Upload) -> Upload:
    upload.status = "uploaded"
    db.commit()
    db.refresh(upload)
    return upload


def mark_upload_failed(db: Session, upload: Upload) -> Upload:
    upload.status = "failed"
    db.commit()
    db.refresh(upload)
    return upload


def get_total_upload_size_bytes(db: Session, user_id: int) -> int:
    total = (
        db.query(func.coalesce(func.sum(Upload.size_bytes), 0))
        .filter(Upload.user_id == user_id, Upload.deleted_at.is_(None))
        .scalar()
    )
    return int(total)
