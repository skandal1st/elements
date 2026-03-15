import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  contractsService,
  type Counterparty,
  type ContractType,
  type Funding,
  type Subunit,
} from '@/shared/services/contracts.service'
import { apiGet } from '@/shared/api/client'

type HrDepartment = { id: number; name: string }

export function ContractCreatePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [fundingList, setFundingList] = useState<Funding[]>([])
  const [subunits, setSubunits] = useState<Subunit[]>([])
  const [hrDepartments, setHrDepartments] = useState<HrDepartment[]>([])
  const [customSubunitModal, setCustomSubunitModal] = useState(false)
  const [customSubunitName, setCustomSubunitName] = useState('')

  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [dateBegin, setDateBegin] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [counterpartyId, setCounterpartyId] = useState('')
  const [contractTypeId, setContractTypeId] = useState('')
  const [sumAmount, setSumAmount] = useState('')
  const [fundingId, setFundingId] = useState('')
  const [subunitId, setSubunitId] = useState('')
  const [notice, setNotice] = useState('')
  const [term, setTerm] = useState('')

  useEffect(() => {
    Promise.all([
      contractsService.listCounterparties(),
      contractsService.listContractTypes(),
      contractsService.listFunding(),
      contractsService.listSubunits(),
      apiGet<HrDepartment[]>('/hr/departments/?only_with_employees=true'),
    ])
      .then(([c, t, f, s, hr]) => {
        setCounterparties(c)
        setContractTypes(t)
        setFundingList(f)
        setSubunits(s)
        setHrDepartments(hr || [])
      })
      .catch(console.error)
  }, [])

  const handleSubunitSelectFromHr = async (hrDepartmentName: string) => {
    const trimmed = hrDepartmentName.trim()
    if (!trimmed) return
    let id = subunits.find((s) => s.name === trimmed)?.id
    if (!id) {
      try {
        const created = await contractsService.createSubunit({ name: trimmed, is_active: true })
        id = created.id
        setSubunits((prev) => [...prev, created])
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Ошибка создания подразделения')
        return
      }
    }
    setSubunitId(id)
  }

  const handleAddCustomSubunit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customSubunitName.trim()) return
    try {
      const created = await contractsService.createSubunit({ name: customSubunitName.trim(), is_active: true })
      setSubunits((prev) => [...prev, created])
      setSubunitId(created.id)
      setCustomSubunitName('')
      setCustomSubunitModal(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!number.trim() || !name.trim()) {
      alert('Укажите номер и наименование договора')
      return
    }
    setLoading(true)
    try {
      const contract = await contractsService.createContract({
        number: number.trim(),
        name: name.trim(),
        date_begin: dateBegin || undefined,
        date_end: dateEnd || undefined,
        counterparty_id: counterpartyId || undefined,
        contract_type_id: contractTypeId || undefined,
        sum_amount: sumAmount.trim() || '0',
        funding_id: fundingId || undefined,
        subunit_id: subunitId || undefined,
        notice: notice.trim() || undefined,
        term: term || undefined,
      })
      navigate(`/contracts/${contract.id}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка создания договора')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/contracts')}
          className="p-2 text-gray-400 hover:text-gray-900 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-gray-900">Новый договор</h2>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Номер договора *</label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Наименование *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
            <input
              type="date"
              value={dateBegin}
              onChange={(e) => setDateBegin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Контрагент</label>
            <select
              value={counterpartyId}
              onChange={(e) => setCounterpartyId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            >
              <option value="">— Выберите —</option>
              {counterparties.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип договора</label>
            <select
              value={contractTypeId}
              onChange={(e) => setContractTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            >
              <option value="">— Выберите —</option>
              {contractTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Сумма</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={sumAmount}
              onChange={(e) => setSumAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Срок завершения</label>
            <input
              type="date"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Источник финансирования</label>
            <select
              value={fundingId}
              onChange={(e) => setFundingId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            >
              <option value="">— Выберите —</option>
              {fundingList.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Подразделение</label>
            <select
              value={subunitId}
              onChange={(e) => {
                const v = e.target.value
                if (v === '__custom__') {
                  setCustomSubunitModal(true)
                  return
                }
                if (v.startsWith('hr:')) {
                  handleSubunitSelectFromHr(v.slice(3))
                  return
                }
                setSubunitId(v)
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            >
              <option value="">— Выберите —</option>
              {hrDepartments.map((d) => (
                <option key={d.id} value={`hr:${d.name}`}>{d.name}</option>
              ))}
              {subunits.filter((s) => !hrDepartments.some((d) => d.name === s.name)).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="__custom__">— Добавить своё подразделение —</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Примечание</label>
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать договор'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/contracts')}
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      </form>

      {customSubunitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCustomSubunitModal(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Добавить своё подразделение</h3>
            <form onSubmit={handleAddCustomSubunit} className="space-y-4">
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
                <button type="submit" disabled={!customSubunitName.trim()} className="px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  Добавить
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
