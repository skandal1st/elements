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
