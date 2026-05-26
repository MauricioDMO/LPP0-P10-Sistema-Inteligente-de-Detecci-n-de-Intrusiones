"""add list entry notification preference

Revision ID: 0007_add_list_entry_notifications
Revises: 0006_add_suricata_lists
Create Date: 2026-05-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_add_list_entry_notifications"
down_revision: str | None = "0006_add_suricata_lists"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "suricata_list_entries",
        sa.Column("notify_enabled", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("suricata_list_entries", "notify_enabled")
