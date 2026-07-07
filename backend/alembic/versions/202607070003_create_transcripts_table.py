"""create transcripts table

Revision ID: 202607070003
Revises: 202607070002
Create Date: 2026-07-07 00:03:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202607070003"
down_revision: Union[str, None] = "202607070002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "transcripts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("upload_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=False),
        sa.Column("segments", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["upload_id"], ["uploads.id"], ondelete="CASCADE"),
    )
    op.create_index(
        op.f("ix_transcripts_meeting_id"), "transcripts", ["meeting_id"], unique=True
    )
    op.create_index(op.f("ix_transcripts_upload_id"), "transcripts", ["upload_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_transcripts_upload_id"), table_name="transcripts")
    op.drop_index(op.f("ix_transcripts_meeting_id"), table_name="transcripts")
    op.drop_table("transcripts")
