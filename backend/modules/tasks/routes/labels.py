"""Роуты /tasks/projects/{id}/labels — метки проекта."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.hr.models.user import User
from backend.modules.tasks.dependencies import (
    get_current_user,
    get_db,
    get_project_permission,
    require_tasks_access,
)
from backend.modules.tasks.models import Label
from backend.modules.tasks.schemas.task import LabelCreate, LabelOut, LabelUpdate

router = APIRouter(prefix="/projects/{project_id}/labels", tags=["project-labels"])


@router.get(
    "/",
    response_model=List[LabelOut],
    dependencies=[Depends(require_tasks_access())],
)
def list_project_labels(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[Label]:
    """Получить метки проекта."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    return db.query(Label).filter(Label.project_id == project_id).all()


@router.post(
    "/",
    response_model=LabelOut,
    status_code=201,
    dependencies=[Depends(require_tasks_access())],
)
def create_project_label(
    project_id: UUID,
    payload: LabelCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Label:
    """Создать метку в проекте."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    # Для создания меток нужен edit
    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    label = Label(
        project_id=project_id,
        name=payload.name,
        color=payload.color,
    )
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.patch(
    "/{label_id}",
    response_model=LabelOut,
    dependencies=[Depends(require_tasks_access())],
)
def update_project_label(
    project_id: UUID,
    label_id: UUID,
    payload: LabelUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Label:
    """Обновить метку."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    label = (
        db.query(Label)
        .filter(Label.id == label_id, Label.project_id == project_id)
        .first()
    )
    if not label:
        raise HTTPException(status_code=404, detail="Метка не найдена")

    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(label, k, v)

    db.commit()
    db.refresh(label)
    return label


@router.delete(
    "/{label_id}",
    status_code=200,
    dependencies=[Depends(require_tasks_access())],
)
def delete_project_label(
    project_id: UUID,
    label_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Удалить метку."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    label = (
        db.query(Label)
        .filter(Label.id == label_id, Label.project_id == project_id)
        .first()
    )
    if not label:
        raise HTTPException(status_code=404, detail="Метка не найдена")

    db.delete(label)
    db.commit()

    return {"message": "Метка удалена"}
