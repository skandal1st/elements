"""Роуты /tasks/tasks/{id}/comments — комментарии к задачам."""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.hr.models.user import User
from backend.modules.tasks.dependencies import (
    get_current_user,
    get_db,
    get_task_permission,
    require_tasks_access,
)
from backend.modules.tasks.models import TaskComment
from backend.modules.tasks.schemas.task import TaskCommentCreate, TaskCommentOut

router = APIRouter(prefix="/tasks/{task_id}/comments", tags=["task-comments"])


@router.get(
    "/",
    response_model=List[TaskCommentOut],
    dependencies=[Depends(require_tasks_access())],
)
def list_task_comments(
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[dict]:
    """Получить комментарии к задаче."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    comments = (
        db.query(TaskComment, User.full_name)
        .outerjoin(User, TaskComment.user_id == User.id)
        .filter(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.desc())
        .all()
    )

    return [
        {
            "id": c.id,
            "task_id": c.task_id,
            "user_id": c.user_id,
            "content": c.content,
            "attachments": c.attachments,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "user_name": name,
        }
        for c, name in comments
    ]


@router.post(
    "/",
    response_model=TaskCommentOut,
    status_code=201,
    dependencies=[Depends(require_tasks_access())],
)
def create_task_comment(
    task_id: UUID,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Добавить комментарий к задаче."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    # Для комментирования достаточно view доступа
    comment = TaskComment(
        task_id=task_id,
        user_id=user.id,
        content=payload.content,
        attachments=payload.attachments,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return {
        "id": comment.id,
        "task_id": comment.task_id,
        "user_id": comment.user_id,
        "content": comment.content,
        "attachments": comment.attachments,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
        "user_name": user.full_name,
    }


@router.delete(
    "/{comment_id}",
    status_code=200,
    dependencies=[Depends(require_tasks_access())],
)
def delete_task_comment(
    task_id: UUID,
    comment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Удалить комментарий."""
    permission = get_task_permission(db, task_id, user)
    if not permission:
        raise HTTPException(status_code=404, detail="Задача не найдена или нет доступа")

    comment = (
        db.query(TaskComment)
        .filter(TaskComment.id == comment_id, TaskComment.task_id == task_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")

    # Можно удалить только свой комментарий или если owner/admin
    if comment.user_id != user.id and permission not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    db.delete(comment)
    db.commit()

    return {"message": "Комментарий удален"}
