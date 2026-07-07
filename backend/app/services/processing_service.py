import logging
import uuid

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud.meeting import get_meeting, update_meeting
from app.crud.processing_job import (
    create_processing_job,
    get_processing_job_by_id,
    mark_job_completed,
    mark_job_failed,
    mark_job_started,
    reset_job_for_retry,
    update_job_progress,
)
from app.crud.upload import get_upload
from app.db.session import SessionLocal
from app.models.processing_job import ProcessingJob
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingUpdate
from app.workers.processor import run_preparation, run_processing_steps

logger = logging.getLogger("converra")


def _sync_meeting_status(db: Session, meeting_id: uuid.UUID, user_id: int, meeting_status: str) -> None:
    meeting = get_meeting(db, meeting_id, user_id)
    if meeting is not None:
        update_meeting(db, meeting, MeetingUpdate(status=meeting_status))


def queue_processing_job(db: Session, *, upload: Upload, user: User) -> ProcessingJob:
    """Creates a ProcessingJob for an upload and flips its meeting into "processing".

    Shared by the automatic upload-completion flow and the manual `POST /process`
    endpoint so both go through identical validation and side effects.
    """
    if upload.meeting_id is None:
        raise AppError("Upload is not linked to a meeting", status.HTTP_400_BAD_REQUEST)

    if get_meeting(db, upload.meeting_id, user.id) is None:
        raise AppError("Meeting not found", status.HTTP_404_NOT_FOUND)

    job = create_processing_job(
        db, upload_id=upload.id, meeting_id=upload.meeting_id, user_id=user.id
    )
    _sync_meeting_status(db, upload.meeting_id, user.id, "processing")
    return job


def retry_processing_job(db: Session, job: ProcessingJob) -> ProcessingJob:
    if job.status != "failed":
        raise AppError("Only failed jobs can be retried", status.HTTP_400_BAD_REQUEST)

    job = reset_job_for_retry(db, job)
    _sync_meeting_status(db, job.meeting_id, job.user_id, "processing")
    return job


async def execute_processing_job(job_id: uuid.UUID) -> None:
    """Runs one ProcessingJob through Preparing -> Processing -> Completed/Failed.

    Invoked via FastAPI `BackgroundTasks` after the response has already been
    sent, so it opens its own DB session rather than reusing the request's.
    Re-fetches the job before each state transition so a job deleted mid-run
    (cancelled) simply stops instead of erroring.
    """
    db = SessionLocal()
    try:
        job = get_processing_job_by_id(db, job_id)
        if job is None:
            return

        upload = get_upload(db, job.upload_id, job.user_id)
        worker_name = f"sim-worker-{job.id.hex[:8]}"
        job = mark_job_started(db, job, worker_name=worker_name)

        await run_preparation()

        job = get_processing_job_by_id(db, job_id)
        if job is None:
            return
        job = update_job_progress(db, job, status="processing", stage="Processing", progress=10)

        async for label, progress in run_processing_steps():
            job = get_processing_job_by_id(db, job_id)
            if job is None:
                return
            job = update_job_progress(db, job, status="processing", stage=label, progress=progress)

        job = get_processing_job_by_id(db, job_id)
        if job is None:
            return
        mark_job_completed(db, job)
        _sync_meeting_status(db, job.meeting_id, job.user_id, "completed")
        logger.info(
            "Processing job %s completed for upload %s", job.id, upload.id if upload else job.upload_id
        )
    except Exception as exc:  # noqa: BLE001 (worker failure must never crash the task loop)
        logger.exception("Processing job %s failed", job_id, exc_info=exc)
        job = get_processing_job_by_id(db, job_id)
        if job is not None:
            mark_job_failed(db, job, error_message=str(exc))
            _sync_meeting_status(db, job.meeting_id, job.user_id, "failed")
    finally:
        db.close()
