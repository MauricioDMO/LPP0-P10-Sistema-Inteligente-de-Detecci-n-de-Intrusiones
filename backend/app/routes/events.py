"""Endpoints para consulta de eventos."""

from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime, timezone
from ..es_queries import get_latest, get_stats, search_events as es_search

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "suricata-backend",
    }


@router.get("/latest")
async def get_latest_events(
    limit: int = Query(10, ge=1, le=100),
    event_type: Optional[str] = None,
    severity: Optional[int] = Query(None, ge=1, le=4),
):
    events = await get_latest(limit=limit, event_type=event_type, severity=severity)
    return {"limit": limit, "event_type": event_type, "severity": severity, "events": events}


@router.get("/stats")
async def get_event_stats(hours: int = Query(24, ge=1, le=168)):
    return await get_stats(hours=hours)


@router.get("/search")
async def search_events(
    query: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return await es_search(query=query, limit=limit, offset=offset)
