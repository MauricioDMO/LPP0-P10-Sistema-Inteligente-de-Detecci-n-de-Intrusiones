"""add suricata notification settings

Revision ID: 0005_add_suricata_notifications
Revises: 0004_fix_suricata_source_names
Create Date: 2026-05-23 00:00:00.000000
"""

from collections.abc import Sequence
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_add_suricata_notifications"
down_revision: str | None = "0004_fix_suricata_source_names"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "suricata_rule_overrides",
        sa.Column("notify_enabled", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "suricata_custom_rules",
        sa.Column("notify_enabled", sa.Boolean(), server_default="false", nullable=False),
    )
    op.create_table(
        "suricata_notification_settings",
        sa.Column("telegram_enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("telegram_chat_recipients", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("buffer_enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("buffer_minutes", sa.Integer(), server_default="5", nullable=False),
        sa.Column("timezone", sa.String(length=40), server_default="UTC", nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.bulk_insert(
        sa.table(
            "suricata_notification_settings",
            sa.column("id", postgresql.UUID),
            sa.column("telegram_enabled", sa.Boolean),
            sa.column("telegram_chat_recipients", postgresql.JSONB),
            sa.column("buffer_enabled", sa.Boolean),
            sa.column("buffer_minutes", sa.Integer),
            sa.column("timezone", sa.String),
        ),
        [
            {
                "id": uuid.uuid4(),
                "telegram_enabled": False,
                "telegram_chat_recipients": [],
                "buffer_enabled": False,
                "buffer_minutes": 5,
                "timezone": "UTC",
            }
        ],
    )


def downgrade() -> None:
    op.drop_table("suricata_notification_settings")
    op.drop_column("suricata_custom_rules", "notify_enabled")
    op.drop_column("suricata_rule_overrides", "notify_enabled")
