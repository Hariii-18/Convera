"""add nullable produced_by_job_id fk on transcripts to distinguish same-job retries from new reprocessing jobs

Revision ID: 202608240001
Revises: 202608220001
Create Date: 2026-08-24 00:01:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202608240001"
down_revision: Union[str, None] = "202608220001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Existing rows have no known producing job (they predate this column) and
# stay NULL after this migration. `execute_processing_job` treats NULL as
# "not produced by this job", the safe default: a retry of a job whose
# transcript predates this migration re-transcribes once more instead of
# resuming, then backfills produced_by_job_id so subsequent retries of that
# same job resume correctly.


def upgrade() -> None:
    op.add_column(
        "transcripts",
        sa.Column("produced_by_job_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        op.f("ix_transcripts_produced_by_job_id"),
        "transcripts",
        ["produced_by_job_id"],
    )
    op.create_foreign_key(
        "fk_transcripts_produced_by_job_id_processing_jobs",
        "transcripts",
        "processing_jobs",
        ["produced_by_job_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_transcripts_produced_by_job_id_processing_jobs", "transcripts", type_="foreignkey"
    )
    op.drop_index(op.f("ix_transcripts_produced_by_job_id"), table_name="transcripts")
    op.drop_column("transcripts", "produced_by_job_id")
