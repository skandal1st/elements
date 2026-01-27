from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Elements HR"
    api_v1_prefix: str = "/api/v1"

    # Authentication (общий секрет для всех модулей Elements)
    secret_key: str = "change-me"
    # 7 дней
    access_token_expire_minutes: int = 60 * 24 * 7

    # Database (PostgreSQL)
    database_url: str = "postgresql://elements:elements@localhost:5432/elements"

    # Redis
    redis_url: str | None = None

    # RabbitMQ (Event Bus)
    rabbitmq_url: str | None = None

    # SupporIT integration
    supporit_api_url: str | None = None
    supporit_token: str | None = None
    supporit_timeout_seconds: int = 10

    # Active Directory
    ad_server: str | None = None
    ad_user: str | None = None
    ad_password: str | None = None
    ad_base_dn: str | None = None
    ad_domain: str | None = None
    ad_use_ssl: bool = True
    ad_timeout_seconds: int = 10

    # Mailcow
    mailcow_api_url: str | None = None
    mailcow_api_key: str | None = None

    # 1C ZUP
    zup_api_url: str | None = None
    zup_username: str | None = None
    zup_password: str | None = None
    zup_webhook_token: str | None = None

    # Seed admin
    seed_admin_enabled: bool = True
    seed_admin_email: str = "admin@elements.local"
    seed_admin_password: str = "admin123"
    seed_admin_role: str = "admin"


settings = Settings()
