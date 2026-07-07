import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import AppError
from app.crud.processing_job import (
    delete_processing_job,
    get_processing_job,
    list_processing_jobs,
)
from app.crud.upload import get_upload
from app.db.session import get_db
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.schemas.processing_job import ProcessingJobCreate, ProcessingJobRead
from app.services.processing_service import queue_processing_job, retry_processing_job
from app.workers.processing_worker import run_processing_job

router = APIRouter(prefix="/process", tags=["processing"])


def _get_owned_job(db: Session, job_id: uuid.UUID, current_user: User) -> ProcessingJob:
    job = get_processing_job(db, job_id, current_user.id)
    if job is None:
        raise AppError("Processing job not found", status.HTTP_404_NOT_FOUND)
    return job


@router.post("", response_model=ProcessingJobRead, status_code=status.HTTP_201_CREATED)
def create(
    job_in: ProcessingJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProcessingJob:
    upload = get_upload(db, job_in.upload_id, current_user.id)
    if upload is None:
        raise AppError("Upload not found", status.HTTP_404_NOT_FOUND)

    job = queue_processing_job(db, upload=upload, user=current_user)
    background_tasks.add_task(run_processing_job, job.id)
    return job


@router.get("", response_model=list[ProcessingJobRead])
def list_all(
    meeting_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProcessingJob]:
    return list_processing_jobs(db, current_user.id, meeting_id=meeting_id)


@router.get("/{job_id}", response_model=ProcessingJobRead)
def get(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProcessingJob:
    return _get_owned_job(db, job_id, current_user)


@router.post("/{job_id}/retry", response_model=ProcessingJobRead)
def retry(
    job_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProcessingJob:
    job = _get_owned_job(db, job_id, current_user)
    job = retry_processing_job(db, job)
    background_tasks.add_task(run_processing_job, job.id)
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    job = _get_owned_job(db, job_id, current_user)
    delete_processing_job(db, job)
