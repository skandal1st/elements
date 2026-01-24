"""
Конфигурация сервера лицензирования
"""
import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Настройки сервера лицензирования"""
    
    # Основные настройки
    app_name: str = "Elements License Server"
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # База данных
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://elements:elements@localhost:5432/elements_license"
    )
    
    # CORS
    cors_origins: List[str] = os.getenv("CORS_ORIGINS", "*").split(",")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
