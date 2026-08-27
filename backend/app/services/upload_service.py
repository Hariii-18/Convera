import logging
from datetime import datetime, timezone

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.processing_job import list_processing_jobs_by_upload_id
from app.crud.summary import get_summary_by_meeting_id
from app.crud.transcript import get_transcript_by_meeting_id
from app.models.upload import Upload
from app.services.storage_service import StorageError, delete_file

logger = logging.getLogger("converra")


def delete_upload_cascade(db: Session, upload: Upload) -> None:
    """Deletes a single upload and every record exclusively owned by it.

    That's the upload's processing jobs (`processing_jobs.upload_id` is a
    non-nullable FK to this upload, so a job can't outlive it) and, if this
    upload is the one that produced the meeting's current transcript
    (`transcripts.upload_id` is likewise a non-nullable FK), that transcript
    and its derived summary — mirroring `upsert_transcript`'s rule that a
    summary never outlives the transcript it was generated from.

    The meeting itself, and anything else attached to it (a Live Meeting
    session, other uploads), is left untouched: an upload does not own its
    meeting, so deleting one must never delete the other.

    Mirrors `delete_meeting_cascade`: DB-level `ondelete="CASCADE"` never
    fires because the upload is soft-deleted (its row is never actually
    removed), so this function does the cascade itself, in one transaction —
    either it all commits, or nothing does and the caller sees an error
    instead of a partially-deleted state.

    Storage-object deletion is best-effort (logged, not fatal), the same
    pattern used by `delete_meeting_cascade`.
    """
    try:
        delete_file(upload.storage_path, bucket=upload.bucket)
    except StorageError as exc:
        logger.exception(
            "Failed to delete storage object for upload %s during upload deletion",
            upload.id,
            exc_info=exc,
        )

    try:
        for job in list_processing_jobs_by_upload_id(db, upload.id):
            db.delete(job)

        if upload.meeting_id is not None:
            transcript = get_transcript_by_meeting_id(db, upload.meeting_id)
            if transcript is not None and transcript.upload_id == upload.id:
                db.delete(transcript)

                summary = get_summary_by_meeting_id(db, upload.meeting_id)
                if summary is not None:
                    db.delete(summary)

        upload.status = "deleted"
        upload.deleted_at = datetime.now(timezone.utc)

        db.commit()
    except Exception as exc:  # noqa: BLE001 (must never falsely report success)
        db.rollback()
        logger.exception("Upload %s cascade delete failed", upload.id, exc_info=exc)
        raise AppError(
            "Failed to delete upload and its related data. Nothing was deleted.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ) from exc
