import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FileText } from 'lucide-react'
import { contractsService, type ContractListItem } from '@/shared/services/contracts.service'

function formatDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(s: string) {
  const n = parseFloat(s)
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function ContractsListPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<ContractListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [numberFilter, setNumberFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await contractsService.listContracts(
        numberFilter ? { number: numberFilter } : undefined
      )
      setList(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [numberFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Договора</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Номер договора..."
              value={numberFilter}
              onChange={(e) => setNumberFilter(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-48"
            />
          </div>
          <button
            onClick={() => navigate('/contracts/new')}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 py-8">Загрузка...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Номер</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Дата</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Наименование</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Контрагент</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Тип</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Сумма</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Выполнено</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Остаток</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Заверш.</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">
                      Нет договоров
                    </td>
                  </tr>
                ) : (
                  list.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => navigate(`/contracts/${c.id}`)}
                    >
                      <td className="py-3 px-4">{c.number}</td>
                      <td className="py-3 px-4">{formatDate(c.date_begin)}</td>
                      <td className="py-3 px-4 max-w-[200px] truncate" title={c.name}>{c.name}</td>
                      <td className="py-3 px-4">{c.counterparty_name ?? '—'}</td>
                      <td className="py-3 px-4">{c.contract_type_name ?? '—'}</td>
                      <td className="py-3 px-4 text-right">{formatMoney(c.sum_amount)}</td>
                      <td className="py-3 px-4 text-right">{formatMoney(c.sum_acts)}</td>
                      <td className="py-3 px-4 text-right">{formatMoney(c.rest_acts)}</td>
                      <td className="py-3 px-4">{c.done ? 'Да' : 'Нет'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
