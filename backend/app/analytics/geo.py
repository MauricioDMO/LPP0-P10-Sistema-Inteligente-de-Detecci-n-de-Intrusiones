"""Analisis geografico basado en eventos enriquecidos."""

import asyncio
from collections import Counter

from ..enricher import enrich_event


async def aggregate_geo(events: list) -> dict:
    enriched = await asyncio.gather(*[enrich_event(e) for e in events]) if events else []

    countries = Counter()
    cities = Counter()
    isps = Counter()
    points = {}

    for event in enriched:
        for direction in ("source", "destination"):
            geo = event.get("_geo", {}).get(direction) or {}
            country = geo.get("country")
            city = geo.get("city")
            isp = geo.get("isp")
            lat = geo.get("lat")
            lon = geo.get("lon")

            if country:
                countries[country] += 1
            if city:
                cities[city] += 1
            if isp:
                isps[isp] += 1
            if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
                key = f"{round(lat, 2)},{round(lon, 2)}"
                point = points.setdefault(
                    key,
                    {
                        "lat": lat,
                        "lon": lon,
                        "country": country,
                        "city": city,
                        "isp": isp,
                        "count": 0,
                    },
                )
                point["count"] += 1

    return {
        "sample_size": len(enriched),
        "countries": [{"country": k, "count": v} for k, v in countries.most_common(15)],
        "cities": [{"city": k, "count": v} for k, v in cities.most_common(15)],
        "isps": [{"isp": k, "count": v} for k, v in isps.most_common(15)],
        "points": sorted(points.values(), key=lambda p: p["count"], reverse=True)[:100],
    }
