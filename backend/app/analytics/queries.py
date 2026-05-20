"""Builders de queries y agregaciones para analytics historico."""

from datetime import datetime, timedelta, timezone


def since(hours: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


def range_filter(hours: int) -> dict:
    return {"range": {"@timestamp": {"gte": since(hours)}}}


def bool_query(hours: int, extra_filters: list | None = None) -> dict:
    filters = [range_filter(hours)]
    if extra_filters:
        filters.extend(extra_filters)
    return {"bool": {"filter": filters}}


def blocked_signature_filter() -> dict:
    return {
        "wildcard": {
            "suricata.eve.alert.signature.keyword": {
                "value": "*BLOQUEO*",
                "case_insensitive": True,
            }
        }
    }


def alert_filter() -> dict:
    return {"term": {"suricata.eve.event_type": "alert"}}


def overview_aggs() -> dict:
    return {
        "total": {"value_count": {"field": "@timestamp"}},
        "by_event_type": {
            "terms": {"field": "suricata.eve.event_type.keyword", "size": 20}
        },
        "by_severity": {
            "terms": {"field": "suricata.eve.alert.severity", "size": 10}
        },
        "unique_source_ips": {"cardinality": {"field": "source.ip.keyword"}},
        "unique_destination_ips": {"cardinality": {"field": "destination.ip.keyword"}},
        "alerts": {"filter": alert_filter()},
        "blocked": {"filter": blocked_signature_filter()},
    }


def timeline_aggs(interval: str) -> dict:
    return {
        "timeline": {
            "date_histogram": {
                "field": "@timestamp",
                "fixed_interval": interval,
                "min_doc_count": 0,
            },
            "aggs": {
                "alerts": {"filter": alert_filter()},
                "blocked": {"filter": blocked_signature_filter()},
                "critical": {
                    "filter": {"terms": {"suricata.eve.alert.severity": [1, 2]}}
                },
            },
        }
    }


def top_ips_aggs(field: str, size: int) -> dict:
    return {
        "top_ips": {
            "terms": {"field": field, "size": size},
            "aggs": {
                "max_severity": {"min": {"field": "suricata.eve.alert.severity"}},
                "event_types": {
                    "terms": {"field": "suricata.eve.event_type.keyword", "size": 8}
                },
                "signatures": {
                    "terms": {"field": "suricata.eve.alert.signature.keyword", "size": 5}
                },
                "last_seen": {"max": {"field": "@timestamp"}},
            },
        }
    }


def top_signatures_aggs(size: int) -> dict:
    return {
        "signatures": {
            "terms": {"field": "suricata.eve.alert.signature.keyword", "size": size},
            "aggs": {
                "severity": {
                    "terms": {"field": "suricata.eve.alert.severity", "size": 10}
                },
                "categories": {
                    "terms": {"field": "suricata.eve.alert.category.keyword", "size": 5}
                },
                "last_seen": {"max": {"field": "@timestamp"}},
            },
        }
    }


def blocked_aggs(size: int) -> dict:
    return {
        "total": {"value_count": {"field": "@timestamp"}},
        "signatures": {
            "terms": {"field": "suricata.eve.alert.signature.keyword", "size": size}
        },
        "source_ips": {"terms": {"field": "source.ip.keyword", "size": size}},
        "dest_ips": {"terms": {"field": "destination.ip.keyword", "size": size}},
        "by_type": {
            "terms": {"field": "suricata.eve.event_type.keyword", "size": 10}
        },
    }
