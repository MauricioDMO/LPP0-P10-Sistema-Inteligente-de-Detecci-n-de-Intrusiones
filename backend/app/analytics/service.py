"""Servicios publicos de analytics historico."""

import asyncio
import re

from elasticsearch import NotFoundError
from sqlalchemy import select

from ..config import settings
from ..db import AsyncSessionLocal
from ..es_client import es
from ..models.suricata import SuricataCustomRule, SuricataListEntry, SuricataProfile, SuricataRuleOverride
from .formatters import bucket_list, severity_counts
from .geo import aggregate_geo_from_elasticsearch
from .queries import (
    alert_filter,
    blocked_aggs,
    blocked_event_filter,
    blocked_signature_filter,
    bool_query,
    event_search_filters,
    overview_aggs,
    timeline_aggs,
    top_ips_aggs,
    top_signatures_aggs,
)
from ..enricher import enrich_event

BLOCK_ACTIONS = {"drop", "reject"}


def _eve(event: dict) -> dict:
    return event.get("suricata", {}).get("eve", event)


def _alert(event: dict) -> dict:
    return _eve(event).get("alert", {}) or {}


def _signature(event: dict) -> str:
    return str(_alert(event).get("signature") or "")


def _event_type(event: dict) -> str:
    return str(_eve(event).get("event_type") or event.get("event_type") or "")


def _domain(event: dict) -> str | None:
    eve = _eve(event)
    dns_queries = eve.get("dns", {}).get("queries") or []
    if dns_queries and isinstance(dns_queries[0], dict) and dns_queries[0].get("rrname"):
        return dns_queries[0]["rrname"]
    return eve.get("tls", {}).get("sni") or eve.get("http", {}).get("hostname") or eve.get("http", {}).get("url")


def _block_action(signature: str) -> str:
    normalized = signature.lower()
    if "suricata-list block" in normalized or "blacklist" in normalized:
        return "blacklist"
    if "reject" in normalized or "bloqueo" in normalized or "blocked" in normalized:
        return "reject"
    if "drop" in normalized:
        return "drop"
    return "unknown"


def _block_source(signature: str, sid: int | None = None) -> str:
    normalized = signature.lower()
    if "suricata-list block" in normalized or "blacklist" in normalized:
        return "blacklist"
    if sid and (1001001 <= sid <= 1001999 or 2000000 <= sid <= 2009999):
        return "seed"
    if "[blocked]" in normalized or "[bloqueo]" in normalized:
        return "local_rule"
    if "override" in normalized:
        return "override"
    if signature:
        return "external_rule"
    return "other"


def _rule_id(event: dict) -> tuple[int | None, int | None]:
    alert = _alert(event)
    sid = alert.get("signature_id") or alert.get("sid")
    gid = alert.get("gid") or alert.get("generator_id") or 1
    return gid, sid


def _rule_text_id(rule_text: str) -> tuple[int, int] | None:
    sid_match = re.search(r"\bsid\s*:\s*(\d+)\s*;", rule_text)
    if sid_match is None:
        return None
    gid_match = re.search(r"\bgid\s*:\s*(\d+)\s*;", rule_text)
    return int(gid_match.group(1)) if gid_match else 1, int(sid_match.group(1))


def _rule_text_action(rule_text: str) -> str:
    stripped = rule_text.strip().lower()
    return stripped.split(None, 1)[0] if stripped else ""


def _seed_source(rule: SuricataCustomRule, sid: int | None) -> bool:
    if sid and (1001001 <= sid <= 1001999 or 2000000 <= sid <= 2009999):
        return True
    name = rule.name.lower()
    return name.startswith("youtube") or name.startswith("adult")


async def _active_block_policy() -> dict[tuple[int, int], dict]:
    async with AsyncSessionLocal() as session:
        profile_result = await session.execute(select(SuricataProfile).where(SuricataProfile.is_active.is_(True)).limit(1))
        profile = profile_result.scalar_one_or_none()
        if profile is None:
            return {}

        policy: dict[tuple[int, int], dict] = {}

        overrides_result = await session.execute(
            select(SuricataRuleOverride).where(
                SuricataRuleOverride.profile_id == profile.id,
                SuricataRuleOverride.enabled.is_(True),
                SuricataRuleOverride.action.in_(BLOCK_ACTIONS),
            )
        )
        for override in overrides_result.scalars().all():
            policy[(override.gid, override.sid)] = {
                "action": override.action,
                "source": "override",
                "rule_name": f"Override {override.gid}:{override.sid}",
                "reason": override.reason,
            }

        lists_result = await session.execute(
            select(SuricataListEntry).where(
                SuricataListEntry.profile_id == profile.id,
                SuricataListEntry.enabled.is_(True),
                SuricataListEntry.list_type == "block",
            )
        )
        generated_rule_to_entry: dict[str, SuricataListEntry] = {}
        for entry in lists_result.scalars().all():
            for rule_id in entry.generated_rule_ids:
                generated_rule_to_entry[str(rule_id)] = entry

        rules_result = await session.execute(
            select(SuricataCustomRule).where(
                SuricataCustomRule.profile_id == profile.id,
                SuricataCustomRule.enabled.is_(True),
                SuricataCustomRule.validation_status == "valid",
            )
        )
        for rule in rules_result.scalars().all():
            action = _rule_text_action(rule.rule_text)
            if action not in BLOCK_ACTIONS:
                continue
            rule_id = _rule_text_id(rule.rule_text)
            if rule_id is None:
                continue
            entry = generated_rule_to_entry.get(str(rule.id))
            source = "blacklist" if entry is not None else "seed" if _seed_source(rule, rule_id[1]) else "local_rule"
            policy.setdefault(
                rule_id,
                {
                    "action": action,
                    "source": source,
                    "rule_name": rule.name,
                    "list_value": entry.value if entry is not None else None,
                    "list_entry_type": entry.entry_type if entry is not None else None,
                },
            )

        return policy


def _policy_rule_ids(policy: dict[tuple[int, int], dict]) -> list[tuple[int, int]]:
    return sorted(policy.keys())


def _explain_block(event: dict, source: str, action: str, domain: str | None = None, rule_name: str | None = None) -> str:
    signature = _signature(event) or rule_name or "regla sin firma"
    blocked_target = domain or _domain(event) or "destino sin dominio"
    dst = _eve(event).get("destination", {}).get("ip") or event.get("destination", {}).get("ip") or event.get("dest_ip") or "IP destino desconocida"
    event_type = _event_type(event).upper() or "EVE"
    source_label = {
        "blacklist": "lista negra",
        "local_rule": "regla local",
        "override": "override",
        "external_rule": "regla externa",
        "seed": "regla seed",
    }.get(source, "regla")
    return f"{blocked_target} bloqueado por {source_label}: {signature}, destino {dst}, evento {event_type}, accion {action}"


def _annotate_block(event: dict, policy: dict[tuple[int, int], dict] | None = None) -> dict:
    gid, sid = _rule_id(event)
    policy_match = policy.get((int(gid), int(sid))) if policy and gid is not None and sid is not None else None
    signature = _signature(event)
    action = policy_match.get("action") if policy_match else _block_action(signature)
    source = policy_match.get("source") if policy_match else _block_source(signature, sid)
    domain = policy_match.get("list_value") if policy_match and policy_match.get("list_value") else _domain(event)
    event["_blocked"] = {
        "action": action,
        "source": source,
        "domain": domain,
        "gid": gid,
        "sid": sid,
        "rule_name": policy_match.get("rule_name") if policy_match else None,
        "explanation": _explain_block(event, source, action, domain, policy_match.get("rule_name") if policy_match else None),
    }
    return event


def _filter_block_source(events: list[dict], block_source: str) -> list[dict]:
    if block_source == "all":
        return events
    return [event for event in events if event.get("_blocked", {}).get("source") == block_source]


def _geo_filters(
    event_type: str = "all",
    only_blocked: bool = False,
    only_malicious: bool = False,
    blocked_filter: dict | None = None,
) -> list[dict]:
    filters = []
    if event_type != "all":
        filters.append({"term": {"suricata.eve.event_type": event_type}})
    if only_blocked:
        filters.append(blocked_filter or blocked_event_filter(keyword=False))
    if only_malicious:
        filters.append({"term": {"_threat.is_malicious": True}})
    return filters


async def get_overview(hours: int = 24) -> dict:
    policy = await _active_block_policy()
    blocked_filter = blocked_event_filter(_policy_rule_ids(policy))
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours),
        size=0,
        aggs=overview_aggs(blocked_filter),
    )
    aggs = resp["aggregations"]
    return {
        "hours": hours,
        "total_events": aggs["total"]["value"],
        "alerts": aggs["alerts"]["doc_count"],
        "blocked": aggs["blocked"]["doc_count"],
        "unique_source_ips": aggs["unique_source_ips"]["value"],
        "unique_destination_ips": aggs["unique_destination_ips"]["value"],
        "by_type": bucket_list(aggs["by_event_type"]["buckets"], "type"),
        "by_severity": severity_counts(aggs["by_severity"]["buckets"]),
    }


async def get_timeline(hours: int = 24, interval: str = "5m") -> dict:
    policy = await _active_block_policy()
    blocked_filter = blocked_event_filter(_policy_rule_ids(policy))
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours),
        size=0,
        aggs=timeline_aggs(interval, blocked_filter),
    )
    buckets = resp["aggregations"]["timeline"]["buckets"]
    return {
        "hours": hours,
        "interval": interval,
        "points": [
            {
                "timestamp": b["key_as_string"],
                "total": b["doc_count"],
                "alerts": b["alerts"]["doc_count"],
                "blocked": b["blocked"]["doc_count"],
                "critical": b["critical"]["doc_count"],
            }
            for b in buckets
        ],
    }


async def get_top_ips(hours: int = 24, direction: str = "source", size: int = 10) -> dict:
    field = "source.ip.keyword" if direction == "source" else "destination.ip.keyword"
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours),
        size=0,
        aggs=top_ips_aggs(field, size),
    )
    buckets = resp["aggregations"]["top_ips"]["buckets"]
    return {
        "hours": hours,
        "direction": direction,
        "ips": [
            {
                "ip": b["key"],
                "count": b["doc_count"],
                "max_severity": b["max_severity"].get("value"),
                "last_seen": b["last_seen"].get("value_as_string"),
                "event_types": bucket_list(b["event_types"]["buckets"], "type"),
                "top_signatures": bucket_list(b["signatures"]["buckets"], "signature"),
            }
            for b in buckets
        ],
    }


async def get_top_signatures(hours: int = 24, size: int = 10) -> dict:
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours, [alert_filter()]),
        size=0,
        aggs=top_signatures_aggs(size),
    )
    buckets = resp["aggregations"]["signatures"]["buckets"]
    return {
        "hours": hours,
        "signatures": [
            {
                "signature": b["key"],
                "count": b["doc_count"],
                "severity": severity_counts(b["severity"]["buckets"]),
                "categories": bucket_list(b["categories"]["buckets"], "category"),
                "last_seen": b["last_seen"].get("value_as_string"),
            }
            for b in buckets
        ],
    }


async def get_blocked(hours: int = 24, size: int = 10) -> dict:
    policy = await _active_block_policy()
    blocked_filter = blocked_event_filter(_policy_rule_ids(policy))
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours, [blocked_filter]),
        size=0,
        aggs=blocked_aggs(size),
    )
    aggs = resp["aggregations"]
    return {
        "hours": hours,
        "total_blocked": aggs["total"]["value"],
        "top_signatures": bucket_list(aggs["signatures"]["buckets"], "signature"),
        "top_source_ips": bucket_list(aggs["source_ips"]["buckets"], "ip"),
        "top_destination_ips": bucket_list(aggs["dest_ips"]["buckets"], "ip"),
        "unique_destination_ips": aggs["unique_dest_ips"]["value"],
        "active_blocking_rules": aggs["active_rules"]["value"],
        "last_blocked_at": aggs["last_blocked"].get("value_as_string"),
        "top_rule": aggs["signatures"]["buckets"][0]["key"] if aggs["signatures"]["buckets"] else None,
        "by_type": bucket_list(aggs["by_type"]["buckets"], "type"),
    }


async def get_events(
    hours: int = 24,
    limit: int = 50,
    offset: int = 0,
    event_type: str = "all",
    only_blocked: bool = False,
    source_ip: str | None = None,
    destination_ip: str | None = None,
    domain: str | None = None,
    signature: str | None = None,
    severity: int | None = None,
) -> dict:
    policy = await _active_block_policy() if only_blocked else {}
    extra_filters = event_search_filters(
        event_type=event_type,
        only_blocked=False,
        source_ip=source_ip,
        destination_ip=destination_ip,
        domain=domain,
        signature=signature,
        severity=severity,
    )
    if only_blocked:
        extra_filters.append(blocked_event_filter(_policy_rule_ids(policy)))
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours, extra_filters),
        sort=[{"@timestamp": {"order": "desc"}}],
        size=limit,
        from_=offset,
        _source=True,
    )
    hits = resp["hits"]["hits"]
    events = [hit["_source"] for hit in hits]
    enriched = await asyncio.gather(*[enrich_event(event) for event in events])
    if only_blocked:
        enriched = [_annotate_block(event, policy) for event in enriched]
    return {
        "hours": hours,
        "limit": limit,
        "offset": offset,
        "total": resp["hits"]["total"]["value"],
        "events": list(enriched),
    }


async def get_blocked_events(
    hours: int = 24,
    limit: int = 50,
    offset: int = 0,
    event_type: str = "all",
    source_ip: str | None = None,
    destination_ip: str | None = None,
    domain: str | None = None,
    signature: str | None = None,
    severity: int | None = None,
    block_source: str = "all",
) -> dict:
    # Pull a little extra when filtering by derived block source because ES does not store it.
    query_limit = limit if block_source == "all" else min(100, limit * 3)
    response = await get_events(
        hours=hours,
        limit=query_limit,
        offset=offset,
        event_type=event_type,
        only_blocked=True,
        source_ip=source_ip,
        destination_ip=destination_ip,
        domain=domain,
        signature=signature,
        severity=severity,
    )
    filtered_events = _filter_block_source(response["events"], block_source)[:limit]
    return {**response, "limit": limit, "block_source": block_source, "events": filtered_events}


async def get_geo(
    hours: int = 24,
    direction: str = "both",
    event_type: str = "all",
    only_blocked: bool = False,
    only_malicious: bool = False,
    min_count: int = 1,
) -> dict:
    empty_response = {
        "hours": hours,
        "direction": direction,
        "event_type": event_type,
        "only_blocked": only_blocked,
        "only_malicious": only_malicious,
        "min_count": min_count,
        "total_events": 0,
        "geolocated_observations": 0,
        "countries": [],
        "cities": [],
        "isps": [],
        "points": [],
    }

    policy = await _active_block_policy() if only_blocked else {}
    blocked_filter = blocked_event_filter(_policy_rule_ids(policy), keyword=False) if only_blocked else None

    try:
        geo = await aggregate_geo_from_elasticsearch(
            es=es,
            index=settings.elasticsearch_enriched_index,
            query=bool_query(
                hours,
                _geo_filters(
                    event_type=event_type,
                    only_blocked=only_blocked,
                    only_malicious=only_malicious,
                    blocked_filter=blocked_filter,
                ),
            ),
            direction=direction,
            min_count=min_count,
        )
    except NotFoundError:
        return empty_response

    return {**empty_response, **geo}
