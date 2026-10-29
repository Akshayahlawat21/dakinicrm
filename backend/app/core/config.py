import os
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """
    Centralized configuration management for Layer 3 Application Backend.
    Reads environment variables from .env file or system environment.
    """
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    AI_SERVICE_URL: str = "http://localhost:8001"
    AI_INTERNAL_API_KEY: str = ""

    # Runtime
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    SERVICE_NAME: str = "dakini-layer3-app"
    SERVICE_VERSION: str = "1.0.0"

    # Database Configuration (Supabase PostgreSQL / Local PostgreSQL / SQLite test)
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./crm_dev.db",
        description="SQLAlchemy connection URI (PostgreSQL psycopg or SQLite aiosqlite)"
    )
    SYNC_DATABASE_URL: Optional[str] = None

    # Connection Pool Management (Optimized for Supabase Session Pooler limit 15)
    DB_POOL_SIZE: int = 4
    DB_MAX_OVERFLOW: int = 3
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_STATEMENT_TIMEOUT_MS: int = 15000
    DB_ENABLE_RLS: bool = True

    # Supabase (Optional for direct storage / Auth)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # Security & Gateway Trust
    JWT_SECRET: str = "dakini-crm-dev-super-secret-key-change-in-production-123456789"
    JWT_ALGORITHM: str = "HS256"
    REQUIRE_TRUSTED_GATEWAY_HEADERS: bool = False

    # CORS
    CORS_ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    ]

    # Layer 9 Analytics integration
    ANALYTICS_SERVICE_URL: str = "http://localhost:8090"
    ANALYTICS_TIMEOUT_SECONDS: int = 5

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ("production", "prod", "staging")

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL.lower()

    @property
    def is_postgres(self) -> bool:
        return "postgres" in self.DATABASE_URL.lower()


settings = AppSettings()
