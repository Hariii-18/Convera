"""create meetings table

Revision ID: 202607060002
Revises: 202607060001
Create Date: 2026-07-06 00:02:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202607060002"
down_revision: Union[str, None] = "202607040001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "meetings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "status", sa.String(length=50), nullable=False, server_default="scheduled"
        ),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("participants_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_meetings_user_id"), "meetings", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_meetings_user_id"), table_name="meetings")
    op.drop_table("meetings")
