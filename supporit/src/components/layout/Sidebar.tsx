import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Ticket,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  Box,
  Settings,
  Key,
  ShoppingCart,
} from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { useNavigate } from "react-router-dom";
import { canViewReports, canManageUsers } from "../../utils/permissions";
import { useState } from "react";
import type { UserRole } from "../../types";

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRoles?: string[];
  checkPermission?: (role: UserRole | undefined) => boolean;
}

const navItems: NavItem[] = [
  {
    name: "Панель управления",
    path: "/dashboard",
    icon: LayoutDashboard,
    checkPermission: (role) => role !== "employee", // Сотрудники не видят дашборд
  },
  {
    name: "Оборудование",
    path: "/equipment",
    icon: Package,
    checkPermission: (role) => role !== "employee", // Сотрудники не видят оборудование
  },
  { name: "Заявки", path: "/tickets", icon: Ticket },
  {
    name: "Заявки на технику",
    path: "/equipment-requests",
    icon: ShoppingCart,
  },
  {
    name: "Расходники",
    path: "/consumables",
    icon: Box,
    checkPermission: (role) => role !== "employee", // Сотрудники не видят расходники
  },
  {
    name: "Лицензии",
    path: "/licenses",
    icon: Key,
    checkPermission: (role) => role !== "employee", // Сотрудники не видят лицензии
  },
  {
    name: "Отчеты",
    path: "/reports",
    icon: FileText,
    checkPermission: canViewReports,
  },
  {
    name: "Пользователи",
    path: "/users",
    icon: Users,
    checkPermission: canManageUsers,
  },
  {
    name: "Настройки",
    path: "/settings",
    icon: Settings,
    checkPermission: (role) => role === "admin" || role === "it_specialist", // Админы и IT-специалисты видят настройки
  },
];

export const Sidebar = () => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.checkPermission) {
      return item.checkPermission(user?.role);
    }
    return true;
  });

  const NavLinkContent = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    return (
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
            isActive
              ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`
        }
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <Icon className="h-5 w-5 mr-3" />
        {item.name}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="bg-primary-600 p-2 rounded-lg mr-3">
                <LayoutDashboard className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                ИТ-Поддержка
              </span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {filteredNavItems.map((item) => (
              <NavLinkContent key={item.path} item={item} />
            ))}
          </nav>

          {/* User info and logout */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                  {user?.full_name?.charAt(0).toUpperCase() || "U"}
                </div>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.full_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Выйти
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
