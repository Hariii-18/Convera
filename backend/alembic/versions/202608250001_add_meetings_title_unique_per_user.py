"""add partial unique index preventing duplicate meeting titles per user

Revision ID: 202608250001
Revises: 202608240003
Create Date: 2026-08-25 00:01:00

"""
from typing import Sequence, Union

from alembic import op

revision: str = "202608250001"
down_revision: Union[str, None] = "202608240003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Case/whitespace-insensitive uniqueness of `title` per `user_id`, scoped
    # to non-deleted meetings (a soft-deleted meeting's title is historical
    # and must not block reuse -- see `meeting_service.delete_meeting_cascade`,
    # which soft-deletes via `deleted_at` rather than removing the row).
    # Applies uniformly to recorded and Live Meeting rows alike: both go
    # through the same `meetings` table and the same `crud.meeting.create_meeting`
    # / `update_meeting` functions. This is the last-line-of-defense backstop
    # for the application-level check in those functions, closing the race
    # window between two concurrent requests for the same title.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_meetings_user_title_ci
        ON meetings (user_id, lower(btrim(title)))
        WHERE deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("uq_meetings_user_title_ci", table_name="meetings")
