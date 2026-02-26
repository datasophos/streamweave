"""m3.5: soft-delete columns, audit_logs, notifications, instrument_requests

Revision ID: a1b2c3d4e5f6
Revises: 285a94f840e1
Create Date: 2026-02-25 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "285a94f840e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- soft-delete columns ---
    for table in (
        "users",
        "instruments",
        "service_accounts",
        "storage_locations",
        "harvest_schedules",
        "hook_configs",
        "groups",
        "projects",
    ):
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column(
            "action",
            sa.Enum("create", "update", "delete", "restore", name="auditaction"),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("actor_email", sa.String(length=320), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- notifications ---
    op.create_table(
        "notifications",
        sa.Column("recipient_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("link", sa.String(length=1024), nullable=True),
        sa.Column("read", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- instrument_requests ---
    op.create_table(
        "instrument_requests",
        sa.Column("requester_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("harvest_frequency", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="instrumentrequeststatus"),
            nullable=False,
        ),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("instrument_requests")
    op.drop_table("notifications")
    op.drop_table("audit_logs")

    for table in (
        "projects",
        "groups",
        "hook_configs",
        "harvest_schedules",
        "storage_locations",
        "service_accounts",
        "instruments",
        "users",
    ):
        op.drop_column(table, "deleted_at")

    op.execute("DROP TYPE IF EXISTS instrumentrequeststatus")
    op.execute("DROP TYPE IF EXISTS auditaction")
