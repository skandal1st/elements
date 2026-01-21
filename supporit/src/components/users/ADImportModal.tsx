import { useState, useEffect } from "react";
import {
  Search,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Users,
  User,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { adService, type ADUser } from "../../services/ad.service";
import type { UserRole } from "../../types";

interface ADImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ADImportModal = ({
  isOpen,
  onClose,
  onImportComplete,
}: ADImportModalProps) => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);
  const [users, setUsers] = useState<ADUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState<UserRole>("employee");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: string[];
    failed: { username: string; error: string }[];
  } | null>(null);

  // Тест подключения при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      testConnection();
    } else {
      // Сброс состояния при закрытии
      setUsers([]);
      setSelectedUsers(new Set());
      setImportResult(null);
      setSearchTerm("");
    }
  }, [isOpen]);

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await adService.testConnection();
      setConnectionStatus({
        tested: true,
        success: result.success,
        message: result.message,
      });

      if (result.success) {
        // Автоматически загружаем пользователей при успешном подключении
        loadUsers();
      }
    } catch (error: any) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: error.message || "Ошибка подключения",
      });
    } finally {
      setTesting(false);
    }
  };

  const loadUsers = async (search?: string) => {
    setLoading(true);
    try {
      const result = await adService.getUsers(search);
      setUsers(result.data);
    } catch (error: any) {
      console.error("Ошибка загрузки пользователей AD:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadUsers(searchTerm || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const toggleUserSelection = (username: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(username)) {
      newSelected.delete(username);
    } else {
      newSelected.add(username);
    }
    setSelectedUsers(newSelected);
  };

  const toggleSelectAll = () => {
    const availableUsers = users.filter((u) => !u.imported && u.enabled);
    if (selectedUsers.size === availableUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(availableUsers.map((u) => u.sAMAccountName)));
    }
  };

  const handleImport = async () => {
    if (selectedUsers.size === 0) return;

    setImporting(true);
    setImportResult(null);

    try {
      const result = await adService.importBulk(
        Array.from(selectedUsers),
        selectedRole
      );
      setImportResult(result.data);

      // Перезагружаем список для обновления статусов
      await loadUsers(searchTerm || undefined);

      // Очищаем выделение
      setSelectedUsers(new Set());

      // Уведомляем родителя об успешном импорте
      if (result.data.success.length > 0) {
        onImportComplete();
      }
    } catch (error: any) {
      console.error("Ошибка импорта:", error);
      setImportResult({
        success: [],
        failed: [{ username: "all", error: error.message }],
      });
    } finally {
      setImporting(false);
    }
  };

  const availableUsersCount = users.filter(
    (u) => !u.imported && u.enabled
  ).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Импорт пользователей из Active Directory"
      size="xl"
    >
      <div className="space-y-4">
        {/* Статус подключения */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center gap-2">
            {testing ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Проверка подключения...
                </span>
              </>
            ) : connectionStatus?.tested ? (
              connectionStatus.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">
                    {connectionStatus.message}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-600 dark:text-red-400">
                    {connectionStatus.message}
                  </span>
                </>
              )
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">
                  Подключение не проверено
                </span>
              </>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={testConnection}
            disabled={testing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${testing ? "animate-spin" : ""}`}
            />
            Проверить
          </Button>
        </div>

        {/* Результат импорта */}
        {importResult && (
          <div
            className={`p-3 rounded-lg ${
              importResult.failed.length === 0
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                : importResult.success.length === 0
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
            }`}
          >
            {importResult.success.length > 0 && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                <CheckCircle className="h-4 w-4" />
                <span>
                  Успешно импортировано: {importResult.success.length}
                </span>
              </div>
            )}
            {importResult.failed.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                  <XCircle className="h-4 w-4" />
                  <span>Ошибки: {importResult.failed.length}</span>
                </div>
                <ul className="text-sm text-red-500 dark:text-red-400 ml-6 list-disc">
                  {importResult.failed.slice(0, 5).map((f, i) => (
                    <li key={i}>
                      {f.username}: {f.error}
                    </li>
                  ))}
                  {importResult.failed.length > 5 && (
                    <li>...и ещё {importResult.failed.length - 5}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {connectionStatus?.success && (
          <>
            {/* Поиск */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по имени, логину или email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Панель действий */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selectedUsers.size === availableUsersCount &&
                      availableUsersCount > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Выбрать всех ({availableUsersCount})
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Роль:
                  </span>
                  <select
                    value={selectedRole}
                    onChange={(e) =>
                      setSelectedRole(e.target.value as UserRole)
                    }
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="employee">Сотрудник</option>
                    <option value="it_specialist">ИТ-специалист</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Выбрано: {selectedUsers.size}
                </span>
                <Button
                  onClick={handleImport}
                  disabled={selectedUsers.size === 0 || importing}
                >
                  {importing ? (
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5 mr-2" />
                  )}
                  Импортировать
                </Button>
              </div>
            </div>

            {/* Список пользователей */}
            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Пользователи не найдены</p>
                  <p className="text-sm">
                    Попробуйте изменить поисковый запрос
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Выбор
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Пользователь
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Email
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Отдел
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((user) => {
                      const isDisabled = user.imported || !user.enabled;
                      const isSelected = selectedUsers.has(user.sAMAccountName);

                      return (
                        <tr
                          key={user.dn}
                          className={`${
                            isDisabled
                              ? "bg-gray-50 dark:bg-gray-900/50 opacity-60"
                              : isSelected
                                ? "bg-primary-50 dark:bg-primary-900/20"
                                : "hover:bg-gray-50 dark:hover:bg-gray-900/50"
                          }`}
                        >
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                toggleUserSelection(user.sAMAccountName)
                              }
                              disabled={isDisabled}
                              className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {user.displayName}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {user.sAMAccountName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {user.mail || user.userPrincipalName || "-"}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {user.department || "-"}
                          </td>
                          <td className="px-4 py-2">
                            {user.imported ? (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Импортирован
                              </span>
                            ) : !user.enabled ? (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                <XCircle className="h-3 w-3 mr-1" />
                                Отключён
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                Доступен
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              Найдено пользователей: {users.length}
              {users.filter((u) => u.imported).length > 0 && (
                <span className="ml-2">
                  (уже импортировано: {users.filter((u) => u.imported).length})
                </span>
              )}
            </div>
          </>
        )}

        {/* Кнопки */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
};
