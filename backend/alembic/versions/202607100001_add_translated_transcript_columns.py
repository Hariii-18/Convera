"""add translated transcript columns

Revision ID: 202607100001
Revises: 202607090001
Create Date: 2026-07-10 00:01:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202607100001"
down_revision: Union[str, None] = "202607090001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transcripts", sa.Column("translated_transcript", sa.Text(), nullable=True))
    op.add_column(
        "transcripts",
        sa.Column("translated_segments", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("transcripts", sa.Column("translated_language", sa.String(length=10), nullable=True))
    op.add_column(
        "transcripts", sa.Column("translated_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("transcripts", "translated_at")
    op.drop_column("transcripts", "translated_language")
    op.drop_column("transcripts", "translated_segments")
    op.drop_column("transcripts", "translated_transcript")
