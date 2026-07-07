import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.crud.meeting import get_meeting
from app.crud.upload import (
    create_upload,
    get_upload,
    list_uploads,
    mark_upload_completed,
    mark_upload_failed,
    soft_delete_upload,
    upload_exists_with_filename,
)
from app.db.session import get_db
from app.models.upload import Upload
from app.models.user import User
from app.schemas.upload import UploadRead
from app.services.storage_service import StorageError, delete_file, upload_file
from app.services.upload_validation import (
    build_storage_path,
    build_stored_filename,
    get_validated_extension,
    sanitize_filename,
)

logger = logging.getLogger("converra")

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _get_owned_upload(db: Session, upload_id: uuid.UUID, current_user: User) -> Upload:
    upload = get_upload(db, upload_id, current_user.id)
    if upload is None:
        raise AppError("Upload not found", status.HTTP_404_NOT_FOUND)
    return upload


@router.post("", response_model=UploadRead, status_code=status.HTTP_201_CREATED)
async def create(
    request: Request,
    file: UploadFile = File(...),
    meeting_id: uuid.UUID | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Upload:
    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024

    content_length = request.headers.get("content-length")
    if content_length is not None and int(content_length) > max_bytes:
        raise AppError(
            f"File exceeds the {settings.max_upload_size_mb}MB limit",
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    if meeting_id is not None and get_meeting(db, meeting_id, current_user.id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    original_filename = sanitize_filename(file.filename or "upload")
    extension = get_validated_extension(original_filename, file.content_type)

    contents = await file.read()
    size_bytes = len(contents)

    if size_bytes == 0:
        raise AppError("File is empty", status.HTTP_400_BAD_REQUEST)
    if size_bytes > max_bytes:
        raise AppError(
            f"File exceeds the {settings.max_upload_size_mb}MB limit",
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    if upload_exists_with_filename(db, current_user.id, original_filename):
        raise AppError(
            f"A file named '{original_filename}' has already been uploaded",
            status.HTTP_409_CONFLICT,
        )

    stored_filename = build_stored_filename(extension)
    storage_path = build_storage_path(current_user.id, stored_filename)
    bucket = settings.supabase_storage_bucket
    mime_type = file.content_type or "application/octet-stream"

    upload = create_upload(
        db,
        user_id=current_user.id,
        meeting_id=meeting_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        storage_path=storage_path,
        bucket=bucket,
        mime_type=mime_type,
        size_bytes=size_bytes,
    )

    try:
        upload_file(storage_path, contents, content_type=mime_type, bucket=bucket)
    except StorageError as exc:
        logger.exception("Upload storage failure", exc_info=exc)
        mark_upload_failed(db, upload)
        raise AppError("Failed to upload file to storage", status.HTTP_502_BAD_GATEWAY) from exc

    return mark_upload_completed(db, upload)


@router.get("", response_model=list[UploadRead])
def list_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Upload]:
    return list_uploads(db, current_user.id)


@router.get("/{upload_id}", response_model=UploadRead)
def get(
    upload_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Upload:
    return _get_owned_upload(db, upload_id, current_user)


@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    upload_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    upload = _get_owned_upload(db, upload_id, current_user)

    try:
        delete_file(upload.storage_path, bucket=upload.bucket)
    except StorageError as exc:
        logger.exception("Failed to delete storage object during upload deletion", exc_info=exc)

    soft_delete_upload(db, upload)
