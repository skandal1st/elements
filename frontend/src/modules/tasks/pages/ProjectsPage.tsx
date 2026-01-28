import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Archive,
  MoreVertical,
  Users,
  UserPlus,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useTasksStore, Project } from "../../../shared/store/tasks.store";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from "../../../shared/api/client";

export function ProjectsPage() {
  const navigate = useNavigate();
  const {
    projects,
    currentProject,
    projectsLoading,
    projectsError,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    setCurrentProject,
  } = useTasksStore();

  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    color: "#3B82F6",
    is_personal: true,
  });
  const [editProject, setEditProject] = useState({
    title: "",
    description: "",
    color: "#3B82F6",
    is_personal: true,
  });
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // --- Project sharing modal ---
  type UserOption = { id: string; full_name: string; email?: string | null };
  type ProjectShare = {
    id: string;
    project_id: string;
    share_type: "user" | "department";
    target_id: string;
    permission: "view" | "edit" | "admin";
    created_at?: string;
    target_name?: string | null;
    target_email?: string | null;
  };

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [shares, setShares] = useState<ProjectShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [sharesError, setSharesError] = useState<string | null>(null);

  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPermission, setSelectedPermission] = useState<
    "view" | "edit" | "admin"
  >("view");

  const openShareModal = async (project: Project) => {
    setMenuOpenId(null);
    setSharesError(null);
    setShareProject(project);
    setShareModalOpen(true);
    await loadShares(project.id);
    await loadUsers();
  };

  const closeShareModal = () => {
    setShareModalOpen(false);
    setShareProject(null);
    setShares([]);
    setSharesError(null);
    setUserSearch("");
    setSelectedUserId("");
    setSelectedPermission("view");
  };

  const loadShares = async (projectId: string) => {
    setSharesLoading(true);
    setSharesError(null);
    try {
      const data = await apiGet<ProjectShare[]>(
        `/tasks/projects/${projectId}/shares/`,
      );
      setShares(data);
    } catch (err) {
      setSharesError((err as Error).message);
    } finally {
      setSharesLoading(false);
    }
  };

  const loadUsers = async () => {
    if (usersLoading) return;
    setUsersLoading(true);
    try {
      const data = await apiGet<UserOption[]>("/hr/users/");
      setUsersList(data);
    } catch (err) {
      // не блокируем модалку, но покажем ошибку рядом
      setSharesError((prev) => prev ?? (err as Error).message);
    } finally {
      setUsersLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const sharedIds = new Set(shares.map((s) => s.target_id));
    return usersList
      .filter((u) => u.id !== shareProject?.owner_id)
      .filter((u) => !sharedIds.has(u.id))
      .filter((u) => {
        if (!q) return true;
        const hay = `${u.full_name ?? ""} ${u.email ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [userSearch, usersList, shares, shareProject?.owner_id]);

  const handleAddShare = async () => {
    if (!shareProject) return;
    if (!selectedUserId) return;
    setSharesError(null);
    try {
      await apiPost(`/tasks/projects/${shareProject.id}/shares/`, {
        share_type: "user",
        target_id: selectedUserId,
        permission: selectedPermission,
      });
      setSelectedUserId("");
      setSelectedPermission("view");
      await loadShares(shareProject.id);
      // обновим проекты (чтобы shared_with_count подтянулся)
      await loadProjects(showArchived);
    } catch (err) {
      setSharesError((err as Error).message);
    }
  };

  const handleUpdateSharePermission = async (
    shareId: string,
    permission: "view" | "edit" | "admin",
  ) => {
    if (!shareProject) return;
    setSharesError(null);
    try {
      await apiPatch(`/tasks/projects/${shareProject.id}/shares/${shareId}`, {
        permission,
      });
      await loadShares(shareProject.id);
    } catch (err) {
      setSharesError((err as Error).message);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!shareProject) return;
    if (!confirm("Отозвать доступ?")) return;
    setSharesError(null);
    try {
      await apiDelete(`/tasks/projects/${shareProject.id}/shares/${shareId}`);
      await loadShares(shareProject.id);
      await loadProjects(showArchived);
    } catch (err) {
      setSharesError((err as Error).message);
    }
  };

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

  const openEditProject = (project: Project) => {
    setEditError(null);
    setEditingProject(project);
    setEditProject({
      title: project.title || "",
      description: project.description || "",
      color: project.color || "#3B82F6",
      is_personal: !!project.is_personal,
    });
    setShowEditModal(true);
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    if (!editProject.title.trim()) return;
    setEditError(null);
    try {
      const updated = await updateProject(editingProject.id, {
        title: editProject.title,
        description: editProject.description || undefined,
        color: editProject.color,
        is_personal: editProject.is_personal,
      });
      setShowEditModal(false);
      setEditingProject(null);
      // Обновим текущий проект, если он открыт
      if (currentProject?.id === updated.id) {
        setCurrentProject(updated);
      }
    } catch (error) {
      const msg = (error as Error).message;
      setEditError(msg);
      console.error("Failed to update project:", error);
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
                      {(project.user_permission === "owner" ||
                        project.user_permission === "admin") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditProject(project);
                            setMenuOpenId(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          Редактировать
                        </button>
                      )}
                      {(project.user_permission === "owner" ||
                        project.user_permission === "admin") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void openShareModal(project);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Users className="w-4 h-4" />
                          Доступ
                        </button>
                      )}
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

      {/* Edit Project Modal */}
      {showEditModal && editingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Редактирование проекта
              </h2>

              {editError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {editError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Название
                  </label>
                  <input
                    type="text"
                    value={editProject.title}
                    onChange={(e) =>
                      setEditProject({ ...editProject, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Название проекта"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={editProject.description}
                    onChange={(e) =>
                      setEditProject({
                        ...editProject,
                        description: e.target.value,
                      })
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
                        onClick={() => setEditProject({ ...editProject, color })}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          editProject.color === color
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
                    id="edit_is_personal"
                    checked={editProject.is_personal}
                    onChange={(e) =>
                      setEditProject({
                        ...editProject,
                        is_personal: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <label
                    htmlFor="edit_is_personal"
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
                  setShowEditModal(false);
                  setEditingProject(null);
                  setEditError(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleUpdateProject}
                disabled={!editProject.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share / Access Modal */}
      {shareModalOpen && shareProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Доступ к проекту
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {shareProject.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Личные проекты видит только владелец, если доступ не выдан явно.
                </p>
              </div>
              <button
                onClick={closeShareModal}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Закрыть"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {sharesError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {sharesError}
                </div>
              )}

              {/* Add user */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Выдать доступ пользователю
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Поиск пользователя (ФИО / email)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={usersLoading}
                    >
                      <option value="">
                        {usersLoading ? "Загрузка пользователей..." : "Выберите пользователя"}
                      </option>
                      {filteredUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} {u.email ? `(${u.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Права
                    </label>
                    <select
                      value={selectedPermission}
                      onChange={(e) =>
                        setSelectedPermission(e.target.value as "view" | "edit" | "admin")
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="view">Просмотр</option>
                      <option value="edit">Редактирование</option>
                      <option value="admin">Администратор</option>
                    </select>
                    <button
                      onClick={handleAddShare}
                      disabled={!selectedUserId}
                      className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Выдать доступ
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing shares */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Пользователи с доступом
                  </h3>
                  {sharesLoading && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Загрузка...
                    </span>
                  )}
                </div>

                {shares.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Доступы не выданы.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {shares
                      .filter((s) => s.share_type === "user")
                      .map((s) => (
                        <div
                          key={s.id}
                          className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {s.target_name || s.target_id}
                            </div>
                            {s.target_email && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {s.target_email}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={s.permission}
                              onChange={(e) =>
                                void handleUpdateSharePermission(
                                  s.id,
                                  e.target.value as "view" | "edit" | "admin",
                                )
                              }
                              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                            >
                              <option value="view">Просмотр</option>
                              <option value="edit">Редактирование</option>
                              <option value="admin">Администратор</option>
                            </select>
                            <button
                              onClick={() => void handleRemoveShare(s.id)}
                              className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            >
                              Убрать
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
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
