"""Resolución inversa de IPs a nombres de dominio con caché."""
import asyncio
import socket
import logging
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

_cache: Dict[str, Tuple[str, datetime]] = {}
_cache_ttl = timedelta(hours=1)


async def resolve(ip: str) -> Optional[str]:
    now = datetime.now(timezone.utc)
    cached = _cache.get(ip)
    if cached and cached[1] > now:
        return cached[0]

    try:
        hostname, _, _ = await asyncio.get_event_loop().run_in_executor(
            None, socket.gethostbyaddr, ip
        )
        _cache[ip] = (hostname, now + _cache_ttl)
        return hostname
    except (socket.herror, socket.gaierror, OSError):
        _cache[ip] = (None, now + _cache_ttl)
        return None


async def enrich_event(event: dict) -> dict:
    src_ip = event.get("source", {}).get("ip")
    dest_ip = event.get("destination", {}).get("ip")

    src_hostname, dest_hostname = None, None
    tasks = []
    if src_ip:
        tasks.append(resolve(src_ip))
    if dest_ip:
        tasks.append(resolve(dest_ip))

    if tasks:
        results = await asyncio.gather(*tasks)
        if src_ip:
            src_hostname = results.pop(0)
        if dest_ip:
            dest_hostname = results.pop(0)

    event["_resolved"] = {
        "source_hostname": src_hostname,
        "dest_hostname": dest_hostname,
    }
    return event
