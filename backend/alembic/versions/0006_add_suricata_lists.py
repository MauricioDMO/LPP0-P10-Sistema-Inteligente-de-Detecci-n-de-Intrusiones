"""add suricata list entries

Revision ID: 0006_add_suricata_lists
Revises: 0005_add_suricata_notifications
Create Date: 2026-05-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_add_suricata_lists"
down_revision: str | None = "0005_add_suricata_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "suricata_list_entries",
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("list_type", sa.String(length=10), nullable=False),
        sa.Column("entry_type", sa.String(length=10), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("direction", sa.String(length=20), server_default="destination", nullable=False),
        sa.Column("action", sa.String(length=10), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("generated_rule_ids", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("list_type IN ('block', 'allow')", name="ck_suricata_list_entries_list_type"),
        sa.CheckConstraint("entry_type IN ('domain', 'ip', 'cidr')", name="ck_suricata_list_entries_entry_type"),
        sa.CheckConstraint("direction IN ('source', 'destination', 'both')", name="ck_suricata_list_entries_direction"),
        sa.CheckConstraint("action IN ('drop', 'reject', 'pass')", name="ck_suricata_list_entries_action"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["profile_id"], ["suricata_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "list_type", "entry_type", "value", "direction", name="uq_suricata_list_entry"),
    )


def downgrade() -> None:
    op.drop_table("suricata_list_entries")
