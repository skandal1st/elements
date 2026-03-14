import { useState, useEffect } from 'react'
import { contractsService, type ContractType } from '@/shared/services/contracts.service'

export function ContractTypesPage() {
  const [list, setList] = useState<ContractType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    contractsService.listContractTypes().then(setList).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Типы договоров</h2>
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">Название</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Активен</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={2} className="py-8 text-center text-gray-400">Нет типов</td></tr>
            ) : (
              list.map((t) => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="py-3 px-4">{t.name}</td>
                  <td className="py-3 px-4">{t.is_active ? 'Да' : 'Нет'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
