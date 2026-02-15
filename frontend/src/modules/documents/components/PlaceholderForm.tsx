import { useState } from 'react'
import { Placeholder } from '@/shared/services/documents.service'

interface Props {
  placeholders: Placeholder[]
  onSubmit: (values: Record<string, string>) => void
  loading?: boolean
}

export function PlaceholderForm({ placeholders, onSubmit, loading }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const p of placeholders) {
      initial[p.key] = p.default_value || ''
    }
    return initial
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Validate required
    for (const p of placeholders) {
      if (p.required && !values[p.key]?.trim()) {
        alert(`Поле "${p.label}" обязательно`)
        return
      }
    }
    // Форматируем даты из YYYY-MM-DD в DD.MM.YYYY
    const formatted: Record<string, string> = { ...values }
    for (const p of placeholders) {
      if (p.type === 'date' && formatted[p.key]) {
        const parts = formatted[p.key].split('-')
        if (parts.length === 3) {
          formatted[p.key] = `${parts[2]}.${parts[1]}.${parts[0]}`
        }
      }
    }
    onSubmit(formatted)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {placeholders.map((p) => (
        <div key={p.key}>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {p.label}
            {p.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {p.type === 'select' && p.options.length > 0 ? (
            <select
              value={values[p.key] || ''}
              onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
              className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none focus:border-accent-purple/50"
            >
              <option value="">Выберите...</option>
              {p.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : p.type === 'date' ? (
            <input
              type="date"
              value={values[p.key] || ''}
              onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
              className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none focus:border-accent-purple/50"
            />
          ) : p.type === 'number' ? (
            <input
              type="number"
              value={values[p.key] || ''}
              onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
              className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none focus:border-accent-purple/50"
            />
          ) : (
            <input
              type="text"
              value={values[p.key] || ''}
              onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
              className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50"
              placeholder={p.label}
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2.5 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 transition-colors text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Генерация...' : 'Создать документ'}
      </button>
    </form>
  )
}
