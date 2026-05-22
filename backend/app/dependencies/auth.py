"""Authentication dependencies for protected endpoints."""

from collections.abc import Callable
from uuid import UUID

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db_session
from ..models.auth import User
from ..security import decode_access_token
from ..services.auth_service import get_user_by_id


async def get_current_user(
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesion requerida",
        )

    try:
        payload = decode_access_token(session_token)
        user_id = UUID(str(payload.get("sub")))
        token_version = int(payload.get("token_version"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesion invalida",
        )

    user = await get_user_by_id(session, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario invalido o inactivo",
        )
    if user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesion revocada",
        )
    return user


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    async def dependency(user: User = Depends(get_current_user)) -> User:
        user_roles = {role.name for role in user.roles}
        if not user_roles.intersection(allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes",
            )
        return user

    return dependency


async def require_csrf_token(
    csrf_cookie: str | None = Cookie(default=None, alias=settings.csrf_cookie_name),
    csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> None:
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token invalido",
        )
