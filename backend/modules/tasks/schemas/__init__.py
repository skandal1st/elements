"""
Схемы для модуля Tasks
"""

from .project import (
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    ProjectWithStats,
)
from .share import (
    ProjectShareCreate,
    ProjectShareOut,
    ProjectShareUpdate,
)
from .task import (
    ChecklistItemCreate,
    ChecklistItemOut,
    ChecklistItemUpdate,
    KanbanMove,
    LabelCreate,
    LabelOut,
    LabelUpdate,
    TaskCommentCreate,
    TaskCommentOut,
    TaskCreate,
    TaskHistoryOut,
    TaskOut,
    TaskUpdate,
    TaskWithDetails,
)

__all__ = [
    # Project schemas
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectOut",
    "ProjectWithStats",
    # Share schemas
    "ProjectShareCreate",
    "ProjectShareUpdate",
    "ProjectShareOut",
    # Task schemas
    "TaskCreate",
    "TaskUpdate",
    "TaskOut",
    "TaskWithDetails",
    "KanbanMove",
    # Label schemas
    "LabelCreate",
    "LabelUpdate",
    "LabelOut",
    # Checklist schemas
    "ChecklistItemCreate",
    "ChecklistItemUpdate",
    "ChecklistItemOut",
    # Comment schemas
    "TaskCommentCreate",
    "TaskCommentOut",
    # History schemas
    "TaskHistoryOut",
]
