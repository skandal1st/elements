import { useState, useEffect } from 'react'
import { Calendar, Bell, Users, Ticket, Server } from 'lucide-react'

interface Birthday {
  id: number
  name: string
  date: string
  days_left: number
  department?: string
}

interface Announcement {
  id: number
  title: string
  date: string
}

interface Stats {
  employees_count: number
  active_tickets: number
  equipment_in_use: number
}

interface DashboardData {
  birthdays: Birthday[]
  announcements: Announcement[]
  stats: Stats
  available_modules: string[]
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/v1/portal/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const dashboardData = await response.json()
        setData(dashboardData)
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-500">Ошибка загрузки данных</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Добро пожаловать в Elements Platform</h1>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Сотрудников</p>
              <p className="text-2xl font-bold">{data.stats.employees_count}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Активных заявок</p>
              <p className="text-2xl font-bold">{data.stats.active_tickets}</p>
            </div>
            <Ticket className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Оборудования в работе</p>
              <p className="text-2xl font-bold">{data.stats.equipment_in_use}</p>
            </div>
            <Server className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ближайшие дни рождения */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Ближайшие дни рождения
          </h2>
          {data.birthdays.length > 0 ? (
            <div className="space-y-3">
              {data.birthdays.slice(0, 5).map((birthday) => (
                <div key={birthday.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{birthday.name}</p>
                    {birthday.department && (
                      <p className="text-sm text-gray-600">{birthday.department}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{new Date(birthday.date).toLocaleDateString('ru-RU')}</p>
                    <p className="text-xs text-gray-500">через {birthday.days_left} дн.</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Ближайших дней рождения нет</p>
          )}
        </div>

        {/* Объявления */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Важные объявления
          </h2>
          {data.announcements.length > 0 ? (
            <div className="space-y-3">
              {data.announcements.map((announcement) => (
                <div key={announcement.id} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                  <p className="font-medium">{announcement.title}</p>
                  <p className="text-sm text-gray-600">{new Date(announcement.date).toLocaleDateString('ru-RU')}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Нет объявлений</p>
          )}
        </div>
      </div>

      {/* Доступные модули */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Доступные модули</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.available_modules?.includes('hr') && (
            <a
              href="/hr"
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <h3 className="font-semibold text-lg mb-2">HR</h3>
              <p className="text-sm text-gray-600">Управление кадрами</p>
            </a>
          )}
          {data.available_modules?.includes('it') && (
            <a
              href="/it"
              className="p-4 border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <h3 className="font-semibold text-lg mb-2">IT</h3>
              <p className="text-sm text-gray-600">Учет оборудования и заявки</p>
            </a>
          )}
          {data.available_modules?.includes('finance') && (
            <a
              href="/finance"
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
            >
              <h3 className="font-semibold text-lg mb-2">Финансы</h3>
              <p className="text-sm text-gray-600">Финансовый учет</p>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
