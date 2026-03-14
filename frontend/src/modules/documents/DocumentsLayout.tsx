import { NavLink, Outlet } from 'react-router-dom'
import { FileText, FileUp, Route, Tag } from 'lucide-react'

const links = [
  { to: '/documents/list', label: 'Документы', icon: FileText },
  { to: '/documents/templates', label: 'Шаблоны', icon: FileUp },
  { to: '/documents/routes', label: 'Маршруты', icon: Route },
  { to: '/documents/types', label: 'Типы', icon: Tag },
]

export function DocumentsLayout() {
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-dark-600/50 pb-4">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                isActive
                  ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700/50 border border-transparent'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
