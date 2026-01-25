import { useEffect, useState } from 'react'
import { apiGet } from '../../../shared/api/client'

type BirthdayEntry = {
  id: number
  full_name: string
  department_id?: number
  birthday?: string
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function formatBirthday(value?: string) {
  if (!value) return 'нет даты'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const now = new Date()
  let age = now.getFullYear() - year
  const hasPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate())
  if (!hasPassed) age -= 1
  return `${day}.${month}.${year} (${age} лет)`
}

export function Birthdays() {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [items, setItems] = useState<BirthdayEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<BirthdayEntry[]>(`/hr/birthdays/?month=${month}`)
      setItems(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [month])

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <h2 className="text-2xl font-bold text-white mb-1">Дни рождения</h2>
        <p className="text-gray-400">Календарь сотрудников по месяцам</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-400">Месяц:</label>
        <select
          className="glass-input px-4 py-2.5 text-sm"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((label, i) => (
            <option key={label} value={i + 1} className="bg-dark-800">
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card p-6">
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="text-sm flex items-baseline gap-2">
                <span className="font-medium text-white">{item.full_name}</span>
                <span className="text-gray-400">— {formatBirthday(item.birthday)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
