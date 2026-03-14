import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/hr/phonebook', label: 'Телефонная книга' },
  { to: '/hr/birthdays', label: 'Дни рождения' },
  { to: '/hr/org', label: 'Оргструктура' },
  { to: '/hr/requests', label: 'HR-заявки' },
  { to: '/hr/zup-sync', label: 'Синхронизация ЗУП' },
]

export function HRLayout() {
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
