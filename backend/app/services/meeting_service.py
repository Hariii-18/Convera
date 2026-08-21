import logging
from datetime import datetime, timezone

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.processing_job import list_processing_jobs
from app.crud.summary import get_summary_by_meeting_id
from app.crud.transcript import get_transcript_by_meeting_id
from app.crud.upload import list_uploads_by_meeting_id
from app.models.meeting import Meeting
from app.services.storage_service import StorageError, delete_file

logger = logging.getLogger("converra")


def delete_meeting_cascade(db: Session, meeting: Meeting) -> None:
    """Deletes a meeting and every record that belongs to it: its uploads
    (DB row + Supabase Storage object), processing jobs, transcript, and
    summary.

    The DB-level `ondelete="CASCADE"`/`"SET NULL"` on these tables' foreign
    keys never fires here because a meeting is soft-deleted (its row is
    never actually removed), so this function does the cascade itself. All
    of it runs as one transaction — one `commit()` at the end — so a
    mid-cascade failure leaves nothing orphaned and nothing falsely marked
    deleted; either the whole cascade commits, or the session is rolled
    back and the caller sees an error instead of a false success.

    Storage-object deletion is best-effort (logged, not fatal), mirroring
    the single-upload delete endpoint: a Supabase outage shouldn't block
    someone from deleting a meeting whose DB records we can still remove.
    """
    uploads = list_uploads_by_meeting_id(db, meeting.id)

    for upload in uploads:
        try:
            delete_file(upload.storage_path, bucket=upload.bucket)
        except StorageError as exc:
            logger.exception(
                "Failed to delete storage object for upload %s during meeting %s deletion",
                upload.id,
                meeting.id,
                exc_info=exc,
            )

    try:
        now = datetime.now(timezone.utc)

        for job in list_processing_jobs(db, meeting.user_id, meeting_id=meeting.id):
            db.delete(job)

        transcript = get_transcript_by_meeting_id(db, meeting.id)
        if transcript is not None:
            db.delete(transcript)

        summary = get_summary_by_meeting_id(db, meeting.id)
        if summary is not None:
            db.delete(summary)

        for upload in uploads:
            upload.status = "deleted"
            upload.deleted_at = now

        meeting.deleted_at = now

        db.commit()
    except Exception as exc:  # noqa: BLE001 (must never falsely report success)
        db.rollback()
        logger.exception("Meeting %s cascade delete failed", meeting.id, exc_info=exc)
        raise AppError(
            "Failed to delete meeting and its related data. Nothing was deleted.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        ) from exc
