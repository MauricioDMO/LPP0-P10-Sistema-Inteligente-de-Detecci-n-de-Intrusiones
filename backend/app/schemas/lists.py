"""Request and response schemas for managed block/allow lists."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

ListType = Literal["block", "allow"]
EntryType = Literal["domain", "ip", "cidr"]
ListDirection = Literal["source", "destination", "both"]
ListAction = Literal["drop", "reject", "pass"]


class ListEntryBase(BaseModel):
    profile_id: UUID
    entry_type: EntryType
    value: str = Field(..., min_length=1, max_length=255)
    direction: ListDirection = "destination"
    action: ListAction | None = None
    reason: str | None = None
    enabled: bool = True

    @field_validator("value")
    @classmethod
    def strip_value(cls, value: str) -> str:
        return value.strip()


class ListEntryCreate(ListEntryBase):
    pass


class ListEntryUpdate(BaseModel):
    entry_type: EntryType | None = None
    value: str | None = Field(default=None, min_length=1, max_length=255)
    direction: ListDirection | None = None
    action: ListAction | None = None
    reason: str | None = None
    enabled: bool | None = None

    @field_validator("value")
    @classmethod
    def strip_value(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class ListEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    list_type: str
    entry_type: str
    value: str
    direction: str
    action: str
    reason: str | None
    enabled: bool
    generated_rule_ids: list[str]
    created_by_id: UUID | None
    updated_by_id: UUID | None
    created_at: datetime
    updated_at: datetime


class ListApplyRequest(BaseModel):
    profile_id: UUID


class GeneratedRuleResponse(BaseModel):
    list_entry_id: UUID
    rule_text: str


class GeneratedRulesResponse(BaseModel):
    rules: list[GeneratedRuleResponse]
