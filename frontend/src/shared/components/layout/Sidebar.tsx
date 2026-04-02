<<<<<<< HEAD
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  CheckSquare,
  Newspaper,
  Wrench,
  FileText,
  FileSignature,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useUIStore } from "../../store/ui.store";
import { useAuthStore } from "../../store/auth.store";

interface Module {
  code: string;
  name: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  path: string;
}

const modules: Module[] = [
  { code: "portal", name: "Главная", icon: LayoutDashboard, path: "/" },
  { code: "hr", name: "Сотрудники", icon: Users, path: "/hr" },
  { code: "mail", name: "Почта", icon: MessageCircle, path: "/mail" },
  { code: "tasks", name: "Задачи", icon: CheckSquare, path: "/tasks" },
  { code: "news", name: "Новости", icon: Newspaper, path: "/news" },
  { code: "it", name: "IT", icon: Wrench, path: "/it" },
  { code: "documents", name: "Документы", icon: FileText, path: "/documents" },
  { code: "contracts", name: "Договора", icon: FileSignature, path: "/contracts" },
  { code: "settings", name: "Настройки", icon: Settings, path: "/settings" },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const mods = payload.modules || [];
        const su = !!payload.is_superuser;
        const requiredMods = ["portal", "news", "mail"].concat(mods);
        setAvailableModules(su ? modules.map(m => m.code) : requiredMods);
      } catch (e) {
        console.error("Ошибка декодирования токена:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!availableModules.includes("mail")) return;
    const fetchUnread = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch("/api/v1/mail/unread-count", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMailUnreadCount(data.unread_count ?? 0);
        }
      } catch {
        setMailUnreadCount(0);
      }
    };
    fetchUnread();
    const t = setInterval(fetchUnread, 60000);
    return () => clearInterval(t);
  }, [availableModules]);

  const filteredModules = modules.filter(
    (m) => availableModules.includes(m.code) || availableModules.length === 0,
  );

  const sidebarWidth = sidebarCollapsed ? "w-20" : "w-[280px]";

  // Логика определения "Активного" пункта
  // Маршрут Главной: точное совпадение с "/"
  const isModuleActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-white border border-gray-200 rounded-xl shadow-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-gray-700" />
        ) : (
          <Menu className="w-5 h-5 text-gray-700" />
        )}
      </button>

      <aside
        className={`
          fixed top-0 left-0 h-full ${sidebarWidth} bg-white border-r border-gray-100 shadow-[2px_0_12px_rgba(0,0,0,0.02)] transform transition-all duration-300 z-40
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <div className="flex flex-col h-full bg-white relative">
          
          {/* Logo Area */}
          <div className={`pt-10 pb-8 flex items-center ${sidebarCollapsed ? "justify-center px-2" : "justify-center"} border-b border-gray-50 mx-6 mb-4 relative`}>
            {!sidebarCollapsed ? (
              <img
                src="/logo.png"
                alt="ТЕПЛОЦЕНТРАЛЬ"
                className="h-14 w-auto max-w-full object-contain object-left"
              />
            ) : (
              <img
                src="/logo-icon.png"
                alt="ТЕПЛОЦЕНТРАЛЬ"
                className="w-14 h-14 object-contain"
              />
            )}
          </div>

          {/* Toggle Button */}
          {!sidebarCollapsed && (
            <div className="px-6 mb-4">
              <button 
                onClick={toggleSidebar}
                className="flex items-center gap-3 w-full py-2 px-3 text-gray-500 hover:text-gray-900 transition-colors bg-gray-50 rounded-xl"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Скрыть меню</span>
              </button>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="px-4 mb-4 flex justify-center">
              <button 
                onClick={toggleSidebar}
                className="p-3 text-gray-500 hover:text-gray-900 transition-colors bg-gray-50 rounded-xl"
                title="Показать меню"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 space-y-1 scrollbar-hide py-2">
            {filteredModules.map((module) => {
              const Icon = module.icon;
              const isActive = isModuleActive(module.path);

              return (
                <Link
                  key={module.code}
                  to={module.path}
                  className={`
                    relative flex items-center ${sidebarCollapsed ? "justify-center" : "gap-4"} px-4 py-3.5 rounded-2xl transition-all duration-200
                    ${
                      isActive
                        ? "text-gray-900 font-semibold bg-gray-50"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    }
                  `}
                  onClick={() => setIsOpen(false)}
                  title={sidebarCollapsed ? module.name : undefined}
                >
                  {/* Левая желтая полоска для активного пункта */}
                  {isActive && !sidebarCollapsed && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-brand-yellow rounded-r-lg" />
                  )}
                  {isActive && sidebarCollapsed && (
                     <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-yellow rounded-r-lg" />
                  )}

                  <Icon className={`w-[22px] h-[22px] flex-shrink-0 ${isActive ? "text-brand-green" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                  {!sidebarCollapsed && <span className="text-[15px]">{module.name}</span>}
                  
                  {/* Счётчик непрочитанных писем в папке Входящие */}
                  {module.code === "mail" && !sidebarCollapsed && mailUnreadCount > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-brand-yellow text-white text-[10px] font-bold flex items-center justify-center">
                      {mailUnreadCount > 99 ? "99+" : mailUnreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer (Выход) */}
          <div className="p-4 mt-auto">
             <button
                onClick={() => logout()}
                className={`
                  w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-4"} px-4 py-3.5 rounded-2xl transition-all duration-200 text-gray-500 hover:text-red-500 hover:bg-red-50
                `}
                title={sidebarCollapsed ? "Выход" : undefined}
             >
                <LogOut className="w-[22px] h-[22px] flex-shrink-0" strokeWidth={2} />
                {!sidebarCollapsed && <span className="text-[15px] font-medium">Выход</span>}
             </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
=======
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Server,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Search,
} from "lucide-react";
import { useUIStore } from "../../store/ui.store";

interface Module {
  code: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const modules: Module[] = [
  { code: "hr", name: "HR", icon: Users, path: "/hr" },
  { code: "it", name: "IT", icon: Server, path: "/it" },
  { code: "tasks", name: "Задачи", icon: CheckSquare, path: "/tasks" },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const mods = payload.modules || [];
        const su = !!payload.is_superuser;
        setAvailableModules(su ? ["hr", "it", "tasks"] : [...mods]);
      } catch (e) {
        console.error("Ошибка декодирования токена:", e);
      }
    }
  }, []);

  const filteredModules = modules.filter(
    (m) => availableModules.includes(m.code) || availableModules.length === 0,
  );

  const sidebarWidth = sidebarCollapsed ? "w-20" : "w-72";

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-3 bg-dark-800 border border-dark-600 rounded-xl shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-gray-300" />
        ) : (
          <Menu className="w-5 h-5 text-gray-300" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full ${sidebarWidth} bg-gradient-sidebar border-r border-dark-700/50 transform transition-all duration-300 z-40
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <div className="p-4 h-full flex flex-col">
          {/* Logo & Header */}
          <div
            className={`flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"} mb-8 px-2`}
          >
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-indigo flex items-center justify-center shadow-glow-sm">
                  <span className="text-white font-bold text-lg">E</span>
                </div>
                <span className="text-xl font-bold text-white">Elements</span>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-indigo flex items-center justify-center shadow-glow-sm">
                <span className="text-white font-bold text-lg">E</span>
              </div>
            )}

            {/* Collapse button */}
            <button
              className={`hidden md:flex items-center justify-center w-8 h-8 rounded-lg bg-dark-700/50 hover:bg-dark-600 text-gray-400 hover:text-white transition-all ${sidebarCollapsed ? "absolute -right-3 top-6 bg-dark-800 border border-dark-600 shadow-lg" : ""}`}
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "Развернуть" : "Свернуть"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Search (only when expanded) */}
          {!sidebarCollapsed && (
            <div className="mb-6 px-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 focus:ring-1 focus:ring-accent-purple/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2">
            {!sidebarCollapsed && (
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-3">
                Навигация
              </p>
            )}

            <Link
              to="/"
              className={`
                flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-3 rounded-xl transition-all duration-200
                ${
                  location.pathname === "/"
                    ? "bg-gradient-to-r from-accent-purple/20 to-transparent text-white border-l-2 border-accent-purple"
                    : "text-gray-400 hover:text-white hover:bg-dark-700/50"
                }
              `}
              onClick={() => setIsOpen(false)}
              title={sidebarCollapsed ? "Главная" : undefined}
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="font-medium">Главная</span>}
            </Link>

            {filteredModules.map((module) => {
              const Icon = module.icon;
              const isActive = location.pathname.startsWith(module.path);

              return (
                <Link
                  key={module.code}
                  to={module.path}
                  className={`
                    flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-3 rounded-xl transition-all duration-200
                    ${
                      isActive
                        ? "bg-gradient-to-r from-accent-purple/20 to-transparent text-white border-l-2 border-accent-purple"
                        : "text-gray-400 hover:text-white hover:bg-dark-700/50"
                    }
                  `}
                  onClick={() => setIsOpen(false)}
                  title={sidebarCollapsed ? module.name : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="font-medium">{module.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
>>>>>>> 1c0b322 (поправлены выпадающие меню)
