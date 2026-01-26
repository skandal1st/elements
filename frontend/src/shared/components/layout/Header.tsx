import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Bell, Search, Settings, ChevronDown } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";

function formatNameWithInitials(fullName: string): string {
  if (!fullName) return "Пользователь";

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "Пользователь";

  if (parts.length === 1) return parts[0];

  const surname = parts[0];
  const initials = parts
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + ".")
    .join("");

  return `${surname} ${initials}`;
}

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/hr": "HR",
  "/hr/phonebook": "Телефонный справочник",
  "/hr/birthdays": "Дни рождения",
  "/hr/org": "Структура организации",
  "/hr/requests": "Заявки",
  "/it": "IT",
  "/it/equipment": "Оборудование",
  "/it/tickets": "Заявки",
  "/it/consumables": "Расходники",
  "/it/equipment-requests": "Заявки на оборудование",
  "/it/reports": "Отчеты",
  "/it/licenses": "Лицензии",
  "/it/dictionaries": "Справочники",
  "/settings": "Настройки",
  "/settings/users": "Пользователи",
  "/settings/it": "Настройки ИТ",
  "/tasks": "Задачи",
  "/tasks/projects": "Проекты",
  "/tasks/board": "Канбан доска",
  "/tasks/my": "Мои задачи",
};

export function Header() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  const displayName = useMemo(() => {
    if (user?.full_name) {
      return formatNameWithInitials(user.full_name);
    }

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.full_name) {
          return formatNameWithInitials(payload.full_name);
        }
      } catch {
        // Ignore decode errors
      }
    }

    return "Пользователь";
  }, [user, token]);

  const avatarInitials = useMemo(() => {
    const fullName = user?.full_name || "";
    if (!fullName) return "U";

    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  }, [user]);

  const currentPageName = useMemo(() => {
    return pageNames[location.pathname] || "Elements Platform";
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Left: Page Title */}
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-white">
            {currentPageName}
          </h1>
          <span className="text-sm text-accent-purple bg-accent-purple/10 px-3 py-1 rounded-full">
            Обновлено 2 мин назад
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <button className="p-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <button className="relative p-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-accent-purple rounded-full"></span>
          </button>

          {/* Settings */}
          <button className="p-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
            <Settings className="w-5 h-5" />
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-dark-600 mx-2"></div>

          {/* User Profile */}
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-dark-700/50 rounded-xl transition-all">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center">
              <span className="text-sm font-semibold text-white">{avatarInitials}</span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-gray-500">admin@elements.local</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </header>
  );
}
