"""add normalized transcript columns

Revision ID: 202607090001
Revises: 202607080001
Create Date: 2026-07-09 00:01:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202607090001"
down_revision: Union[str, None] = "202607080001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transcripts", sa.Column("normalized_transcript", sa.Text(), nullable=True))
    op.add_column(
        "transcripts",
        sa.Column("normalized_segments", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "transcripts", sa.Column("normalized_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("transcripts", "normalized_at")
    op.drop_column("transcripts", "normalized_segments")
    op.drop_column("transcripts", "normalized_transcript")
