from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import Token
from app.schemas.user import PasswordChange, UserCreate, UserOut
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
) -> Token:
    """
    Вход в систему.
    Принимает email или username в поле username.
    """
    # Ищем по email или username
    user = (
        db.query(User)
        .filter(
            (User.email == form_data.username) | (User.username == form_data.username)
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль"
        )

    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пароль не установлен. Обратитесь к администратору.",
        )

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь деактивирован"
        )

    # Обновляем время последнего входа
    user.last_login_at = datetime.utcnow()
    db.commit()

    # Создаём токен с унифицированным форматом
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        roles=user.roles or {},
        is_superuser=user.is_superuser,
    )

    log_action(db, str(user.id), "login", "user", f"email={user.email}")

    return Token(access_token=token)


@router.post("/bootstrap", response_model=UserOut)
def bootstrap_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    """
    Создание первого администратора.
    Доступно только если в системе нет пользователей.
    """
    existing = db.query(User).count()
    if existing > 0:
        raise HTTPException(status_code=403, detail="Bootstrap уже выполнен")

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        full_name=payload.full_name,
        roles=payload.roles or {"hr": "admin"},
        is_superuser=True,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(
        db, str(user.id), "bootstrap", "user", f"email={user.email}, superuser=True"
    )

    return user


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Получить информацию о текущем пользователе"""
    return current_user


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Смена пароля текущего пользователя"""
    if not current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Пароль не установлен"
        )

    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный текущий пароль"
        )

    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()

    log_action(
        db,
        str(current_user.id),
        "change_password",
        "user",
        f"email={current_user.email}",
    )

    return {"message": "Пароль успешно изменён"}
