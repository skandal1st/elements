import { useEffect, useState } from 'react'
import { Edit, ArrowRightLeft, Trash2, Users } from 'lucide-react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../shared/api/client'
import { buildingsService, roomsService } from '../../../shared/services/rooms.service'

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
  const [deletingId, setDeletingId] = useState<number | null>(null)

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
    room_id: '',
  })
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([])
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; building_name?: string }>>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('')

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

  const loadBuildings = async () => {
    try {
      const data = await buildingsService.getBuildings(true)
      setBuildings(data)
    } catch (err) {
      console.error('Ошибка загрузки зданий:', err)
    }
  }

  const loadRooms = async (buildingId: string) => {
    try {
      const data = await roomsService.getRooms(buildingId, true)
      setRooms(data)
    } catch (err) {
      console.error('Ошибка загрузки кабинетов:', err)
      setRooms([])
    }
  }

  useEffect(() => {
    if (editModalOpen) {
      loadBuildings()
    }
  }, [editModalOpen])

  useEffect(() => {
    if (selectedBuildingId) {
      loadRooms(selectedBuildingId)
    } else {
      setRooms([])
    }
  }, [selectedBuildingId])

  // Открыть редактирование
  const openEdit = async (emp: PhonebookEntry) => {
    setEditingEmployee(emp)
    setError(null)
    setMessage(null)
    setEditModalOpen(true)

    // Загружаем полную информацию о сотруднике, включая room_id
    try {
      const fullEmployee = await apiGet<PhonebookEntry & { room_id?: string }>(`/hr/employees/${emp.id}`)

      setEditForm({
        full_name: fullEmployee.full_name,
        department_id: fullEmployee.department_id ? String(fullEmployee.department_id) : '',
        position_id: fullEmployee.position_id ? String(fullEmployee.position_id) : '',
        internal_phone: fullEmployee.internal_phone || '',
        external_phone: fullEmployee.external_phone || '',
        email: fullEmployee.email || '',
        birthday: fullEmployee.birthday || '',
        room_id: fullEmployee.room_id || '',
      })

      // Определяем здание по room_id
      if (fullEmployee.room_id) {
        try {
          const room = await apiGet<{ id: string; building_id: string }>(`/it/rooms/${fullEmployee.room_id}`)
          setSelectedBuildingId(room.building_id)
        } catch (err) {
          console.error('Ошибка загрузки информации о кабинете:', err)
        }
      } else {
        setSelectedBuildingId('')
        setRooms([])
      }
    } catch (err) {
      console.error('Ошибка загрузки полной информации о сотруднике:', err)
      // Заполняем доступными данными
      setEditForm({
        full_name: emp.full_name,
        department_id: emp.department_id ? String(emp.department_id) : '',
        position_id: emp.position_id ? String(emp.position_id) : '',
        internal_phone: emp.internal_phone || '',
        external_phone: emp.external_phone || '',
        email: emp.email || '',
        birthday: emp.birthday || '',
        room_id: '',
      })
    }
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
        room_id: editForm.room_id || null,
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

  const handleDeleteEmployee = async (emp: PhonebookEntry) => {
    if (!window.confirm(`Удалить сотрудника "${emp.full_name}"?\n\nЭто действие пометит сотрудника как dismissed.`)) {
      return
    }
    setError(null)
    setMessage(null)
    setDeletingId(emp.id)
    try {
      await apiDelete(`/hr/employees/${emp.id}`)
      setMessage(`Сотрудник "${emp.full_name}" удалён (dismissed)`)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  // Фильтрация должностей по выбранному отделу
  const getFilteredPositions = (departmentId: string) => {
    if (!departmentId) return positions
    return positions.filter((p) => !p.department_id || p.department_id === Number(departmentId))
  }

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <h2 className="text-2xl font-bold text-white mb-1">Телефонная книга</h2>
        <p className="text-gray-400">Поиск по сотрудникам и контактам</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="glass-input flex-1 max-w-md px-4 py-2.5 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Поиск по ФИО"
        />
        <button onClick={load} className="glass-button-secondary px-4 py-2.5 text-sm font-medium">
          Найти
        </button>
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
      ) : items.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Сотрудники не найдены</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-dark-600/50">
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">ФИО</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Отдел</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Должность</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Внутренний</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Внешний</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-dark-700/30 transition-colors">
                  <td className="px-4 py-4 font-medium text-white">{item.full_name}</td>
                  <td className="px-4 py-4 text-gray-400">{departments.find((d) => d.id === item.department_id)?.name ?? '-'}</td>
                  <td className="px-4 py-4 text-gray-400">{positions.find((p) => p.id === item.position_id)?.name ?? '-'}</td>
                  <td className="px-4 py-4 text-gray-400">{item.internal_phone ?? '-'}</td>
                  <td className="px-4 py-4 text-gray-400">{item.external_phone ?? '-'}</td>
                  <td className="px-4 py-4 text-gray-400">{item.email ?? '-'}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-accent-purple hover:bg-dark-700/50 rounded-lg transition-all" title="Редактировать">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => openTransfer(item)} className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all" title="Перевести на другую должность">
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(item)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Удалить (dismissed)"
                        disabled={deletingId === item.id}
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

      {editModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-lg font-semibold text-white">Редактирование сотрудника</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">ФИО <span className="text-red-400">*</span></label>
                <input className="glass-input w-full px-4 py-3 text-sm" value={editForm.full_name} onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Дата рождения</label>
                <input className="glass-input w-full px-4 py-3 text-sm" type="date" value={editForm.birthday} onChange={(e) => setEditForm((p) => ({ ...p, birthday: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Подразделение</label>
                <select className="glass-input w-full px-4 py-3 text-sm" value={editForm.department_id} onChange={(e) => setEditForm((p) => ({ ...p, department_id: e.target.value, position_id: '' }))}>
                  <option value="" className="bg-dark-800">Не выбрано</option>
                  {departments.map((d) => <option key={d.id} value={d.id} className="bg-dark-800">{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Должность</label>
                <select className="glass-input w-full px-4 py-3 text-sm" value={editForm.position_id} onChange={(e) => setEditForm((p) => ({ ...p, position_id: e.target.value }))}>
                  <option value="" className="bg-dark-800">Не выбрано</option>
                  {getFilteredPositions(editForm.department_id).map((p) => <option key={p.id} value={p.id} className="bg-dark-800">{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Внутренний телефон</label>
                <input className="glass-input w-full px-4 py-3 text-sm" placeholder="123" value={editForm.internal_phone} onChange={(e) => setEditForm((p) => ({ ...p, internal_phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Внешний телефон</label>
                <input className="glass-input w-full px-4 py-3 text-sm" placeholder="+7 (999) 123-45-67" value={editForm.external_phone} onChange={(e) => setEditForm((p) => ({ ...p, external_phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input className="glass-input w-full px-4 py-3 text-sm" type="email" placeholder="email@example.com" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Здание</label>
                <select className="glass-input w-full px-4 py-3 text-sm" value={selectedBuildingId} onChange={(e) => setSelectedBuildingId(e.target.value)}>
                  <option value="" className="bg-dark-800">Не выбрано</option>
                  {buildings.map((b) => <option key={b.id} value={b.id} className="bg-dark-800">{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Кабинет</label>
                <select className="glass-input w-full px-4 py-3 text-sm" value={editForm.room_id} onChange={(e) => setEditForm((p) => ({ ...p, room_id: e.target.value }))} disabled={!selectedBuildingId}>
                  <option value="" className="bg-dark-800">Не выбрано</option>
                  {rooms.map((r) => <option key={r.id} value={r.id} className="bg-dark-800">{r.name} {r.building_name ? `(${r.building_name})` : ''}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditModalOpen(false)} className="glass-button-secondary px-4 py-2 text-sm font-medium">Отмена</button>
              <button onClick={handleEditSubmit} className="glass-button px-4 py-2 text-sm font-medium">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {transferModalOpen && transferEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-lg font-semibold text-white">Перевод сотрудника</h3>
            <p className="text-sm text-gray-400">Перевод: <strong className="text-white">{transferEmployee.full_name}</strong></p>
            <div className="bg-dark-700/30 rounded-xl p-4 text-sm">
              <div className="text-gray-500 mb-2">Текущее назначение:</div>
              <div className="text-gray-400"><strong className="text-gray-300">Подразделение:</strong> {departments.find((d) => d.id === transferEmployee.department_id)?.name ?? 'Не указано'}</div>
              <div className="text-gray-400"><strong className="text-gray-300">Должность:</strong> {positions.find((p) => p.id === transferEmployee.position_id)?.name ?? 'Не указано'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Новое подразделение <span className="text-red-400">*</span></label>
              <select className="glass-input w-full px-4 py-3 text-sm" value={transferForm.new_department_id} onChange={(e) => setTransferForm((p) => ({ ...p, new_department_id: e.target.value, new_position_id: '' }))}>
                <option value="" className="bg-dark-800">Выберите подразделение</option>
                {departments.map((d) => <option key={d.id} value={d.id} className="bg-dark-800">{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Новая должность <span className="text-red-400">*</span></label>
              <select className="glass-input w-full px-4 py-3 text-sm" value={transferForm.new_position_id} onChange={(e) => setTransferForm((p) => ({ ...p, new_position_id: e.target.value }))}>
                <option value="" className="bg-dark-800">Выберите должность</option>
                {getFilteredPositions(transferForm.new_department_id).map((p) => <option key={p.id} value={p.id} className="bg-dark-800">{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Дата перевода</label>
              <input className="glass-input w-full px-4 py-3 text-sm" type="date" value={transferForm.effective_date} onChange={(e) => setTransferForm((p) => ({ ...p, effective_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Причина перевода</label>
              <textarea className="glass-input w-full px-4 py-3 text-sm min-h-[80px] resize-none" placeholder="Например: Повышение в должности, Реорганизация отдела" value={transferForm.reason} onChange={(e) => setTransferForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setTransferModalOpen(false)} className="glass-button-secondary px-4 py-2 text-sm font-medium">Отмена</button>
              <button onClick={handleTransferSubmit} className="px-4 py-2 text-sm font-medium text-amber-400 bg-amber-500/20 border border-amber-500/30 rounded-xl hover:bg-amber-500/30 transition-all">Перевести</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
