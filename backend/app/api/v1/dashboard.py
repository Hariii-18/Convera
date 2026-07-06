from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.crud.meeting import get_meeting_status_counts
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
    return DashboardStats(
        total_meetings=sum(counts.values()),
        completed_meetings=counts.get("completed", 0),
        processing_meetings=counts.get("processing", 0),
        failed_meetings=counts.get("failed", 0),
        storage_used_bytes=0,
    )
