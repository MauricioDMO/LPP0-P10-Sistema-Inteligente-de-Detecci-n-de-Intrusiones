import logging
from . import resolver
from . import geoip
from . import threat_intel

logger = logging.getLogger(__name__)


async def enrich_event(event: dict) -> dict:
    event = await resolver.enrich_event(event)
    event = await geoip.enrich_geo(event)
    event = await threat_intel.enrich_threat(event)
    return event
