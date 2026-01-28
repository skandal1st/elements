"""
Единая аутентификация для всех модулей Elements Platform
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from uuid import UUID

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

from .config import settings

# Алгоритм JWT (должен совпадать во всех модулях Elements)
ALGORITHM = settings.algorithm

# OAuth2 схема для получения токена из заголовка Authorization
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_v1_prefix}/auth/login",
    auto_error=False
)


def _to_bytes(s: str, max_len: int = 72) -> bytes:
    b = s.encode("utf-8")
    return b[:max_len] if len(b) > max_len else b


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль против хеша (bcrypt, до 72 байт)."""
    try:
        plain = _to_bytes(plain_password)
        h = hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password
        return bcrypt.checkpw(plain, h)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Хеширует пароль (bcrypt, до 72 байт)."""
    plain = _to_bytes(password)
    return bcrypt.hashpw(plain, bcrypt.gensalt()).decode("utf-8")


def create_access_token(
    user_id: UUID | str,
    email: str,
    company_id: Optional[str] = None,
    modules: Optional[List[str]] = None,
    role: Optional[str] = None,
    roles: Optional[Dict[str, str]] = None,
    is_superuser: bool = False,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Создаёт JWT токен с унифицированным форматом для всех модулей Elements.
    
    Args:
        user_id: ID пользователя (UUID)
        email: Email пользователя
        company_id: ID компании (для лицензирования)
        modules: Список доступных модулей пользователя
        role: Основная роль пользователя (для обратной совместимости)
        roles: Словарь ролей по модулям {"hr": "admin", "it": "user"}
        is_superuser: Флаг суперпользователя
        expires_delta: Время жизни токена (по умолчанию из настроек)
    
    Returns:
        JWT токен в виде строки
    
    Payload структура:
        {
            "sub": "user_id",
            "email": "user@company.com",
            "company_id": "company-uuid",
            "modules": ["hr", "it"],
            "role": "admin",  # основная роль для обратной совместимости
            "roles": {"hr": "admin", "it": "user"},
            "is_superuser": false,
            "exp": 1234567890,
            "iat": 1234567890
        }
    """
    if expires_delta is not None:
        expire = datetime.utcnow() + expires_delta
    else:
        if getattr(settings, "access_token_expire_seconds", None):
            expire = datetime.utcnow() + timedelta(seconds=settings.access_token_expire_seconds)
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    # Формируем payload
    to_encode = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    
    # Добавляем опциональные поля
    if company_id:
        to_encode["company_id"] = company_id
    
    if modules:
        to_encode["modules"] = modules
    
    if role:
        to_encode["role"] = role
    
    if roles:
        to_encode["roles"] = roles
    
    if is_superuser:
        to_encode["is_superuser"] = True
    
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[Dict]:
    """
    Декодирует JWT токен.
    
    Args:
        token: JWT токен в виде строки
    
    Returns:
        Payload токена или None при ошибке
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def get_token_payload(token: str = Depends(oauth2_scheme)) -> Dict:
    """
    Получает payload из JWT токена.
    Используется как dependency в FastAPI.
    
    Raises:
        HTTPException: Если токен невалиден или отсутствует
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
    
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    
    return payload


def get_user_id_from_token(token: str = Depends(oauth2_scheme)) -> UUID:
    """
    Извлекает user_id из JWT токена.
    
    Returns:
        UUID пользователя
    
    Raises:
        HTTPException: Если токен невалиден или user_id отсутствует
    """
    payload = get_token_payload(token)
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный формат токена",
        )
    
    try:
        return UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный формат user_id в токене",
        )


def get_company_id_from_token(token: str = Depends(oauth2_scheme)) -> Optional[str]:
    """
    Извлекает company_id из JWT токена.
    
    Returns:
        ID компании или None
    """
    payload = get_token_payload(token)
    return payload.get("company_id")


def get_modules_from_token(token: str = Depends(oauth2_scheme)) -> List[str]:
    """
    Извлекает список доступных модулей из JWT токена.
    
    Returns:
        Список модулей или пустой список
    """
    payload = get_token_payload(token)
    return payload.get("modules", [])


def has_module_access(token: str, module: str) -> bool:
    """
    Проверяет, есть ли у пользователя доступ к модулю.
    
    Args:
        token: JWT токен
        module: Название модуля (hr, it, finance)
    
    Returns:
        True если доступ есть, False иначе
    """
    payload = decode_token(token)
    if payload is None:
        return False
    
    # Суперпользователь имеет доступ ко всем модулям
    if payload.get("is_superuser", False):
        return True
    
    modules = payload.get("modules", [])
    return module in modules


def require_module(module: str):
    """
    Dependency для проверки доступа к модулю.
    
    Args:
        module: Название модуля
    
    Returns:
        Dependency функция для FastAPI
    
    Пример использования:
        @router.get("/", dependencies=[Depends(require_module("hr"))])
    """
    def _module_checker(token: str = Depends(oauth2_scheme)) -> Dict:
        payload = get_token_payload(token)
        
        # Суперпользователь имеет доступ ко всем модулям
        if payload.get("is_superuser", False):
            return payload
        
        modules = payload.get("modules", [])
        if module not in modules:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Нет доступа к модулю {module}",
            )
        
        return payload
    
    return _module_checker


def require_role(module: str, allowed_roles: List[str]):
    """
    Dependency для проверки роли пользователя в модуле.
    
    Args:
        module: Название модуля
        allowed_roles: Список разрешенных ролей
    
    Returns:
        Dependency функция для FastAPI
    
    Пример использования:
        @router.get("/", dependencies=[Depends(require_role("hr", ["admin", "hr_specialist"]))])
    """
    def _role_checker(token: str = Depends(oauth2_scheme)) -> Dict:
        payload = get_token_payload(token)
        
        # Суперпользователь имеет доступ ко всему
        if payload.get("is_superuser", False):
            return payload
        
        # Проверяем доступ к модулю
        modules = payload.get("modules", [])
        if module not in modules:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Нет доступа к модулю {module}",
            )
        
        # Получаем роль пользователя в модуле
        roles = payload.get("roles", {})
        user_role = roles.get(module)
        
        # Если роли нет в словаре, проверяем основную роль (для обратной совместимости)
        if user_role is None:
            user_role = payload.get("role")
        
        if user_role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Роль не определена для модуля {module}",
            )
        
        # Проверяем, есть ли роль в списке разрешенных
        if user_role.lower() not in [r.lower() for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Недостаточно прав. Требуется одна из ролей: {', '.join(allowed_roles)}",
            )
        
        return payload
    
    return _role_checker


def require_superuser(token: str = Depends(oauth2_scheme)) -> Dict:
    """
    Dependency для проверки прав суперпользователя.
    
    Returns:
        Payload токена если пользователь суперпользователь
    
    Raises:
        HTTPException: Если пользователь не суперпользователь
    """
    payload = get_token_payload(token)
    
    if not payload.get("is_superuser", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права суперпользователя",
        )
    
    return payload
