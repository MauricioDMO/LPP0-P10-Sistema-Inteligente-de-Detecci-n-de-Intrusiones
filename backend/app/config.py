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

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://suricata:suricata@localhost:5432/suricata"

    # JWT
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 480

    # Session cookie
    session_cookie_name: str = "suricata_session"
    csrf_cookie_name: str = "suricata_csrf"
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"

    # CORS
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"

    # Bootstrap admin
    initial_admin_username: str = "admin"
    initial_admin_password: str = "admin123"
    initial_admin_email: Optional[str] = "admin@example.com"

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

    # Suricata management
    suricata_container_name: str = "suricata"

    class Config:
        env_file = ".env"
        env_prefix = "BACKEND_"
        case_sensitive = False

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


settings = Settings()
