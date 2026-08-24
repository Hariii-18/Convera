import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MeetingNotes(Base):
    """Editable, persisted Meeting Notes for a meeting — one row per meeting.

    Auto-created (see `meeting_notes_service.ensure_meeting_notes`) from the
    completed `Transcript`/`Summary` pair once processing finishes, then
    owned by the user from that point on: edits here never write back to
    `Transcript` or `Summary`, and a `Summary` regeneration never overwrites
    an existing row. Deliberately excludes the transcript body (raw or
    normalized) and the live-derived fields (`date_time_utc`/`duration_seconds`
    /`full_transcript`) — those are still composed from `Meeting`/`Transcript`
    at read time (see `MeetingNotesRead`), not duplicated here.
    """

    __tablename__ = "meeting_notes"

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
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    discussion_topics: Mapped[list] = mapped_column(
        JSONB, default=list, server_default="[]", nullable=False
    )
    decisions: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    action_items: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    risks: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    open_questions: Mapped[list] = mapped_column(
        JSONB, default=list, server_default="[]", nullable=False
    )
    next_steps: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    timestamped_discussion: Mapped[list] = mapped_column(
        JSONB, default=list, server_default="[]", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
