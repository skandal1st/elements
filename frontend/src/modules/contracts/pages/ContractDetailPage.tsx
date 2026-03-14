import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { contractsService, type ContractDetail } from '@/shared/services/contracts.service'

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

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Акты и платёжки</h3>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2 px-3">Тип</th>
                <th className="text-left py-2 px-3">Номер</th>
                <th className="text-left py-2 px-3">Дата</th>
                <th className="text-right py-2 px-3">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {contract.acts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">Нет актов</td>
                </tr>
              ) : (
                contract.acts.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-2 px-3">{DOCTYPE_LABEL[a.doctype] ?? a.doctype}</td>
                    <td className="py-2 px-3">{a.number ?? '—'}</td>
                    <td className="py-2 px-3">{formatDate(a.act_date)}</td>
                    <td className="py-2 px-3 text-right">{formatMoney(a.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
