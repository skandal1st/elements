import { useEffect, useState } from 'react'
import { Edit, ArrowRightLeft, Users } from 'lucide-react'
import { apiGet, apiPatch, apiPost } from '../../../shared/api/client'

type PhonebookEntry = {
  id: number
  full_name: string
  internal_phone?: string
  external_phone?: string
  email?: string
  department_id?: number
  position_id?: number
  birthday?: string
}

type Department = { id: number; name: string }
type Position = { id: number; name: string; department_id?: number }

export function Phonebook() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PhonebookEntry[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Модальное окно редактирования
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<PhonebookEntry | null>(null)
  const [editForm, setEditForm] = useState({
    full_name: '',
    department_id: '',
    position_id: '',
    internal_phone: '',
    external_phone: '',
    email: '',
    birthday: '',
  })

  // Модальное окно перевода
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferEmployee, setTransferEmployee] = useState<PhonebookEntry | null>(null)
  const [transferForm, setTransferForm] = useState({
    new_department_id: '',
    new_position_id: '',
    effective_date: '',
    reason: '',
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      const [data, departmentData, positionData] = await Promise.all([
        apiGet<PhonebookEntry[]>(`/hr/phonebook/?${params}`),
        apiGet<Department[]>('/hr/departments/'),
        apiGet<Position[]>('/hr/positions/'),
      ])
      const deptMap = new Map(departmentData.map((d) => [d.id, d.name]))
      const sorted = [...data].sort((a, b) => {
        const left = deptMap.get(a.department_id ?? -1) ?? ''
        const right = deptMap.get(b.department_id ?? -1) ?? ''
        return left.localeCompare(right, 'ru')
      })
      setItems(sorted)
      setDepartments(departmentData)
      setPositions(positionData)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Открыть редактирование
  const openEdit = (emp: PhonebookEntry) => {
    setEditingEmployee(emp)
    setEditForm({
      full_name: emp.full_name,
      department_id: emp.department_id ? String(emp.department_id) : '',
      position_id: emp.position_id ? String(emp.position_id) : '',
      internal_phone: emp.internal_phone || '',
      external_phone: emp.external_phone || '',
      email: emp.email || '',
      birthday: emp.birthday || '',
    })
    setError(null)
    setMessage(null)
    setEditModalOpen(true)
  }

  // Сохранить редактирование
  const handleEditSubmit = async () => {
    if (!editingEmployee) return
    if (!editForm.full_name.trim()) {
      setError('ФИО обязательно')
      return
    }

    setError(null)
    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        department_id: editForm.department_id ? Number(editForm.department_id) : null,
        position_id: editForm.position_id ? Number(editForm.position_id) : null,
        internal_phone: editForm.internal_phone.trim() || null,
        external_phone: editForm.external_phone.trim() || null,
        email: editForm.email.trim() || null,
        birthday: editForm.birthday || null,
      }

      await apiPatch(`/hr/employees/${editingEmployee.id}`, payload)
      setMessage('Данные сотрудника обновлены')
      setEditModalOpen(false)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Открыть перевод
  const openTransfer = (emp: PhonebookEntry) => {
    setTransferEmployee(emp)
    setTransferForm({
      new_department_id: emp.department_id ? String(emp.department_id) : '',
      new_position_id: emp.position_id ? String(emp.position_id) : '',
      effective_date: new Date().toISOString().slice(0, 10),
      reason: '',
    })
    setError(null)
    setMessage(null)
    setTransferModalOpen(true)
  }

  // Выполнить перевод
  const handleTransferSubmit = async () => {
    if (!transferEmployee) return
    if (!transferForm.new_department_id || !transferForm.new_position_id) {
      setError('Выберите подразделение и должность')
      return
    }

    setError(null)
    try {
      // Создаем HR-заявку на перевод
      await apiPost('/hr/hr-requests/', {
        type: 'transfer',
        employee_id: transferEmployee.id,
        request_date: new Date().toISOString().slice(0, 10),
        effective_date: transferForm.effective_date || null,
        needs_it_equipment: false,
        notes: transferForm.reason || null,
      })

      // Обновляем данные сотрудника
      await apiPatch(`/hr/employees/${transferEmployee.id}`, {
        department_id: Number(transferForm.new_department_id),
        position_id: Number(transferForm.new_position_id),
      })

      setMessage(`Сотрудник "${transferEmployee.full_name}" переведен`)
      setTransferModalOpen(false)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Фильтрация должностей по выбранному отделу
  const getFilteredPositions = (departmentId: string) => {
    if (!departmentId) return positions
    return positions.filter((p) => !p.department_id || p.department_id === Number(departmentId))
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Телефонная книга</h2>
          <p className="text-sm text-gray-500">Поиск по сотрудникам и контактам.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по ФИО"
        />
        <button
          onClick={load}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          Найти
        </button>
      </div>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
      {!loading && items.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Сотрудники не найдены</p>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">ФИО</th>
                <th className="px-4 py-3 font-medium text-gray-700">Отдел</th>
                <th className="px-4 py-3 font-medium text-gray-700">Должность</th>
                <th className="px-4 py-3 font-medium text-gray-700">Внутренний</th>
                <th className="px-4 py-3 font-medium text-gray-700">Внешний</th>
                <th className="px-4 py-3 font-medium text-gray-700">Email</th>
                <th className="px-4 py-3 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.full_name}</td>
                  <td className="px-4 py-3">
                    {departments.find((d) => d.id === item.department_id)?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    {positions.find((p) => p.id === item.position_id)?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3">{item.internal_phone ?? '-'}</td>
                  <td className="px-4 py-3">{item.external_phone ?? '-'}</td>
                  <td className="px-4 py-3">{item.email ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openTransfer(item)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Перевести на другую должность"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно редактирования сотрудника */}
      {editModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Редактирование сотрудника
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ФИО <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата рождения
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  type="date"
                  value={editForm.birthday}
                  onChange={(e) => setEditForm((p) => ({ ...p, birthday: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Подразделение
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={editForm.department_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, department_id: e.target.value, position_id: '' }))}
                >
                  <option value="">Не выбрано</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Должность
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={editForm.position_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, position_id: e.target.value }))}
                >
                  <option value="">Не выбрано</option>
                  {getFilteredPositions(editForm.department_id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Внутренний телефон
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123"
                  value={editForm.internal_phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, internal_phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Внешний телефон
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+7 (999) 123-45-67"
                  value={editForm.external_phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, external_phone: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="email"
                placeholder="email@example.com"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleEditSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно перевода сотрудника */}
      {transferModalOpen && transferEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Перевод сотрудника
            </h3>
            <p className="text-sm text-gray-600">
              Перевод: <strong>{transferEmployee.full_name}</strong>
            </p>

            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="text-gray-500 mb-1">Текущее назначение:</div>
              <div>
                <strong>Подразделение:</strong> {departments.find((d) => d.id === transferEmployee.department_id)?.name ?? 'Не указано'}
              </div>
              <div>
                <strong>Должность:</strong> {positions.find((p) => p.id === transferEmployee.position_id)?.name ?? 'Не указано'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Новое подразделение <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={transferForm.new_department_id}
                onChange={(e) => setTransferForm((p) => ({ ...p, new_department_id: e.target.value, new_position_id: '' }))}
              >
                <option value="">Выберите подразделение</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Новая должность <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={transferForm.new_position_id}
                onChange={(e) => setTransferForm((p) => ({ ...p, new_position_id: e.target.value }))}
              >
                <option value="">Выберите должность</option>
                {getFilteredPositions(transferForm.new_department_id).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата перевода
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="date"
                value={transferForm.effective_date}
                onChange={(e) => setTransferForm((p) => ({ ...p, effective_date: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Причина перевода
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
                placeholder="Например: Повышение в должности, Реорганизация отдела"
                value={transferForm.reason}
                onChange={(e) => setTransferForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTransferModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleTransferSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg"
              >
                Перевести
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
