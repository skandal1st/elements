"""Роуты /tasks/tasks — задачи."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from backend.modules.hr.models.user import User
from backend.modules.tasks.dependencies import (
    get_current_user,
    get_db,
    get_project_permission,
    get_task_permission,
    require_tasks_access,
)
from backend.modules.tasks.models import (
    ChecklistItem,
    Project,
    Task,
    TaskComment,
    TaskHistory,
)
from backend.modules.tasks.schemas.task import (
    ChecklistItemCreate,
    ChecklistItemOut,
    ChecklistItemUpdate,
    KanbanMove,
    TaskCreate,
    TaskHistoryOut,
    TaskOut,
    TaskUpdate,
    TaskWithDetails,
)
from backend.modules.tasks.services.task_history import (
    log_task_changes,
    log_task_creation,
    log_task_status_change,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get(
    "/",
    response_model=List[TaskOut],
    dependencies=[Depends(require_tasks_access())],
)
def list_tasks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    project_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[UUID] = Query(None),
    my_tasks: bool = Query(False),
    search: Optional[str] = Query(None),
    include_archived: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> List[Task]:
    """Получить список задач с фильтрацией."""
    q = db.query(Task)

    # Фильтр по проекту с проверкой доступа
    if project_id:
        permission = get_project_permission(db, project_id, user)
        if not permission:
            raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")
        q = q.filter(Task.project_id == project_id)
    else:
        # Без указания проекта - показываем задачи только из доступных проектов
        from backend.modules.tasks.services.permissions import get_accessible_projects

        accessible = get_accessible_projects(db, user, include_archived=False)
        accessible_ids = [p.id for p, _ in accessible]
        q = q.filter(Task.project_id.in_(accessible_ids))

    # Фильтры
    if not include_archived:
        q = q.filter(Task.archived_at.is_(None))
    if status:
        q = q.filter(Task.status == status)
    if priority:
        q = q.filter(Task.priority == priority)
    if assignee_id:
        q = q.filter(Task.assignee_id == assignee_id)
    if my_tasks:
        q = q.filter(
            or_(
                Task.assignee_id == user.id,
                Task.creator_id == user.id,
            )
        )
    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.filter(or_(Task.title.ilike(s), Task.description.ilike(s)))

    # Сортировка и пагинация
    q = q.order_by(Task.order_index, Task.created_at.desc())
    offset = (page - 1) * page_size
    return q.offset(offset).limit(page_size).all()


@router.get(
    "/my",
    response_model=List[TaskOut],
    dependencies=[Depends(require_tasks_access())],
)
def get_my_tasks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    include_created: bool = Query(True),
    include_archived: bool = Query(False),
) -> List[Task]:
    """Получить мои задачи (назначенные на меня и созданные мной)."""
    from backend.modules.tasks.services.permissions import get_accessible_projects

    accessible = get_accessible_projects(db, user, include_archived=False)
    accessible_ids = [p.id for p, _ in accessible]

    q = db.query(Task).filter(Task.project_id.in_(accessible_ids))
    if not include_archived:
        q = q.filter(Task.archived_at.is_(None))

    if include_created:
        q = q.filter(or_(Task.assignee_id == user.id, Task.creator_id == user.id))
    else:
        q = q.filter(Task.assignee_id == user.id)

    if status:
        q = q.filter(Task.status == status)

    return q.order_by(Task.due_date.asc().nullslast(), Task.priority.desc()).all()


@router.get(
    "/kanban/{project_id}",
    response_model=dict,
    dependencies=[Depends(require_tasks_access())],
)
def get_kanban_board(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Получить задачи проекта, сгруппированные по статусам для канбан-доски."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    # Колонки канбана из настроек проекта
    settings = project.settings or {}
    column_defs = settings.get("kanban_columns")
    if not isinstance(column_defs, list) or len(column_defs) == 0:
        column_defs = [
            {"id": "todo", "title": "К выполнению", "color": "bg-gray-500"},
            {"id": "in_progress", "title": "В работе", "color": "bg-blue-500"},
            {"id": "review", "title": "На проверке", "color": "bg-yellow-500"},
            {"id": "done", "title": "Готово", "color": "bg-green-500"},
            {"id": "cancelled", "title": "Отменено", "color": "bg-gray-400"},
        ]

    tasks = (
        db.query(Task)
        .filter(Task.project_id == project_id, Task.parent_id.is_(None))
        .filter(Task.archived_at.is_(None))
        .order_by(Task.order_index)
        .all()
    )

    # Группируем по статусам
    columns = {c.get("id"): [] for c in column_defs if isinstance(c, dict) and c.get("id")}

    for task in tasks:
        if task.status not in columns:
            # если встретили неизвестный статус (старые данные) — покажем отдельной колонкой
            columns[task.status] = []
            column_defs.append(
                {"id": task.status, "title": task.status, "color": "bg-gray-500"}
            )
        columns[task.status].append(TaskOut.model_validate(task).model_dump())

    return {
        "project_id": str(project_id),
        "column_defs": column_defs,
        "columns": columns,
    }


@router.post(
    "/{task_id}/archive",
    response_model=TaskOut,
    dependencies=[Depends(require_tasks_access())],
)
def archive_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    """Архивировать задачу (скрыть из списков по умолчанию)."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")
    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    task = db.query(Task).filter(Task.id == task_id).first()
    task.archived_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task


@router.post(
    "/{task_id}/unarchive",
    response_model=TaskOut,
    dependencies=[Depends(require_tasks_access())],
)
def unarchive_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    """Разархивировать задачу."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")
    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    task = db.query(Task).filter(Task.id == task_id).first()
    task.archived_at = None
    db.commit()
    db.refresh(task)
    return task


@router.post(
    "/archive-done/{project_id}",
    dependencies=[Depends(require_tasks_access())],
)
def archive_done_tasks(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Архивировать все задачи в статусе done в проекте."""
    permission = get_project_permission(db, project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")
    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    now = datetime.utcnow()
    q = (
        db.query(Task)
        .filter(
            Task.project_id == project_id,
            Task.status == "done",
            Task.archived_at.is_(None),
        )
    )
    count = q.count()
    q.update({Task.archived_at: now}, synchronize_session=False)
    db.commit()
    return {"archived": count}


@router.get(
    "/{task_id}",
    response_model=TaskWithDetails,
    dependencies=[Depends(require_tasks_access())],
)
def get_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Получить задачу с деталями."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    task = db.query(Task).filter(Task.id == task_id).first()

    # Получаем доп. информацию
    subtasks_count = (
        db.query(func.count(Task.id)).filter(Task.parent_id == task_id).scalar() or 0
    )
    subtasks_completed = (
        db.query(func.count(Task.id))
        .filter(Task.parent_id == task_id, Task.status == "done")
        .scalar()
        or 0
    )
    comments_count = (
        db.query(func.count(TaskComment.id))
        .filter(TaskComment.task_id == task_id)
        .scalar()
        or 0
    )

    # Чеклист
    checklist = (
        db.query(ChecklistItem)
        .filter(ChecklistItem.task_id == task_id)
        .order_by(ChecklistItem.order_index)
        .all()
    )

    # Информация о пользователях
    creator = db.query(User).filter(User.id == task.creator_id).first()
    assignee = None
    if task.assignee_id:
        assignee = db.query(User).filter(User.id == task.assignee_id).first()

    return {
        **TaskOut.model_validate(task).model_dump(),
        "subtasks_count": subtasks_count,
        "subtasks_completed": subtasks_completed,
        "comments_count": comments_count,
        "checklist_items": [
            ChecklistItemOut.model_validate(item).model_dump() for item in checklist
        ],
        "creator_name": creator.full_name if creator else None,
        "assignee_name": assignee.full_name if assignee else None,
    }


@router.post(
    "/",
    response_model=TaskOut,
    status_code=201,
    dependencies=[Depends(require_tasks_access())],
)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    """Создать новую задачу."""
    permission = get_project_permission(db, payload.project_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Проект не найден или нет доступа")

    # Для создания нужен как минимум edit
    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    # Получаем максимальный order_index для статуса
    max_order = (
        db.query(func.max(Task.order_index))
        .filter(
            Task.project_id == payload.project_id,
            Task.status == (payload.status or "todo"),
        )
        .scalar()
        or 0
    )

    data = payload.model_dump(exclude={"checklist"})
    data["creator_id"] = user.id
    data["order_index"] = max_order + 1

    task = Task(**data)
    db.add(task)
    db.flush()  # Получаем ID до коммита

    # Создаём чеклист если передан
    if payload.checklist:
        for i, item in enumerate(payload.checklist):
            checklist_item = ChecklistItem(
                task_id=task.id,
                title=item.title,
                order_index=item.order_index if item.order_index is not None else i,
            )
            db.add(checklist_item)

    # Логируем создание
    log_task_creation(db, task.id, user.id)

    db.commit()
    db.refresh(task)
    return task


@router.patch(
    "/{task_id}",
    response_model=TaskOut,
    dependencies=[Depends(require_tasks_access())],
)
def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    """Обновить задачу."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    # Для редактирования нужен edit
    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    task = db.query(Task).filter(Task.id == task_id).first()

    # Сохраняем старые значения для логирования
    old_data = {
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assignee_id": str(task.assignee_id) if task.assignee_id else None,
        "due_date": str(task.due_date) if task.due_date else None,
        "start_date": str(task.start_date) if task.start_date else None,
        "parent_id": str(task.parent_id) if task.parent_id else None,
        "labels": task.labels,
    }

    update_data = payload.model_dump(exclude_unset=True)

    # Обрабатываем изменение статуса
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status == "done" and task.status != "done":
            update_data["completed_at"] = datetime.utcnow()
        elif new_status != "done" and task.status == "done":
            update_data["completed_at"] = None

    for k, v in update_data.items():
        setattr(task, k, v)

    # Логируем изменения
    log_task_changes(
        db=db,
        task_id=task_id,
        changed_by_id=user.id,
        old_data=old_data,
        new_data=update_data,
    )

    db.commit()
    db.refresh(task)
    return task


@router.post(
    "/{task_id}/move",
    response_model=TaskOut,
    dependencies=[Depends(require_tasks_access())],
)
def move_task(
    task_id: UUID,
    payload: KanbanMove,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    """Переместить задачу на канбан-доске (изменить статус и порядок)."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    task = db.query(Task).filter(Task.id == task_id).first()
    old_status = task.status
    new_status = payload.status

    # Обновляем статус и порядок
    task.status = new_status
    task.order_index = payload.order_index

    # Обновляем completed_at при изменении статуса
    if new_status == "done" and old_status != "done":
        task.completed_at = datetime.utcnow()
    elif new_status != "done" and old_status == "done":
        task.completed_at = None

    # Логируем изменение статуса
    if old_status != new_status:
        log_task_status_change(db, task_id, user.id, old_status, new_status)

    db.commit()
    db.refresh(task)
    return task


@router.delete(
    "/{task_id}",
    status_code=200,
    dependencies=[Depends(require_tasks_access())],
)
def delete_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Удалить задачу."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    if permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    task = db.query(Task).filter(Task.id == task_id).first()
    db.delete(task)
    db.commit()

    return {"message": "Задача удалена"}


# --- Subtasks ---


@router.get(
    "/{task_id}/subtasks",
    response_model=List[TaskOut],
    dependencies=[Depends(require_tasks_access())],
)
def get_subtasks(
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[Task]:
    """Получить подзадачи."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    return (
        db.query(Task)
        .filter(Task.parent_id == task_id)
        .order_by(Task.order_index)
        .all()
    )


# --- Checklist ---


@router.post(
    "/{task_id}/checklist",
    response_model=ChecklistItemOut,
    status_code=201,
    dependencies=[Depends(require_tasks_access())],
)
def add_checklist_item(
    task_id: UUID,
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChecklistItem:
    """Добавить пункт в чеклист."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    # Определяем order_index
    max_order = (
        db.query(func.max(ChecklistItem.order_index))
        .filter(ChecklistItem.task_id == task_id)
        .scalar()
        or 0
    )

    item = ChecklistItem(
        task_id=task_id,
        title=payload.title,
        order_index=payload.order_index if payload.order_index is not None else max_order + 1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch(
    "/{task_id}/checklist/{item_id}",
    response_model=ChecklistItemOut,
    dependencies=[Depends(require_tasks_access())],
)
def update_checklist_item(
    task_id: UUID,
    item_id: UUID,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChecklistItem:
    """Обновить пункт чеклиста."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    item = (
        db.query(ChecklistItem)
        .filter(ChecklistItem.id == item_id, ChecklistItem.task_id == task_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Пункт чеклиста не найден")

    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(item, k, v)

    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/{task_id}/checklist/{item_id}",
    status_code=200,
    dependencies=[Depends(require_tasks_access())],
)
def delete_checklist_item(
    task_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Удалить пункт чеклиста."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    if permission not in ("owner", "admin", "edit"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    item = (
        db.query(ChecklistItem)
        .filter(ChecklistItem.id == item_id, ChecklistItem.task_id == task_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Пункт чеклиста не найден")

    db.delete(item)
    db.commit()

    return {"message": "Пункт удален"}


# --- History ---


@router.get(
    "/{task_id}/history",
    response_model=List[TaskHistoryOut],
    dependencies=[Depends(require_tasks_access())],
)
def get_task_history(
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[dict]:
    """Получить историю изменений задачи."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    history = (
        db.query(TaskHistory, User.full_name)
        .outerjoin(User, TaskHistory.changed_by_id == User.id)
        .filter(TaskHistory.task_id == task_id)
        .order_by(TaskHistory.created_at.desc())
        .all()
    )

    return [
        {
            "id": h.id,
            "task_id": h.task_id,
            "changed_by_id": h.changed_by_id,
            "field": h.field,
            "old_value": h.old_value,
            "new_value": h.new_value,
            "created_at": h.created_at,
            "changed_by_name": name,
        }
        for h, name in history
    ]
