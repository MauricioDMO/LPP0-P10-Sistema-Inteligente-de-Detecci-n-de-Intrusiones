"""Endpoints de analisis historico sobre Elasticsearch."""

from fastapi import APIRouter, Query

from ..analytics import service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def analytics_overview(hours: int = Query(24, ge=1, le=168)):
    """KPIs historicos generales para el dashboard."""
    return await service.get_overview(hours=hours)


@router.get("/timeline")
async def analytics_timeline(
    hours: int = Query(24, ge=1, le=168),
    interval: str = Query("5m", pattern=r"^\d+[mhd]$"),
):
    """Serie temporal de eventos, alertas, bloqueos y criticidad."""
    return await service.get_timeline(hours=hours, interval=interval)


@router.get("/top-ips")
async def analytics_top_ips(
    hours: int = Query(24, ge=1, le=168),
    direction: str = Query("source", pattern="^(source|destination)$"),
    size: int = Query(10, ge=1, le=50),
):
    """Top IPs origen o destino con contexto de eventos y firmas."""
    return await service.get_top_ips(hours=hours, direction=direction, size=size)


@router.get("/top-signatures")
async def analytics_top_signatures(
    hours: int = Query(24, ge=1, le=168),
    size: int = Query(10, ge=1, le=50),
):
    """Firmas Suricata mas frecuentes en el periodo."""
    return await service.get_top_signatures(hours=hours, size=size)


@router.get("/blocked")
async def analytics_blocked(
    hours: int = Query(24, ge=1, le=168),
    size: int = Query(10, ge=1, le=50),
):
    """Analisis especifico de reglas de bloqueo."""
    return await service.get_blocked(hours=hours, size=size)


@router.get("/geo")
async def analytics_geo(
    hours: int = Query(24, ge=1, le=168),
    direction: str = Query("both", pattern="^(source|destination|both)$"),
    event_type: str = Query("all", pattern="^(all|alert|dns|http|tls)$"),
    only_blocked: bool = Query(False),
    only_malicious: bool = Query(False),
    min_count: int = Query(1, ge=1),
):
    """Agregacion geografica completa usando eventos enriquecidos persistidos."""
    return await service.get_geo(
        hours=hours,
        direction=direction,
        event_type=event_type,
        only_blocked=only_blocked,
        only_malicious=only_malicious,
        min_count=min_count,
    )
