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
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Дни рождения</h2>
        <p className="text-sm text-gray-500">Календарь сотрудников по месяцам.</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Месяц:</label>
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTHS.map((label, i) => (
            <option key={label} value={i + 1}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="text-sm">
                <span className="font-medium text-gray-900">{item.full_name}</span>{' '}
                — {formatBirthday(item.birthday)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
