"""Suricata management request and response schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

SuricataMode = Literal["IDS", "IPS"]
SuricataSensitivity = Literal["low", "medium", "high"]
RuleAction = Literal["enable", "disable", "drop", "alert", "reject"]
ValidationStatus = Literal["pending", "valid", "invalid"]
JobStatus = Literal["pending", "running", "success", "failed"]
ApplyMode = Literal["auto", "fast", "full"]


class SuricataProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = None
    mode: SuricataMode = "IPS"
    sensitivity: SuricataSensitivity = "medium"


class SuricataProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    mode: SuricataMode | None = None
    sensitivity: SuricataSensitivity | None = None


class SuricataProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    mode: str
    sensitivity: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SuricataSourceUpdate(BaseModel):
    enabled: bool


class SuricataSourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_name: str
    display_name: str
    description: str | None
    enabled: bool
    created_at: datetime
    updated_at: datetime


class RuleOverrideCreate(BaseModel):
    gid: int = Field(default=1, ge=1)
    sid: int = Field(..., ge=1)
    action: RuleAction
    reason: str | None = None
    enabled: bool = True
    notify_enabled: bool = False


class RuleOverrideUpdate(BaseModel):
    gid: int | None = Field(default=None, ge=1)
    sid: int | None = Field(default=None, ge=1)
    action: RuleAction | None = None
    reason: str | None = None
    enabled: bool | None = None
    notify_enabled: bool | None = None


class RuleOverrideResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    gid: int
    sid: int
    action: str
    reason: str | None
    enabled: bool
    notify_enabled: bool
    created_at: datetime
    updated_at: datetime


class CustomRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    description: str | None = None
    rule_text: str = Field(..., min_length=10)
    enabled: bool = True
    notify_enabled: bool = False


class CustomRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    rule_text: str | None = Field(default=None, min_length=10)
    enabled: bool | None = None
    notify_enabled: bool | None = None


class CustomRuleValidateRequest(BaseModel):
    rule_text: str = Field(..., min_length=10)


class CustomRuleValidateResponse(BaseModel):
    status: ValidationStatus
    error: str | None = None


class CustomRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    name: str
    description: str | None
    rule_text: str
    enabled: bool
    notify_enabled: bool
    validation_status: str
    validation_error: str | None
    created_at: datetime
    updated_at: datetime


class ApplyRequest(BaseModel):
    profile_id: UUID | None = None
    mode: ApplyMode = "auto"


class ApplyJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    generated_files: dict | None
    command_output: str | None
    error_message: str | None
    created_at: datetime


class SuricataStatusResponse(BaseModel):
    container_running: bool
    active_profile: SuricataProfileResponse | None
    last_job: ApplyJobResponse | None
    apply_running: bool = False
    current_apply_event: dict | None = None
    sources_changed_since_last_apply: bool = False


class TelegramChatRecipient(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    chat_id: str = Field(..., min_length=1, max_length=120)


class NotificationSettingsUpdate(BaseModel):
    telegram_enabled: bool | None = None
    telegram_chat_recipients: list[TelegramChatRecipient] | None = None
    buffer_enabled: bool | None = None
    buffer_minutes: int | None = Field(default=None, ge=1, le=1440)
    timezone: str | None = Field(default=None, min_length=1, max_length=40)


class NotificationSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    telegram_enabled: bool
    telegram_chat_recipients: list[TelegramChatRecipient]
    buffer_enabled: bool
    buffer_minutes: int
    timezone: str
    created_at: datetime
    updated_at: datetime
