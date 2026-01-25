import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/hr/phonebook', label: 'Телефонная книга' },
  { to: '/hr/birthdays', label: 'Дни рождения' },
  { to: '/hr/org', label: 'Оргструктура' },
  { to: '/hr/requests', label: 'HR-заявки' },
  { to: '/hr/users', label: 'Пользователи' },
]

export function HRLayout() {
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-dark-600/50 pb-4">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                isActive
                  ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700/50 border border-transparent'
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
