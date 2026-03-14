import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Paperclip,
  CheckCircle2,
  CalendarDays,
  FileText,
  FileStack,
  Archive,
  Activity,
  BookOpen,
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  date: string;
  image_color: string;
  content: string;
}

interface DashboardData {
  announcements: Announcement[];
  available_modules: string[];
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/portal/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      } else {
        // Mock data if failed
        setData({ announcements: [], available_modules: [] });
      }
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      setData({ announcements: [], available_modules: [] });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // --- Mocks ---
  const emails = [
    { id: 1, sender: "Иванов Д.В.", subject: "Корпоративный портал", preview: "В 2024 году запланирован...", date: "19 фев", type: "unread", avatar: "ИД" },
    { id: 2, sender: "Дубинина А.А.", subject: "Стажерская программа", preview: "Анна, еще раз здравств...", date: "19 фев", type: "urgent", avatar: "ДА", hasAttachment: true },
  ];

  const events = [
    { id: 1, date: "22.02.2024", time: "15:00", title: "Общее совещание", desc: "Утверждение архитектуры\nи функций корпоративного портала", color: "bg-green-100/50" },
    { id: 2, date: "27.02.2024", time: "12:00", title: "Защита проекта", desc: "Утверждение цели, команды,\nсроков и бюджета", color: "bg-brand-yellow/20" },
  ];

  return (
    <div className="relative">
      <div className="flex gap-6">
        {/* Main Content (Left) */}
        <div className="flex-1 space-y-6">
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

            <div className="portal-card flex-[1.5] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-gray-800 font-medium">Основные направления</h3>
                <span className="text-sm text-gray-400">7/10</span>
              </div>
              
              <div className="space-y-4">
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-brand-green" style={{ width: '40%' }}></div>
                  <div className="h-full bg-brand-yellow" style={{ width: '30%' }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-green-50 text-brand-green text-xs font-medium rounded-full">Согласование</span>
                    <span className="px-3 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded-full">Исследования</span>
                    <span className="px-3 py-1 bg-yellow-50 text-brand-yellow text-xs font-medium rounded-full">Функционал</span>
                  </div>
                  
                  <div className="flex gap-2">
                     <button className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-brand-yellow"><FileText className="w-4 h-4" /></button>
                     <button className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-brand-green"><CheckCircle2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mail Widget */}
          <div className="portal-card !p-0 overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-gray-800 font-medium px-1">Почта</h3>
              <div className="flex gap-4 text-sm font-medium">
                <button className="text-gray-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-brand-green flex items-center justify-center text-[10px]">2</span>
                  Непрочитанные
                </button>
                <button className="text-gray-400 hover:text-gray-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-yellow-100 text-brand-yellow flex items-center justify-center text-[10px]">1</span>
                  Срочные
                </button>
                <button className="text-gray-400 hover:text-gray-800">Отправленные</button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                   {/* mock avatars */}
                   <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200"></div>
                   <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-300"></div>
                   <button className="w-8 h-8 rounded-full border-2 border-white bg-gray-50 flex items-center justify-center text-gray-400 text-xs">+</button>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {emails.map((email) => (
                <div key={email.id} className="p-4 hover:bg-gray-50 flex items-center gap-4 cursor-pointer transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${email.type === 'unread' ? 'bg-green-100 text-brand-green' : 'bg-gray-100 text-gray-600'}`}>
                    {email.avatar}
                  </div>
                  <div className="w-32 truncate text-sm font-medium text-gray-800">{email.sender}</div>
                  
                  {email.type === 'urgent' && <span className="text-brand-yellow font-bold mr-1">!</span>}
                  
                  <div className="w-48 truncate text-sm font-medium text-gray-800">{email.subject}</div>
                  <div className="flex-1 truncate text-sm text-gray-400">{email.preview}</div>
                  
                  {email.hasAttachment && <Paperclip className="w-4 h-4 text-gray-400" />}
                  
                  <div className="text-xs text-gray-400 w-12 text-right">{email.date}</div>
                </div>
              ))}
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

        {/* Right Sidebar (Calendar & Events) */}
        <div className="w-[320px] space-y-6">
          <div className="portal-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-500 font-medium">Общий календарь</h3>
              <button className="w-6 h-6 rounded-full bg-brand-green text-white flex items-center justify-center">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-800 font-medium">Февраль 2024</span>
                <div className="flex gap-2">
                  <button className="w-6 h-6 rounded-full bg-brand-green text-white flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                  <button className="w-6 h-6 rounded-full bg-brand-green text-white flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center text-sm mb-2">
                <div className="text-gray-400">Пн</div>
                <div className="text-gray-400">Вт</div>
                <div className="text-gray-400">Ср</div>
                <div className="text-gray-400">Чт</div>
                <div className="text-gray-400">Пт</div>
                <div className="text-gray-400">Сб</div>
                <div className="text-gray-400">Вс</div>
              </div>
              
              <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center text-sm">
                 {/* Empty days / Prev month */}
                 <div className="text-gray-300">29</div>
                 <div className="text-gray-300">30</div>
                 <div className="text-gray-300">31</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">1</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">2</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">3</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">4</div>
                 
                 {/* Row 2 */}
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">5</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">6</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">7</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">8</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">9</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">10</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">11</div>
                 
                 {/* Row 3 */}
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">12</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">13</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">14</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">15</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">16</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">17</div>
                 <div className="text-gray-400 hover:bg-gray-50 rounded-full py-1 cursor-pointer">18</div>
                 
                 {/* Row 4 */}
                 <div className="text-brand-yellow font-medium hover:bg-yellow-50 rounded-full py-1 cursor-pointer">19</div>
                 <div className="text-gray-700 font-medium hover:bg-gray-50 rounded-full py-1 cursor-pointer">20</div>
                 <div className="text-gray-700 font-medium hover:bg-gray-50 rounded-full py-1 cursor-pointer">21</div>
                 <div className="bg-green-100 text-brand-green font-bold rounded-full py-1 cursor-pointer">22</div>
                 <div className="text-gray-700 font-medium hover:bg-gray-50 rounded-full py-1 cursor-pointer">23</div>
                 <div className="text-gray-700 font-medium hover:bg-gray-50 rounded-full py-1 cursor-pointer">24</div>
                 <div className="text-gray-700 font-medium hover:bg-gray-50 rounded-full py-1 cursor-pointer">25</div>
                 
                 {/* Row 5 */}
                 <div className="text-gray-700 font-medium hover:bg-gray-50 rounded-full py-1 cursor-pointer">26</div>
                 <div className="bg-brand-yellow text-white font-bold rounded-full py-1 cursor-pointer relative"><span className="absolute top-0 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></span>27</div>
                 <div className="text-gray-700 font-medium hover:bg-gray-50 rounded-full py-1 cursor-pointer">28</div>
                 <div className="text-gray-700 font-medium hover:bg-gray-50 rounded-full py-1 cursor-pointer">29</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="portal-card p-5 relative overflow-hidden group hover:border-gray-200 transition-colors cursor-pointer">
                 <div className="flex items-center justify-between mb-3">
                   <div className={`px-3 py-1 rounded-full text-xs font-medium text-gray-800 border border-gray-100 ${event.color}`}>{event.date}</div>
                   <div className="px-3 py-1 rounded-full border border-gray-200 text-xs font-medium text-gray-500 bg-white">
                      {event.time}
                   </div>
                 </div>
                 <h4 className="font-semibold text-gray-900 mb-2">{event.title}</h4>
                 <p className="text-sm text-gray-500 whitespace-pre-line leading-relaxed">{event.desc}</p>
                 
                 {/* Decorative element */}
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-10 transition-opacity">
                    <CalendarDays className="w-24 h-24" />
                 </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
