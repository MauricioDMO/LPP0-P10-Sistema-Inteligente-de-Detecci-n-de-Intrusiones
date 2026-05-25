"""Auth request and response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=80)
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: str | None
    is_active: bool
    roles: list[str]
    created_at: datetime
    updated_at: datetime


class SessionResponse(BaseModel):
    expires_in: int
    user: UserResponse


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=80)
    email: EmailStr | None = None
    password: str = Field(..., min_length=8, max_length=128)
    roles: list[str] = Field(default_factory=lambda: ["viewer"])
    is_active: bool = True


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    current_password: str | None = Field(default=None, min_length=1, max_length=128)
    roles: list[str] | None = None
    is_active: bool | None = None


class UsersListResponse(BaseModel):
    users: list[UserResponse]
