import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Statuses that represent a job still in flight. A job in one of these
# statuses is what "duplicate processing" protection guards against -
# completed/failed jobs are historical and never block a new one.
ACTIVE_STATUSES = ("queued", "preparing", "processing")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    __table_args__ = (
        # Enforces "at most one active job per upload" at the database level
        # so concurrent requests can't both insert an active job for the same
        # upload - the loser's INSERT raises IntegrityError instead of
        # silently creating a duplicate. Historical (completed/failed) rows
        # are excluded so reprocessing an upload after a prior run finished
        # is never blocked.
        Index(
            "uq_processing_jobs_upload_active",
            "upload_id",
            unique=True,
            postgresql_where=text("status IN ('queued', 'preparing', 'processing')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    upload_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50), default="queued", server_default="queued", nullable=False
    )
    progress: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    stage: Mapped[str] = mapped_column(
        String(100), default="Queued", server_default="Queued", nullable=False
    )
    worker_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
