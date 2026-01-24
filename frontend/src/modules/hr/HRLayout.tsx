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
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:bg-gray-100'
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
