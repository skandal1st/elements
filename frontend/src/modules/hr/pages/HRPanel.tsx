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
  const [fireEmployeeSearch, setFireEmployeeSearch] = useState('')
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

  const filteredEmployees = employees.filter((e) => {
    const q = fireEmployeeSearch.trim().toLowerCase()
    if (!q) return true
    return (
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q)
    )
  })

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
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">HR-панель</h2>
            <p className="text-gray-400">Создание заявок на прием или увольнение</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="glass-button px-4 py-2.5 text-sm font-medium"
          >
            Добавить сотрудника (прием)
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

      <div className="glass-card p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Увольнение сотрудника</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="glass-input px-4 py-2.5 text-sm"
            placeholder="Поиск сотрудника (ФИО / email)…"
            value={fireEmployeeSearch}
            onChange={(e) => setFireEmployeeSearch(e.target.value)}
          />
          <select
            className="glass-input px-4 py-2.5 text-sm"
            value={fireEmployeeId}
            onChange={(e) => setFireEmployeeId(e.target.value)}
          >
            <option value="" className="bg-dark-800">Выберите сотрудника</option>
            {filteredEmployees.map((e) => (
              <option key={e.id} value={e.id} className="bg-dark-800">{e.full_name}</option>
            ))}
          </select>
          <input
            className="glass-input px-4 py-2.5 text-sm"
            type="date"
            value={fireDate}
            onChange={(e) => setFireDate(e.target.value)}
          />
          <button
            onClick={handleFire}
            className="glass-button px-4 py-2.5 text-sm font-medium"
          >
            Создать заявку на увольнение
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <h3 className="px-6 py-4 text-lg font-semibold text-white border-b border-dark-600/50">
          Заявки
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-dark-600/50">
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Сотрудник</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                <th className="px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-dark-700/30 transition-colors">
                  <td className="px-4 py-4 text-gray-400">{r.id}</td>
                  <td className="px-4 py-4 text-white">{r.type === 'hire' ? 'Прием' : 'Увольнение'}</td>
                  <td className="px-4 py-4 text-gray-300">{empName(r.employee_id)}</td>
                  <td className="px-4 py-4 text-gray-400">{r.effective_date ?? r.request_date}</td>
                  <td className="px-4 py-4 text-gray-400">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Новый сотрудник (прием)</h3>
              <button onClick={() => setIsModalOpen(false)} className="glass-button-secondary px-3 py-2 text-sm font-medium">
                Закрыть
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">ФИО <span className="text-red-400">*</span></label>
                <input className="glass-input w-full px-4 py-3 text-sm" placeholder="Иванов Иван Иванович" value={newEmployee.full_name} onChange={(e) => setNewEmployee((p) => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Дата рождения</label>
                <input className="glass-input w-full px-4 py-3 text-sm" type="date" value={newEmployee.birthday} onChange={(e) => setNewEmployee((p) => ({ ...p, birthday: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Подразделение</label>
                <select className="glass-input w-full px-4 py-3 text-sm" value={newEmployee.department_id} onChange={(e) => handleDepartmentChange(e.target.value)}>
                  <option value="" className="bg-dark-800">Выберите подразделение</option>
                  {departments.map((d) => <option key={d.id} value={d.id} className="bg-dark-800">{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Должность</label>
                <select className="glass-input w-full px-4 py-3 text-sm" value={newEmployee.position_id} onChange={(e) => setNewEmployee((p) => ({ ...p, position_id: e.target.value }))}>
                  <option value="" className="bg-dark-800">Выберите должность</option>
                  {positions.filter((p) => !newEmployee.department_id || p.department_id === Number(newEmployee.department_id)).map((p) => <option key={p.id} value={p.id} className="bg-dark-800">{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Дата выхода на работу</label>
                <input className="glass-input w-full px-4 py-3 text-sm" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                <input className="glass-input w-full px-4 py-3 text-sm" type="email" placeholder="email@example.com" value={newEmployee.email} onChange={(e) => setNewEmployee((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Внутренний телефон</label>
                <input className="glass-input w-full px-4 py-3 text-sm" placeholder="123" value={newEmployee.internal_phone} onChange={(e) => setNewEmployee((p) => ({ ...p, internal_phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Номер пропуска</label>
                <input className="glass-input w-full px-4 py-3 text-sm" placeholder="00001" value={newEmployee.pass_number} onChange={(e) => setNewEmployee((p) => ({ ...p, pass_number: e.target.value }))} />
              </div>
              <div className="flex items-center md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30" checked={newEmployee.uses_it_equipment} onChange={(e) => setNewEmployee((p) => ({ ...p, uses_it_equipment: e.target.checked }))} />
                  <span className="text-sm text-gray-400">Нужно IT-оборудование</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setIsModalOpen(false)} className="glass-button-secondary px-4 py-2 text-sm font-medium">Отмена</button>
              <button onClick={handleCreateEmployeeAndHire} disabled={!newEmployee.full_name} className="glass-button px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">Создать сотрудника и заявку</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
