import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  GitBranch,
  Phone,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

type NavItem = {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  adminOnly?: boolean;
};

const allNavItems: NavItem[] = [
  { name: "Телефонная книга", path: "/", icon: Phone },
  { name: "Дни рождения", path: "/birthdays", icon: CalendarDays },
  { name: "Оргструктура", path: "/org", icon: GitBranch, requiresAuth: true },
  { name: "HR-панель", path: "/hr", icon: ClipboardList, requiresAuth: true },
  { name: "Аудит", path: "/audit", icon: ShieldCheck, requiresAuth: true },
  {
    name: "Пользователи",
    path: "/users",
    icon: Users,
    requiresAuth: true,
    adminOnly: true,
  },
  { name: "Настройки", path: "/settings", icon: Settings, requiresAuth: true },
];

type SidebarProps = {
  isAuthed?: boolean;
  isHRorIT?: boolean;
  userRole?: string | null;
};

export function Sidebar({
  isAuthed = false,
  isHRorIT = false,
  userRole = null,
}: SidebarProps) {
  // Фильтруем пункты меню в зависимости от авторизации
  const navItems = allNavItems.filter((item) => {
    if (item.adminOnly) {
      return isAuthed && userRole === "admin";
    }
    return !item.requiresAuth || (isAuthed && isHRorIT);
  });

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40">
      <div className="flex flex-col h-full">
        <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="bg-primary-600 p-2 rounded-lg mr-3">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            HR-IT Manager
          </span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`
                }
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
