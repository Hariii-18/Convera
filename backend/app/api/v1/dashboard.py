from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.crud.meeting import get_meeting_status_counts
from app.crud.processing_job import get_processing_stats
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardStats:
    counts = get_meeting_status_counts(db, current_user.id)
    processing_stats = get_processing_stats(db, current_user.id)
    return DashboardStats(
        total_meetings=sum(counts.values()),
        storage_used_bytes=0,
        currently_processing=processing_stats.currently_processing,
        queued_jobs=processing_stats.queued_jobs,
        completed_today=processing_stats.completed_today,
        failed_jobs=processing_stats.failed_jobs,
    )
