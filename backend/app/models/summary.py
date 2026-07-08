import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Summary(Base):
    __tablename__ = "summaries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)
    topics: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    decisions: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    action_items: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    risks: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    open_questions: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    next_steps: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
