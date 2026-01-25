"""
Модели для модуля Tasks (Управление задачами)
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    DECIMAL,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.core.database import Base


class Project(Base):
    """Проект для группировки задач"""

    __tablename__ = "projects"
    __table_args__ = {"schema": "tasks"}

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(50), default="#3B82F6")
    icon = Column(String(50), nullable=True)
    is_personal = Column(Boolean, default=True, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    settings = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    shares = relationship(
        "ProjectShare", back_populates="project", cascade="all, delete-orphan"
    )
    tasks = relationship(
        "Task", back_populates="project", cascade="all, delete-orphan"
    )
    labels = relationship(
        "Label", back_populates="project", cascade="all, delete-orphan"
    )


class ProjectShare(Base):
    """Шаринг проекта с пользователями или отделами"""

    __tablename__ = "project_shares"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "share_type", "target_id", name="unique_project_share"
        ),
        {"schema": "tasks"},
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tasks.projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    share_type = Column(
        String(20), nullable=False
    )  # 'user' или 'department'
    target_id = Column(
        PGUUID(as_uuid=True), nullable=False
    )  # user_id или department_id
    permission = Column(
        String(20), default="view", nullable=False
    )  # 'view', 'edit', 'admin'
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="shares")


class Label(Base):
    """Метка для задач внутри проекта"""

    __tablename__ = "labels"
    __table_args__ = {"schema": "tasks"}

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tasks.projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(50), nullable=False)
    color = Column(String(50), default="#6B7280")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="labels")


class Task(Base):
    """Задача"""

    __tablename__ = "tasks"
    __table_args__ = {"schema": "tasks"}

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tasks.projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tasks.tasks.id", ondelete="CASCADE"),
        nullable=True,
    )
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        String(20), default="todo", nullable=False
    )  # todo, in_progress, review, done, cancelled
    priority = Column(
        String(20), default="medium", nullable=False
    )  # low, medium, high, urgent
    creator_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    assignee_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    due_date = Column(DateTime(timezone=True), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    labels = Column(ARRAY(PGUUID(as_uuid=True)), default=[])
    recurrence = Column(JSONB, nullable=True)  # {type, interval, end_date}
    estimated_hours = Column(DECIMAL(5, 2), nullable=True)
    actual_hours = Column(DECIMAL(5, 2), nullable=True)
    # Интеграция с другими модулями
    linked_ticket_id = Column(PGUUID(as_uuid=True), nullable=True)
    linked_employee_id = Column(PGUUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    project = relationship("Project", back_populates="tasks")
    parent = relationship("Task", remote_side=[id], backref="subtasks")
    creator = relationship("User", foreign_keys=[creator_id])
    assignee = relationship("User", foreign_keys=[assignee_id])
    comments = relationship(
        "TaskComment", back_populates="task", cascade="all, delete-orphan"
    )
    checklist_items = relationship(
        "ChecklistItem", back_populates="task", cascade="all, delete-orphan"
    )
    history = relationship(
        "TaskHistory", back_populates="task", cascade="all, delete-orphan"
    )


class ChecklistItem(Base):
    """Элемент чеклиста внутри задачи"""

    __tablename__ = "checklist_items"
    __table_args__ = {"schema": "tasks"}

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tasks.tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    task = relationship("Task", back_populates="checklist_items")


class TaskComment(Base):
    """Комментарий к задаче"""

    __tablename__ = "task_comments"
    __table_args__ = {"schema": "tasks"}

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tasks.tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    attachments = Column(ARRAY(String), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    task = relationship("Task", back_populates="comments")
    user = relationship("User", foreign_keys=[user_id])


class TaskHistory(Base):
    """История изменений задачи"""

    __tablename__ = "task_history"
    __table_args__ = {"schema": "tasks"}

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tasks.tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    changed_by_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    field = Column(String(50), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    task = relationship("Task", back_populates="history")
    changed_by = relationship("User", foreign_keys=[changed_by_id])
