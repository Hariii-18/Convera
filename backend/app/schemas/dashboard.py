from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_meetings: int
    completed_meetings: int
    processing_meetings: int
    failed_meetings: int
    storage_used_bytes: int
