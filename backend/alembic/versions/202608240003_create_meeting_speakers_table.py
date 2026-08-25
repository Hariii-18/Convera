"""create meeting_speakers table

Revision ID: 202608240003
Revises: 202608240002
Create Date: 2026-08-24 00:03:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202608240003"
down_revision: Union[str, None] = "202608240002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "meeting_speakers",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("speaker_key", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=255), nullable=True),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
    )
    op.create_index(
        op.f("ix_meeting_speakers_meeting_id"), "meeting_speakers", ["meeting_id"]
    )
    op.create_index(
        "uq_meeting_speakers_meeting_id_speaker_key",
        "meeting_speakers",
        ["meeting_id", "speaker_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_meeting_speakers_meeting_id_speaker_key", table_name="meeting_speakers")
    op.drop_index(op.f("ix_meeting_speakers_meeting_id"), table_name="meeting_speakers")
    op.drop_table("meeting_speakers")
