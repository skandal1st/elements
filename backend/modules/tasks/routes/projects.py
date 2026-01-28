"""Роуты /tasks/projects — проекты."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
import re
import uuid

from backend.modules.hr.models.user import User
from backend.modules.tasks.dependencies import (
    get_current_user,
    get_db,
    get_project_permission,
    require_tasks_access,
)
from backend.modules.tasks.models import Project, ProjectShare, Task
from backend.modules.tasks.schemas.project import (
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    ProjectWithStats,
)
from backend.modules.tasks.services.permissions import (
    get_accessible_projects,
    get_user_permission_for_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _default_kanban_columns() -> list[dict]:
    return [
        {"id": "todo", "title": "К выполнению", "color": "bg-gray-500"},
        {"id": "in_progress", "title": "В работе", "color": "bg-blue-500"},
        {"id": "review", "title": "На проверке", "color": "bg-yellow-500"},
        {"id": "done", "title": "Готово", "color": "bg-green-500"},
        {"id": "cancelled", "title": "Отменено", "color": "bg-gray-400"},
    ]


def _slug(s: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "_", (s or "").strip().lower()).strip("_")
    return base or "stage"


class KanbanColumnCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = Field(default="bg-gray-500", max_length=50)


class KanbanColumnUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=50)
    color: Optional[str] = Field(default=None, max_length=50)


@router.get(
    "/",
    response_model=List[ProjectWithStats],
    dependencies=[Depends(require_tasks_access())],
)
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    include_archived: bool = Query(False),
    search: Optional[str] = Query(None),
) -> List[dict]:
    """Получить список доступных проектов."""
    projects_with_permission = get_accessible_projects(db, user, include_archived)

    results = []
    for project, permission in projects_with_permission:
        # Применяем поиск
        if search and search.strip():
            s = search.strip().lower()
            if s not in project.title.lower() and (
                not project.description or s not in project.description.lower()
            ):
                continue

        # Считаем статистику задач
        total = db.query(func.count(Task.id)).filter(Task.project_id == project.id).scalar()
        completed = (
            db.query(func.count(Task.id))
            .filter(Task.project_id == project.id, Task.status == "done")
            .scalar()
        )
        in_progress = (
            db.query(func.count(Task.id))
            .filter(Task.project_id == project.id, Task.status == "in_progress")
            .scalar()
        )
        overdue = (
            db.query(func.count(Task.id))
            .filter(
                Task.project_id == project.id,
                Task.due_date < datetime.utcnow(),
                Task.status.notin_(["done", "cancelled"]),
            )
            .scalar()
        )

        # Считаем количество шарингов
        shared_count = (
            db.query(func.count(ProjectShare.id))
            .filter(ProjectShare.project_id == project.id)
            .scalar()
        )

        results.append(
            {
                **ProjectOut.model_validate(project).model_dump(),
                "total_tasks": total or 0,
                "completed_tasks": completed or 0,
                "in_progress_tasks": in_progress or 0,
                "overdue_tasks": overdue or 0,
                "shared_with_count": shared_count or 0,
                "user_permission": permission,
            }
        )

    return results


@router.get(
    "/{project_id}",
    response_model=ProjectWithStats,
    dependencies=[Depends(require_tasks_access())],
)
def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Получить проект по ID."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    project = db.query(Project).filter(Project.id == project_id).first()

    # Считаем статистику
    total = db.query(func.count(Task.id)).filter(Task.project_id == project.id).scalar()
    completed = (
        db.query(func.count(Task.id))
        .filter(Task.project_id == project.id, Task.status == "done")
        .scalar()
    )
    in_progress = (
        db.query(func.count(Task.id))
        .filter(Task.project_id == project.id, Task.status == "in_progress")
        .scalar()
    )
    overdue = (
        db.query(func.count(Task.id))
        .filter(
            Task.project_id == project.id,
            Task.due_date < datetime.utcnow(),
            Task.status.notin_(["done", "cancelled"]),
        )
        .scalar()
    )
    shared_count = (
        db.query(func.count(ProjectShare.id))
        .filter(ProjectShare.project_id == project.id)
        .scalar()
    )

    return {
        **ProjectOut.model_validate(project).model_dump(),
        "total_tasks": total or 0,
        "completed_tasks": completed or 0,
        "in_progress_tasks": in_progress or 0,
        "overdue_tasks": overdue or 0,
        "shared_with_count": shared_count or 0,
        "user_permission": permission,
    }


@router.post(
    "/",
    response_model=ProjectOut,
    status_code=201,
    dependencies=[Depends(require_tasks_access())],
)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Project:
    """Создать новый проект."""
    data = payload.model_dump()
    data["owner_id"] = user.id

    project = Project(**data)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.patch(
    "/{project_id}",
    response_model=ProjectOut,
    dependencies=[Depends(require_tasks_access())],
)
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Project:
    """Обновить проект."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    # Только owner и admin могут обновлять проект
    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    project = db.query(Project).filter(Project.id == project_id).first()

    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(project, k, v)

    db.commit()
    db.refresh(project)
    return project


@router.delete(
    "/{project_id}",
    status_code=200,
    dependencies=[Depends(require_tasks_access())],
)
def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Удалить проект."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    # Только owner может удалять проект
    if permission != "owner":
        raise HTTPException(status_code=403, detail="Только владелец может удалить проект")

    project = db.query(Project).filter(Project.id == project_id).first()
    db.delete(project)
    db.commit()

    return {"message": "Проект удален"}


@router.post(
    "/{project_id}/archive",
    response_model=ProjectOut,
    dependencies=[Depends(require_tasks_access())],
)
def archive_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Project:
    """Архивировать проект."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    project = db.query(Project).filter(Project.id == project_id).first()
    project.is_archived = True
    db.commit()
    db.refresh(project)
    return project


@router.post(
    "/{project_id}/unarchive",
    response_model=ProjectOut,
    dependencies=[Depends(require_tasks_access())],
)
def unarchive_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Project:
    """Разархивировать проект."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    project = db.query(Project).filter(Project.id == project_id).first()
    project.is_archived = False
    db.commit()
    db.refresh(project)
    return project


@router.get(
    "/{project_id}/kanban-columns",
    dependencies=[Depends(require_tasks_access())],
)
def get_kanban_columns(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Получить этапы (колонки) канбана проекта."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    project = db.query(Project).filter(Project.id == project_id).first()
    settings = project.settings or {}
    cols = settings.get("kanban_columns")
    if not isinstance(cols, list) or len(cols) == 0:
        cols = _default_kanban_columns()
    return {"columns": cols}


@router.post(
    "/{project_id}/kanban-columns",
    dependencies=[Depends(require_tasks_access())],
)
def add_kanban_column(
    project_id: UUID,
    payload: KanbanColumnCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Добавить этап в канбан проекта."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")
    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    project = db.query(Project).filter(Project.id == project_id).first()
    settings = project.settings or {}
    cols = settings.get("kanban_columns")
    if not isinstance(cols, list) or len(cols) == 0:
        cols = _default_kanban_columns()

    col_id = f"{_slug(payload.title)}_{uuid.uuid4().hex[:6]}"
    cols.append(
        {
            "id": col_id,
            "title": payload.title,
            "color": payload.color or "bg-gray-500",
        }
    )
    settings["kanban_columns"] = cols
    project.settings = settings
    db.commit()
    db.refresh(project)
    return {"columns": cols}


@router.patch(
    "/{project_id}/kanban-columns/{column_id}",
    dependencies=[Depends(require_tasks_access())],
)
def update_kanban_column(
    project_id: UUID,
    column_id: str,
    payload: KanbanColumnUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Переименовать/перекрасить этап канбана."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")
    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    project = db.query(Project).filter(Project.id == project_id).first()
    settings = project.settings or {}
    cols = settings.get("kanban_columns") or _default_kanban_columns()
    if not isinstance(cols, list):
        cols = _default_kanban_columns()

    found = False
    for c in cols:
        if isinstance(c, dict) and c.get("id") == column_id:
            if payload.title is not None:
                c["title"] = payload.title
            if payload.color is not None:
                c["color"] = payload.color
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Этап не найден")

    settings["kanban_columns"] = cols
    project.settings = settings
    db.commit()
    db.refresh(project)
    return {"columns": cols}


@router.delete(
    "/{project_id}/kanban-columns/{column_id}",
    dependencies=[Depends(require_tasks_access())],
)
def delete_kanban_column(
    project_id: UUID,
    column_id: str,
    move_to: str = Query("todo"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Удалить этап канбана. Задачи из этого этапа переносятся в move_to."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")
    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    if column_id in ("todo", "in_progress", "review", "done", "cancelled"):
        raise HTTPException(status_code=400, detail="Нельзя удалить системный этап")

    project = db.query(Project).filter(Project.id == project_id).first()
    settings = project.settings or {}
    cols = settings.get("kanban_columns") or _default_kanban_columns()
    if not isinstance(cols, list):
        cols = _default_kanban_columns()

    cols2 = [
        c for c in cols if not (isinstance(c, dict) and c.get("id") == column_id)
    ]
    if len(cols2) == len(cols):
        raise HTTPException(status_code=404, detail="Этап не найден")

    db.query(Task).filter(Task.project_id == project_id, Task.status == column_id).update(
        {Task.status: move_to}, synchronize_session=False
    )

    settings["kanban_columns"] = cols2
    project.settings = settings
    db.commit()
    db.refresh(project)
    return {"columns": cols2}
