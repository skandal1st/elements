import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Building2, Briefcase } from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../../shared/api/client'

type OrgEmployee = { id: number; full_name: string }
type OrgPosition = { id?: number; name: string; employees: OrgEmployee[] }
type OrgDepartment = {
  id: number
  name: string
  parent_department_id?: number
  positions: OrgPosition[]
}
type Department = { id: number; name: string; parent_department_id?: number; description?: string }
type Position = { id: number; name: string; department_id?: number; description?: string }

export function OrgChart() {
  const [items, setItems] = useState<OrgDepartment[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  // Модальное окно подразделения
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState({
    name: '',
    parent_department_id: '',
    description: '',
  })

  // Модальное окно должности
  const [positionModalOpen, setPositionModalOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [positionForm, setPositionForm] = useState({
    name: '',
    department_id: '',
    description: '',
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [orgData, deptData, posData] = await Promise.all([
        apiGet<OrgDepartment[]>('/hr/org/'),
        apiGet<Department[]>('/hr/departments/'),
        apiGet<Position[]>('/hr/positions/'),
      ])
      setItems(orgData)
      setDepartments(deptData)
      setPositions(posData)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const parentName = (id?: number) =>
    id ? departments.find((d) => d.id === id)?.name : null

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', parent_department_id: '', description: '' })
    setError(null)
    setMessage(null)
    setModalOpen(true)
  }

  const openEdit = (dept: Department) => {
    setEditing(dept)
    setForm({
      name: dept.name,
      parent_department_id: dept.parent_department_id ? String(dept.parent_department_id) : '',
      description: dept.description || '',
    })
    setError(null)
    setMessage(null)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Название подразделения обязательно')
      return
    }

    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        parent_department_id: form.parent_department_id ? Number(form.parent_department_id) : null,
        description: form.description.trim() || null,
      }

      if (editing) {
        await apiPatch(`/hr/departments/${editing.id}`, payload)
        setMessage('Подразделение обновлено')
      } else {
        await apiPost('/hr/departments/', payload)
        setMessage('Подразделение создано')
      }

      setModalOpen(false)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleDelete = async (dept: Department) => {
    if (!window.confirm(`Удалить подразделение "${dept.name}"? Все связанные данные будут потеряны.`)) {
      return
    }

    setError(null)
    try {
      await apiDelete(`/hr/departments/${dept.id}`)
      setMessage('Подразделение удалено')
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Находим подразделение по ID из списка departments
  const findDepartment = (id: number) => departments.find((d) => d.id === id)

  // Открыть создание должности
  const openCreatePosition = (departmentId: number) => {
    setEditingPosition(null)
    setPositionForm({ name: '', department_id: String(departmentId), description: '' })
    setError(null)
    setMessage(null)
    setPositionModalOpen(true)
  }

  // Открыть редактирование должности
  const openEditPosition = (pos: Position) => {
    setEditingPosition(pos)
    setPositionForm({
      name: pos.name,
      department_id: pos.department_id ? String(pos.department_id) : '',
      description: pos.description || '',
    })
    setError(null)
    setMessage(null)
    setPositionModalOpen(true)
  }

  // Сохранить должность
  const handlePositionSubmit = async () => {
    if (!positionForm.name.trim()) {
      setError('Название должности обязательно')
      return
    }

    setError(null)
    try {
      const payload = {
        name: positionForm.name.trim(),
        department_id: positionForm.department_id ? Number(positionForm.department_id) : null,
        description: positionForm.description.trim() || null,
      }

      if (editingPosition) {
        await apiPatch(`/hr/positions/${editingPosition.id}`, payload)
        setMessage('Должность обновлена')
      } else {
        await apiPost('/hr/positions/', payload)
        setMessage('Должность создана')
      }

      setPositionModalOpen(false)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Удалить должность
  const handleDeletePosition = async (pos: Position) => {
    if (!window.confirm(`Удалить должность "${pos.name}"? Сотрудники будут откреплены от этой должности.`)) {
      return
    }

    setError(null)
    try {
      await apiDelete(`/hr/positions/${pos.id}`)
      setMessage('Должность удалена')
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Оргструктура</h2>
          <p className="text-sm text-gray-500">Дерево отделов, должностей и сотрудников.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Добавить подразделение
        </button>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Загрузка…</p>}

      {!loading && items.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Подразделения не найдены</p>
          <button
            onClick={openCreate}
            className="mt-4 text-blue-600 hover:underline text-sm"
          >
            Создать первое подразделение
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((dept) => {
            const deptData = findDepartment(dept.id)
            return (
              <div
                key={dept.id}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {dept.name}
                      {dept.parent_department_id && (
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          (подчинен: {parentName(dept.parent_department_id) ?? '—'})
                        </span>
                      )}
                    </h3>
                    {deptData?.description && (
                      <p className="text-sm text-gray-500 mt-1">{deptData.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deptData && openEdit(deptData)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Редактировать"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deptData && handleDelete(deptData)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  {/* Отображаем должности из списка positions, отфильтрованные по подразделению */}
                  {positions
                    .filter((pos) => pos.department_id === dept.id)
                    .map((pos) => {
                      // Находим данные о сотрудниках из orgData
                      const orgPos = dept.positions.find((p) => p.id === pos.id)
                      const employees = orgPos?.employees || []
                      return (
                        <div
                          key={pos.id}
                          className="pl-4 border-l-2 border-gray-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-800">
                                {pos.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditPosition(pos)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Редактировать должность"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeletePosition(pos)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Удалить должность"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {pos.description && (
                            <p className="text-xs text-gray-500 mt-1 ml-6">{pos.description}</p>
                          )}
                          <ul className="mt-2 ml-6 space-y-1">
                            {employees.map((emp) => (
                              <li
                                key={emp.id}
                                className="text-sm text-gray-600"
                              >
                                {emp.full_name}
                              </li>
                            ))}
                            {employees.length === 0 && (
                              <li className="text-xs text-gray-400 italic">Нет сотрудников</li>
                            )}
                          </ul>
                        </div>
                      )
                    })}
                  {positions.filter((pos) => pos.department_id === dept.id).length === 0 && (
                    <p className="text-sm text-gray-400 italic">Нет должностей</p>
                  )}
                  <button
                    onClick={() => openCreatePosition(dept.id)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить должность
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editing ? 'Редактирование подразделения' : 'Новое подразделение'}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Например: Отдел разработки"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Родительское подразделение
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={form.parent_department_id}
                onChange={(e) => setForm((p) => ({ ...p, parent_department_id: e.target.value }))}
              >
                <option value="">Нет (верхний уровень)</option>
                {departments
                  .filter((d) => d.id !== editing?.id) // Нельзя выбрать самого себя
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
                placeholder="Краткое описание подразделения"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

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
                {editing ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания/редактирования должности */}
      {positionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingPosition ? 'Редактирование должности' : 'Новая должность'}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Например: Ведущий разработчик"
                value={positionForm.name}
                onChange={(e) => setPositionForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Подразделение
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={positionForm.department_id}
                onChange={(e) => setPositionForm((p) => ({ ...p, department_id: e.target.value }))}
              >
                <option value="">Не указано</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
                placeholder="Краткое описание должности и обязанностей"
                value={positionForm.description}
                onChange={(e) => setPositionForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPositionModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handlePositionSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {editingPosition ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
