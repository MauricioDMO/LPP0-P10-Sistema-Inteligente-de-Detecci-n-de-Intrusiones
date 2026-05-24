"""Suricata policy management models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SuricataProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "suricata_profiles"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    sensitivity: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    overrides: Mapped[list["SuricataRuleOverride"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", lazy="selectin"
    )
    custom_rules: Mapped[list["SuricataCustomRule"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", lazy="selectin"
    )


class SuricataSource(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "suricata_sources"
    __table_args__ = (UniqueConstraint("source_name", name="uq_suricata_sources_source_name"),)

    source_name: Mapped[str] = mapped_column(String(160), nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")


class SuricataRuleOverride(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "suricata_rule_overrides"
    __table_args__ = (UniqueConstraint("profile_id", "gid", "sid", "action", name="uq_suricata_rule_override"),)

    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suricata_profiles.id", ondelete="CASCADE"), nullable=False)
    gid: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    sid: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    profile: Mapped[SuricataProfile] = relationship(back_populates="overrides")


class SuricataCustomRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "suricata_custom_rules"

    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suricata_profiles.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    rule_text: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    validation_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="pending")
    validation_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    profile: Mapped[SuricataProfile] = relationship(back_populates="custom_rules")


class SuricataApplyJob(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "suricata_apply_jobs"

    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suricata_profiles.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generated_files: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    command_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SuricataConfigVersion(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "suricata_config_versions"

    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suricata_profiles.id"), nullable=False)
    apply_job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("suricata_apply_jobs.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    enable_conf: Mapped[str | None] = mapped_column(Text, nullable=True)
    disable_conf: Mapped[str | None] = mapped_column(Text, nullable=True)
    drop_conf: Mapped[str | None] = mapped_column(Text, nullable=True)
    modify_conf: Mapped[str | None] = mapped_column(Text, nullable=True)
    local_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SuricataNotificationSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "suricata_notification_settings"

    telegram_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    telegram_chat_recipients: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    buffer_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    buffer_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5, server_default="5")
    timezone: Mapped[str] = mapped_column(String(40), nullable=False, default="UTC", server_default="UTC")
