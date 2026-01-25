import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Archive,
  MoreVertical,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useTasksStore, Project } from "../../../shared/store/tasks.store";

export function ProjectsPage() {
  const navigate = useNavigate();
  const {
    projects,
    projectsLoading,
    projectsError,
    loadProjects,
    createProject,
    deleteProject,
    archiveProject,
    setCurrentProject,
  } = useTasksStore();

  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    color: "#3B82F6",
    is_personal: true,
  });
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects(showArchived);
  }, [loadProjects, showArchived]);

  const handleCreateProject = async () => {
    if (!newProject.title.trim()) return;
    setCreateError(null);
    try {
      const project = await createProject(newProject);
      setShowCreateModal(false);
      setNewProject({ title: "", description: "", color: "#3B82F6", is_personal: true });
      setCurrentProject(project);
      navigate(`/tasks/board?project=${project.id}`);
    } catch (error) {
      const msg = (error as Error).message;
      setCreateError(msg);
      console.error("Failed to create project:", error);
    }
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    navigate(`/tasks/board?project=${project.id}`);
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот проект?")) return;
    try {
      await deleteProject(id);
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
    setMenuOpenId(null);
  };

  const handleArchiveProject = async (id: string) => {
    try {
      await archiveProject(id);
    } catch (error) {
      console.error("Failed to archive project:", error);
    }
    setMenuOpenId(null);
  };

  const colorOptions = [
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#6B7280", // gray
  ];

  const filteredProjects = projects.filter((p) =>
    showArchived ? p.is_archived : !p.is_archived
  );

  if (projectsLoading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Загрузка проектов...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Проекты</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Управление проектами и задачами
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Показать архив
          </label>
          <button
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Новый проект
          </button>
        </div>
      </div>

      {projectsError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {projectsError}
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleOpenProject(project)}
          >
            {/* Color bar */}
            <div
              className="h-2 rounded-t-xl"
              style={{ backgroundColor: project.color }}
            />

            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {project.title}
                  </h3>
                  {project.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>
                <div className="relative ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === project.id ? null : project.id);
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-500" />
                  </button>
                  {menuOpenId === project.id && (
                    <div className="absolute right-0 top-8 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveProject(project.id);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Archive className="w-4 h-4" />
                        {project.is_archived ? "Разархивировать" : "Архивировать"}
                      </button>
                      {project.user_permission === "owner" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                {project.total_tasks !== undefined && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>
                      {project.completed_tasks}/{project.total_tasks}
                    </span>
                  </div>
                )}
                {project.in_progress_tasks !== undefined && project.in_progress_tasks > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>{project.in_progress_tasks}</span>
                  </div>
                )}
                {project.overdue_tasks !== undefined && project.overdue_tasks > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>{project.overdue_tasks}</span>
                  </div>
                )}
                {project.shared_with_count !== undefined && project.shared_with_count > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{project.shared_with_count}</span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {project.total_tasks !== undefined && project.total_tasks > 0 && (
                <div className="mt-3">
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{
                        width: `${(project.completed_tasks! / project.total_tasks) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="flex items-center gap-2 mt-3">
                {project.is_personal && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    Личный
                  </span>
                )}
                {project.user_permission && project.user_permission !== "owner" && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                    {project.user_permission === "admin"
                      ? "Администратор"
                      : project.user_permission === "edit"
                      ? "Редактор"
                      : "Просмотр"}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Empty state */}
        {filteredProjects.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <FolderKanban className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Нет проектов</p>
            <p className="text-sm mt-1">
              {showArchived
                ? "Архивированных проектов нет"
                : "Создайте свой первый проект"}
            </p>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Новый проект
              </h2>

              {createError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {createError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Название
                  </label>
                  <input
                    type="text"
                    value={newProject.title}
                    onChange={(e) =>
                      setNewProject({ ...newProject, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Мой проект"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) =>
                      setNewProject({ ...newProject, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Описание проекта..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Цвет
                  </label>
                  <div className="flex gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewProject({ ...newProject, color })}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          newProject.color === color
                            ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_personal"
                    checked={newProject.is_personal}
                    onChange={(e) =>
                      setNewProject({ ...newProject, is_personal: e.target.checked })
                    }
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <label
                    htmlFor="is_personal"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Личный проект
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProject.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component
function FolderKanban(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="M8 10v4" />
      <path d="M12 10v2" />
      <path d="M16 10v6" />
    </svg>
  );
}
