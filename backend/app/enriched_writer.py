"""Persistencia de eventos enriquecidos en Elasticsearch."""

import copy
import hashlib
import json
import logging
from datetime import datetime, timezone

from .config import settings
from .es_client import es

logger = logging.getLogger(__name__)

_template_ready = False


def _template_name() -> str:
    return f"{settings.elasticsearch_enriched_write_index}-template"


def _index_name(event: dict) -> str:
    raw_timestamp = event.get("@timestamp") or event.get("timestamp")
    try:
        if isinstance(raw_timestamp, str):
            parsed = datetime.fromisoformat(raw_timestamp.replace("Z", "+00:00"))
        else:
            parsed = datetime.now(timezone.utc)
    except ValueError:
        parsed = datetime.now(timezone.utc)
    return f"{settings.elasticsearch_enriched_write_index}-{parsed:%Y.%m.%d}"


def _event_id(event: dict) -> str:
    event_key = {
        "@timestamp": event.get("@timestamp"),
        "timestamp": event.get("timestamp"),
        "event": event.get("event"),
        "source": event.get("source"),
        "destination": event.get("destination"),
        "suricata": event.get("suricata"),
        "event_type": event.get("event_type"),
        "flow_id": event.get("flow_id"),
    }
    payload = json.dumps(event_key, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _add_geo_points(event: dict) -> dict:
    doc = copy.deepcopy(event)
    geo = doc.get("_geo")
    if not isinstance(geo, dict):
        return doc

    for direction in ("source", "destination"):
        point = geo.get(direction)
        if not isinstance(point, dict):
            continue

        lat = point.get("lat")
        lon = point.get("lon")
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            point["location"] = {"lat": lat, "lon": lon}

    return doc


async def ensure_enriched_template() -> None:
    """Crea/actualiza el template necesario para agregaciones historicas."""
    global _template_ready

    if _template_ready or not settings.enriched_index_enabled:
        return

    template = {
        "index_patterns": [f"{settings.elasticsearch_enriched_write_index}-*"],
        "template": {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
            },
            "mappings": {
                "dynamic": True,
                "properties": {
                    "@timestamp": {"type": "date"},
                    "timestamp": {"type": "date"},
                    "source": {
                        "properties": {
                            "ip": {"type": "ip"},
                            "port": {"type": "integer"},
                        }
                    },
                    "destination": {
                        "properties": {
                            "ip": {"type": "ip"},
                            "port": {"type": "integer"},
                        }
                    },
                    "suricata": {
                        "properties": {
                            "eve": {
                                "properties": {
                                    "event_type": {"type": "keyword"},
                                    "alert": {
                                        "properties": {
                                            "signature": {"type": "keyword"},
                                            "category": {"type": "keyword"},
                                            "severity": {"type": "integer"},
                                        }
                                    },
                                }
                            }
                        }
                    },
                    "_resolved": {
                        "properties": {
                            "source_hostname": {"type": "keyword"},
                            "dest_hostname": {"type": "keyword"},
                        }
                    },
                    "_geo": {
                        "properties": {
                            "source": {
                                "properties": {
                                    "country": {"type": "keyword"},
                                    "country_code": {"type": "keyword"},
                                    "city": {"type": "keyword"},
                                    "isp": {"type": "keyword"},
                                    "lat": {"type": "float"},
                                    "lon": {"type": "float"},
                                    "location": {"type": "geo_point"},
                                }
                            },
                            "destination": {
                                "properties": {
                                    "country": {"type": "keyword"},
                                    "country_code": {"type": "keyword"},
                                    "city": {"type": "keyword"},
                                    "isp": {"type": "keyword"},
                                    "lat": {"type": "float"},
                                    "lon": {"type": "float"},
                                    "location": {"type": "geo_point"},
                                }
                            },
                        }
                    },
                    "_threat": {
                        "properties": {
                            "is_malicious": {"type": "boolean"},
                            "confidence": {"type": "integer"},
                            "total_reports": {"type": "integer"},
                            "isp": {"type": "keyword"},
                            "domain": {"type": "keyword"},
                            "country_code": {"type": "keyword"},
                            "usage_type": {"type": "keyword"},
                            "is_tor": {"type": "boolean"},
                            "last_reported": {"type": "date"},
                        }
                    },
                }
            },
        },
    }

    try:
        await es.indices.put_index_template(name=_template_name(), body=template)
        _template_ready = True
        logger.info("Template de indice enriquecido listo: %s", _template_name())
    except Exception as exc:
        logger.warning("No se pudo preparar el template enriquecido: %s", exc)


async def persist_enriched_event(event: dict) -> None:
    """Guarda un evento enriquecido sin afectar el streaming si falla ES."""
    if not settings.enriched_index_enabled:
        return

    try:
        await ensure_enriched_template()
        await es.index(
            index=_index_name(event),
            id=_event_id(event),
            document=_add_geo_points(event),
        )
    except Exception as exc:
        logger.warning("No se pudo persistir evento enriquecido: %s", exc)
