"""
API роуты для модуля Tasks.
Префикс: /api/v1/tasks
"""

from fastapi import APIRouter

from backend.core.config import settings

from .routes import (
    comments,
    labels,
    projects,
    shares,
    tasks,
)

router = APIRouter(prefix=f"{settings.api_v1_prefix}/tasks", tags=["tasks"])

# Основные роуты
router.include_router(projects.router)
router.include_router(tasks.router)

# Вложенные роуты проектов
router.include_router(shares.router)
router.include_router(labels.router)

# Вложенные роуты задач
router.include_router(comments.router)


@router.get("/")
async def tasks_module_info():
    """Информация о модуле Tasks"""
    return {
        "module": "tasks",
        "name": "Tasks Module",
        "version": "1.0.0",
        "status": "active",
        "features": [
            "projects",
            "tasks",
            "subtasks",
            "labels",
            "sharing",
            "comments",
            "checklist",
            "kanban",
        ],
    }
