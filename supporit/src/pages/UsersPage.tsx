import { useState, useEffect } from "react";
import {
  Search,
  Edit,
  Users as UsersIcon,
  Plus,
  Trash2,
  FolderSync,
} from "lucide-react";
import { usersService } from "../services/users.service";
import { adService } from "../services/ad.service";
import type { User, UserRole } from "../types";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { UserForm } from "../components/users/UserForm";
import { ADImportModal } from "../components/users/ADImportModal";
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/Table";
import { useAuthStore } from "../store/auth.store";
import { isITSpecialist, canManageUsers } from "../utils/permissions";

const roleLabels: Record<UserRole, string> = {
  admin: "Администратор",
  it_specialist: "ИТ-специалист",
  employee: "Сотрудник",
};

const roleColors: Record<UserRole, string> = {
  admin:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  it_specialist:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  employee: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

export const UsersPage = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [isADModalOpen, setIsADModalOpen] = useState(false);
  const [adEnabled, setAdEnabled] = useState(false);
  const canManage = isITSpecialist(currentUser?.role);
  const canDelete = canManageUsers(currentUser?.role); // Только админы могут удалять

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await usersService.getUsers();
      if (result.error) {
        console.error("Ошибка загрузки пользователей:", result.error);
        setError(result.error.message || "Ошибка при загрузке пользователей");
      } else {
        setUsers(result.data);
      }
    } catch (err) {
      console.error("Исключение при загрузке:", err);
      setError("Произошла ошибка при загрузке пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // Проверяем доступность AD для админов
    if (canDelete) {
      adService
        .getStatus()
        .then((status) => {
          setAdEnabled(status.enabled);
        })
        .catch(() => {
          setAdEnabled(false);
        });
    }
  }, [canDelete]);

  const handleCreate = () => {
    setEditingUser(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleSubmit = async (data: any) => {
    setFormLoading(true);
    try {
      if (editingUser) {
        // Обновление существующего пользователя
        const { error } = await usersService.updateUser(editingUser.id, data);
        if (error) {
          alert("Ошибка при обновлении: " + error.message);
          return;
        }

        // Если текущий пользователь изменил свою роль, нужно перелогиниться
        if (
          editingUser.id === currentUser?.id &&
          data.role !== editingUser.role
        ) {
          alert("Вы изменили свою роль. Пожалуйста, перезайдите в систему.");
          // Здесь можно добавить автоматический выход и перенаправление на страницу входа
        }
      } else {
        // Создание нового пользователя
        // Преобразуем пустую строку пароля в undefined
        const userData = {
          ...data,
          password:
            data.password && data.password.trim() !== ""
              ? data.password
              : undefined,
        };
        const { error } = await usersService.createUser(userData);
        if (error) {
          alert("Ошибка при создании: " + error.message);
          return;
        }
      }

      setIsModalOpen(false);
      setEditingUser(undefined);
      loadUsers();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (user: User) => {
    // Нельзя удалить самого себя
    if (user.id === currentUser?.id) {
      alert("Нельзя удалить самого себя");
      return;
    }

    if (
      !confirm(
        `Вы уверены, что хотите удалить пользователя "${user.full_name}" (${user.email})?`,
      )
    ) {
      return;
    }

    const { error } = await usersService.deleteUser(user.id);
    if (error) {
      alert("Ошибка при удалении: " + error.message);
    } else {
      loadUsers();
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.department &&
        user.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.position &&
        user.position.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <UsersIcon className="h-8 w-8 mr-3" />
            Пользователи
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Управление пользователями и правами доступа
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {adEnabled && canDelete && (
              <Button
                variant="secondary"
                onClick={() => setIsADModalOpen(true)}
              >
                <FolderSync className="h-5 w-5 mr-2" />
                Импорт из AD
              </Button>
            )}
            <Button onClick={handleCreate}>
              <Plus className="h-5 w-5 mr-2" />
              Добавить пользователя
            </Button>
          </div>
        )}
      </div>

      {/* Поиск */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по имени, email, отделу или должности..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Таблица */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
          {searchTerm ? "Пользователи не найдены" : "Пользователи не найдены"}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Имя</TableHeaderCell>
              <TableHeaderCell>Роль</TableHeaderCell>
              <TableHeaderCell>Отдел</TableHeaderCell>
              <TableHeaderCell>Должность</TableHeaderCell>
              <TableHeaderCell>Телефон</TableHeaderCell>
              <TableHeaderCell>Дата регистрации</TableHeaderCell>
              <TableHeaderCell>Действия</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{user.full_name}</div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${roleColors[user.role]}`}
                    >
                      {roleLabels[user.role]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.department || (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.position || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    {user.phone || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {canDelete && user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Модальное окно для создания/редактирования */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(undefined);
        }}
        title={
          editingUser
            ? `Редактирование пользователя: ${editingUser.email}`
            : "Добавление пользователя"
        }
      >
        <UserForm
          user={editingUser}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingUser(undefined);
          }}
          loading={formLoading}
        />
      </Modal>

      {/* Модальное окно импорта из AD */}
      <ADImportModal
        isOpen={isADModalOpen}
        onClose={() => setIsADModalOpen(false)}
        onImportComplete={loadUsers}
      />
    </div>
  );
};
