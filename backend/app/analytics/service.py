"""Servicios publicos de analytics historico."""

from ..config import settings
from ..es_client import es
from .formatters import bucket_list, severity_counts
from .geo import aggregate_geo
from .queries import (
    alert_filter,
    blocked_aggs,
    blocked_signature_filter,
    bool_query,
    overview_aggs,
    timeline_aggs,
    top_ips_aggs,
    top_signatures_aggs,
)


async def get_overview(hours: int = 24) -> dict:
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours),
        size=0,
        aggs=overview_aggs(),
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
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours),
        size=0,
        aggs=timeline_aggs(interval),
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
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours, [blocked_signature_filter()]),
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
        "by_type": bucket_list(aggs["by_type"]["buckets"], "type"),
    }


async def get_geo(hours: int = 24, sample_size: int = 200) -> dict:
    resp = await es.search(
        index=settings.elasticsearch_index,
        query=bool_query(hours),
        sort=[{"@timestamp": {"order": "desc"}}],
        size=sample_size,
        _source=True,
    )
    events = [hit["_source"] for hit in resp["hits"]["hits"]]
    geo = await aggregate_geo(events)
    return {"hours": hours, **geo}
