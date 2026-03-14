import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { contractsService, type Counterparty } from '@/shared/services/contracts.service'

export function CounterpartiesPage() {
  const [list, setList] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [fullName, setFullName] = useState('')
  const [inn, setInn] = useState('')
  const [kpp, setKpp] = useState('')
  const [address, setAddress] = useState('')
  const [checkingInn, setCheckingInn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [innError, setInnError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    contractsService
      .listCounterparties()
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleCheckInn = async () => {
    const digits = inn.replace(/\D/g, '')
    if (digits.length !== 10 && digits.length !== 12) {
      setInnError('ИНН должен содержать 10 или 12 цифр')
      return
    }
    setInnError(null)
    setCheckingInn(true)
    try {
      const data = await contractsService.checkInn(digits)
      setName(data.name || '')
      setFullName(data.full_name || '')
      setInn(data.inn || digits)
      setKpp(data.kpp || '')
      setAddress(data.address || '')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка проверки по ИНН'
      setInnError(msg)
    } finally {
      setCheckingInn(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('Укажите название контрагента')
      return
    }
    setSaving(true)
    try {
      await contractsService.createCounterparty({
        name: name.trim(),
        full_name: fullName.trim() || undefined,
        inn: inn.trim() || undefined,
        kpp: kpp.trim() || undefined,
        address: address.trim() || undefined,
        is_active: true,
      })
      setName('')
      setFullName('')
      setInn('')
      setKpp('')
      setAddress('')
      setInnError(null)
      setModalOpen(false)
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка создания контрагента')
    } finally {
      setSaving(false)
    }
  }

  const openModal = () => {
    setName('')
    setFullName('')
    setInn('')
    setKpp('')
    setAddress('')
    setInnError(null)
    setModalOpen(true)
  }

  if (loading) return <div className="text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Контрагенты</h2>
        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Добавить контрагента
        </button>
      </div>

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
              <tr>
                <td colSpan={3} className="py-8 text-center text-gray-400">
                  Нет контрагентов. Нажмите «Добавить контрагента».
                </td>
              </tr>
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

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Новый контрагент</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ИНН</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inn}
                    onChange={(e) => {
                      setInn(e.target.value.replace(/\D/g, '').slice(0, 12))
                      setInnError(null)
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    placeholder="10 или 12 цифр"
                    maxLength={12}
                  />
                  <button
                    type="button"
                    onClick={handleCheckInn}
                    disabled={checkingInn || inn.replace(/\D/g, '').length < 10}
                    className="px-4 py-2 border border-brand-green text-brand-green rounded-xl text-sm font-medium hover:bg-brand-green/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkingInn ? 'Проверка...' : 'Проверить по ИНН'}
                  </button>
                </div>
                {innError && <p className="text-sm text-red-600 mt-1">{innError}</p>}
                <p className="text-xs text-gray-500 mt-1">Данные из реестра ФНС (api-fns.ru)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Краткое наименование *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Полное наименование</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">КПП</label>
                <input
                  type="text"
                  value={kpp}
                  onChange={(e) => setKpp(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
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
