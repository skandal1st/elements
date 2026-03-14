import { useState, useEffect } from 'react'
import { contractsService, type Counterparty } from '@/shared/services/contracts.service'

export function CounterpartiesPage() {
  const [list, setList] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    contractsService.listCounterparties().then(setList).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Контрагенты</h2>
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">Название</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Полное наименование</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">ИНН</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={3} className="py-8 text-center text-gray-400">Нет контрагентов</td></tr>
            ) : (
              list.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-3 px-4">{c.name}</td>
                  <td className="py-3 px-4">{c.full_name ?? '—'}</td>
                  <td className="py-3 px-4">{c.inn ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
