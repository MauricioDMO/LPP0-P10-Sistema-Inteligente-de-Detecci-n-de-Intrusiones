"""create suricata management tables

Revision ID: 0003_create_suricata_management
Revises: 0002_add_user_token_version
Create Date: 2026-05-22 00:00:00.000000
"""

from collections.abc import Sequence
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_create_suricata_management"
down_revision: str | None = "0002_add_user_token_version"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "suricata_profiles",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("mode", sa.String(length=10), nullable=False),
        sa.Column("sensitivity", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("mode IN ('IDS', 'IPS')", name="ck_suricata_profiles_mode"),
        sa.CheckConstraint("sensitivity IN ('low', 'medium', 'high')", name="ck_suricata_profiles_sensitivity"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "suricata_sources",
        sa.Column("source_name", sa.String(length=160), nullable=False),
        sa.Column("display_name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_name", name="uq_suricata_sources_source_name"),
    )
    op.create_table(
        "suricata_rule_overrides",
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gid", sa.Integer(), server_default="1", nullable=False),
        sa.Column("sid", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("action IN ('enable', 'disable', 'drop', 'alert', 'reject')", name="ck_suricata_rule_overrides_action"),
        sa.ForeignKeyConstraint(["profile_id"], ["suricata_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "gid", "sid", "action", name="uq_suricata_rule_override"),
    )
    op.create_table(
        "suricata_custom_rules",
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rule_text", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("validation_status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("validation_error", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("validation_status IN ('pending', 'valid', 'invalid')", name="ck_suricata_custom_rules_validation_status"),
        sa.ForeignKeyConstraint(["profile_id"], ["suricata_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "suricata_apply_jobs",
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("generated_files", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("command_output", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'running', 'success', 'failed')", name="ck_suricata_apply_jobs_status"),
        sa.ForeignKeyConstraint(["profile_id"], ["suricata_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "suricata_config_versions",
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("apply_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("enable_conf", sa.Text(), nullable=True),
        sa.Column("disable_conf", sa.Text(), nullable=True),
        sa.Column("drop_conf", sa.Text(), nullable=True),
        sa.Column("modify_conf", sa.Text(), nullable=True),
        sa.Column("local_rules", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('applied', 'failed', 'rolled_back')", name="ck_suricata_config_versions_status"),
        sa.ForeignKeyConstraint(["apply_job_id"], ["suricata_apply_jobs.id"]),
        sa.ForeignKeyConstraint(["profile_id"], ["suricata_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.bulk_insert(
        sa.table(
            "suricata_sources",
            sa.column("id", postgresql.UUID),
            sa.column("source_name", sa.String),
            sa.column("display_name", sa.String),
            sa.column("description", sa.Text),
            sa.column("enabled", sa.Boolean),
        ),
        [
            {"id": uuid.uuid4(), "source_name": "et/open", "display_name": "ET Open", "description": "Emerging Threats Open ruleset", "enabled": False},
            {"id": uuid.uuid4(), "source_name": "abuse.ch/urlhaus", "display_name": "abuse.ch URLhaus", "description": "URLhaus malware URL rules", "enabled": False},
            {"id": uuid.uuid4(), "source_name": "abuse.ch/feodotracker", "display_name": "abuse.ch FeodoTracker", "description": "Feodo botnet tracker rules", "enabled": False},
            {"id": uuid.uuid4(), "source_name": "abuse.ch/sslbl-blacklist", "display_name": "abuse.ch SSLBL Blacklist", "description": "SSL certificate blacklist rules", "enabled": False},
            {"id": uuid.uuid4(), "source_name": "oisf/trafficid", "display_name": "OISF Traffic ID", "description": "Traffic identification rules", "enabled": False},
        ],
    )


def downgrade() -> None:
    op.drop_table("suricata_config_versions")
    op.drop_table("suricata_apply_jobs")
    op.drop_table("suricata_custom_rules")
    op.drop_table("suricata_rule_overrides")
    op.drop_table("suricata_sources")
    op.drop_table("suricata_profiles")
