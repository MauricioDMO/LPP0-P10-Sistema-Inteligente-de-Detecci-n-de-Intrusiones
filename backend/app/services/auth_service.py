"""Authentication and user management service."""

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.auth import Role, User
from ..schemas.auth import UserCreate, UserUpdate
from ..security import hash_password, verify_password

logger = logging.getLogger(__name__)

DEFAULT_ROLES: dict[str, str] = {
    "admin": "Acceso completo a la plataforma",
    "analyst": "Operacion SOC y administracion de seguridad",
    "viewer": "Acceso de solo lectura",
}


def user_to_response_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "roles": [role.name for role in user.roles],
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


async def get_user_by_id(session: AsyncSession, user_id: UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_username(session: AsyncSession, username: str) -> User | None:
    result = await session.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def authenticate_user(session: AsyncSession, username: str, password: str) -> User | None:
    user = await get_user_by_username(session, username)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def get_roles_by_names(session: AsyncSession, role_names: list[str]) -> list[Role]:
    if not role_names:
        return []
    result = await session.execute(select(Role).where(Role.name.in_(role_names)))
    roles = list(result.scalars().all())
    found = {role.name for role in roles}
    missing = sorted(set(role_names) - found)
    if missing:
        raise ValueError(f"Roles inexistentes: {', '.join(missing)}")
    return roles


async def list_users(session: AsyncSession) -> list[User]:
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().unique().all())


async def bump_token_version(session: AsyncSession, user: User) -> User:
    user.token_version += 1
    await session.commit()
    await session.refresh(user, attribute_names=["roles", "updated_at"])
    return user


async def count_active_admins(session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count(User.id))
        .join(User.roles)
        .where(User.is_active.is_(True), Role.name == "admin")
    )
    return result.scalar_one()


async def create_user(session: AsyncSession, payload: UserCreate) -> User:
    existing_username = await get_user_by_username(session, payload.username)
    if existing_username:
        raise ValueError("El username ya existe")

    if payload.email:
        existing_email = await session.execute(select(User).where(User.email == payload.email))
        if existing_email.scalar_one_or_none():
            raise ValueError("El email ya existe")

    roles = await get_roles_by_names(session, payload.roles)
    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_active=payload.is_active,
        roles=roles,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user, attribute_names=["roles", "updated_at"])
    return user


async def update_user(
    session: AsyncSession,
    user: User,
    payload: UserUpdate,
    acting_user: User | None = None,
) -> User:
    if payload.email is not None:
        if payload.email != user.email:
            existing_email = await session.execute(select(User).where(User.email == payload.email))
            if existing_email.scalar_one_or_none():
                raise ValueError("El email ya existe")
        user.email = payload.email

    if payload.password is not None:
        if acting_user is None or not payload.current_password:
            raise ValueError("Debes confirmar tu contraseña actual para cambiar passwords")
        if not verify_password(payload.current_password, acting_user.password_hash):
            raise ValueError("Contraseña actual incorrecta")
        user.password_hash = hash_password(payload.password)
        user.token_version += 1
    if payload.is_active is not None:
        if acting_user is not None and acting_user.id == user.id and not payload.is_active:
            raise ValueError("No puedes desactivar tu propio usuario")
        if user.is_active and not payload.is_active and any(role.name == "admin" for role in user.roles):
            if await count_active_admins(session) <= 1:
                raise ValueError("No puedes desactivar el ultimo admin activo")
        user.is_active = payload.is_active
    if payload.roles is not None:
        if acting_user is not None and acting_user.id == user.id and "admin" not in payload.roles:
            raise ValueError("No puedes quitar tu propio rol admin")
        if any(role.name == "admin" for role in user.roles) and "admin" not in payload.roles:
            if await count_active_admins(session) <= 1:
                raise ValueError("No puedes quitar el rol admin al ultimo admin activo")
        user.roles = await get_roles_by_names(session, payload.roles)

    await session.commit()
    await session.refresh(user, attribute_names=["roles", "updated_at"])
    return user


async def deactivate_user(session: AsyncSession, user: User, acting_user: User | None = None) -> User:
    if acting_user is not None and acting_user.id == user.id:
        raise ValueError("No puedes desactivar tu propio usuario")
    if any(role.name == "admin" for role in user.roles) and await count_active_admins(session) <= 1:
        raise ValueError("No puedes desactivar el ultimo admin activo")
    user.is_active = False
    user.token_version += 1
    await session.commit()
    await session.refresh(user, attribute_names=["roles", "updated_at"])
    return user


async def ensure_default_roles(session: AsyncSession) -> None:
    for name, description in DEFAULT_ROLES.items():
        result = await session.execute(select(Role).where(Role.name == name))
        if result.scalar_one_or_none() is None:
            session.add(Role(name=name, description=description))
    await session.commit()


async def ensure_initial_admin(session: AsyncSession) -> None:
    result = await session.execute(select(func.count(User.id)))
    user_count = result.scalar_one()
    if user_count > 0:
        return

    if not settings.initial_admin_username or not settings.initial_admin_password:
        logger.warning("No hay usuarios y no se definio admin inicial")
        return

    admin_roles = await get_roles_by_names(session, ["admin"])
    admin = User(
        username=settings.initial_admin_username,
        email=settings.initial_admin_email,
        password_hash=hash_password(settings.initial_admin_password),
        is_active=True,
        roles=admin_roles,
    )
    session.add(admin)
    await session.commit()
    logger.info("Usuario admin inicial creado: %s", settings.initial_admin_username)


async def bootstrap_auth(session: AsyncSession) -> None:
    await ensure_default_roles(session)
    await ensure_initial_admin(session)
