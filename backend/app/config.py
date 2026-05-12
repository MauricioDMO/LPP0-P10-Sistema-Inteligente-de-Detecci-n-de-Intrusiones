from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Configuracion del backend."""

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_channel: str = "suricata"

    # Elasticsearch
    elasticsearch_host: str = "localhost"
    elasticsearch_port: int = 9200
    elasticsearch_scheme: str = "http"
    elasticsearch_index: str = "suricata-*"

    # FastAPI
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_title: str = "Suricata Backend API"
    api_version: str = "1.0.0"

    class Config:
        env_file = ".env"
        env_prefix = "BACKEND_"
        case_sensitive = False


settings = Settings()
