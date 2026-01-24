"""Роуты /it/users — список пользователей (для выбора исполнителя и т.д.)."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.hr.models.user import User

router = APIRouter(prefix="/users", tags=["it-users"])


class UserItOut(BaseModel):
    id: UUID
    email: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=List[UserItOut], dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def list_users(db: Session = Depends(get_db)) -> List[User]:
    return db.query(User).filter(User.is_active == True).order_by(User.full_name).all()


@router.get("/{user_id}", response_model=UserItOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))])
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if not current_user.is_superuser and current_user.get_role("it") not in ("admin", "it_specialist"):
        if u.id != current_user.id:
            raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    return u
