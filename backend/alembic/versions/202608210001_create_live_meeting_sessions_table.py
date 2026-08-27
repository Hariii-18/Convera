"""create live_meeting_sessions table

Revision ID: 202608210001
Revises: 202607100001
Create Date: 2026-08-21 00:01:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202608210001"
down_revision: Union[str, None] = "202607100001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "live_meeting_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(length=50), nullable=False, server_default="live"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "session_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("meeting_id", name="uq_live_meeting_sessions_meeting_id"),
    )
    op.create_index(
        op.f("ix_live_meeting_sessions_meeting_id"), "live_meeting_sessions", ["meeting_id"]
    )
    op.create_index(
        op.f("ix_live_meeting_sessions_user_id"), "live_meeting_sessions", ["user_id"]
    )
    # Enforces "only one active live session per user" at the database level
    # so two concurrent `POST /live-meetings/start` requests from the same
    # user can't both create a session — the second raises an IntegrityError
    # that the service layer catches and turns into the existing active
    # session (idempotent start). Partial index: rows in a terminal state
    # (completed/failed/cancelled) don't count, so a user can freely start a
    # new live meeting after a previous one has ended.
    op.create_index(
        "ix_live_meeting_sessions_active_user",
        "live_meeting_sessions",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("state IN ('live', 'stopping', 'finalizing')"),
    )


def downgrade() -> None:
    op.drop_index("ix_live_meeting_sessions_active_user", table_name="live_meeting_sessions")
    op.drop_index(
        op.f("ix_live_meeting_sessions_user_id"), table_name="live_meeting_sessions"
    )
    op.drop_index(
        op.f("ix_live_meeting_sessions_meeting_id"), table_name="live_meeting_sessions"
    )
    op.drop_table("live_meeting_sessions")
