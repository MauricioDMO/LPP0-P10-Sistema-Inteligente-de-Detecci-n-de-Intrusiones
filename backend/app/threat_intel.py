import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Tuple

logger = logging.getLogger(__name__)

_cache: Dict[str, Tuple[Optional[dict], datetime]] = {}
_cache_ttl = timedelta(hours=24)

ABUSEIPDB_KEY = os.getenv("BACKEND_ABUSEIPDB_KEY", "")


async def check_ip(ip: str) -> Optional[dict]:
    if not ABUSEIPDB_KEY:
        return None

    now = datetime.now(timezone.utc)
    cached = _cache.get(ip)
    if cached and cached[1] > now:
        return cached[0]

    result = await _query_abuseipdb(ip)
    _cache[ip] = (result, now + _cache_ttl)
    return result


async def _query_abuseipdb(ip: str) -> Optional[dict]:
    try:
        import aiohttp
        url = "https://api.abuseipdb.com/api/v2/check"
        headers = {
            "Key": ABUSEIPDB_KEY,
            "Accept": "application/json",
        }
        params = {
            "ipAddress": ip,
            "maxAgeInDays": "90",
            "verbose": "",
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(
                url, headers=headers, params=params,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    logger.warning("AbuseIPDB returned status %d for %s", resp.status, ip)
                    return None
                data = await resp.json()
                info = data.get("data", {})
                return {
                    "is_malicious": info.get("abuseConfidenceScore", 0) > 0,
                    "confidence": info.get("abuseConfidenceScore", 0),
                    "total_reports": info.get("totalReports", 0),
                    "isp": info.get("isp"),
                    "domain": info.get("domain"),
                    "country_code": info.get("countryCode"),
                    "usage_type": info.get("usageType"),
                    "is_tor": info.get("isTor", False),
                    "last_reported": info.get("lastReportedAt"),
                }
    except Exception as e:
        logger.debug("AbuseIPDB query failed for %s: %s", ip, e)
        return None


async def enrich_threat(event: dict) -> dict:
    src_ip = event.get("source", {}).get("ip")
    if not src_ip:
        event["_threat"] = None
        return event

    threat = await check_ip(src_ip)
    event["_threat"] = threat
    return event
