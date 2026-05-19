"""Cliente Elasticsearch para consulta de eventos."""
import asyncio
from elasticsearch import AsyncElasticsearch
from .config import settings
from .enricher import enrich_event

es = AsyncElasticsearch(
    hosts=[f"{settings.elasticsearch_scheme}://{settings.elasticsearch_host}:{settings.elasticsearch_port}"],
)


async def get_latest(limit: int = 10, event_type: str = None, severity: int = None) -> list:
    filters = []
    if event_type:
        filters.append({"term": {"suricata.eve.event_type": event_type}})
    if severity is not None:
        filters.append({"term": {"suricata.eve.alert.severity": severity}})

    query = {"bool": {"must": filters}} if filters else {"match_all": {}}

    resp = await es.search(
        index=settings.elasticsearch_index,
        query=query,
        sort=[{"@timestamp": {"order": "desc"}}],
        size=limit,
        _source=True,
    )
    events = [hit["_source"] for hit in resp["hits"]["hits"]]
    enriched = await asyncio.gather(*[enrich_event(e) for e in events])
    return list(enriched)


async def get_stats(hours: int = 24) -> dict:
    from datetime import datetime, timedelta, timezone
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    resp = await es.search(
        index=settings.elasticsearch_index,
        query={"range": {"@timestamp": {"gte": since}}},
        size=0,
        aggs={
            "total": {"value_count": {"field": "@timestamp"}},
            "by_event_type": {
                "terms": {"field": "suricata.eve.event_type.keyword", "size": 20}
            },
            "by_severity": {
                "terms": {"field": "suricata.eve.alert.severity", "size": 10}
            },
            "top_source_ips": {
                "terms": {"field": "source.ip.keyword", "size": 10}
            },
        },
    )
    aggs = resp["aggregations"]

    severity_labels = {1: "critical", 2: "high", 3: "medium", 4: "low"}
    by_severity = {}
    for bucket in aggs["by_severity"]["buckets"]:
        label = severity_labels.get(bucket["key"], str(bucket["key"]))
        by_severity[label] = bucket["doc_count"]

    return {
        "hours": hours,
        "total_events": aggs["total"]["value"],
        "by_type": {b["key"]: b["doc_count"] for b in aggs["by_event_type"]["buckets"]},
        "by_severity": by_severity,
        "top_source_ips": [
            {"ip": b["key"], "count": b["doc_count"]} for b in aggs["top_source_ips"]["buckets"]
        ],
    }


async def search_events(query: str, limit: int = 20, offset: int = 0) -> dict:
    resp = await es.search(
        index=settings.elasticsearch_index,
        query={
            "query_string": {
                "query": query,
                "default_field": "event.original",
            }
        },
        sort=[{"@timestamp": {"order": "desc"}}],
        size=limit,
        from_=offset,
        _source=True,
    )
    hits = resp["hits"]["hits"]
    events = [hit["_source"] for hit in hits]
    enriched = await asyncio.gather(*[enrich_event(e) for e in events])
    return {
        "query": query,
        "total": resp["hits"]["total"]["value"],
        "limit": limit,
        "offset": offset,
        "events": list(enriched),
    }
