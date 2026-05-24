"""Suricata policy management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db_session
from ..dependencies.auth import require_csrf_token, require_roles
from ..models.auth import User
from ..models.suricata import SuricataApplyJob, SuricataConfigVersion, SuricataCustomRule, SuricataNotificationSettings, SuricataProfile, SuricataRuleOverride, SuricataSource
from ..schemas.suricata import (
    ApplyJobResponse,
    ApplyRequest,
    CustomRuleCreate,
    CustomRuleResponse,
    CustomRuleUpdate,
    CustomRuleValidateRequest,
    CustomRuleValidateResponse,
    NotificationSettingsResponse,
    NotificationSettingsUpdate,
    RuleOverrideCreate,
    RuleOverrideResponse,
    RuleOverrideUpdate,
    SuricataProfileCreate,
    SuricataProfileResponse,
    SuricataProfileUpdate,
    SuricataSourceResponse,
    SuricataSourceUpdate,
    SuricataStatusResponse,
)
from ..services.suricata_apply_service import apply_suricata_config, docker_container_running, get_active_profile, get_last_job
from ..services.suricata_config_renderer import validate_custom_rule_text

router = APIRouter(prefix="/api/suricata", tags=["suricata"])


def serialize_profile(profile: SuricataProfile) -> SuricataProfileResponse:
    return SuricataProfileResponse.model_validate(profile)


async def require_profile(session: AsyncSession, profile_id: UUID) -> SuricataProfile:
    profile = await session.get(SuricataProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado")
    return profile


async def get_or_create_notification_settings(session: AsyncSession) -> SuricataNotificationSettings:
    result = await session.execute(select(SuricataNotificationSettings).order_by(SuricataNotificationSettings.created_at).limit(1))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = SuricataNotificationSettings()
        session.add(settings)
        await session.commit()
        await session.refresh(settings)
    return settings


@router.get("/status", response_model=SuricataStatusResponse)
async def get_status(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    return SuricataStatusResponse(
        container_running=await docker_container_running(),
        active_profile=await get_active_profile(session),
        last_job=await get_last_job(session),
    )


@router.get("/profiles", response_model=list[SuricataProfileResponse])
async def list_profiles(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    result = await session.execute(select(SuricataProfile).order_by(SuricataProfile.created_at.desc()))
    return list(result.scalars().all())


@router.post("/profiles", response_model=SuricataProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: SuricataProfileCreate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    profile = SuricataProfile(**payload.model_dump())
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return profile


@router.patch("/profiles/{profile_id}", response_model=SuricataProfileResponse)
async def patch_profile(
    profile_id: UUID,
    payload: SuricataProfileUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    profile = await require_profile(session, profile_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await session.commit()
    await session.refresh(profile)
    return profile


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    profile = await require_profile(session, profile_id)
    if profile.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede eliminar el perfil activo")
    await session.execute(delete(SuricataConfigVersion).where(SuricataConfigVersion.profile_id == profile_id))
    await session.execute(delete(SuricataApplyJob).where(SuricataApplyJob.profile_id == profile_id))
    await session.delete(profile)
    await session.commit()


@router.post("/profiles/{profile_id}/activate", response_model=SuricataProfileResponse)
async def activate_profile(
    profile_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    profile = await require_profile(session, profile_id)
    await session.execute(update(SuricataProfile).values(is_active=False))
    profile.is_active = True
    await session.commit()
    await session.refresh(profile)
    return profile


@router.get("/sources", response_model=list[SuricataSourceResponse])
async def list_sources(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    result = await session.execute(select(SuricataSource).order_by(SuricataSource.display_name))
    return list(result.scalars().all())


@router.patch("/sources/{source_id}", response_model=SuricataSourceResponse)
async def patch_source(
    source_id: UUID,
    payload: SuricataSourceUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    source = await session.get(SuricataSource, source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fuente no encontrada")
    source.enabled = payload.enabled
    await session.commit()
    await session.refresh(source)
    return source


@router.get("/profiles/{profile_id}/rule-overrides", response_model=list[RuleOverrideResponse])
async def list_rule_overrides(
    profile_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    await require_profile(session, profile_id)
    result = await session.execute(select(SuricataRuleOverride).where(SuricataRuleOverride.profile_id == profile_id).order_by(SuricataRuleOverride.sid))
    return list(result.scalars().all())


@router.post("/profiles/{profile_id}/rule-overrides", response_model=RuleOverrideResponse, status_code=status.HTTP_201_CREATED)
async def create_rule_override(
    profile_id: UUID,
    payload: RuleOverrideCreate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    await require_profile(session, profile_id)
    override = SuricataRuleOverride(profile_id=profile_id, **payload.model_dump())
    session.add(override)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Override duplicado") from exc
    await session.refresh(override)
    return override


@router.patch("/rule-overrides/{override_id}", response_model=RuleOverrideResponse)
async def patch_rule_override(
    override_id: UUID,
    payload: RuleOverrideUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    override = await session.get(SuricataRuleOverride, override_id)
    if override is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Override no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(override, field, value)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Override duplicado") from exc
    await session.refresh(override)
    return override


@router.delete("/rule-overrides/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule_override(
    override_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    override = await session.get(SuricataRuleOverride, override_id)
    if override is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Override no encontrado")
    await session.delete(override)
    await session.commit()


@router.get("/profiles/{profile_id}/custom-rules", response_model=list[CustomRuleResponse])
async def list_custom_rules(
    profile_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    await require_profile(session, profile_id)
    result = await session.execute(select(SuricataCustomRule).where(SuricataCustomRule.profile_id == profile_id).order_by(SuricataCustomRule.created_at.desc()))
    return list(result.scalars().all())


@router.post("/profiles/{profile_id}/custom-rules", response_model=CustomRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_rule(
    profile_id: UUID,
    payload: CustomRuleCreate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    await require_profile(session, profile_id)
    validation_status, validation_error = validate_custom_rule_text(payload.rule_text)
    custom_rule = SuricataCustomRule(
        profile_id=profile_id,
        validation_status=validation_status,
        validation_error=validation_error,
        **payload.model_dump(),
    )
    session.add(custom_rule)
    await session.commit()
    await session.refresh(custom_rule)
    return custom_rule


@router.patch("/custom-rules/{rule_id}", response_model=CustomRuleResponse)
async def patch_custom_rule(
    rule_id: UUID,
    payload: CustomRuleUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    custom_rule = await session.get(SuricataCustomRule, rule_id)
    if custom_rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regla custom no encontrada")
    values = payload.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(custom_rule, field, value)
    if "rule_text" in values:
        custom_rule.validation_status, custom_rule.validation_error = validate_custom_rule_text(custom_rule.rule_text)
    await session.commit()
    await session.refresh(custom_rule)
    return custom_rule


@router.delete("/custom-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_rule(
    rule_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    custom_rule = await session.get(SuricataCustomRule, rule_id)
    if custom_rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regla custom no encontrada")
    await session.delete(custom_rule)
    await session.commit()


@router.post("/custom-rules/validate", response_model=CustomRuleValidateResponse)
async def validate_custom_rule(
    payload: CustomRuleValidateRequest,
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    validation_status, validation_error = validate_custom_rule_text(payload.rule_text)
    return CustomRuleValidateResponse(status=validation_status, error=validation_error)


@router.post("/apply", response_model=ApplyJobResponse)
async def apply_config(
    payload: ApplyRequest,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    try:
        return await apply_suricata_config(session, payload.profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/apply-jobs/{job_id}", response_model=ApplyJobResponse)
async def get_apply_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    job = await session.get(SuricataApplyJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job no encontrado")
    return job


@router.get("/notification-settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    return await get_or_create_notification_settings(session)


@router.patch("/notification-settings", response_model=NotificationSettingsResponse)
async def patch_notification_settings(
    payload: NotificationSettingsUpdate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst")),
    __: None = Depends(require_csrf_token),
):
    settings = await get_or_create_notification_settings(session)
    values = payload.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(settings, field, value)
    await session.commit()
    await session.refresh(settings)
    return settings
