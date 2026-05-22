"""Formatters para respuestas de agregaciones Elasticsearch."""

SEVERITY_LABELS = {1: "critical", 2: "high", 3: "medium", 4: "low"}


def severity_counts(buckets: list) -> dict:
    return {
        SEVERITY_LABELS.get(bucket["key"], str(bucket["key"])): bucket["doc_count"]
        for bucket in buckets
    }


def bucket_list(buckets: list, key_name: str = "key") -> list:
    return [{key_name: b["key"], "count": b["doc_count"]} for b in buckets]
