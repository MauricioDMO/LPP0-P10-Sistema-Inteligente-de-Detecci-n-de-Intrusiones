"""Cliente Elasticsearch compartido."""

from elasticsearch import AsyncElasticsearch

from .config import settings

es = AsyncElasticsearch(
    hosts=[f"{settings.elasticsearch_scheme}://{settings.elasticsearch_host}:{settings.elasticsearch_port}"],
)
