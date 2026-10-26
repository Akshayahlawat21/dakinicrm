import json
from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ANALYTICS_DIR = Path(__file__).resolve().parent.parent
_PROJECT_ROOT = _ANALYTICS_DIR.parent
_BACKEND_DIR = _PROJECT_ROOT / "backend"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[
            str(_ANALYTICS_DIR / ".env"),
            str(_BACKEND_DIR / ".env"),
            str(_PROJECT_ROOT / ".env"),
            ".env",
        ],
        extra="ignore",
    )
    database_url: str = Field("", alias="DATABASE_URL")
    pool_size: int = Field(5, ge=1, le=50, alias="DATABASE_POOL_SIZE")
    max_overflow: int = Field(5, ge=0, le=50, alias="DATABASE_MAX_OVERFLOW")
    pool_timeout: int = Field(10, ge=1, le=60, alias="DATABASE_POOL_TIMEOUT")
    tenant_slug_map_json: str = Field("{}", alias="TENANT_SLUG_MAP_JSON")
    won_values_csv: str = Field("won,closed_won,closed-won", alias="WON_VALUES")
    lost_values_csv: str = Field("lost,closed_lost,closed-lost", alias="LOST_VALUES")
    allow_empty_tenant: bool = Field(False, alias="ALLOW_EMPTY_TENANT")

    @property
    def tenant_slug_map(self) -> dict[str, str]:
        try:
            data = json.loads(self.tenant_slug_map_json)
        except json.JSONDecodeError as exc:
            raise ValueError("TENANT_SLUG_MAP_JSON must be valid JSON") from exc
        if not isinstance(data, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in data.items()):
            raise ValueError("TENANT_SLUG_MAP_JSON must map strings to strings")
        return data

    @property
    def won_values(self) -> list[str]:
        return [v.strip().lower() for v in self.won_values_csv.split(",") if v.strip()]

    @property
    def lost_values(self) -> list[str]:
        return [v.strip().lower() for v in self.lost_values_csv.split(",") if v.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
