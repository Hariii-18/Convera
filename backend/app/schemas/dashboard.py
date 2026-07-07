from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_meetings: int
    storage_used_bytes: int
    currently_processing: int
    queued_jobs: int
    completed_today: int
    failed_jobs: int
