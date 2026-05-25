"""Runtime health counters for the backend process."""

from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any


_recent_events: deque[datetime] = deque()
_last_event: dict[str, Any] | None = None
_redis_connected = False
_websocket_clients = 0
_last_enriched_write_error: dict[str, str] | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _prune_events(now: datetime) -> None:
    cutoff = now - timedelta(minutes=1)
    while _recent_events and _recent_events[0] < cutoff:
        _recent_events.popleft()


def record_event(event: dict[str, Any]) -> None:
    global _last_event
    now = _now()
    _recent_events.append(now)
    _prune_events(now)
    _last_event = {
        "received_at": now.isoformat(),
        "timestamp": event.get("@timestamp") or event.get("timestamp"),
        "event_type": event.get("event_type") or event.get("suricata", {}).get("eve", {}).get("event_type"),
        "source_ip": event.get("source", {}).get("ip"),
        "destination_ip": event.get("destination", {}).get("ip"),
        "signature": event.get("suricata", {}).get("eve", {}).get("alert", {}).get("signature")
        or event.get("alert", {}).get("signature"),
    }


def set_redis_connected(value: bool) -> None:
    global _redis_connected
    _redis_connected = value


def set_websocket_clients(value: int) -> None:
    global _websocket_clients
    _websocket_clients = max(value, 0)


def record_enriched_write_error(error: Exception) -> None:
    global _last_enriched_write_error
    _last_enriched_write_error = {"timestamp": _now().isoformat(), "message": str(error)}


def snapshot() -> dict[str, Any]:
    now = _now()
    _prune_events(now)
    return {
        "timestamp": now.isoformat(),
        "redis_connected": _redis_connected,
        "websocket_clients": _websocket_clients,
        "last_event": _last_event,
        "events_per_minute": len(_recent_events),
        "last_enriched_write_error": _last_enriched_write_error,
    }
