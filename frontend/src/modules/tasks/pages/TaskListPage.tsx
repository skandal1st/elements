import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Filter,
} from "lucide-react";
import { useTasksStore, Task } from "../../../shared/store/tasks.store";

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
    projects,
    loadProjects,
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

  useEffect(() => {
    loadTasks({ my_tasks: true });
    if (projects.length === 0) {
      loadProjects();
    }
  }, [loadTasks, loadProjects, projects.length]);

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
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="truncate max-w-[150px]">
                            {projects.find((p) => p.id === task.project_id)?.title}
                          </span>
                          <span className={`${PRIORITY_COLORS[task.priority]}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                          <span>{STATUS_LABELS[task.status]}</span>
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
    </div>
  );
}
