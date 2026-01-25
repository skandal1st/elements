"""Роуты /tasks/projects/{id}/shares — шаринг проектов."""

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
from backend.modules.tasks.models import Project, ProjectShare
from backend.modules.tasks.schemas.share import (
    ProjectShareCreate,
    ProjectShareOut,
    ProjectShareUpdate,
)

router = APIRouter(prefix="/projects/{project_id}/shares", tags=["project-shares"])


@router.get(
    "/",
    response_model=List[ProjectShareOut],
    dependencies=[Depends(require_tasks_access())],
)
def list_project_shares(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[dict]:
    """Получить список шарингов проекта."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    # Только owner и admin могут видеть шаринги
    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    shares = (
        db.query(ProjectShare)
        .filter(ProjectShare.project_id == project_id)
        .all()
    )

    results = []
    for share in shares:
        # Получаем информацию о получателе
        target_name = None
        target_email = None

        if share.share_type == "user":
            target_user = db.query(User).filter(User.id == share.target_id).first()
            if target_user:
                target_name = target_user.full_name
                target_email = target_user.email
        elif share.share_type == "department":
            # TODO: Получить название отдела из HR
            target_name = f"Отдел {share.target_id}"

        results.append(
            {
                "id": share.id,
                "project_id": share.project_id,
                "share_type": share.share_type,
                "target_id": share.target_id,
                "permission": share.permission,
                "created_at": share.created_at,
                "target_name": target_name,
                "target_email": target_email,
            }
        )

    return results


@router.post(
    "/",
    response_model=ProjectShareOut,
    status_code=201,
    dependencies=[Depends(require_tasks_access())],
)
def create_project_share(
    project_id: UUID,
    payload: ProjectShareCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Поделиться проектом с пользователем или отделом."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    # Только owner и admin могут шарить
    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    # Проверяем что не шарим сами себе
    project = db.query(Project).filter(Project.id == project_id).first()
    if payload.share_type == "user" and payload.target_id == project.owner_id:
        raise HTTPException(
            status_code=400,
            detail="Нельзя поделиться проектом с его владельцем",
        )

    # Проверяем что пользователь существует
    if payload.share_type == "user":
        target_user = db.query(User).filter(User.id == payload.target_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Проверяем дубликаты
    existing = (
        db.query(ProjectShare)
        .filter(
            ProjectShare.project_id == project_id,
            ProjectShare.share_type == payload.share_type,
            ProjectShare.target_id == payload.target_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Проект уже расшарен для этого получателя",
        )

    share = ProjectShare(
        project_id=project_id,
        share_type=payload.share_type,
        target_id=payload.target_id,
        permission=payload.permission,
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    # Получаем информацию о получателе
    target_name = None
    target_email = None
    if payload.share_type == "user":
        target_user = db.query(User).filter(User.id == payload.target_id).first()
        if target_user:
            target_name = target_user.full_name
            target_email = target_user.email

    return {
        "id": share.id,
        "project_id": share.project_id,
        "share_type": share.share_type,
        "target_id": share.target_id,
        "permission": share.permission,
        "created_at": share.created_at,
        "target_name": target_name,
        "target_email": target_email,
    }


@router.patch(
    "/{share_id}",
    response_model=ProjectShareOut,
    dependencies=[Depends(require_tasks_access())],
)
def update_project_share(
    project_id: UUID,
    share_id: UUID,
    payload: ProjectShareUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Обновить права шаринга."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    share = (
        db.query(ProjectShare)
        .filter(ProjectShare.id == share_id, ProjectShare.project_id == project_id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Шаринг не найден")

    share.permission = payload.permission
    db.commit()
    db.refresh(share)

    # Получаем информацию о получателе
    target_name = None
    target_email = None
    if share.share_type == "user":
        target_user = db.query(User).filter(User.id == share.target_id).first()
        if target_user:
            target_name = target_user.full_name
            target_email = target_user.email

    return {
        "id": share.id,
        "project_id": share.project_id,
        "share_type": share.share_type,
        "target_id": share.target_id,
        "permission": share.permission,
        "created_at": share.created_at,
        "target_name": target_name,
        "target_email": target_email,
    }


@router.delete(
    "/{share_id}",
    status_code=200,
    dependencies=[Depends(require_tasks_access())],
)
def delete_project_share(
    project_id: UUID,
    share_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Удалить шаринг проекта."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    share = (
        db.query(ProjectShare)
        .filter(ProjectShare.id == share_id, ProjectShare.project_id == project_id)
        .first()
    )
    if not share:
        raise HTTPException(status_code=404, detail="Шаринг не найден")

    db.delete(share)
    db.commit()

    return {"message": "Доступ отозван"}
