import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const ALL_LINKS = [
  { to: '/hr/phonebook', label: 'Телефонная книга', roles: ['employee', 'secretary', 'hr', 'admin'] },
  { to: '/hr/birthdays', label: 'Дни рождения', roles: ['employee', 'secretary', 'hr', 'admin'] },
  { to: '/hr/org', label: 'Оргструктура', roles: ['hr', 'admin'] },
  { to: '/hr/requests', label: 'HR-заявки', roles: ['hr', 'admin'] },
  { to: '/hr/zup-sync', label: 'Синхронизация ЗУП', roles: ['admin'] },
]

export function HRLayout() {
  const [hrRole, setHrRole] = useState<string>('employee')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const roles = payload.roles || {}
        setHrRole(roles.hr || 'employee')
      } catch {
        setHrRole('employee')
      }
    }
  }, [])

  const links = ALL_LINKS.filter((link) => link.roles.includes(hrRole))

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                isActive
                  ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
