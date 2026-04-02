"""
Сервис для проверки прав доступа к проектам и задачам.
"""
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.modules.hr.models.employee import Employee
from backend.modules.hr.models.user import User
from backend.modules.tasks.dependencies import department_id_to_uuid
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

    # Суперпользователь: видит все НЕ личные проекты + свои личные + расшаренные на него.
    # Важно: личные проекты других пользователей не показываем даже суперпользователю,
    # если они не расшарены явно.
    if user.is_superuser:
        owned = (
            db.query(Project)
            .filter(Project.owner_id == user.id, archive_filter)
            .all()
        )
        owned_ids = {p.id for p in owned}

        # Неличные проекты (общие)
        public_projects = (
            db.query(Project)
            .filter(Project.is_personal == False, archive_filter)
            .order_by(Project.updated_at.desc())
            .all()
        )

        # Явно расшаренные на суперпользователя (в т.ч. личные)
        shared_projects = (
            db.query(Project, ProjectShare.permission)
            .join(ProjectShare, Project.id == ProjectShare.project_id)
            .filter(
                ProjectShare.share_type == "user",
                ProjectShare.target_id == user.id,
                archive_filter,
                ~Project.id.in_(owned_ids),
            )
            .all()
        )

        results: List[Tuple[Project, str]] = []
        for p in owned:
            results.append((p, "owner"))
        for p in public_projects:
            if p.id not in owned_ids:
                results.append((p, "owner"))
        for p, perm in shared_projects:
            if p.id not in owned_ids:
                results.append((p, perm))

        # Сортируем по дате обновления
        results.sort(key=lambda x: x[0].updated_at or x[0].created_at, reverse=True)
        return results

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

    # Проекты, расшаренные на отдел пользователя
    employee = db.query(Employee).filter(Employee.user_id == user.id).first()
    if employee and employee.department_id:
        already_added_ids = {p.id for p, _ in results}
        dept_uuid = department_id_to_uuid(employee.department_id)
        dept_shared = (
            db.query(Project, ProjectShare.permission)
            .join(ProjectShare, Project.id == ProjectShare.project_id)
            .filter(
                ProjectShare.share_type == "department",
                ProjectShare.target_id == dept_uuid,
                Project.is_personal == False,
                archive_filter,
                ~Project.id.in_(already_added_ids) if already_added_ids else True,
            )
            .all()
        )
        for p, perm in dept_shared:
            results.append((p, perm))

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

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return False

    # Личные проекты: доступны только владельцу или если явно расшарены (даже для superuser).
    if project.is_personal and project.owner_id != user.id:
        share = (
            db.query(ProjectShare)
            .filter(
                ProjectShare.project_id == project_id,
                ProjectShare.share_type == "user",
                ProjectShare.target_id == user.id,
            )
            .first()
        )
        if not share:
            return False
        user_level = permission_levels.get(share.permission, 0)
        return user_level >= required_level

    # Суперпользователь: полный доступ к НЕ личным проектам, и к своим личным.
    if user.is_superuser:
        return True

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

    # Проверяем шаринг на отдел
    employee = db.query(Employee).filter(Employee.user_id == user.id).first()
    if employee and employee.department_id:
        dept_uuid = department_id_to_uuid(employee.department_id)
        dept_share = (
            db.query(ProjectShare)
            .filter(
                ProjectShare.project_id == project_id,
                ProjectShare.share_type == "department",
                ProjectShare.target_id == dept_uuid,
            )
            .first()
        )
        if dept_share:
            user_level = permission_levels.get(dept_share.permission, 0)
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
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None

    # Личные проекты: только владелец или явный share (даже для superuser).
    if project.is_personal and project.owner_id != user.id:
        share = (
            db.query(ProjectShare)
            .filter(
                ProjectShare.project_id == project_id,
                ProjectShare.share_type == "user",
                ProjectShare.target_id == user.id,
            )
            .first()
        )
        return share.permission if share else None

    if user.is_superuser:
        return "owner"

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

    # Проверяем шаринг на отдел
    employee = db.query(Employee).filter(Employee.user_id == user.id).first()
    if employee and employee.department_id:
        dept_uuid = department_id_to_uuid(employee.department_id)
        dept_share = (
            db.query(ProjectShare)
            .filter(
                ProjectShare.project_id == project_id,
                ProjectShare.share_type == "department",
                ProjectShare.target_id == dept_uuid,
            )
            .first()
        )
        if dept_share:
            return dept_share.permission

    return None
