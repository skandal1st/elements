import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

const links = [
  { to: "/it/equipment", label: "Оборудование" },
  { to: "/it/tickets", label: "Заявки" },
  { to: "/it/knowledge", label: "База знаний" },
  { to: "/it/consumables", label: "Расходные материалы" },
  { to: "/it/equipment-requests", label: "Заявки на оборудование" },
  { to: "/it/reports", label: "Отчеты" },
  { to: "/it/licenses", label: "Лицензии ПО" },
  { to: "/it/dictionaries", label: "Справочники" },
];

export function ITLayout() {
  const [itRole, setItRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1] || ""));
      const roles = payload.roles || {};
      setItRole(roles.it || null);
    } catch {
      // ignore token parse errors
    }
  }, []);

  const visibleLinks = links.filter(({ to }) => {
    if (itRole === "auditor") {
      // Аудитор видит только оборудование, заявки, заявки на оборудование и отчёты
      if (
        to === "/it/knowledge" ||
        to === "/it/consumables" ||
        to === "/it/licenses" ||
        to === "/it/dictionaries"
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {visibleLinks.map(({ to, label }) => (
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
