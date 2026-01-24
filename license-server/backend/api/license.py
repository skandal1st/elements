"""
API endpoints для проверки лицензий
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models.subscription import Company, Module, Subscription, SubscriptionModule
from models.schemas import (
    LicenseCheckRequest,
    LicenseCheckResponse,
    ModulesResponse,
    SubscriptionCreate,
    SubscriptionUpdate,
)

router = APIRouter(prefix="/api/v1/license", tags=["license"])


def get_db():
    """Dependency для получения сессии БД"""
    # TODO: Реализовать подключение к БД
    # Пока заглушка
    pass


@router.post("/check", response_model=LicenseCheckResponse)
async def check_license(
    request: LicenseCheckRequest,
    db: Session = Depends(get_db)
) -> LicenseCheckResponse:
    """
    Проверяет доступность модуля для компании.
    
    Args:
        request: Запрос с company_id и module
        db: Сессия БД
    
    Returns:
        Информация о валидности лицензии
    """
    try:
        company_uuid = UUID(request.company_id)
    except ValueError:
        return LicenseCheckResponse(
            valid=False,
            message="Неверный формат company_id"
        )
    
    # Находим активную подписку компании
    subscription = db.query(Subscription).join(Company).filter(
        Company.id == company_uuid,
        Subscription.status == "active",
        Subscription.expires_at > datetime.utcnow()
    ).first()
    
    if not subscription:
        return LicenseCheckResponse(
            valid=False,
            message="Активная подписка не найдена или истекла"
        )
    
    # Проверяем, есть ли модуль в подписке
    module = db.query(Module).filter(Module.code == request.module).first()
    if not module:
        return LicenseCheckResponse(
            valid=False,
            message=f"Модуль {request.module} не существует"
        )
    
    subscription_module = db.query(SubscriptionModule).filter(
        SubscriptionModule.subscription_id == subscription.id,
        SubscriptionModule.module_id == module.id
    ).first()
    
    if not subscription_module:
        return LicenseCheckResponse(
            valid=False,
            message=f"Модуль {request.module} не включен в подписку"
        )
    
    return LicenseCheckResponse(
        valid=True,
        expires_at=subscription.expires_at,
        features=subscription_module.features
    )


@router.get("/modules/{company_id}", response_model=ModulesResponse)
async def get_company_modules(
    company_id: str,
    db: Session = Depends(get_db)
) -> ModulesResponse:
    """
    Получает список доступных модулей для компании.
    
    Args:
        company_id: ID компании
        db: Сессия БД
    
    Returns:
        Список доступных модулей и дата истечения подписки
    """
    try:
        company_uuid = UUID(company_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат company_id"
        )
    
    # Находим активную подписку компании
    subscription = db.query(Subscription).join(Company).filter(
        Company.id == company_uuid,
        Subscription.status == "active",
        Subscription.expires_at > datetime.utcnow()
    ).first()
    
    if not subscription:
        return ModulesResponse(
            modules=[],
            message="Активная подписка не найдена или истекла"
        )
    
    # Получаем модули подписки
    subscription_modules = db.query(SubscriptionModule).join(Module).filter(
        SubscriptionModule.subscription_id == subscription.id
    ).all()
    
    modules = [sm.module.code for sm in subscription_modules]
    
    return ModulesResponse(
        modules=modules,
        expires_at=subscription.expires_at,
        plan_name=subscription.plan_name
    )


@router.post("/subscriptions", status_code=status.HTTP_201_CREATED)
async def create_subscription(
    subscription: SubscriptionCreate,
    db: Session = Depends(get_db)
):
    """
    Создает новую подписку для компании.
    Только для администраторов сервера лицензирования.
    """
    # TODO: Добавить проверку прав администратора
    
    try:
        company_uuid = UUID(subscription.company_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат company_id"
        )
    
    # Проверяем существование компании
    company = db.query(Company).filter(Company.id == company_uuid).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена"
        )
    
    # Создаем подписку
    new_subscription = Subscription(
        company_id=company_uuid,
        plan_name=subscription.plan_name,
        status="active",
        starts_at=subscription.starts_at,
        expires_at=subscription.expires_at,
        auto_renew=subscription.auto_renew
    )
    db.add(new_subscription)
    db.flush()
    
    # Добавляем модули к подписке
    for module_code in subscription.modules:
        module = db.query(Module).filter(Module.code == module_code).first()
        if module:
            subscription_module = SubscriptionModule(
                subscription_id=new_subscription.id,
                module_id=module.id
            )
            db.add(subscription_module)
    
    db.commit()
    
    return {"id": str(new_subscription.id), "message": "Подписка создана"}


@router.put("/subscriptions/{subscription_id}")
async def update_subscription(
    subscription_id: str,
    subscription_update: SubscriptionUpdate,
    db: Session = Depends(get_db)
):
    """
    Обновляет подписку.
    Только для администраторов сервера лицензирования.
    """
    # TODO: Добавить проверку прав администратора
    
    try:
        subscription_uuid = UUID(subscription_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат subscription_id"
        )
    
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_uuid
    ).first()
    
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Подписка не найдена"
        )
    
    if subscription_update.status:
        subscription.status = subscription_update.status
    if subscription_update.expires_at:
        subscription.expires_at = subscription_update.expires_at
    if subscription_update.auto_renew is not None:
        subscription.auto_renew = subscription_update.auto_renew
    
    db.commit()
    
    return {"message": "Подписка обновлена"}
