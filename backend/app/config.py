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
    elasticsearch_enriched_index: str = "suricata-enriched-*"
    elasticsearch_enriched_write_index: str = "suricata-enriched"
    enriched_index_enabled: bool = True

    # FastAPI
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_title: str = "Suricata Backend API"
    api_version: str = "1.0.0"

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # AbuseIPDB
    abuseipdb_key: str = ""

    # GeoIP
    geoip_db_path: str = "/data/GeoLite2-City.mmdb"

    class Config:
        env_file = ".env"
        env_prefix = "BACKEND_"
        case_sensitive = False


settings = Settings()
