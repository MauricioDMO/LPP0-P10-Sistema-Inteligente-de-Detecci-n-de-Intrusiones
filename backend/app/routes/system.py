"""Operational health endpoints for the full Suricata stack."""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import geoip, system_state
from ..config import settings
from ..db import get_db_session
from ..dependencies.auth import require_roles
from ..enriched_writer import template_name
from ..es_client import es
from ..models.auth import User
from ..models.suricata import SuricataApplyJob, SuricataConfigVersion, SuricataSource
from ..schemas.suricata import ApplyJobResponse, SuricataProfileResponse
from ..services.suricata_apply_service import (
    SuricataCommandError,
    docker_container_running,
    enabled_source_names,
    get_active_profile,
    get_last_job,
    run_command,
)

router = APIRouter(prefix="/api/system", tags=["system"])


def _serialize_profile(profile: Any | None) -> dict[str, Any] | None:
    if profile is None:
        return None
    return SuricataProfileResponse.model_validate(profile).model_dump(mode="json")


def _serialize_job(job: SuricataApplyJob | None) -> dict[str, Any] | None:
    if job is None:
        return None
    return ApplyJobResponse.model_validate(job).model_dump(mode="json")


def _serialize_config_version(version: SuricataConfigVersion | None) -> dict[str, Any] | None:
    if version is None:
        return None
    return {
        "id": str(version.id),
        "profile_id": str(version.profile_id),
        "apply_job_id": str(version.apply_job_id) if version.apply_job_id else None,
        "status": version.status,
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }


def _status(ok: bool, degraded: bool = False) -> str:
    if ok and not degraded:
        return "green"
    if ok or degraded:
        return "yellow"
    return "red"


async def _safe_command(args: list[str], timeout: int = 12) -> tuple[bool, str]:
    try:
        output = await asyncio.to_thread(run_command, args, timeout)
        return True, output
    except (SuricataCommandError, FileNotFoundError) as exc:
        return False, getattr(exc, "output", str(exc))


async def _container_status(name: str) -> dict[str, Any]:
    ok, running = await _safe_command(["docker", "inspect", "-f", "{{.State.Running}}", name], timeout=8)
    is_running = ok and running.strip() == "true"
    _, logs = await _safe_command(["docker", "logs", name, "--tail=20"], timeout=8) if is_running else (False, "")
    return {
        "name": name,
        "running": is_running,
        "status": _status(is_running),
        "logs": logs.splitlines()[-20:],
    }


async def _latest_event(index: str) -> dict[str, Any] | None:
    try:
        response = await es.search(
            index=index,
            query={"match_all": {}},
            sort=[{"@timestamp": {"order": "desc", "unmapped_type": "date"}}],
            size=1,
            _source=["@timestamp", "timestamp", "event_type", "suricata.eve.event_type", "suricata.eve.alert.signature"],
            ignore_unavailable=True,
        )
    except Exception:
        return None
    hits = response.get("hits", {}).get("hits", [])
    return hits[0].get("_source") if hits else None


async def _index_summary(index: str) -> dict[str, Any]:
    try:
        count_response = await es.count(index=index, query={"match_all": {}}, ignore_unavailable=True)
    except Exception as exc:
        return {"pattern": index, "exists": False, "status": "red", "error": str(exc)}

    docs = int(count_response.get("count", 0))
    stats_error = None
    try:
        stats = await es.indices.stats(index=index, expand_wildcards="open")
        indices = stats.get("indices", {})
    except Exception as exc:
        indices = {}
        stats_error = str(exc)

    size_bytes = sum(item.get("total", {}).get("store", {}).get("size_in_bytes", 0) for item in indices.values())
    exists = bool(indices) or docs > 0
    summary = {
        "pattern": index,
        "exists": exists,
        "status": _status(exists),
        "index_count": len(indices),
        "documents": docs,
        "size_bytes": size_bytes,
    }
    if stats_error:
        summary["stats_error"] = stats_error
    return summary


async def _count(index: str, query: dict[str, Any]) -> int:
    try:
        response = await es.count(index=index, query=query, ignore_unavailable=True)
        return int(response.get("count", 0))
    except Exception:
        return 0


async def _coverage(hours: int) -> dict[str, Any]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    base_query = {"range": {"@timestamp": {"gte": since}}}
    total = await _count(settings.elasticsearch_enriched_index, base_query)

    async def ratio(query: dict[str, Any]) -> dict[str, Any]:
        count = await _count(settings.elasticsearch_enriched_index, query)
        return {"count": count, "percent": round((count / total) * 100, 2) if total else 0}

    return {
        "hours": hours,
        "total": total,
        "geo": await ratio({"bool": {"filter": [base_query], "should": [{"exists": {"field": "_geo.source.country_code"}}, {"exists": {"field": "_geo.destination.country_code"}}], "minimum_should_match": 1}}),
        "resolved": await ratio({"bool": {"filter": [base_query], "should": [{"exists": {"field": "_resolved.source_hostname"}}, {"exists": {"field": "_resolved.dest_hostname"}}], "minimum_should_match": 1}}),
        "threat": await ratio({"bool": {"filter": [base_query], "must": [{"exists": {"field": "_threat.is_malicious"}}]}}),
    }


@router.get("/health")
async def get_system_health(_: User = Depends(require_roles("admin", "analyst", "viewer"))):
    runtime = system_state.snapshot()
    redis_ok = runtime["redis_connected"]
    return {
        "status": _status(redis_ok, degraded=runtime["last_event"] is None),
        "backend": {
            "status": "green",
            "timestamp": runtime["timestamp"],
        },
        "redis": {
            "status": _status(redis_ok),
            "connected": redis_ok,
            "host": settings.redis_host,
            "port": settings.redis_port,
            "channel": settings.redis_channel,
        },
        "websocket": {
            "status": _status(True),
            "path": "/ws",
            "clients": runtime["websocket_clients"],
        },
        "pipeline": {
            "last_event": runtime["last_event"],
            "events_per_minute": runtime["events_per_minute"],
        },
    }


@router.get("/elasticsearch")
async def get_elasticsearch_health(
    hours: int = Query(24, ge=1, le=168),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    try:
        cluster = await es.cluster.health()
        connected = True
    except Exception as exc:
        return {"connected": False, "status": "red", "error": str(exc)}

    try:
        await es.indices.get_index_template(name=template_name())
        template_exists = True
    except Exception:
        template_exists = False

    raw_summary, enriched_summary, raw_latest, enriched_latest, coverage = await asyncio.gather(
        _index_summary(settings.elasticsearch_index),
        _index_summary(settings.elasticsearch_enriched_index),
        _latest_event(settings.elasticsearch_index),
        _latest_event(settings.elasticsearch_enriched_index),
        _coverage(hours),
    )

    runtime = system_state.snapshot()
    return {
        "connected": connected,
        "status": cluster.get("status", "unknown"),
        "cluster": cluster,
        "indices": {"raw": raw_summary, "enriched": enriched_summary},
        "latest_raw_event": raw_latest,
        "latest_enriched_event": enriched_latest,
        "coverage": coverage,
        "template": {"name": template_name(), "exists": template_exists, "status": _status(template_exists)},
        "geoip": {
            "mode": "GeoLite2" if geoip.geoip_database_available() else "ip-api.com fallback",
            "database_path": settings.geoip_db_path,
            "database_available": geoip.geoip_database_available(),
        },
        "last_enriched_write_error": runtime["last_enriched_write_error"],
    }


@router.get("/pipeline")
async def get_pipeline_health(_: User = Depends(require_roles("admin", "analyst", "viewer"))):
    runtime = system_state.snapshot()
    return {
        "status": _status(runtime["redis_connected"], degraded=runtime["last_event"] is None),
        "redis_connected": runtime["redis_connected"],
        "websocket_clients": runtime["websocket_clients"],
        "last_event": runtime["last_event"],
        "events_per_minute": runtime["events_per_minute"],
        "last_enriched_write_error": runtime["last_enriched_write_error"],
    }


@router.get("/containers")
async def get_container_health(_: User = Depends(require_roles("admin", "analyst", "viewer"))):
    containers = await asyncio.gather(
        _container_status(settings.suricata_container_name),
        _container_status(settings.filebeat_container_name),
        _container_status(settings.logstash_container_name),
    )
    return {"status": _status(all(item["running"] for item in containers), degraded=any(item["running"] for item in containers)), "containers": containers}


@router.get("/suricata-config")
async def get_suricata_config_health(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    active_profile = await get_active_profile(session)
    last_job = await get_last_job(session)
    version_result = await session.execute(select(SuricataConfigVersion).order_by(SuricataConfigVersion.created_at.desc()).limit(1))
    last_version = version_result.scalar_one_or_none()
    sources_result = await session.execute(select(SuricataSource).order_by(SuricataSource.source_name))
    sources = list(sources_result.scalars())
    container_running = await docker_container_running()
    nfqueue_ok, nfqueue_output = await _safe_command(["docker", "exec", settings.suricata_container_name, "sh", "-c", "iptables -L OUTPUT -n 2>/dev/null | grep NFQUEUE || true"], timeout=8) if container_running else (False, "")
    logs_ok, logs = await _safe_command(["docker", "logs", settings.suricata_container_name, "--tail=30"], timeout=8) if container_running else (False, "")
    real_mode = "IPS" if nfqueue_ok and "NFQUEUE" in nfqueue_output else "IDS"
    mode_matches = active_profile is not None and active_profile.mode == real_mode
    degraded = active_profile is None or (last_job is not None and last_job.status == "failed") or not mode_matches

    return {
        "status": _status(container_running, degraded=degraded),
        "container_running": container_running,
        "mode": {"real": real_mode, "profile": active_profile.mode if active_profile else None, "matches": mode_matches},
        "nfqueue": {"present": "NFQUEUE" in nfqueue_output, "output": nfqueue_output.strip()},
        "active_profile": _serialize_profile(active_profile),
        "last_job": _serialize_job(last_job),
        "last_config_version": _serialize_config_version(last_version),
        "enabled_sources": enabled_source_names(sources),
        "recent_logs": logs.splitlines()[-30:] if logs_ok else [],
    }


@router.get("/overview")
async def get_system_overview(
    hours: int = Query(24, ge=1, le=168),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles("admin", "analyst", "viewer")),
):
    health, elasticsearch, pipeline, containers, suricata_config = await asyncio.gather(
        get_system_health(_),
        get_elasticsearch_health(hours, _),
        get_pipeline_health(_),
        get_container_health(_),
        get_suricata_config_health(session, _),
    )
    return {
        "health": health,
        "elasticsearch": elasticsearch,
        "pipeline": pipeline,
        "containers": containers,
        "suricata_config": suricata_config,
    }
