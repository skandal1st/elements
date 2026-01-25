import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  Calendar,
  User,
  MoreVertical,
  X,
  Check,
} from "lucide-react";
import { useTasksStore, Task } from "../../../shared/store/tasks.store";

const COLUMNS = [
  { id: "todo", title: "К выполнению", color: "bg-gray-500" },
  { id: "in_progress", title: "В работе", color: "bg-blue-500" },
  { id: "review", title: "На проверке", color: "bg-yellow-500" },
  { id: "done", title: "Готово", color: "bg-green-500" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-400",
  high: "bg-orange-400",
  urgent: "bg-red-500",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

export function TaskBoardPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");

  const {
    projects,
    kanbanColumns,
    tasksLoading,
    tasksError,
    loadProjects,
    loadKanban,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    setCurrentProject,
  } = useTasksStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projectId
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInColumn, setCreateInColumn] = useState<string>("todo");
  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    priority: Task["priority"];
  }>({
    title: "",
    description: "",
    priority: "medium",
  });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    if (projects.length === 0) {
      loadProjects();
    }
  }, [loadProjects, projects.length]);

  // Set current project from URL or first project
  useEffect(() => {
    if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setCurrentProject(project);
        setSelectedProjectId(projectId);
      }
    } else if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
      setCurrentProject(projects[0]);
    }
  }, [projectId, projects, setCurrentProject, selectedProjectId]);

  // Load kanban when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadKanban(selectedProjectId);
    }
  }, [selectedProjectId, loadKanban]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // If dropped in same place, do nothing
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    try {
      await moveTask(draggableId, destination.droppableId, destination.index);
    } catch (error) {
      console.error("Failed to move task:", error);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !selectedProjectId) return;

    try {
      await createTask({
        project_id: selectedProjectId,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        status: createInColumn as Task["status"],
      });
      setShowCreateModal(false);
      setNewTask({ title: "", description: "", priority: "medium" });
      // Reload kanban to get updated order
      loadKanban(selectedProjectId);
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Удалить эту задачу?")) return;
    try {
      await deleteTask(taskId);
      if (selectedProjectId) {
        loadKanban(selectedProjectId);
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
    setMenuOpenId(null);
  };

  const handleQuickAdd = (columnId: string) => {
    setCreateInColumn(columnId);
    setShowCreateModal(true);
  };

  const formatDate = (date?: string) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date) return false;
    if (task.status === "done" || task.status === "cancelled") return false;
    return new Date(task.due_date) < new Date();
  };

  if (!selectedProjectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">Выберите проект</p>
        <p className="text-sm mt-1">или создайте новый на странице проектов</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedProjectId || ""}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              const project = projects.find((p) => p.id === e.target.value);
              if (project) setCurrentProject(project);
            }}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            {projects
              .filter((p) => !p.is_archived)
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
          </select>
        </div>
      </div>

      {tasksError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {tasksError}
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-80 bg-gray-100 dark:bg-gray-800/50 rounded-xl"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {column.title}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {kanbanColumns[column.id]?.length || 0}
                  </span>
                </div>
                <button
                  onClick={() => handleQuickAdd(column.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                >
                  <Plus className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Column Tasks */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-2 min-h-[200px] space-y-2 ${
                      snapshot.isDraggingOver
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : ""
                    }`}
                  >
                    {tasksLoading && kanbanColumns[column.id]?.length === 0 && (
                      <div className="text-center py-4 text-gray-400">
                        Загрузка...
                      </div>
                    )}
                    {kanbanColumns[column.id]?.map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${
                              snapshot.isDragging ? "shadow-lg" : ""
                            } ${
                              isOverdue(task)
                                ? "border-l-4 border-l-red-500"
                                : ""
                            }`}
                          >
                            {/* Task Header */}
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                                {task.title}
                              </p>
                              <div className="relative ml-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(
                                      menuOpenId === task.id ? null : task.id
                                    );
                                  }}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="w-3 h-3 text-gray-400" />
                                </button>
                                {menuOpenId === task.id && (
                                  <div className="absolute right-0 top-6 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTask(task);
                                        setMenuOpenId(null);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      Редактировать
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTask(task.id);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Task Description (truncated) */}
                            {task.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}

                            {/* Task Meta */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {/* Priority */}
                              <span
                                className={`px-1.5 py-0.5 text-xs text-white rounded ${
                                  PRIORITY_COLORS[task.priority]
                                }`}
                              >
                                {PRIORITY_LABELS[task.priority]}
                              </span>

                              {/* Due date */}
                              {task.due_date && (
                                <span
                                  className={`flex items-center gap-1 text-xs ${
                                    isOverdue(task)
                                      ? "text-red-500"
                                      : "text-gray-500 dark:text-gray-400"
                                  }`}
                                >
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(task.due_date)}
                                </span>
                              )}

                              {/* Assignee */}
                              {task.assignee_name && (
                                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <User className="w-3 h-3" />
                                  {task.assignee_name.split(" ")[0]}
                                </span>
                              )}

                              {/* Subtasks */}
                              {task.subtasks_count !== undefined &&
                                task.subtasks_count > 0 && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                    <Check className="w-3 h-3" />
                                    {task.subtasks_completed}/{task.subtasks_count}
                                  </span>
                                )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Новая задача
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Название
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Что нужно сделать?"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Описание
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Подробное описание..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Приоритет
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      priority: e.target.value as Task["priority"],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                  <option value="urgent">Срочный</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTask.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={async (data) => {
            await updateTask(editingTask.id, data);
            setEditingTask(null);
            if (selectedProjectId) loadKanban(selectedProjectId);
          }}
        />
      )}
    </div>
  );
}

// Task Edit Modal Component
function TaskEditModal({
  task,
  onClose,
  onSave,
}: {
  task: Task;
  onClose: () => void;
  onSave: (data: Partial<Task>) => Promise<void>;
}) {
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    priority: Task["priority"];
    status: Task["status"];
    due_date: string;
  }>({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    status: task.status,
    due_date: task.due_date
      ? new Date(task.due_date).toISOString().split("T")[0]
      : "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date
          ? new Date(formData.due_date).toISOString()
          : undefined,
      });
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Редактирование задачи
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Название
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Статус
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as Task["status"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="todo">К выполнению</option>
                <option value="in_progress">В работе</option>
                <option value="review">На проверке</option>
                <option value="done">Готово</option>
                <option value="cancelled">Отменено</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Приоритет
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as Task["priority"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочный</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Срок выполнения
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) =>
                setFormData({ ...formData, due_date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.title.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
