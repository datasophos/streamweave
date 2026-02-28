"""add requester_email and notification dismissed_at

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-27 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "instrument_requests",
        sa.Column("requester_email", sa.String(320), nullable=True),
    )
    op.execute(
        "UPDATE instrument_requests "
        "SET requester_email = ("
        "  SELECT email FROM users WHERE users.id = instrument_requests.requester_id"
        ")"
    )
    op.add_column(
        "notifications",
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notifications", "dismissed_at")
    op.drop_column("instrument_requests", "requester_email")
