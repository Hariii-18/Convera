import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.processing_job import ProcessingJob
from app.schemas.processing_job import ProcessingStats


def create_processing_job(
    db: Session,
    *,
    upload_id: uuid.UUID,
    meeting_id: uuid.UUID,
    user_id: int,
) -> ProcessingJob:
    job = ProcessingJob(
        upload_id=upload_id,
        meeting_id=meeting_id,
        user_id=user_id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_processing_job(db: Session, job_id: uuid.UUID, user_id: int) -> ProcessingJob | None:
    return (
        db.query(ProcessingJob)
        .filter(ProcessingJob.id == job_id, ProcessingJob.user_id == user_id)
        .first()
    )


def get_processing_job_by_id(db: Session, job_id: uuid.UUID) -> ProcessingJob | None:
    """Ownerless lookup for the background worker, which runs outside a request context."""
    return db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()


def list_processing_jobs(
    db: Session, user_id: int, *, meeting_id: uuid.UUID | None = None
) -> list[ProcessingJob]:
    query = db.query(ProcessingJob).filter(ProcessingJob.user_id == user_id)
    if meeting_id is not None:
        query = query.filter(ProcessingJob.meeting_id == meeting_id)
    return query.order_by(ProcessingJob.created_at.desc()).all()


def update_job_progress(
    db: Session,
    job: ProcessingJob,
    *,
    status: str,
    stage: str,
    progress: int,
) -> ProcessingJob:
    job.status = status
    job.stage = stage
    job.progress = progress
    db.commit()
    db.refresh(job)
    return job


def mark_job_started(db: Session, job: ProcessingJob, *, worker_name: str) -> ProcessingJob:
    job.status = "preparing"
    job.stage = "Preparing"
    job.progress = 5
    job.worker_name = worker_name
    job.attempts += 1
    job.started_at = datetime.now(timezone.utc)
    job.completed_at = None
    job.error_message = None
    db.commit()
    db.refresh(job)
    return job


def mark_job_completed(db: Session, job: ProcessingJob) -> ProcessingJob:
    job.status = "completed"
    job.stage = "Completed"
    job.progress = 100
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return job


def mark_job_failed(db: Session, job: ProcessingJob, *, error_message: str) -> ProcessingJob:
    job.status = "failed"
    job.stage = "Failed"
    job.error_message = error_message
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return job


def reset_job_for_retry(db: Session, job: ProcessingJob) -> ProcessingJob:
    job.status = "queued"
    job.stage = "Queued"
    job.progress = 0
    job.error_message = None
    job.started_at = None
    job.completed_at = None
    db.commit()
    db.refresh(job)
    return job


def delete_processing_job(db: Session, job: ProcessingJob) -> None:
    db.delete(job)
    db.commit()


def get_processing_stats(db: Session, user_id: int) -> ProcessingStats:
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    base_query = db.query(ProcessingJob).filter(ProcessingJob.user_id == user_id)

    currently_processing = base_query.filter(
        ProcessingJob.status.in_(["preparing", "processing"])
    ).count()
    queued_jobs = base_query.filter(ProcessingJob.status == "queued").count()
    completed_today = base_query.filter(
        ProcessingJob.status == "completed",
        ProcessingJob.completed_at >= today_start,
    ).count()
    failed_jobs = base_query.filter(ProcessingJob.status == "failed").count()

    return ProcessingStats(
        currently_processing=currently_processing,
        queued_jobs=queued_jobs,
        completed_today=completed_today,
        failed_jobs=failed_jobs,
    )
