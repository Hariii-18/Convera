import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# The only status transitions ever produced by the app's actual lifecycle
# code: recorded-upload processing (processing_service._sync_meeting_status)
# and Live Meeting lifecycle sync (live_meeting_service, which maps
# live/stopping/finalizing -> processing, completed -> completed, failed ->
# failed). Same edges either way: initial queueing, success/failure of a
# run, retrying a failed run, and reprocessing an already-completed meeting
# (queue_processing_job treats completed/failed jobs as historical and never
# blocks a new one). Nothing outside these edges is a legitimate transition,
# so PATCH /meetings/{id} does not expose `status` at all - only these
# internal call sites drive it.
MEETING_STATUS_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "scheduled": ("processing",),
    "processing": ("completed", "failed"),
    "completed": ("processing",),
    "failed": ("processing",),
}


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="scheduled", server_default="scheduled", nullable=False
    )
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    participants_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
