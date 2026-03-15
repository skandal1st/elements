import { useState, useEffect } from "react";
import {
  FileStack,
  Archive,
  Activity,
  BookOpen,
  Megaphone,
  Gift,
} from "lucide-react";
import { DashboardCalendar } from "./DashboardCalendar";
import { ActionCenter, type ActionItemsData } from "./ActionCenter";
import { useAuthStore } from "@/shared/store/auth.store";

interface Announcement {
  id: string;
  title: string;
  date: string;
  image_color: string;
  content: string;
}

interface BirthdayEntry {
  id: string;
  name: string;
  date: string;
  days_left: number;
  department?: string | null;
}

interface DashboardData {
  announcements: Announcement[];
  available_modules: string[];
  birthdays?: BirthdayEntry[];
  stats?: {
    employees_count: number;
    active_tickets: number;
    equipment_in_use: number;
    tasks_total: number;
    tasks_completed: number;
    tasks_progress: number;
    tasks_completed_this_month: number;
  };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionItems, setActionItems] = useState<ActionItemsData | null>(null);
  const user = useAuthStore((s) => s.user);

  const hasModule = (mod: string) =>
    !!user?.is_superuser || !!user?.modules?.includes(mod);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch dashboard and action items in parallel
    const fetchDashboard = fetch("/api/v1/portal/dashboard", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const fetchActions = fetch("/api/v1/portal/dashboard/actions", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    Promise.all([fetchDashboard, fetchActions]).then(
      ([dashboardData, actionsData]) => {
        setData(
          dashboardData ?? {
            announcements: [],
            available_modules: [],
            birthdays: [],
          }
        );
        if (actionsData) setActionItems(actionsData);
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const formatBirthdayDate = (isoDate: string) => {
    const d = new Date(isoDate);
    const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  const formatDaysLeft = (days: number) => {
    if (days === 0) return "Сегодня";
    if (days === 1) return "Завтра";
    if (days >= 2 && days <= 4) return `Через ${days} дня`;
    return `Через ${days} дн.`;
  };

  return (
    <div className="relative">
      <div className="flex gap-6">
        {/* Main Content (Left) */}
        <div className="flex-1 space-y-6">
          {/* Action Center */}
          {actionItems && (
            <ActionCenter data={actionItems} hasModule={hasModule} />
          )}

          {/* Кнопки быстрого доступа — карточки как виджет План */}
          <div className="flex gap-6">
            <a
              href="http://10.20.30.81/docs/index.php"
              target="_blank"
              rel="noopener noreferrer"
              className="portal-card flex-1 flex flex-col items-center justify-center gap-3 min-h-[180px] text-gray-700 font-medium hover:border-gray-200 transition-colors group"
            >
              <FileStack className="w-10 h-10 text-brand-green group-hover:scale-110 transition-transform" />
              <span className="text-[15px]">Документы</span>
            </a>
            <a
              href="http://10.20.30.81/archive/index.php"
              target="_blank"
              rel="noopener noreferrer"
              className="portal-card flex-1 flex flex-col items-center justify-center gap-3 min-h-[180px] text-gray-700 font-medium hover:border-gray-200 transition-colors group"
            >
              <Archive className="w-10 h-10 text-brand-green group-hover:scale-110 transition-transform" />
              <span className="text-[15px]">Архив</span>
            </a>
            <a
              href="http://10.20.30.81/values/index.php"
              target="_blank"
              rel="noopener noreferrer"
              className="portal-card flex-1 flex flex-col items-center justify-center gap-3 min-h-[180px] text-gray-700 font-medium hover:border-gray-200 transition-colors group"
            >
              <Activity className="w-10 h-10 text-brand-green group-hover:scale-110 transition-transform" />
              <span className="text-[15px]">Мониторинг</span>
            </a>
            <a
              href="http://10.20.30.12:8080/app"
              target="_blank"
              rel="noopener noreferrer"
              className="portal-card flex-1 flex flex-col items-center justify-center gap-3 min-h-[180px] text-gray-700 font-medium hover:border-gray-200 transition-colors group"
            >
              <BookOpen className="w-10 h-10 text-brand-green group-hover:scale-110 transition-transform" />
              <span className="text-[15px]">Тезис</span>
            </a>
          </div>

          {/* Stats Row */}
          <div className="flex gap-6">
            {hasModule("tasks") && (
              <div className="portal-card flex-1 flex items-center justify-between">
                <div>
                  <h3 className="text-gray-500 font-medium mb-1">План</h3>
                  <p className="text-sm text-gray-400 mb-6">{data?.stats?.tasks_completed ?? 0}/{data?.stats?.tasks_total ?? 0} задач</p>
                  <div className="flex items-center gap-2 text-sm text-green-600 font-semibold">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    +{data?.stats?.tasks_completed_this_month ?? 0}
                    <span className="text-gray-400 font-normal ml-1">в этом месяце</span>
                  </div>
                </div>
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-100"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-brand-yellow"
                      strokeDasharray={`${data?.stats?.tasks_progress ?? 0}, 100`}
                      strokeWidth="3"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-800">{data?.stats?.tasks_progress ?? 0}%</span>
                  </div>
                </div>
              </div>
            )}

            <div className={`portal-card flex flex-col ${hasModule("tasks") ? "flex-[1.5]" : "flex-1"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-800 font-medium">Важные объявления</h3>
                {data?.announcements && data.announcements.length > 0 && (
                  <span className="text-sm text-gray-400">{data.announcements.length}</span>
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-hidden">
                {data?.announcements && data.announcements.length > 0 ? (
                  data.announcements.slice(0, 4).map((announcement) => (
                    <div
                      key={announcement.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors cursor-pointer group"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand-green/10 flex items-center justify-center">
                        <Megaphone className="w-4 h-4 text-brand-green" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 mb-0.5">{announcement.date}</p>
                        <h4 className="text-sm font-medium text-gray-800 group-hover:text-brand-green transition-colors line-clamp-2" title={announcement.title}>
                          {announcement.title}
                        </h4>
                        {announcement.content && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{announcement.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 py-6 text-gray-400 text-sm">
                    <Megaphone className="w-8 h-8 text-gray-300 flex-shrink-0" />
                    <span>Нет важных объявлений</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ближайшие дни рождения */}
          <div className="portal-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-800 font-medium">Ближайшие дни рождения</h3>
              {data?.birthdays && data.birthdays.length > 0 && (
                <span className="text-sm text-gray-400">{data.birthdays.length}</span>
              )}
            </div>
            <div className="space-y-2">
              {data?.birthdays && data.birthdays.length > 0 ? (
                data.birthdays.slice(0, 8).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-green/10 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-brand-green" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatBirthdayDate(b.date)} · {formatDaysLeft(b.days_left)}
                        {b.department && ` · ${b.department}`}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 py-8 text-gray-400 text-sm">
                  <Gift className="w-8 h-8 text-gray-300 flex-shrink-0" />
                  <span>В ближайшие 7 дней именинников нет</span>
                </div>
              )}
            </div>
          </div>

          {/* Announcements/News Grid */}
          <div className="grid grid-cols-3 gap-6">
            {data?.announcements && data.announcements.length > 0 ? (
              data.announcements.map((announcement) => (
                <div key={announcement.id} className="cursor-pointer group">
                  <div className={`h-32 mb-3 rounded-2xl overflow-hidden relative ${announcement.image_color || 'bg-gray-100'}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{announcement.date}</p>
                  <h4 className="text-sm font-medium text-gray-800 group-hover:text-brand-green transition-colors leading-tight line-clamp-2" title={announcement.title}>
                    {announcement.title}
                  </h4>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-6 text-gray-400 text-sm">
                Нет актуальных объявлений
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar (Calendar + задачи на день) */}
        <div className="w-[360px] flex-shrink-0">
          <DashboardCalendar />
        </div>
      </div>
    </div>
  );
}
