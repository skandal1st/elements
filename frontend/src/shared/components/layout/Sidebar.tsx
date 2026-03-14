import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  CheckSquare,
  Newspaper,
  GraduationCap,
  Wrench,
  FileText,
  Settings,
  HelpCircle,
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
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const modules: Module[] = [
  { code: "portal", name: "Главная", icon: LayoutDashboard, path: "/" },
  { code: "hr", name: "Сотрудники", icon: Users, path: "/hr" },
  { code: "mail", name: "Чаты и звонки", icon: MessageCircle, path: "/mail" },
  { code: "tasks", name: "Задачи", icon: CheckSquare, path: "/tasks" },
  { code: "news", name: "Новости", icon: Newspaper, path: "/news" },
  { code: "learning", name: "Обучение", icon: GraduationCap, path: "/learning" },
  { code: "it", name: "Сервисы", icon: Wrench, path: "/it" },
  { code: "documents", name: "Документы", icon: FileText, path: "/documents" },
  { code: "settings", name: "Настройки", icon: Settings, path: "/settings" },
  { code: "help", name: "Помощь", icon: HelpCircle, path: "/help" },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
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
        // Mocking some modules as always available for the portal layout
        const requiredMods = ["portal", "news", "learning", "mail", "help"].concat(mods);
        setAvailableModules(su ? modules.map(m => m.code) : requiredMods);
      } catch (e) {
        console.error("Ошибка декодирования токена:", e);
      }
    }
  }, []);

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
          <div className={`pt-10 pb-8 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-center"} border-b border-gray-50 mx-6 mb-4 relative`}>
             {!sidebarCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  {/* Имитация логотипа */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-end gap-[2px] mb-1">
                      <div className="w-[4px] h-[18px] bg-brand-green rounded-t-sm"></div>
                      <div className="w-[4px] h-[24px] bg-brand-green rounded-t-sm"></div>
                      <div className="w-[4px] h-[30px] bg-brand-yellow rounded-t-sm"></div>
                      <div className="w-[4px] h-[24px] bg-brand-green rounded-t-sm"></div>
                      <div className="w-[4px] h-[18px] bg-brand-green rounded-t-sm"></div>
                     </div>
                     <span className="text-[18px] font-black text-[#004e38] tracking-widest uppercase mt-1">
                       Роснефть
                     </span>
                  </div>
                </div>
             ) : (
                <div className="flex items-end gap-[2px]">
                   <div className="w-[3px] h-[12px] bg-brand-green"></div>
                   <div className="w-[3px] h-[16px] bg-brand-green"></div>
                   <div className="w-[3px] h-[22px] bg-brand-yellow"></div>
                   <div className="w-[3px] h-[16px] bg-brand-green"></div>
                   <div className="w-[3px] h-[12px] bg-brand-green"></div>
                </div>
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
                  
                  {/* Бейджик, если это например звонки/задачи (мок данных) */}
                  {module.code === "mail" && !sidebarCollapsed && (
                    <span className="ml-auto w-5 h-5 rounded-full bg-brand-yellow text-white text-[10px] font-bold flex items-center justify-center">
                      1
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
