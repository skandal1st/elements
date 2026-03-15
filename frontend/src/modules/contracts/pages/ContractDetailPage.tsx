import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { contractsService, type ContractDetail, type Funding, type Subunit } from '@/shared/services/contracts.service'
import { apiGet } from '@/shared/api/client'

type HrDepartment = { id: number; name: string }

function formatDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(s: string) {
  const n = parseFloat(s)
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const DOCTYPE_LABEL: Record<number, string> = { 0: 'Акт', 1: 'П/П', 2: 'Корр.' }

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actModal, setActModal] = useState<'act' | 'payment' | null>(null)
  const [fundingModal, setFundingModal] = useState(false)
  const [customSubunitModal, setCustomSubunitModal] = useState(false)
  const [fundingList, setFundingList] = useState<Funding[]>([])
  const [hrDepartments, setHrDepartments] = useState<HrDepartment[]>([])
  const [subunits, setSubunits] = useState<Subunit[]>([])
  const [actForm, setActForm] = useState({ number: '', act_date: '', notice: '', amount: '' })
  const [newFundingName, setNewFundingName] = useState('')
  const [customSubunitName, setCustomSubunitName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!id) return
    try {
      const data = await contractsService.getContract(id)
      setContract(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    contractsService.listFunding().then(setFundingList).catch(console.error)
  }, [id])

  useEffect(() => {
    apiGet<HrDepartment[]>('/hr/departments/?only_with_employees=true').then(setHrDepartments).catch(() => setHrDepartments([]))
    contractsService.listSubunits().then(setSubunits).catch(() => setSubunits([]))
  }, [])

  const openActModal = (kind: 'act' | 'payment') => {
    setActForm({ number: '', act_date: new Date().toISOString().slice(0, 10), notice: '', amount: '' })
    setActModal(kind)
  }

  const submitAct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    const doctype = actModal === 'payment' ? 1 : 0
    const amount = actForm.amount.trim() ? String(actForm.amount) : '0'
    setSaving(true)
    try {
      await contractsService.createAct(id, {
        doctype,
        number: actForm.number.trim() || undefined,
        act_date: actForm.act_date || undefined,
        notice: actForm.notice.trim() || undefined,
        amount,
      })
      setActModal(null)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const submitNewFunding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFundingName.trim() || !id) return
    setSaving(true)
    try {
      const f = await contractsService.createFunding({ name: newFundingName.trim(), is_active: true })
      await contractsService.updateContract(id, { funding_id: f.id })
      setFundingList((prev) => [...prev, f])
      setNewFundingName('')
      setFundingModal(false)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleFundingChange = async (fundingId: string) => {
    if (!id) return
    try {
      await contractsService.updateContract(id, { funding_id: fundingId || undefined })
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  /** По имени подразделения из оргструктуры найти или создать Subunit и установить в договор */
  const handleSubunitSelect = async (hrDepartmentName: string) => {
    if (!id) return
    const trimmed = hrDepartmentName.trim()
    if (!trimmed) return
    let subunitId: string | null = subunits.find((s) => s.name === trimmed)?.id ?? null
    if (!subunitId) {
      try {
        const created = await contractsService.createSubunit({ name: trimmed, is_active: true })
        subunitId = created.id
        setSubunits((prev) => [...prev, created])
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Ошибка создания подразделения')
        return
      }
    }
    try {
      await contractsService.updateContract(id, { subunit_id: subunitId })
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  const handleSubunitChange = async (subunitId: string) => {
    if (!id) return
    try {
      await contractsService.updateContract(id, { subunit_id: subunitId || undefined })
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  const submitCustomSubunit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customSubunitName.trim() || !id) return
    setSaving(true)
    try {
      const s = await contractsService.createSubunit({ name: customSubunitName.trim(), is_active: true })
      await contractsService.updateContract(id, { subunit_id: s.id })
      setCustomSubunitName('')
      setCustomSubunitModal(false)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const deleteAct = async (actId: string) => {
    if (!id || !confirm('Удалить запись?')) return
    try {
      await contractsService.deleteAct(id, actId)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  if (loading) return <div className="text-gray-400">Загрузка...</div>
  if (!contract) return <div className="text-gray-400">Договор не найден</div>

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/contracts')}
          className="p-2 text-gray-400 hover:text-gray-900 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{contract.number} — {contract.name}</h2>
          <div className="text-sm text-gray-500 mt-1">
            {contract.contract_type_name ?? '—'} · {contract.counterparty_name ?? '—'} · {formatDate(contract.date_begin)}
          </div>
          {contract.full_name && <p className="text-sm text-gray-600 mt-2">{contract.full_name}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500">Сумма</div>
          <div className="font-semibold">{formatMoney(contract.sum_amount)}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500">Выполнено (акты)</div>
          <div className="font-semibold">{formatMoney(contract.sum_acts)}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500">Оплачено (П/П)</div>
          <div className="font-semibold">{formatMoney(contract.sum_pp)}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-gray-500">Остаток</div>
          <div className="font-semibold">{formatMoney(contract.rest_acts)}</div>
        </div>
      </div>

      {/* Источники финансирования */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Источник финансирования</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={contract.funding_id ?? ''}
            onChange={(e) => handleFundingChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm min-w-[200px]"
          >
            <option value="">— Не выбран —</option>
            {fundingList.length === 0 && contract.funding_id && contract.funding_name && (
              <option value={contract.funding_id}>{contract.funding_name}</option>
            )}
            {fundingList.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFundingModal(true)}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" /> Добавить источник
          </button>
        </div>
      </div>

      {/* Подразделение: из справочника оргструктуры (только непустые) или своё */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Подразделение</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={contract.subunit_id ?? ''}
            onChange={(e) => {
              const v = e.target.value
              if (v === '__custom__') {
                setCustomSubunitModal(true)
                return
              }
              if (v.startsWith('hr:')) {
                const name = v.slice(3)
                handleSubunitSelect(name)
                return
              }
              handleSubunitChange(v)
            }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm min-w-[200px]"
          >
            <option value="">— Не выбрано —</option>
            {hrDepartments.map((d) => (
              <option key={d.id} value={`hr:${d.name}`}>{d.name}</option>
            ))}
            {subunits.filter((s) => !hrDepartments.some((d) => d.name === s.name)).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            {contract.subunit_id && contract.subunit_name && !subunits.some((s) => s.id === contract.subunit_id) && (
              <option value={contract.subunit_id}>{contract.subunit_name}</option>
            )}
            <option value="__custom__">— Добавить своё подразделение —</option>
          </select>
        </div>
      </div>

      {/* Акты и платёжки */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-2">
          <h3 className="text-sm font-medium text-gray-700">Акты и платёжки</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openActModal('act')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-brand-green rounded-lg hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Добавить акт
            </button>
            <button
              type="button"
              onClick={() => openActModal('payment')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" /> Добавить платёж
            </button>
          </div>
        </div>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2 px-3">Тип</th>
                <th className="text-left py-2 px-3">Номер</th>
                <th className="text-left py-2 px-3">Дата</th>
                <th className="text-right py-2 px-3">Сумма</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {contract.acts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-400">Нет актов и платёжек</td>
                </tr>
              ) : (
                contract.acts.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-2 px-3">{DOCTYPE_LABEL[a.doctype] ?? a.doctype}</td>
                    <td className="py-2 px-3">{a.number ?? '—'}</td>
                    <td className="py-2 px-3">{formatDate(a.act_date)}</td>
                    <td className="py-2 px-3 text-right">{formatMoney(a.amount)}</td>
                    <td className="py-2 px-3">
                      <button type="button" onClick={() => deleteAct(a.id)} className="p-1 text-gray-400 hover:text-red-600" title="Удалить">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модалка: новый акт / платёж */}
      {actModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setActModal(null)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {actModal === 'payment' ? 'Добавить платёж' : 'Добавить акт'}
            </h3>
            <form onSubmit={submitAct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Номер</label>
                <input
                  type="text"
                  value={actForm.number}
                  onChange={(e) => setActForm((p) => ({ ...p, number: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                <input
                  type="date"
                  value={actForm.act_date}
                  onChange={(e) => setActForm((p) => ({ ...p, act_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={actForm.amount}
                  onChange={(e) => setActForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примечание</label>
                <input
                  type="text"
                  value={actForm.notice}
                  onChange={(e) => setActForm((p) => ({ ...p, notice: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setActModal(null)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: новый источник финансирования */}
      {fundingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setFundingModal(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Добавить источник финансирования</h3>
            <form onSubmit={submitNewFunding} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Наименование</label>
                <input
                  type="text"
                  value={newFundingName}
                  onChange={(e) => setNewFundingName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  placeholder="Например: Бюджет 2025"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving || !newFundingName.trim()} className="px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Сохранение...' : 'Добавить'}
                </button>
                <button type="button" onClick={() => setFundingModal(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: своё подразделение */}
      {customSubunitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCustomSubunitModal(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Добавить своё подразделение</h3>
            <form onSubmit={submitCustomSubunit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Наименование</label>
                <input
                  type="text"
                  value={customSubunitName}
                  onChange={(e) => setCustomSubunitName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  placeholder="Введите название подразделения"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving || !customSubunitName.trim()} className="px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Сохранение...' : 'Добавить'}
                </button>
                <button type="button" onClick={() => setCustomSubunitModal(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
