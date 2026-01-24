import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../../shared/api/client'

type HRRequest = {
  id: number
  type: string
  employee_id: number
  request_date: string
  effective_date?: string
  status: string
  needs_it_equipment: boolean
  pass_number?: string
}
type Department = { id: number; name: string; manager_id?: number | null }
type Position = { id: number; name: string; department_id?: number }
type Employee = { id: number; full_name: string; email?: string; department_id?: number; manager_id?: number }

export function HRPanel() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [requests, setRequests] = useState<HRRequest[]>([])
  const [hireDate, setHireDate] = useState('')
  const [fireEmployeeId, setFireEmployeeId] = useState('')
  const [fireDate, setFireDate] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    full_name: '',
    department_id: '',
    position_id: '',
    internal_phone: '',
    external_phone: '',
    email: '',
    birthday: '',
    uses_it_equipment: false,
    pass_number: '',
  })

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [deptData, empData, posData, reqData] = await Promise.all([
        apiGet<Department[]>('/hr/departments/'),
        apiGet<Employee[]>('/hr/employees/'),
        apiGet<Position[]>('/hr/positions/'),
        apiGet<HRRequest[]>('/hr/hr-requests/'),
      ])
      setDepartments(deptData)
      setEmployees(empData)
      setPositions(posData)
      setRequests(reqData)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDepartmentChange = (departmentId: string) => {
    const dept = departments.find((d) => d.id === Number(departmentId))
    setNewEmployee((prev) => ({
      ...prev,
      department_id: departmentId,
      manager_id: dept?.manager_id ? String(dept.manager_id) : '',
    }))
  }

  const handleCreateEmployeeAndHire = async () => {
    setError(null)
    try {
      const payload = {
        full_name: newEmployee.full_name,
        department_id: newEmployee.department_id ? Number(newEmployee.department_id) : undefined,
        position_id: newEmployee.position_id ? Number(newEmployee.position_id) : undefined,
        internal_phone: newEmployee.internal_phone || undefined,
        external_phone: newEmployee.external_phone || undefined,
        email: newEmployee.email || undefined,
        birthday: newEmployee.birthday || undefined,
        uses_it_equipment: newEmployee.uses_it_equipment,
        pass_number: newEmployee.pass_number || undefined,
      }
      const employee = await apiPost<Employee>('/hr/employees/', payload)
      await apiPost<HRRequest>('/hr/hr-requests/', {
        type: 'hire',
        employee_id: employee.id,
        request_date: new Date().toISOString().slice(0, 10),
        effective_date: hireDate || undefined,
        needs_it_equipment: newEmployee.uses_it_equipment,
        pass_number: newEmployee.pass_number || undefined,
      })
      setMessage(`Заявка на прием #${employee.id} создана`)
      setIsModalOpen(false)
      setNewEmployee({
        full_name: '',
        department_id: '',
        position_id: '',
        internal_phone: '',
        external_phone: '',
        email: '',
        birthday: '',
        uses_it_equipment: false,
        pass_number: '',
      })
      setHireDate('')
      await loadData()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleFire = async () => {
    if (!fireEmployeeId) {
      setError('Выберите сотрудника')
      return
    }
    setError(null)
    try {
      await apiPost<HRRequest>('/hr/hr-requests/', {
        type: 'fire',
        employee_id: Number(fireEmployeeId),
        request_date: new Date().toISOString().slice(0, 10),
        effective_date: fireDate || undefined,
        needs_it_equipment: false,
      })
      setMessage('Заявка на увольнение создана')
      setFireEmployeeId('')
      setFireDate('')
      await loadData()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const empName = (id: number) => employees.find((e) => e.id === id)?.full_name ?? '—'

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">HR-панель</h2>
        <p className="text-sm text-gray-500">Создание заявок на прием или увольнение.</p>
      </div>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-between items-center">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          Добавить сотрудника (прием)
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Увольнение сотрудника</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            value={fireEmployeeId}
            onChange={(e) => setFireEmployeeId(e.target.value)}
          >
            <option value="">Выберите сотрудника</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
          <input
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
            type="date"
            value={fireDate}
            onChange={(e) => setFireDate(e.target.value)}
          />
          <button
            onClick={handleFire}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Создать заявку на увольнение
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <h3 className="px-4 py-3 text-lg font-semibold text-gray-900 bg-gray-50 border-b">
          Заявки
        </h3>
        {loading && <p className="p-4 text-sm text-gray-500">Загрузка…</p>}
        {!loading && (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">ID</th>
                <th className="px-4 py-3 font-medium text-gray-700">Тип</th>
                <th className="px-4 py-3 font-medium text-gray-700">Сотрудник</th>
                <th className="px-4 py-3 font-medium text-gray-700">Дата</th>
                <th className="px-4 py-3 font-medium text-gray-700">Статус</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{r.id}</td>
                  <td className="px-4 py-3">{r.type === 'hire' ? 'Прием' : 'Увольнение'}</td>
                  <td className="px-4 py-3">{empName(r.employee_id)}</td>
                  <td className="px-4 py-3">{r.effective_date ?? r.request_date}</td>
                  <td className="px-4 py-3">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Новый сотрудник (прием)</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-sm text-gray-500">
                Закрыть
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ФИО <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Иванов Иван Иванович"
                  value={newEmployee.full_name}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата рождения
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  type="date"
                  value={newEmployee.birthday}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, birthday: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Подразделение
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={newEmployee.department_id}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                >
                  <option value="">Выберите подразделение</option>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={newEmployee.position_id}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, position_id: e.target.value }))}
                >
                  <option value="">Выберите должность</option>
                  {positions
                    .filter((p) => !newEmployee.department_id || p.department_id === Number(newEmployee.department_id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата выхода на работу
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  type="email"
                  placeholder="email@example.com"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Внутренний телефон
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="123"
                  value={newEmployee.internal_phone}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, internal_phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Номер пропуска
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="00001"
                  value={newEmployee.pass_number}
                  onChange={(e) => setNewEmployee((p) => ({ ...p, pass_number: e.target.value }))}
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={newEmployee.uses_it_equipment}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, uses_it_equipment: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-700">Нужно IT-оборудование</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateEmployeeAndHire}
                disabled={!newEmployee.full_name}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                Создать сотрудника и заявку
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
