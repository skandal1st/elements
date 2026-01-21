import { useEffect, useState } from "react";
import { Key, Trash2, UserPlus } from "lucide-react";

import { apiFetch } from "../api/client";

type User = {
  id: number;
  username: string;
  role: string;
  full_name?: string;
};

const ROLES = [
  { value: "admin", label: "Администратор" },
  { value: "hr", label: "HR-менеджер" },
  { value: "it", label: "IT-специалист" },
  { value: "auditor", label: "Аудитор" },
  { value: "manager", label: "Руководитель" },
];

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Модальное окно создания пользователя
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "auditor",
  });

  // Модальное окно сброса пароля
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<User[]>("/users/");
      setUsers(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async () => {
    setError(null);
    try {
      await apiFetch<User>("/users/", {
        method: "POST",
        body: JSON.stringify(newUser),
      });
      setMessage("Пользователь создан");
      setIsCreateModalOpen(false);
      setNewUser({ username: "", password: "", role: "auditor" });
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    setError(null);
    try {
      await apiFetch<User>(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMessage("Роль обновлена");
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId) return;
    setError(null);
    try {
      await apiFetch<User>(`/users/${resetUserId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword }),
      });
      setMessage("Пароль сброшен");
      setIsResetModalOpen(false);
      setResetUserId(null);
      setNewPassword("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm("Вы уверены, что хотите удалить пользователя?")) return;
    setError(null);
    try {
      await apiFetch(`/users/${userId}`, { method: "DELETE" });
      setMessage("Пользователь удален");
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openResetModal = (userId: number) => {
    setResetUserId(userId);
    setNewPassword("");
    setIsResetModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Управление пользователями
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Просмотр пользователей, назначение ролей и сброс паролей.
        </p>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-between items-center">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
        >
          <UserPlus className="h-4 w-4" />
          Добавить пользователя
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                ФИО
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Логин
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Роль
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="px-4 py-3 text-gray-900 dark:text-white">
                  {user.id}
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">
                  {user.full_name || "-"}
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">
                  {user.username}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openResetModal(user.id)}
                      className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                      title="Сбросить пароль"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модальное окно создания пользователя */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Новый пользователь
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-sm text-gray-500"
              >
                Закрыть
              </button>
            </div>

            <div className="space-y-3">
              <input
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="Логин (email)"
                value={newUser.username}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, username: e.target.value }))
                }
              />
              <input
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                type="password"
                placeholder="Пароль"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, password: e.target.value }))
                }
              />
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, role: e.target.value }))
                }
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateUser}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                disabled={!newUser.username || !newUser.password}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно сброса пароля */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Сброс пароля
              </h3>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="text-sm text-gray-500"
              >
                Закрыть
              </button>
            </div>

            <div className="space-y-3">
              <input
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                type="password"
                placeholder="Новый пароль"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                disabled={!newPassword}
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
