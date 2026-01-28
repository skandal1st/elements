import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import { Search, Settings, ChevronDown, LogOut, User } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { apiGet } from "../../api/client";
import { formatRelative } from "../../utils/formatRelative";
import { NotificationBell } from "../notifications/NotificationBell";

function formatNameWithInitials(fullName: string): string {
  if (!fullName) return "Пользователь";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "Пользователь";
  if (parts.length === 1) return parts[0];
  const surname = parts[0];
  const initials = parts.slice(1).map((p) => p.charAt(0).toUpperCase() + ".").join("");
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
  "/profile": "Настройки пользователя",
  "/tasks": "Задачи",
  "/tasks/projects": "Проекты",
  "/tasks/board": "Канбан доска",
  "/tasks/my": "Мои задачи",
};

export function Header() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  const { displayName, email, isSuperuser } = useMemo(() => {
    let name = "Пользователь";
    let em = "";
    let su = false;
    if (user?.full_name) name = formatNameWithInitials(user.full_name);
    else if (token) {
      try {
        const p = JSON.parse(atob(token.split(".")[1]));
        if (p.full_name) name = formatNameWithInitials(p.full_name);
        if (p.email) em = p.email;
        su = !!p.is_superuser;
      } catch {
        /**/
      }
    }
    if (user?.email) em = user.email;
    if (user?.is_superuser) su = user.is_superuser;
    return { displayName: name, email: em, isSuperuser: su };
  }, [user, token]);

  const avatarInitials = useMemo(() => {
    const fn = user?.full_name || (token ? (() => {
      try {
        const p = JSON.parse(atob(token.split(".")[1]));
        return p.full_name || "";
      } catch { return ""; }
    })() : "");
    if (!fn) return "U";
    const parts = fn.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    return parts[0].charAt(0).toUpperCase();
  }, [user, token]);

  const currentPageName = pageNames[location.pathname] || "Elements Platform";
  const lastEmailCheckAt = useUIStore((s) => s.lastEmailCheckAt);
  const setLastEmailCheckAt = useUIStore((s) => s.setLastEmailCheckAt);
  const [, setTick] = useState(0);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    if (userOpen) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [userOpen]);

  useEffect(() => {
    apiGet<{ last_check_at: string | null }>("/portal/last-email-check")
      .then((data) => setLastEmailCheckAt(data.last_check_at))
      .catch(() => {});
  }, [setLastEmailCheckAt]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const updatedLabel = formatRelative(lastEmailCheckAt);

  return (
    <header className="sticky top-0 z-30 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-white">{currentPageName}</h1>
          <span className="text-sm text-accent-purple bg-accent-purple/10 px-3 py-1 rounded-full">
            Обновлено {updatedLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all"
            title="Поиск"
          >
            <Search className="w-5 h-5" />
          </button>

          <NotificationBell />

          {isSuperuser && (
            <Link
              to="/settings"
              className="p-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all"
              title="Настройки проекта"
            >
              <Settings className="w-5 h-5" />
            </Link>
          )}

          <div className="w-px h-8 bg-dark-600 mx-1" />

          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={() => setUserOpen(!userOpen)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-dark-700/50 rounded-xl transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center">
                <span className="text-sm font-semibold text-white">{avatarInitials}</span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">{displayName}</p>
                <p className="text-xs text-gray-500 truncate max-w-[160px]">{email || "—"}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userOpen ? "rotate-180" : ""}`} />
            </button>

            {userOpen && (
              <div className="absolute right-0 mt-2 w-56 py-1 bg-dark-800 rounded-xl shadow-xl border border-dark-600 z-50">
                <Link
                  to="/profile"
                  onClick={() => setUserOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-dark-700/50 hover:text-white transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm">Настройки пользователя</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setUserOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Выход</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
