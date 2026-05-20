"""Analisis geografico completo sobre eventos enriquecidos persistidos."""

from collections import Counter, defaultdict
from typing import Any

COMPOSITE_PAGE_SIZE = 1000


def _field(direction: str, name: str) -> str:
    return f"_geo.{direction}.{name}"


def _location_query(base_query: dict, direction: str) -> dict:
    return {
        "bool": {
            "filter": [
                base_query,
                {"exists": {"field": _field(direction, "lat")}},
                {"exists": {"field": _field(direction, "lon")}},
            ]
        }
    }


def _composite_sources(direction: str) -> list[dict]:
    return [
        {"lat": {"terms": {"field": _field(direction, "lat")}}},
        {"lon": {"terms": {"field": _field(direction, "lon")}}},
        {"country": {"terms": {"field": _field(direction, "country"), "missing_bucket": True}}},
        {"city": {"terms": {"field": _field(direction, "city"), "missing_bucket": True}}},
        {"isp": {"terms": {"field": _field(direction, "isp"), "missing_bucket": True}}},
    ]


def _composite_agg(direction: str, after_key: dict | None = None) -> dict:
    composite: dict[str, Any] = {
        "size": COMPOSITE_PAGE_SIZE,
        "sources": _composite_sources(direction),
    }
    if after_key:
        composite["after"] = after_key
    return {"locations": {"composite": composite}}


def _clean_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _valid_coordinate(lat: Any, lon: Any) -> bool:
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return False
    if lat == 0 and lon == 0:
        return False
    return -90 <= lat <= 90 and -180 <= lon <= 180


def _ranked(counter: Counter, key_name: str) -> list[dict]:
    return [{key_name: key, "count": count} for key, count in counter.most_common()]


async def aggregate_geo_from_elasticsearch(es, index: str, query: dict) -> dict:
    """Recorre todas las ubicaciones del periodo con composite aggs paginadas."""
    total_resp = await es.count(index=index, query=query, ignore_unavailable=True)
    total_events = total_resp.get("count", 0)

    countries = Counter()
    cities = Counter()
    isps = Counter()
    point_counts = Counter()
    point_countries: dict[tuple[float, float], Counter] = defaultdict(Counter)
    point_cities: dict[tuple[float, float], Counter] = defaultdict(Counter)
    point_isps: dict[tuple[float, float], Counter] = defaultdict(Counter)
    geolocated_observations = 0

    for direction in ("source", "destination"):
        after_key = None
        while True:
            resp = await es.search(
                index=index,
                query=_location_query(query, direction),
                size=0,
                aggs=_composite_agg(direction, after_key),
                ignore_unavailable=True,
            )
            locations = resp.get("aggregations", {}).get("locations", {})
            buckets = locations.get("buckets", [])

            for bucket in buckets:
                key = bucket.get("key", {})
                lat = key.get("lat")
                lon = key.get("lon")
                count = bucket.get("doc_count", 0)
                if not _valid_coordinate(lat, lon):
                    continue

                country = _clean_text(key.get("country"))
                city = _clean_text(key.get("city"))
                isp = _clean_text(key.get("isp"))
                point_key = (float(lat), float(lon))

                geolocated_observations += count
                point_counts[point_key] += count
                if country:
                    countries[country] += count
                    point_countries[point_key][country] += count
                if city:
                    cities[city] += count
                    point_cities[point_key][city] += count
                if isp:
                    isps[isp] += count
                    point_isps[point_key][isp] += count

            after_key = locations.get("after_key")
            if not after_key:
                break

    points = []
    for (lat, lon), count in point_counts.most_common():
        country = point_countries[(lat, lon)].most_common(1)
        city = point_cities[(lat, lon)].most_common(1)
        isp = point_isps[(lat, lon)].most_common(1)
        points.append(
            {
                "lat": lat,
                "lon": lon,
                "country": country[0][0] if country else None,
                "city": city[0][0] if city else None,
                "isp": isp[0][0] if isp else None,
                "count": count,
            }
        )

    return {
        "total_events": total_events,
        "geolocated_observations": geolocated_observations,
        "countries": _ranked(countries, "country"),
        "cities": _ranked(cities, "city"),
        "isps": _ranked(isps, "isp"),
        "points": points,
    }
