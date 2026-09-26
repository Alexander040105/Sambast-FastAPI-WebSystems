"""
Application configuration — loaded from backend/.env via pydantic-settings.
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        ..., description="Pooled Neon connection URL (used at runtime)"
    )
    DATABASE_URL_DIRECT: str = Field(
        default="", description="Unpooled Neon URL (used by Alembic migrations)"
    )

    # ── JWT ────────────────────────────────────────────────────────────────
    JWT_SECRET: str = Field(..., description="HMAC secret for JWT signing")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # ── SMTP / email ──────────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # ── Geocoding ─────────────────────────────────────────────────────────
    NOMINATIM_USER_AGENT: str = "sambast-delivery/1.0"

    # ── Delivery costing (v1: base + per-km) ──────────────────────────────
    DELIVERY_BASE_FEE: float = 50.0
    DELIVERY_PER_KM: float = 15.0
    # Warehouse origin for distance calculation (Quezon City default)
    WAREHOUSE_LAT: float = 14.6760
    WAREHOUSE_LNG: float = 121.0437

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
