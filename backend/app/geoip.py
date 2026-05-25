import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_cache: Dict[str, Tuple[Optional[dict], datetime]] = {}
_cache_ttl = timedelta(hours=1)

GEOIP_DB_PATH = os.getenv("BACKEND_GEOIP_DB_PATH", "/data/GeoLite2-City.mmdb")

_reader = None


def geoip_database_available() -> bool:
    return os.path.exists(GEOIP_DB_PATH)

def _load_geoip_reader():
    global _reader
    if _reader is not None:
        return True
    try:
        import geoip2.database
        if os.path.exists(GEOIP_DB_PATH):
            _reader = geoip2.database.Reader(GEOIP_DB_PATH)
            logger.info("GeoIP: loaded GeoLite2-City.mmdb from %s", GEOIP_DB_PATH)
            return True
        else:
            logger.info("GeoIP: %s not found, will use ip-api.com fallback", GEOIP_DB_PATH)
            return False
    except ImportError:
        logger.info("GeoIP: geoip2 not installed, will use ip-api.com fallback")
        return False
    except Exception as e:
        logger.warning("GeoIP: failed to load mmdb: %s", e)
        return False


async def geoip_lookup(ip: str) -> Optional[dict]:
    now = datetime.now(timezone.utc)
    cached = _cache.get(ip)
    if cached and cached[1] > now:
        return cached[0]

    result = None
    if _load_geoip_reader():
        result = await _lookup_mmdb(ip)
    else:
        result = await _lookup_api(ip)

    _cache[ip] = (result, now + _cache_ttl)
    return result


async def _lookup_mmdb(ip: str) -> Optional[dict]:
    try:
        import geoip2.errors
        response = _reader.city(ip)
        return {
            "country": response.country.name,
            "country_code": response.country.iso_code,
            "city": response.city.name,
            "lat": response.location.latitude,
            "lon": response.location.longitude,
            "isp": response.traits.isp,
        }
    except geoip2.errors.AddressNotFoundError:
        return None
    except Exception as e:
        logger.debug("GeoIP mmdb lookup failed for %s: %s", ip, e)
        return None


async def _lookup_api(ip: str) -> Optional[dict]:
    try:
        import aiohttp
        url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,city,lat,lon,isp,query"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()
                if data.get("status") != "success":
                    return None
                return {
                    "country": data.get("country"),
                    "country_code": data.get("countryCode"),
                    "city": data.get("city"),
                    "lat": data.get("lat"),
                    "lon": data.get("lon"),
                    "isp": data.get("isp"),
                }
    except Exception as e:
        logger.debug("GeoIP API lookup failed for %s: %s", ip, e)
        return None


async def enrich_geo(event: dict) -> dict:
    src_ip = event.get("source", {}).get("ip")
    dest_ip = event.get("destination", {}).get("ip")

    src_geo, dest_geo = None, None
    tasks = []
    if src_ip:
        tasks.append(geoip_lookup(src_ip))
    if dest_ip:
        tasks.append(geoip_lookup(dest_ip))

    if tasks:
        results = await asyncio.gather(*tasks)
        if src_ip:
            src_geo = results.pop(0)
        if dest_ip:
            dest_geo = results.pop(0)

    event["_geo"] = {
        "source": src_geo,
        "destination": dest_geo,
    }
    return event
