"""WebSocket fanout for Suricata apply progress."""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

active_apply_websockets: set[WebSocket] = set()
last_apply_event: dict[str, Any] | None = None


async def register_apply_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    active_apply_websockets.add(websocket)
    if last_apply_event is not None:
        await websocket.send_json(last_apply_event)


def unregister_apply_websocket(websocket: WebSocket) -> None:
    active_apply_websockets.discard(websocket)


async def broadcast_apply_event(event: dict[str, Any]) -> None:
    global last_apply_event
    payload = {"type": "suricata_apply", "timestamp": datetime.now(timezone.utc).isoformat(), **event}
    last_apply_event = payload
    for websocket in active_apply_websockets.copy():
        try:
            await websocket.send_json(payload)
        except Exception as exc:
            logger.warning("Error enviando progreso de apply a WebSocket: %s", exc)
            active_apply_websockets.discard(websocket)


def get_last_apply_event() -> dict[str, Any] | None:
    return last_apply_event
