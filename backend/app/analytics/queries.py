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


def text_match_filter(value: str, fields: list[str]) -> dict:
    return {
        "bool": {
            "should": [
                {
                    "wildcard": {
                        field: {
                            "value": f"*{value}*",
                            "case_insensitive": True,
                        }
                    }
                }
                for field in fields
            ],
            "minimum_should_match": 1,
        }
    }


def blocked_signature_filter(keyword: bool = True) -> dict:
    field = "suricata.eve.alert.signature.keyword" if keyword else "suricata.eve.alert.signature"
    return {
        "bool": {
            "should": [
                {
                    "wildcard": {
                        field: {
                            "value": pattern,
                            "case_insensitive": True,
                        }
                    }
                }
                for pattern in ("*BLOQUEO*", "*BLOCKED*", "*SURICATA-LIST block*")
            ],
            "minimum_should_match": 1,
        }
    }


def alert_action_blocked_filter(keyword: bool = True) -> dict:
    field = "suricata.eve.alert.action.keyword" if keyword else "suricata.eve.alert.action"
    return {"terms": {field: ["blocked", "drop", "reject"]}}


def rule_id_filter(rule_ids: list[tuple[int, int]]) -> dict:
    clauses = []
    for gid, sid in rule_ids:
        clauses.append(
            {
                "bool": {
                    "filter": [
                        {
                            "bool": {
                                "should": [
                                    {"term": {"suricata.eve.alert.gid": gid}},
                                    {"term": {"suricata.eve.alert.generator_id": gid}},
                                ],
                                "minimum_should_match": 1,
                            }
                        },
                        {
                            "bool": {
                                "should": [
                                    {"term": {"suricata.eve.alert.signature_id": sid}},
                                    {"term": {"suricata.eve.alert.sid": sid}},
                                ],
                                "minimum_should_match": 1,
                            }
                        },
                    ]
                }
            }
        )
        if gid == 1:
            clauses.append(
                {
                    "bool": {
                        "should": [
                            {"term": {"suricata.eve.alert.signature_id": sid}},
                            {"term": {"suricata.eve.alert.sid": sid}},
                        ],
                        "minimum_should_match": 1,
                    }
                }
            )
    return {
        "bool": {
            "should": clauses,
            "minimum_should_match": 1,
        }
    }


def blocked_event_filter(rule_ids: list[tuple[int, int]] | None = None, keyword: bool = True) -> dict:
    should = [blocked_signature_filter(keyword=keyword), alert_action_blocked_filter(keyword=keyword)]
    if rule_ids:
        should.append(rule_id_filter(rule_ids))
    return {"bool": {"should": should, "minimum_should_match": 1}}


def alert_filter() -> dict:
    return {"term": {"suricata.eve.event_type": "alert"}}


def event_search_filters(
    event_type: str = "all",
    only_blocked: bool = False,
    source_ip: str | None = None,
    destination_ip: str | None = None,
    domain: str | None = None,
    signature: str | None = None,
    severity: int | None = None,
) -> list[dict]:
    filters = []
    if event_type != "all":
        filters.append({"term": {"suricata.eve.event_type": event_type}})
    if only_blocked:
        filters.append(blocked_event_filter())
    if source_ip:
        filters.append({"term": {"source.ip.keyword": source_ip}})
    if destination_ip:
        filters.append({"term": {"destination.ip.keyword": destination_ip}})
    if domain:
        filters.append(
            text_match_filter(
                domain,
                [
                    "suricata.eve.dns.queries.rrname.keyword",
                    "suricata.eve.tls.sni.keyword",
                    "suricata.eve.http.hostname.keyword",
                    "suricata.eve.http.url.keyword",
                    "event.original.keyword",
                ],
            )
        )
    if signature:
        filters.append(text_match_filter(signature, ["suricata.eve.alert.signature.keyword"]))
    if severity is not None:
        filters.append({"term": {"suricata.eve.alert.severity": severity}})
    return filters


def overview_aggs(blocked_filter: dict | None = None) -> dict:
    blocked = blocked_filter or blocked_signature_filter()
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
        "blocked": {"filter": blocked},
    }


def timeline_aggs(interval: str, blocked_filter: dict | None = None) -> dict:
    blocked = blocked_filter or blocked_signature_filter()
    return {
        "timeline": {
            "date_histogram": {
                "field": "@timestamp",
                "fixed_interval": interval,
                "min_doc_count": 0,
            },
            "aggs": {
                "alerts": {"filter": alert_filter()},
                "blocked": {"filter": blocked},
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
        "unique_dest_ips": {"cardinality": {"field": "destination.ip.keyword"}},
        "active_rules": {"cardinality": {"field": "suricata.eve.alert.signature.keyword"}},
        "last_blocked": {"max": {"field": "@timestamp"}},
        "by_type": {
            "terms": {"field": "suricata.eve.event_type.keyword", "size": 10}
        },
    }
