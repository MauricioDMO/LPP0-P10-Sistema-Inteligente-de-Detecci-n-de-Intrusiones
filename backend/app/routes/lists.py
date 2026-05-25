"""Managed block and allow list endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db_session
from ..dependencies.auth import require_csrf_token, require_roles
from ..models.auth import User
from ..models.suricata import SuricataCustomRule, SuricataListEntry, SuricataProfile
from ..schemas.lists import GeneratedRulesResponse, ListApplyRequest, ListEntryCreate, ListEntryResponse, ListEntryUpdate
from ..schemas.suricata import ApplyJobResponse
from ..services.suricata_apply_service import apply_suricata_config
from ..services.suricata_list_service import preview_generated_rules, sync_profile_list_rules, validate_list_entry

router = APIRouter(prefix="/api/lists", tags=["lists"])


async def require_profile(session: AsyncSession, profile_id: UUID) -> SuricataProfile:
    profile = await session.get(SuricataProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado")
    return profile


def action_for_list(list_type: str, payload_action: str | None) -> str:
    if list_type == "allow":
        return "pass"
    return payload_action or "drop"


def direction_for_entry(entry_type: str, direction: str) -> str:
    return "destination" if entry_type == "domain" else direction


async def delete_generated_rules(session: AsyncSession, entry: SuricataListEntry) -> None:
    if entry.generated_rule_ids:
        await session.execute(delete(SuricataCustomRule).where(SuricataCustomRule.id.in_([UUID(rule_id) for rule_id in entry.generated_rule_ids])))


async def list_entries_by_type(
    list_type: str,
    profile_id: UUID = Query(...),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    await require_profile(session, profile_id)
    result = await session.execute(
        select(SuricataListEntry)
        .where(SuricataListEntry.profile_id == profile_id, SuricataListEntry.list_type == list_type)
        .order_by(SuricataListEntry.created_at.desc())
    )
    return list(result.scalars().all())


async def create_entry_by_type(
    list_type: str,
    payload: ListEntryCreate,
    session: AsyncSession,
    user: User,
):
    await require_profile(session, payload.profile_id)
    action = action_for_list(list_type, payload.action)
    direction = direction_for_entry(payload.entry_type, payload.direction)
    try:
        value = validate_list_entry(list_type, payload.entry_type, payload.value, direction, action)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    entry = SuricataListEntry(
        profile_id=payload.profile_id,
        list_type=list_type,
        entry_type=payload.entry_type,
        value=value,
        direction=direction,
        action=action,
        reason=payload.reason,
        enabled=payload.enabled,
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    session.add(entry)
    try:
        await session.flush()
        await sync_profile_list_rules(session, payload.profile_id)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entrada duplicada") from exc
    await session.refresh(entry)
    return entry


async def patch_entry_by_type(
    list_type: str,
    entry_id: UUID,
    payload: ListEntryUpdate,
    session: AsyncSession,
    user: User,
):
    entry = await session.get(SuricataListEntry, entry_id)
    if entry is None or entry.list_type != list_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada no encontrada")

    values = payload.model_dump(exclude_unset=True)
    entry_type = values.get("entry_type", entry.entry_type)
    value = values.get("value", entry.value)
    direction = direction_for_entry(entry_type, values.get("direction", entry.direction))
    action = action_for_list(list_type, values.get("action", entry.action))
    try:
        normalized_value = validate_list_entry(list_type, entry_type, value, direction, action)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    for field, next_value in values.items():
        setattr(entry, field, next_value)
    entry.value = normalized_value
    entry.action = action
    entry.updated_by_id = user.id

    try:
        await sync_profile_list_rules(session, entry.profile_id)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entrada duplicada") from exc
    await session.refresh(entry)
    return entry


async def delete_entry_by_type(list_type: str, entry_id: UUID, session: AsyncSession):
    entry = await session.get(SuricataListEntry, entry_id)
    if entry is None or entry.list_type != list_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada no encontrada")
    await delete_generated_rules(session, entry)
    await session.delete(entry)
    await session.commit()


@router.get("/block", response_model=list[ListEntryResponse])
async def list_block_entries(profile_id: UUID = Query(...), session: AsyncSession = Depends(get_db_session), user: User = Depends(require_roles("admin", "analyst", "viewer"))):
    return await list_entries_by_type("block", profile_id, session, user)


@router.post("/block", response_model=ListEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_block_entry(payload: ListEntryCreate, session: AsyncSession = Depends(get_db_session), user: User = Depends(require_roles("admin", "analyst")), _: None = Depends(require_csrf_token)):
    return await create_entry_by_type("block", payload, session, user)


@router.patch("/block/{entry_id}", response_model=ListEntryResponse)
async def patch_block_entry(entry_id: UUID, payload: ListEntryUpdate, session: AsyncSession = Depends(get_db_session), user: User = Depends(require_roles("admin", "analyst")), _: None = Depends(require_csrf_token)):
    return await patch_entry_by_type("block", entry_id, payload, session, user)


@router.delete("/block/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block_entry(entry_id: UUID, session: AsyncSession = Depends(get_db_session), _: User = Depends(require_roles("admin", "analyst")), __: None = Depends(require_csrf_token)):
    await delete_entry_by_type("block", entry_id, session)


@router.get("/allow", response_model=list[ListEntryResponse])
async def list_allow_entries(profile_id: UUID = Query(...), session: AsyncSession = Depends(get_db_session), user: User = Depends(require_roles("admin", "analyst", "viewer"))):
    return await list_entries_by_type("allow", profile_id, session, user)


@router.post("/allow", response_model=ListEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_allow_entry(payload: ListEntryCreate, session: AsyncSession = Depends(get_db_session), user: User = Depends(require_roles("admin", "analyst")), _: None = Depends(require_csrf_token)):
    return await create_entry_by_type("allow", payload, session, user)


@router.patch("/allow/{entry_id}", response_model=ListEntryResponse)
async def patch_allow_entry(entry_id: UUID, payload: ListEntryUpdate, session: AsyncSession = Depends(get_db_session), user: User = Depends(require_roles("admin", "analyst")), _: None = Depends(require_csrf_token)):
    return await patch_entry_by_type("allow", entry_id, payload, session, user)


@router.delete("/allow/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_allow_entry(entry_id: UUID, session: AsyncSession = Depends(get_db_session), _: User = Depends(require_roles("admin", "analyst")), __: None = Depends(require_csrf_token)):
    await delete_entry_by_type("allow", entry_id, session)


@router.get("/generated-rules", response_model=GeneratedRulesResponse)
async def get_generated_rules(profile_id: UUID = Query(...), session: AsyncSession = Depends(get_db_session), _: User = Depends(require_roles("admin", "analyst", "viewer"))):
    await require_profile(session, profile_id)
    result = await session.execute(select(SuricataListEntry).where(SuricataListEntry.profile_id == profile_id).order_by(SuricataListEntry.created_at, SuricataListEntry.id))
    return GeneratedRulesResponse(rules=[{"list_entry_id": entry_id, "rule_text": rule_text} for entry_id, rule_text in preview_generated_rules(list(result.scalars().all()))])


@router.post("/apply", response_model=ApplyJobResponse)
async def apply_lists(payload: ListApplyRequest, session: AsyncSession = Depends(get_db_session), _: User = Depends(require_roles("admin", "analyst")), __: None = Depends(require_csrf_token)):
    await require_profile(session, payload.profile_id)
    await sync_profile_list_rules(session, payload.profile_id)
    await session.commit()
    return await apply_suricata_config(session, payload.profile_id, "auto")
