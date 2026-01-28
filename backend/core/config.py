"""
Конфигурация платформы Elements
"""
import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


def _split_strip(s: str) -> List[str]:
    """Разбивает строку по запятой и убирает пробелы."""
    return [x.strip() for x in s.split(",") if x.strip()]


class Settings(BaseSettings):
    """Настройки приложения"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        # Читать переменные окружения (DATABASE_URL -> database_url)
        env_prefix="",
    )

    # Основные настройки
    app_name: str = "Elements Platform"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False

    # База данных
    database_url: str = "postgresql://elements:elements@localhost:5433/elements"

    # JWT аутентификация
    secret_key: str = "elements-super-secret-key-change-in-production-min-32-chars"
    # Время жизни access token.
    # По умолчанию: 7 дней.
    # Если задано access_token_expire_seconds — оно имеет приоритет (удобно, если в инфраструктуре принято задавать TTL в секундах).
    access_token_expire_minutes: int = 60 * 24 * 7
    access_token_expire_seconds: int | None = None
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    # Лицензирование
    license_server_url: str = ""
    company_id: str = ""
    license_check_cache_ttl: int = 300

    # Модули — в .env строка "hr,it,tasks" (не JSON)
    enabled_modules: str = "hr,it,tasks"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Seed admin
    seed_admin_enabled: bool = True
    seed_admin_email: str = "admin@elements.local"
    seed_admin_password: str = "admin123"

    # CORS — в .env строка "*" или "http://a,http://b"
    cors_origins: str = "*"

    def get_enabled_modules(self) -> List[str]:
        return _split_strip(self.enabled_modules)

    def get_cors_origins(self) -> List[str]:
        out = _split_strip(self.cors_origins)
        return out if out else ["*"]

    # SupporIT / внешний IT (опционально)
    supporit_api_url: str = os.getenv("SUPPORIT_API_URL", "")
    supporit_token: str = os.getenv("SUPPORIT_TOKEN", "")
    supporit_timeout_seconds: int = int(os.getenv("SUPPORIT_TIMEOUT_SECONDS", "10"))

    # AD, Mailcow, 1C ZUP (опционально, для integrations)
    ad_server: str = os.getenv("AD_SERVER", "")
    ad_user: str = os.getenv("AD_USER", "")
    ad_password: str = os.getenv("AD_PASSWORD", "")
    ad_base_dn: str = os.getenv("AD_BASE_DN", "")
    ad_use_ssl: bool = os.getenv("AD_USE_SSL", "true").lower() == "true"
    mailcow_api_url: str = os.getenv("MAILCOW_API_URL", "")
    mailcow_api_key: str = os.getenv("MAILCOW_API_KEY", "")
    zup_api_url: str = os.getenv("ZUP_API_URL", "")
    zup_username: str = os.getenv("ZUP_USERNAME", "")
    zup_password: str = ""


# Глобальный экземпляр настроек
settings = Settings()

# Валидация критичных настроек при импорте
if len(settings.secret_key) < 32:
    raise ValueError(
        "SECRET_KEY должен быть минимум 32 символа. "
        "Сгенерируйте командой: openssl rand -hex 32"
    )
