import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class GatewaySettings(BaseSettings):
    """
    Layer 2 Gateway Configuration.
    Loaded from environment variables or .env file.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # General
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8080
    SERVICE_NAME: str = "dakini-layer2-gateway"
    SERVICE_VERSION: str = "1.0.0"

    # E1: Edge Shield (CDN / WAF / Cloudflare integration)
    EDGE_SHIELD_ENABLED: bool = False
    EDGE_SHIELD_HEADER_NAME: str = "X-Edge-Secret"
    EDGE_SHIELD_SECRET: str = ""
    TRUSTED_PROXIES: List[str] = ["127.0.0.1", "::1"]

    # E2 & E3: Upstream Layer 3 Backend Routing
    UPSTREAM_API_URL: str = "http://localhost:8000"

    # Private Layer 9 reporting service. Reach it only through this gateway.
    ANALYTICS_API_URL: str = "http://localhost:8090"
    UPSTREAM_TIMEOUT_SECONDS: float = 60.0
    MOCK_UPSTREAM_IF_DOWN: bool = False  # False by default; only allowed in development

    @property
    def is_production(self) -> bool:
        """Determines if running in production or staging mode."""
        return self.ENVIRONMENT.lower() in ("production", "prod", "staging")

    @property
    def can_mock_upstream(self) -> bool:
        """
        Mock fallback is STRICTLY disabled in production and staging environments.
        Can only be enabled during local development when explicitly configured.
        """
        if self.is_production:
            return False
        return self.MOCK_UPSTREAM_IF_DOWN

    def validate_production_security(self) -> None:
        """Validates that production runs cannot use insecure development defaults."""
        if self.is_production:
            if not self.JWKS_URL and (
                not self.JWT_SECRET
                or self.JWT_SECRET == "dakini-crm-dev-super-secret-key-change-in-production-123456789"
                or len(self.JWT_SECRET) < 32
            ):
                raise ValueError(
                    "CRITICAL: Production deployment requires a secure JWT_SECRET (min 32 chars) "
                    "or a valid JWKS_URL set via environment variables. Default development secrets are forbidden."
                )

    # E7: Request Tracing & Correlation
    CORRELATION_ID_HEADER: str = "X-Correlation-ID"
    REQUEST_ID_HEADER: str = "X-Request-ID"

    # E6: Request Validation Limits
    MAX_HEADER_SIZE_BYTES: int = 16 * 1024  # 16 KB
    MAX_BODY_SIZE_BYTES: int = 1 * 1024 * 1024  # 1 MB non-upload
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB upload routes
    ALLOWED_HTTP_METHODS: List[str] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
    CORS_ALLOWED_ORIGINS: List[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://10.192.195.108:3000",  # Add this
]
    CORS_ALLOW_CREDENTIALS: bool = True

    # E4: Token Validation (JWT / JWKS)
    JWT_SECRET: str = "dakini-crm-dev-super-secret-key-change-in-production-123456789"
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: Optional[str] = None
    JWT_AUDIENCE: Optional[str] = None
    JWKS_URL: Optional[str] = None
    JWKS_CACHE_TTL_SECONDS: int = 3600
    PUBLIC_ROUTES: List[str] = [
        "/health",
        "/v1/health",
        "/v1/auth/login",
        "/v1/auth/token",
        "/v1/auth/refresh",
        "/docs",
        "/redoc",
        "/openapi.json",
    ]

    # E5: Rate Limiting & Quotas
    RATE_LIMIT_ENABLED: bool = True
    REDIS_URL: Optional[str] = None  # e.g., "redis://localhost:6379/0"
    
    # Specific rate limits: (count, window_seconds, fail_closed)
    RATE_LIMIT_LOGIN: int = 10            # 10 per 60s (fail-closed)
    RATE_LIMIT_READS: int = 300           # 300 per 60s (fail-open)
    RATE_LIMIT_WRITES: int = 60           # 60 per 60s (fail-open)
    RATE_LIMIT_BULK: int = 5              # 5 per 3600s (fail-closed)
    RATE_LIMIT_AI: int = 20               # 20 per 60s (fail-closed)
    RATE_LIMIT_WEBHOOKS: int = 100        # 100 per 60s (fail-open)
    RATE_LIMIT_TENANT: int = 3000         # 3000 per 60s (fail-open)


settings = GatewaySettings()
