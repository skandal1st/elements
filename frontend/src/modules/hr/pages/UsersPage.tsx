import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Key, Users, Shield, ShieldOff } from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../../shared/api/client'

type User = {
  id: string
  email: string
  username?: string
  full_name: string
  roles: Record<string, string>
  phone?: string
  is_active: boolean
  is_superuser: boolean
  created_at?: string
  last_login_at?: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  hr: 'HR-специалист',
  user: 'Пользователь',
  viewer: 'Просмотр',
}

const MODULE_LABELS: Record<string, string> = {
  hr: 'HR',
  it: 'IT',
  finance: 'Финансы',
  portal: 'Портал',
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Модальное окно создания/редактирования
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState({
    email: '',
    username: '',
    full_name: '',
    password: '',
    phone: '',
    is_active: true,
    roles: {} as Record<string, string>,
  })

  // Модальное окно сброса пароля
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<User[]>('/hr/users/')
      setUsers(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditingUser(null)
    setForm({
      email: '',
      username: '',
      full_name: '',
      password: '',
      phone: '',
      is_active: true,
      roles: {},
    })
    setError(null)
    setMessage(null)
    setModalOpen(true)
  }

  const openEdit = (user: User) => {
    setEditingUser(user)
    setForm({
      email: user.email,
      username: user.username || '',
      full_name: user.full_name,
      password: '',
      phone: user.phone || '',
      is_active: user.is_active,
      roles: { ...user.roles },
    })
    setError(null)
    setMessage(null)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.full_name.trim()) {
      setError('ФИО обязательно')
      return
    }
    if (!form.email.trim()) {
      setError('Email обязателен')
      return
    }
    if (!editingUser && !form.password) {
      setError('Пароль обязателен для нового пользователя')
      return
    }

    setError(null)
    try {
      if (editingUser) {
        // Редактирование
        await apiPatch(`/hr/users/${editingUser.id}`, {
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          is_active: form.is_active,
          roles: form.roles,
        })
        setMessage('Пользователь обновлён')
      } else {
        // Создание
        await apiPost('/hr/users/', {
          email: form.email.trim(),
          username: form.username.trim() || null,
          password: form.password,
          full_name: form.full_name.trim(),
          roles: form.roles,
        })
        setMessage('Пользователь создан')
      }

      setModalOpen(false)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Удалить пользователя "${user.full_name}"?`)) {
      return
    }

    setError(null)
    try {
      await apiDelete(`/hr/users/${user.id}`)
      setMessage('Пользователь удалён')
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const openResetPassword = (user: User) => {
    setResetPasswordUser(user)
    setNewPassword('')
    setError(null)
    setResetPasswordModalOpen(true)
  }

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return
    if (!newPassword || newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }

    setError(null)
    try {
      await apiPost(`/hr/users/${resetPasswordUser.id}/reset-password`, {
        new_password: newPassword,
      })
      setMessage(`Пароль для ${resetPasswordUser.full_name} сброшен`)
      setResetPasswordModalOpen(false)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const toggleRole = (module: string, role: string) => {
    setForm((prev) => {
      const newRoles = { ...prev.roles }
      if (newRoles[module] === role) {
        delete newRoles[module]
      } else {
        newRoles[module] = role
      }
      return { ...prev, roles: newRoles }
    })
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRolesDisplay = (roles: Record<string, string>) => {
    const entries = Object.entries(roles)
    if (entries.length === 0) return <span className="text-gray-400">Нет ролей</span>
    return entries.map(([module, role]) => (
      <span
        key={module}
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-1"
      >
        {MODULE_LABELS[module] || module}: {ROLE_LABELS[role] || role}
      </span>
    ))
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Пользователи</h2>
          <p className="text-sm text-gray-500">Управление учётными записями системы.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Добавить пользователя
        </button>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Загрузка…</p>}

      {!loading && users.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Пользователи не найдены</p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Пользователь</th>
                <th className="px-4 py-3 font-medium text-gray-700">Email / Логин</th>
                <th className="px-4 py-3 font-medium text-gray-700">Роли</th>
                <th className="px-4 py-3 font-medium text-gray-700">Статус</th>
                <th className="px-4 py-3 font-medium text-gray-700">Последний вход</th>
                <th className="px-4 py-3 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {user.is_superuser && (
                        <Shield className="w-4 h-4 text-amber-500" title="Суперпользователь" />
                      )}
                      <span className="font-medium">{user.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{user.email}</div>
                    {user.username && (
                      <div className="text-xs text-gray-500">@{user.username}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{getRolesDisplay(user.roles)}</td>
                  <td className="px-4 py-3">
                    {user.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Активен
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Заблокирован
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(user.last_login_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openResetPassword(user)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Сбросить пароль"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить"
                        disabled={user.is_superuser}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingUser ? 'Редактирование пользователя' : 'Новый пользователь'}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ФИО <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Иванов Иван Иванович"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  disabled={!!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Логин
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="ivanov"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  disabled={!!editingUser}
                />
              </div>
            </div>

            {!editingUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  type="password"
                  placeholder="Минимум 6 символов"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Телефон
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+7 (999) 123-45-67"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Роли по модулям
              </label>
              <div className="space-y-3">
                {Object.entries(MODULE_LABELS).map(([module, moduleLabel]) => (
                  <div key={module} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">{moduleLabel}</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ROLE_LABELS).map(([role, roleLabel]) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRole(module, role)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                            form.roles[module] === role
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {roleLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {editingUser && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Учётная запись активна
                </label>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {editingUser ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно сброса пароля */}
      {resetPasswordModalOpen && resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Сброс пароля
            </h3>
            <p className="text-sm text-gray-600">
              Сброс пароля для: <strong>{resetPasswordUser.full_name}</strong>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Новый пароль <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="password"
                placeholder="Минимум 6 символов"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResetPasswordModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg"
              >
                Сбросить пароль
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
