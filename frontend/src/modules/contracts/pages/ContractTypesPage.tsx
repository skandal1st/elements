import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { contractsService, type ContractType } from '@/shared/services/contracts.service'

export function ContractTypesPage() {
  const [list, setList] = useState<ContractType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newActive, setNewActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    contractsService
      .listContractTypes()
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      alert('Введите название типа договора')
      return
    }
    setSaving(true)
    try {
      await contractsService.createContractType({ name, is_active: newActive })
      setNewName('')
      setNewActive(true)
      setModalOpen(false)
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка создания типа')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Типы договоров</h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Добавить тип
        </button>
      </div>

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
              <tr>
                <td colSpan={2} className="py-8 text-center text-gray-400">
                  Нет типов. Нажмите «Добавить тип».
                </td>
              </tr>
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

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Новый тип договора</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  placeholder="Например: Поставка"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="type-active"
                  checked={newActive}
                  onChange={(e) => setNewActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="type-active" className="text-sm text-gray-700">
                  Активен
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Создание...' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={() => !saving && setModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
                >
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
