import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/it/equipment", label: "Оборудование" },
  { to: "/it/tickets", label: "Заявки" },
  { to: "/it/consumables", label: "Расходные материалы" },
  { to: "/it/equipment-requests", label: "Заявки на оборудование" },
  { to: "/it/reports", label: "Отчеты" },
  { to: "/it/licenses", label: "Лицензии ПО" },
  { to: "/it/dictionaries", label: "Справочники" },
];

export function ITLayout() {
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
                  ? "bg-blue-100 text-blue-800"
                  : "text-gray-600 hover:bg-gray-100"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
