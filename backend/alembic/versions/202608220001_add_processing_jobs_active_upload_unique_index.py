"""add partial unique index preventing duplicate active processing jobs per upload

Revision ID: 202608220001
Revises: 202608210001
Create Date: 2026-08-22 00:01:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202608220001"
down_revision: Union[str, None] = "202608210001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_processing_jobs_upload_active",
        "processing_jobs",
        ["upload_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'preparing', 'processing')"),
    )


def downgrade() -> None:
    op.drop_index("uq_processing_jobs_upload_active", table_name="processing_jobs")
