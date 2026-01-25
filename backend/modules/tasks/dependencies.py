"""
Dependencies для модуля Tasks.
Проверка прав доступа к проектам и задачам.
"""
from typing import Optional, Sequence
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.core.auth import get_token_payload
from backend.core.database import get_db as core_get_db
from backend.modules.hr.models.user import User
from backend.modules.tasks.models import Project, ProjectShare, Task

get_db = core_get_db


def get_current_user(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
) -> User:
    """Текущий пользователь из JWT."""
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный формат токена",
        )
    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный формат user_id",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь деактивирован",
        )
    return user


def require_tasks_access(allowed_roles: Sequence[str] = ("user", "manager", "admin")):
    """
    Проверяет доступ к модулю Tasks.
    По умолчанию разрешает всем авторизованным пользователям.
    """

    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.is_superuser:
            return user
        role = user.get_role("tasks")
        # Если роль не задана - даём базовый доступ (user)
        if not role:
            role = "user"
        if role in allowed_roles or role == "admin":
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Недостаточно прав. Требуется одна из ролей: {', '.join(allowed_roles)}",
        )

    return _checker


def get_project_permission(
    db: Session,
    project_id: UUID,
    user: User,
) -> Optional[str]:
    """
    Определяет права пользователя на проект.

    Возвращает:
    - 'owner' - владелец проекта
    - 'admin' - администратор (через share)
    - 'edit' - редактирование (через share)
    - 'view' - просмотр (через share)
    - None - нет доступа
    """
    # Суперпользователь имеет полный доступ
    if user.is_superuser:
        return "owner"

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None

    # Проверяем, является ли пользователь владельцем
    if project.owner_id == user.id:
        return "owner"

    # Проверяем прямой шаринг на пользователя
    user_share = (
        db.query(ProjectShare)
        .filter(
            ProjectShare.project_id == project_id,
            ProjectShare.share_type == "user",
            ProjectShare.target_id == user.id,
        )
        .first()
    )
    if user_share:
        return user_share.permission

    # Проверяем шаринг на отдел
    # TODO: Получить department_id пользователя из HR модуля
    # Пока возвращаем None если нет прямого доступа

    return None


def require_project_access(
    min_permission: str = "view",
    project_id_param: str = "project_id",
):
    """
    Проверяет доступ к конкретному проекту.

    Args:
        min_permission: минимальный уровень прав ('view', 'edit', 'admin', 'owner')
        project_id_param: имя параметра в path с ID проекта
    """
    permission_levels = {"view": 1, "edit": 2, "admin": 3, "owner": 4}

    def _checker(
        project_id: UUID,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> User:
        permission = get_project_permission(db, project_id, user)
        if not permission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Проект не найден или нет доступа",
            )

        user_level = permission_levels.get(permission, 0)
        required_level = permission_levels.get(min_permission, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Недостаточно прав. Требуется: {min_permission}",
            )

        return user

    return _checker


def get_task_permission(
    db: Session,
    task_id: UUID,
    user: User,
) -> Optional[str]:
    """
    Определяет права пользователя на задачу.
    Права определяются через проект, к которому принадлежит задача.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return None

    return get_project_permission(db, task.project_id, user)


def require_task_access(min_permission: str = "view"):
    """Проверяет доступ к задаче через права на её проект."""
    permission_levels = {"view": 1, "edit": 2, "admin": 3, "owner": 4}

    def _checker(
        task_id: UUID,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> User:
        permission = get_task_permission(db, task_id, user)
        if not permission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Задача не найдена или нет доступа",
            )

        user_level = permission_levels.get(permission, 0)
        required_level = permission_levels.get(min_permission, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Недостаточно прав. Требуется: {min_permission}",
            )

        return user

    return _checker
