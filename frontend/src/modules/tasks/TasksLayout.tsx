import { NavLink, Outlet } from "react-router-dom";
import { FolderKanban, CheckSquare, LayoutDashboard } from "lucide-react";

const links = [
  { to: "/tasks/projects", label: "Проекты", icon: FolderKanban },
  { to: "/tasks/board", label: "Канбан", icon: LayoutDashboard },
  { to: "/tasks/my", label: "Мои задачи", icon: CheckSquare },
];

export function TasksLayout() {
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
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
  );
}
