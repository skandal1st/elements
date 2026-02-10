import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Filter,
  X,
  Check,
  Tag,
} from "lucide-react";
import { useTasksStore, Task, Label } from "../../../shared/store/tasks.store";
import { apiGet } from "../../../shared/api/client";

type UserOption = { id: string; full_name: string; email?: string | null };

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-blue-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "К выполнению",
  in_progress: "В работе",
  review: "На проверке",
  done: "Готово",
  cancelled: "Отменено",
};

export function TaskListPage() {
  const {
    tasks,
    tasksLoading,
    tasksError,
    loadTasks,
    updateTask,
    createTask,
    kanbanColumnDefs,
    projects,
    loadProjects,
    labels,
    loadLabels,
    createLabel,
  } = useTasksStore();

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["overdue", "today", "upcoming", "no_date"])
  );
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddProject, setQuickAddProject] = useState<string>("");
  const [quickAddDueDate, setQuickAddDueDate] = useState<string>("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Users for assignee picker
  const [usersList, setUsersList] = useState<UserOption[]>([]);

  // Labels lookup map
  const labelsMap = useMemo(() => {
    const map: Record<string, Label> = {};
    labels.forEach((l) => (map[l.id] = l));
    return map;
  }, [labels]);

  useEffect(() => {
    loadTasks({ my_tasks: true });
    if (projects.length === 0) {
      loadProjects();
    }
    apiGet<UserOption[]>("/hr/users/").then(setUsersList).catch(() => {});
  }, [loadTasks, loadProjects, projects.length]);

  // Load labels for each unique project in the tasks
  useEffect(() => {
    const projectIds = [...new Set(tasks.map((t) => t.project_id))];
    projectIds.forEach((pid) => {
      if (pid) loadLabels(pid);
    });
  }, [tasks, loadLabels]);

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    try {
      await updateTask(task.id, { status: newStatus });
      loadTasks({ my_tasks: true });
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddTitle.trim() || !quickAddProject) return;

    try {
      await createTask({
        project_id: quickAddProject,
        title: quickAddTitle,
        status: "todo",
        priority: "medium",
        due_date: quickAddDueDate ? new Date(quickAddDueDate).toISOString() : undefined,
      });
      setQuickAddTitle("");
      setQuickAddDueDate("");
      setShowQuickAdd(false);
      loadTasks({ my_tasks: true });
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const groupTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      upcoming: [],
      later: [],
      no_date: [],
      completed: [],
    };

    const filteredTasks = statusFilter
      ? tasks.filter((t) => t.status === statusFilter)
      : tasks;

    filteredTasks.forEach((task) => {
      if (task.status === "done" || task.status === "cancelled") {
        if (showCompleted) {
          groups.completed.push(task);
        }
        return;
      }

      if (!task.due_date) {
        groups.no_date.push(task);
        return;
      }

      const dueDate = new Date(task.due_date);

      if (dueDate < today) {
        groups.overdue.push(task);
      } else if (dueDate < tomorrow) {
        groups.today.push(task);
      } else if (dueDate < nextWeek) {
        groups.upcoming.push(task);
      } else {
        groups.later.push(task);
      }
    });

    // Sort tasks within each group
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        // Priority first
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff =
          priorityOrder[a.priority as keyof typeof priorityOrder] -
          priorityOrder[b.priority as keyof typeof priorityOrder];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by due date
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return 0;
      });
    });

    return groups;
  };

  const formatDate = (date?: string) => {
    if (!date) return "";
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "Сегодня";
    if (d.toDateString() === tomorrow.toDateString()) return "Завтра";

    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  };

  const groupLabels: Record<string, { title: string; color: string }> = {
    overdue: { title: "Просрочено", color: "text-red-600" },
    today: { title: "Сегодня", color: "text-blue-600" },
    upcoming: { title: "На этой неделе", color: "text-green-600" },
    later: { title: "Позже", color: "text-gray-600" },
    no_date: { title: "Без срока", color: "text-gray-500" },
    completed: { title: "Завершённые", color: "text-green-600" },
  };

  const taskGroups = groupTasks();

  if (tasksLoading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Загрузка задач...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Мои задачи
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Задачи, назначенные мне или созданные мной
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter || ""}
              onChange={(e) => setStatusFilter(e.target.value || null)}
              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="">Все статусы</option>
              <option value="todo">К выполнению</option>
              <option value="in_progress">В работе</option>
              <option value="review">На проверке</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Показать завершённые
          </label>
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      {tasksError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {tasksError}
        </div>
      )}

      {/* Quick Add */}
      {showQuickAdd && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Название задачи..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAdd();
                if (e.key === "Escape") setShowQuickAdd(false);
              }}
            />
            <select
              value={quickAddProject}
              onChange={(e) => setQuickAddProject(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Выберите проект</option>
              {projects
                .filter((p) => !p.is_archived)
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
            </select>
            <input
              type="date"
              value={quickAddDueDate}
              onChange={(e) => setQuickAddDueDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              title="Дата выполнения"
            />
            <button
              onClick={handleQuickAdd}
              disabled={!quickAddTitle.trim() || !quickAddProject}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Добавить
            </button>
            <button
              onClick={() => setShowQuickAdd(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Task Groups */}
      <div className="space-y-4">
        {Object.entries(taskGroups).map(([groupId, groupTasks]) => {
          if (groupTasks.length === 0) return null;

          const { title, color } = groupLabels[groupId];
          const isExpanded = expandedGroups.has(groupId);

          return (
            <div
              key={groupId}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(groupId)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <span className={`font-medium ${color}`}>{title}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({groupTasks.length})
                  </span>
                </div>
              </button>

              {/* Group Tasks */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {groupTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                      onClick={() => setEditingTask(task)}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className="flex-shrink-0"
                      >
                        {task.status === "done" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle
                            className={`w-5 h-5 ${PRIORITY_COLORS[task.priority]}`}
                          />
                        )}
                      </button>

                      {/* Task Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${
                            task.status === "done"
                              ? "text-gray-400 line-through"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                          <span className="truncate max-w-[150px]">
                            {projects.find((p) => p.id === task.project_id)?.title}
                          </span>
                          <span className={`${PRIORITY_COLORS[task.priority]}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                          <span>{STATUS_LABELS[task.status]}</span>
                          {task.labels && task.labels.length > 0 && task.labels.map((labelId) => {
                            const label = labelsMap[labelId];
                            if (!label) return null;
                            return (
                              <span
                                key={labelId}
                                className="px-1.5 py-0.5 rounded text-white"
                                style={{ backgroundColor: label.color }}
                              >
                                {label.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Due Date */}
                      {task.due_date && (
                        <div
                          className={`flex items-center gap-1 text-sm ${
                            groupId === "overdue"
                              ? "text-red-500"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                          {formatDate(task.due_date)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {Object.values(taskGroups).every((g) => g.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <CheckCircle2 className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Нет задач</p>
            <p className="text-sm mt-1">Все задачи выполнены или не назначены</p>
          </div>
        )}
      </div>

      {/* Edit Task Modal (простое редактирование) */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={async (data) => {
            await updateTask(editingTask.id, data);
            setEditingTask(null);
            loadTasks({ my_tasks: true });
          }}
          columns={
            kanbanColumnDefs && kanbanColumnDefs.length > 0
              ? kanbanColumnDefs.map((c) => ({
                  id: c.id,
                  title: c.title,
                }))
              : [
                  { id: "todo", title: "К выполнению" },
                  { id: "in_progress", title: "В работе" },
                  { id: "review", title: "На проверке" },
                  { id: "done", title: "Готово" },
                  { id: "cancelled", title: "Отменено" },
                ]
          }
          usersList={usersList}
          labels={labels}
          onCreateLabel={createLabel}
        />
      )}
    </div>
  );
}

function TaskEditModal({
  task,
  onClose,
  onSave,
  columns,
  usersList,
  labels,
  onCreateLabel,
}: {
  task: Task;
  onClose: () => void;
  onSave: (data: Partial<Task>) => Promise<void>;
  columns: Array<{ id: string; title: string }>;
  usersList: UserOption[];
  labels: Label[];
  onCreateLabel: (projectId: string, data: Partial<Label>) => Promise<Label>;
}) {
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    priority: Task["priority"];
    status: string;
    due_date: string;
    assignee_id: string;
    selectedLabels: string[];
  }>({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    status: task.status,
    due_date: task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "",
    assignee_id: task.assignee_id || "",
    selectedLabels: task.labels || [],
  });
  const [saving, setSaving] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState(
    task.assignee_name || (task.assignee_id ? usersList.find((u) => u.id === task.assignee_id)?.full_name || "" : "")
  );
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6B7280");

  const filteredUsers = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return usersList.slice(0, 20);
    return usersList
      .filter((u) => {
        const hay = `${u.full_name ?? ""} ${u.email ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [assigneeSearch, usersList]);

  // Filter labels for this task's project
  const projectLabels = useMemo(() => {
    return labels.filter((l) => l.project_id === task.project_id);
  }, [labels, task.project_id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
        assignee_id: formData.assignee_id || undefined,
        labels: formData.selectedLabels,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Задача
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Закрыть
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
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Приоритет
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as Task["priority"] })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Assignee picker */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Исполнитель
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={
                  formData.assignee_id
                    ? usersList.find((u) => u.id === formData.assignee_id)?.full_name || assigneeSearch
                    : assigneeSearch
                }
                onChange={(e) => {
                  setAssigneeSearch(e.target.value);
                  setFormData({ ...formData, assignee_id: "" });
                  setShowAssigneeDropdown(true);
                }}
                onFocus={() => setShowAssigneeDropdown(true)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Поиск по имени..."
              />
              {formData.assignee_id && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, assignee_id: "" });
                    setAssigneeSearch("");
                  }}
                  className="px-2 py-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {showAssigneeDropdown && !formData.assignee_id && (
              <div className="absolute z-20 w-full mt-1 max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, assignee_id: u.id });
                      setAssigneeSearch(u.full_name);
                      setShowAssigneeDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {u.full_name}
                    {u.email && (
                      <span className="ml-2 text-xs text-gray-400">{u.email}</span>
                    )}
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400">Не найдено</div>
                )}
              </div>
            )}
          </div>

          {/* Labels multi-select */}
          {projectLabels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Метки
              </label>
              <div className="flex flex-wrap gap-2">
                {projectLabels.map((label) => {
                  const selected = formData.selectedLabels.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          selectedLabels: selected
                            ? formData.selectedLabels.filter((id) => id !== label.id)
                            : [...formData.selectedLabels, label.id],
                        });
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        selected
                          ? "text-white border-transparent"
                          : "text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                      }`}
                      style={selected ? { backgroundColor: label.color } : {}}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inline label creation */}
          <div>
            {!showNewLabel ? (
              <button
                type="button"
                onClick={() => setShowNewLabel(true)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Tag className="w-3 h-3" /> Создать метку
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Название метки"
                />
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newLabelName.trim() || !task.project_id) return;
                    await onCreateLabel(task.project_id, { name: newLabelName.trim(), color: newLabelColor });
                    setNewLabelName("");
                    setNewLabelColor("#6B7280");
                    setShowNewLabel(false);
                  }}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewLabel(false); setNewLabelName(""); }}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
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
