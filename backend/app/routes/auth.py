"""Authentication and user administration endpoints."""

import secrets
import time

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db_session
from ..dependencies.auth import get_current_user, require_csrf_token, require_roles
from ..models.auth import User
from ..schemas.auth import LoginRequest, SessionResponse, UserCreate, UserResponse, UsersListResponse, UserUpdate
from ..security import create_access_token
from ..services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])
LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 300
login_failures: dict[str, list[float]] = {}


def serialize_user(user: User) -> UserResponse:
    return UserResponse(**auth_service.user_to_response_dict(user))


def login_rate_limit_key(request: Request, username: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    return f"{client_host}:{username.lower()}"


def check_login_rate_limit(request: Request, username: str) -> str:
    key = login_rate_limit_key(request, username)
    now = time.monotonic()
    recent_failures = [failure for failure in login_failures.get(key, []) if now - failure < LOGIN_WINDOW_SECONDS]
    login_failures[key] = recent_failures
    if len(recent_failures) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Intenta nuevamente en unos minutos",
        )
    return key


def record_login_failure(key: str) -> None:
    login_failures.setdefault(key, []).append(time.monotonic())


def clear_login_failures(key: str) -> None:
    login_failures.pop(key, None)


@router.post("/login", response_model=SessionResponse)
async def login(payload: LoginRequest, request: Request, response: Response, session: AsyncSession = Depends(get_db_session)):
    rate_limit_key = check_login_rate_limit(request, payload.username)
    user = await auth_service.authenticate_user(session, payload.username, payload.password)
    if user is None:
        record_login_failure(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales invalidas",
        )
    clear_login_failures(rate_limit_key)

    roles = [role.name for role in user.roles]
    token, expires_in = create_access_token(user.id, roles, user.token_version)
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=expires_in,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=expires_in,
        httponly=False,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )
    return SessionResponse(expires_in=expires_in, user=serialize_user(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
    _: None = Depends(require_csrf_token),
):
    await auth_service.bump_token_version(session, user)
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    response.delete_cookie(key=settings.csrf_cookie_name, path="/")


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return serialize_user(user)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin")),
    __: None = Depends(require_csrf_token),
):
    try:
        user = await auth_service.create_user(session, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return serialize_user(user)


@router.get("/users", response_model=UsersListResponse)
async def get_users(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin")),
):
    users = await auth_service.list_users(session)
    return UsersListResponse(users=[serialize_user(user) for user in users])


@router.patch("/users/{user_id}", response_model=UserResponse)
async def patch_user(
    user_id: UUID,
    payload: UserUpdate,
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_roles("admin")),
    __: None = Depends(require_csrf_token),
):
    user = await auth_service.get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    try:
        updated_user = await auth_service.update_user(session, user, payload, acting_user=admin_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return serialize_user(updated_user)


@router.delete("/users/{user_id}", response_model=UserResponse)
async def delete_user(
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_roles("admin")),
    __: None = Depends(require_csrf_token),
):
    user = await auth_service.get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    try:
        deactivated_user = await auth_service.deactivate_user(session, user, acting_user=admin_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return serialize_user(deactivated_user)
