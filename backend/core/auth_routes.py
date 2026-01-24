"""
API роуты для аутентификации
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.core.auth import (
    create_access_token,
    verify_password,
    get_user_id_from_token,
)
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.license import license_client
from backend.modules.hr.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """Запрос на вход. email — str, чтобы допускать .local и иные домены (EmailStr их отклоняет)."""
    email: str
    password: str


class LoginResponse(BaseModel):
    """Ответ на вход"""
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    """Информация о пользователе"""
    id: str
    email: str
    full_name: str
    role: str | None = None
    roles: dict = {}
    is_superuser: bool = False
    is_active: bool = True
    modules: list[str] = []


@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
) -> LoginResponse:
    """
    Вход в систему.
    Принимает email и password, возвращает JWT токен.
    """
    # Находим пользователя по email
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    
    # Проверяем пароль
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пароль не установлен. Обратитесь к администратору.",
        )
    
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    
    # Проверяем активность пользователя
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь деактивирован",
        )
    
    # Получаем доступные модули из лицензии или настроек
    if settings.company_id:
        try:
            modules = await license_client.get_available_modules(settings.company_id)
        except Exception:
            # При ошибке используем модули из настроек
            modules = settings.get_enabled_modules()
    else:
        # Если company_id не настроен, используем модули из настроек
        modules = settings.get_enabled_modules()
    
    # Определяем основную роль (для обратной совместимости)
    # Берем первую роль из roles или "employee" по умолчанию
    main_role = "employee"
    if user.roles:
        # Берем первую роль из словаря
        main_role = list(user.roles.values())[0] if user.roles else "employee"
    
    # Создаем JWT токен
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        company_id=settings.company_id or None,
        modules=modules,
        role=main_role,
        roles=user.roles or {},
        is_superuser=user.is_superuser,
    )
    
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user={
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": main_role,
            "roles": user.roles or {},
            "is_superuser": user.is_superuser,
            "is_active": user.is_active,
            "modules": modules,
        }
    )


@router.post("/login/form", response_model=LoginResponse)
async def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
) -> LoginResponse:
    """
    Вход через OAuth2PasswordRequestForm (для совместимости с фронтенд формами).
    Принимает username (email) и password.
    """
    login_request = LoginRequest(email=form_data.username, password=form_data.password)
    return await login(login_request, db)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user_id: UUID = Depends(get_user_id_from_token),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Получает информацию о текущем авторизованном пользователе.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    
    # Получаем доступные модули
    modules = []
    if settings.company_id:
        try:
            modules = await license_client.get_available_modules(settings.company_id)
        except Exception:
            modules = settings.get_enabled_modules()
    else:
        modules = settings.get_enabled_modules()
    
    # Определяем основную роль
    main_role = "employee"
    if user.roles:
        main_role = list(user.roles.values())[0] if user.roles else "employee"
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=main_role,
        roles=user.roles or {},
        is_superuser=user.is_superuser,
        is_active=user.is_active,
        modules=modules,
    )
