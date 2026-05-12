"""Endpoints para consulta de eventos."""

from fastapi import APIRouter, Query
from typing import Optional, List
from datetime import datetime, timedelta
from ..filters import EventFilter, EventType

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("/health")
async def health_check():
    """Verifica que el backend esté vivo."""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "suricata-backend",
    }


@router.get("/latest")
async def get_latest_events(
    limit: int = Query(10, ge=1, le=100),
    event_type: Optional[str] = None,
    severity: Optional[int] = Query(None, ge=1, le=4),
):
    """
    Obtiene los últimos eventos desde Elasticsearch.

    Query params:
        - limit: Número de eventos a retornar (default: 10, max: 100)
        - event_type: Tipo de evento a filtrar (alert, http, dns, etc.)
        - severity: Severidad mínima (1=critical, 4=low)

    Returns:
        Lista de eventos recientemente indexados.
    """
    # Placeholder: En la implementación real consultará Elasticsearch
    return {
        "limit": limit,
        "event_type": event_type,
        "severity": severity,
        "events": [
            {
                "timestamp": (datetime.utcnow() - timedelta(seconds=i)).isoformat(),
                "event_type": event_type or "alert",
                "src_ip": f"192.168.1.{100 + i}",
                "dest_ip": "192.168.1.10",
                "message": f"Sample event {i+1}",
            }
            for i in range(min(limit, 5))
        ],
    }


@router.get("/stats")
async def get_event_stats(
    hours: int = Query(24, ge=1, le=168),
):
    """
    Obtiene estadísticas de eventos en el rango de tiempo.

    Query params:
        - hours: Ventana de tiempo en horas (default: 24)

    Returns:
        Conteos por tipo de evento, severidad y top IPs.
    """
    # Placeholder: En la implementación real consultará Elasticsearch con aggregations
    return {
        "hours": hours,
        "total_events": 42918,
        "by_type": {
            "alert": 1205,
            "http": 28103,
            "dns": 12401,
            "flow": 1209,
        },
        "by_severity": {
            "critical": 12,
            "high": 156,
            "medium": 413,
            "low": 624,
        },
        "top_source_ips": [
            {"ip": "192.168.1.45", "count": 342},
            {"ip": "192.168.1.99", "count": 219},
            {"ip": "10.0.0.8", "count": 178},
        ],
    }


@router.get("/search")
async def search_events(
    query: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Busca eventos por términos en Elasticsearch.

    Query params:
        - query: Término de búsqueda (IP, puerto, nombre, etc.)
        - limit: Resultados por página
        - offset: Offset para paginación

    Returns:
        Eventos que coinciden con la búsqueda.
    """
    # Placeholder: En la implementación real hace búsqueda full-text en Elasticsearch
    return {
        "query": query,
        "total": 5,
        "limit": limit,
        "offset": offset,
        "events": [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": "alert",
                "src_ip": "192.168.1.45",
                "message": f"Event matching '{query}'",
            }
        ],
    }
