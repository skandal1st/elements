import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Key, Users, Shield } from 'lucide-react'
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
  it_specialist: 'ИТ-специалист',
  employee: 'Сотрудник',
  auditor: 'Аудитор',
  specialist: 'Специалист',
}

const MODULE_LABELS: Record<string, string> = {
  hr: 'HR',
  it: 'IT',
  tasks: 'Задачи',
  documents: 'Документы',
  portal: 'Портал',
}

// Роли для каждого модуля
const MODULE_ROLES: Record<string, string[]> = {
  hr: ['admin', 'hr', 'employee'],
  it: ['admin', 'it_specialist', 'employee', 'auditor'],
  tasks: ['admin', 'employee'],
  documents: ['admin', 'specialist', 'employee'],
  portal: ['admin', 'user'],
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
    if (entries.length === 0) return <span className="text-gray-500">Нет ролей</span>
    return entries.map(([module, role]) => (
      <span
        key={module}
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-purple/20 text-accent-purple mr-1"
      >
        {MODULE_LABELS[module] || module}: {ROLE_LABELS[role] || role}
      </span>
    ))
  }

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Пользователи</h2>
            <p className="text-gray-400">Управление учётными записями системы</p>
          </div>
          <button onClick={openCreate} className="glass-button px-4 py-2.5 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Добавить пользователя
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">{message}</p>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Пользователи не найдены</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-dark-600/50">
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Email / Логин</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Роли</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Последний вход</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-dark-700/30 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {user.is_superuser && <Shield className="w-4 h-4 text-amber-400" aria-label="Суперпользователь" />}
                      <span className="font-medium text-white">{user.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-gray-300">{user.email}</div>
                    {user.username && <div className="text-xs text-gray-500">@{user.username}</div>}
                  </td>
                  <td className="px-4 py-4">{getRolesDisplay(user.roles)}</td>
                  <td className="px-4 py-4">
                    {user.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">Активен</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">Заблокирован</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-500 text-xs">{formatDate(user.last_login_at)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(user)} className="p-2 text-gray-400 hover:text-accent-purple hover:bg-dark-700/50 rounded-lg transition-all" title="Редактировать">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => openResetPassword(user)} className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all" title="Сбросить пароль">
                        <Key className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(user)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed" title="Удалить" disabled={user.is_superuser}>
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-lg font-semibold text-white">{editingUser ? 'Редактирование пользователя' : 'Новый пользователь'}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">ФИО <span className="text-red-400">*</span></label>
              <input className="glass-input w-full px-4 py-3 text-sm" placeholder="Иванов Иван Иванович" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email <span className="text-red-400">*</span></label>
                <input className="glass-input w-full px-4 py-3 text-sm disabled:opacity-60" type="email" placeholder="user@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={!!editingUser} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Логин</label>
                <input className="glass-input w-full px-4 py-3 text-sm disabled:opacity-60" placeholder="ivanov" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} disabled={!!editingUser} />
              </div>
            </div>
            {!editingUser && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Пароль <span className="text-red-400">*</span></label>
                <input className="glass-input w-full px-4 py-3 text-sm" type="password" placeholder="Минимум 6 символов" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Телефон</label>
              <input className="glass-input w-full px-4 py-3 text-sm" placeholder="+7 (999) 123-45-67" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Роли по модулям</label>
              <div className="space-y-3">
                {Object.entries(MODULE_LABELS).map(([module, moduleLabel]) => (
                  <div key={module} className="bg-dark-700/30 rounded-xl p-4">
                    <div className="text-sm font-medium text-white mb-2">{moduleLabel}</div>
                    <div className="flex flex-wrap gap-2">
                      {(MODULE_ROLES[module] || []).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRole(module, role)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
                            form.roles[module] === role
                              ? 'bg-accent-purple/30 text-accent-purple border border-accent-purple/50'
                              : 'bg-dark-700/50 border border-dark-600/50 text-gray-400 hover:text-white hover:border-dark-500'
                          }`}
                        >
                          {ROLE_LABELS[role] || role}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {editingUser && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30" />
                <label htmlFor="is_active" className="text-sm text-gray-400">Учётная запись активна</label>
              </div>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalOpen(false)} className="glass-button-secondary px-4 py-2 text-sm font-medium">Отмена</button>
              <button onClick={handleSubmit} className="glass-button px-4 py-2 text-sm font-medium">{editingUser ? 'Сохранить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {resetPasswordModalOpen && resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">Сброс пароля</h3>
            <p className="text-sm text-gray-400">Сброс пароля для: <strong className="text-white">{resetPasswordUser.full_name}</strong></p>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Новый пароль <span className="text-red-400">*</span></label>
              <input className="glass-input w-full px-4 py-3 text-sm" type="password" placeholder="Минимум 6 символов" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setResetPasswordModalOpen(false)} className="glass-button-secondary px-4 py-2 text-sm font-medium">Отмена</button>
              <button onClick={handleResetPassword} className="px-4 py-2 text-sm font-medium text-amber-400 bg-amber-500/20 border border-amber-500/30 rounded-xl hover:bg-amber-500/30 transition-all">Сбросить пароль</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
