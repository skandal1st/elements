"""
Configuration for License Server
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """License Server settings"""

    # Application
    app_name: str = "Elements License Server"
    app_version: str = "1.0.0"
    api_prefix: str = "/api/v1"

    # Database
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Security
    secret_key: str
    admin_api_key: str = ""  # Optional API key for admin endpoints

    # License validation
    default_cache_ttl: int = 300  # 5 minutes

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
