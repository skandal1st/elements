import { NavLink, Outlet } from 'react-router-dom'
import { FileText, Building2, Tag } from 'lucide-react'

const links = [
  { to: '/contracts', label: 'Договора', icon: FileText },
  { to: '/contracts/counterparties', label: 'Контрагенты', icon: Building2 },
  { to: '/contracts/types', label: 'Типы договоров', icon: Tag },
]

export function ContractsLayout() {
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                isActive
                  ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
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
