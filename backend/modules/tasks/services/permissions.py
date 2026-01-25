"""
Сервис для проверки прав доступа к проектам и задачам.
"""
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.modules.hr.models.user import User
from backend.modules.tasks.models import Project, ProjectShare


def get_accessible_projects(
    db: Session,
    user: User,
    include_archived: bool = False,
) -> List[Tuple[Project, str]]:
    """
    Получает список проектов, доступных пользователю.

    Args:
        db: сессия базы данных
        user: текущий пользователь
        include_archived: включать архивированные проекты

    Returns:
        Список кортежей (проект, уровень_доступа)
    """
    results = []

    # Базовый фильтр
    archive_filter = True if include_archived else Project.is_archived == False

    # Суперпользователь видит всё
    if user.is_superuser:
        projects = (
            db.query(Project)
            .filter(archive_filter)
            .order_by(Project.updated_at.desc())
            .all()
        )
        return [(p, "owner") for p in projects]

    # Получаем проекты пользователя (owner)
    owned_projects = (
        db.query(Project)
        .filter(Project.owner_id == user.id, archive_filter)
        .all()
    )
    for p in owned_projects:
        results.append((p, "owner"))

    owned_ids = {p.id for p in owned_projects}

    # Получаем проекты, которыми поделились с пользователем
    shared_projects = (
        db.query(Project, ProjectShare.permission)
        .join(ProjectShare, Project.id == ProjectShare.project_id)
        .filter(
            ProjectShare.share_type == "user",
            ProjectShare.target_id == user.id,
            archive_filter,
            ~Project.id.in_(owned_ids),  # исключаем уже добавленные
        )
        .all()
    )
    for p, permission in shared_projects:
        results.append((p, permission))

    # TODO: Добавить проекты, расшаренные на отдел пользователя

    # Сортируем по дате обновления
    results.sort(key=lambda x: x[0].updated_at or x[0].created_at, reverse=True)

    return results


def can_access_project(
    db: Session,
    project_id: UUID,
    user: User,
    min_permission: str = "view",
) -> bool:
    """
    Проверяет, имеет ли пользователь доступ к проекту.

    Args:
        db: сессия базы данных
        project_id: ID проекта
        user: пользователь
        min_permission: минимальный требуемый уровень прав

    Returns:
        True если доступ есть, иначе False
    """
    permission_levels = {"view": 1, "edit": 2, "admin": 3, "owner": 4}
    required_level = permission_levels.get(min_permission, 1)

    if user.is_superuser:
        return True

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return False

    # Владелец
    if project.owner_id == user.id:
        return True

    # Проверяем share
    share = (
        db.query(ProjectShare)
        .filter(
            ProjectShare.project_id == project_id,
            ProjectShare.share_type == "user",
            ProjectShare.target_id == user.id,
        )
        .first()
    )

    if share:
        user_level = permission_levels.get(share.permission, 0)
        return user_level >= required_level

    return False


def get_user_permission_for_project(
    db: Session,
    project_id: UUID,
    user: User,
) -> Optional[str]:
    """
    Получает уровень прав пользователя на проект.

    Returns:
        'owner', 'admin', 'edit', 'view' или None
    """
    if user.is_superuser:
        return "owner"

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None

    if project.owner_id == user.id:
        return "owner"

    share = (
        db.query(ProjectShare)
        .filter(
            ProjectShare.project_id == project_id,
            ProjectShare.share_type == "user",
            ProjectShare.target_id == user.id,
        )
        .first()
    )

    if share:
        return share.permission

    return None
