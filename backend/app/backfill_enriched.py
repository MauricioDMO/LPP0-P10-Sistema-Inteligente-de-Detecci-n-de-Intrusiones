"""Backfill de eventos crudos hacia indices enriquecidos persistidos.

Uso dentro del contenedor backend:
    python -m app.backfill_enriched --hours 168
"""

import argparse
import asyncio
import logging

from elasticsearch.helpers import async_bulk, async_scan

from .analytics.queries import bool_query
from .config import settings
from .enriched_writer import _add_geo_points, _event_id, _index_name, ensure_enriched_template
from .enricher import enrich_event
from .es_client import es

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def _actions(hours: int):
    async for hit in async_scan(
        client=es,
        index=settings.elasticsearch_index,
        query={"query": bool_query(hours)},
        size=500,
        preserve_order=False,
    ):
        event = await enrich_event(hit.get("_source", {}))
        yield {
            "_op_type": "index",
            "_index": _index_name(event),
            "_id": _event_id(event),
            "_source": _add_geo_points(event),
        }


async def run_backfill(hours: int) -> None:
    await ensure_enriched_template()
    success, errors = await async_bulk(
        client=es,
        actions=_actions(hours),
        chunk_size=500,
        raise_on_error=False,
        stats_only=True,
    )
    logger.info("Backfill terminado: %s documentos indexados, %s errores", success, errors)
    await es.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill de suricata-* a suricata-enriched-*")
    parser.add_argument("--hours", type=int, default=168, help="Periodo historico completo a procesar")
    args = parser.parse_args()
    asyncio.run(run_backfill(args.hours))


if __name__ == "__main__":
    main()
