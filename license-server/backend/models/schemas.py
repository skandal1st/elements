"""
Pydantic схемы для API сервера лицензирования
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ModuleInfo(BaseModel):
    """Информация о модуле"""
    code: str
    name: str
    features: Optional[dict] = None


class LicenseCheckRequest(BaseModel):
    """Запрос на проверку лицензии"""
    company_id: str = Field(..., description="ID компании")
    module: str = Field(..., description="Код модуля (hr, it, finance)")


class LicenseCheckResponse(BaseModel):
    """Ответ на проверку лицензии"""
    valid: bool = Field(..., description="Действительна ли лицензия")
    expires_at: Optional[datetime] = Field(None, description="Дата истечения подписки")
    features: Optional[dict] = Field(None, description="Доступные функции модуля")
    message: Optional[str] = Field(None, description="Сообщение об ошибке")


class ModulesResponse(BaseModel):
    """Ответ со списком доступных модулей"""
    modules: List[str] = Field(..., description="Список кодов доступных модулей")
    expires_at: Optional[datetime] = Field(None, description="Дата истечения подписки")
    plan_name: Optional[str] = Field(None, description="Название тарифного плана")


class SubscriptionCreate(BaseModel):
    """Создание подписки"""
    company_id: str
    plan_name: str
    modules: List[str]  # Список кодов модулей
    starts_at: datetime
    expires_at: datetime
    auto_renew: bool = True


class SubscriptionUpdate(BaseModel):
    """Обновление подписки"""
    status: Optional[str] = None
    expires_at: Optional[datetime] = None
    auto_renew: Optional[bool] = None
