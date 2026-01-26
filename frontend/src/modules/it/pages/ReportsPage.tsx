import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Star,
  Calendar,
} from "lucide-react";
import { apiGet } from "../../../shared/api/client";

type TicketReportData = {
  summary: {
    total_tickets: number;
    open_tickets: number;
    resolved_tickets: number;
    closed_tickets: number;
    avg_resolution_time_hours: number | null;
    avg_rating: number | null;
  };
  by_status: Array<{ status: string; count: number }>;
  by_category: Array<{ category: string; count: number }>;
  by_priority: Array<{ priority: string; count: number }>;
  resolution_details: Array<{
    id: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    resolved_at: string | null;
    closed_at: string | null;
    resolution_time_hours: number | null;
    creator_name: string;
    assignee_name: string | null;
  }>;
  top_creators: Array<{
    user_id: string;
    user_name: string;
    user_email: string;
    department: string | null;
    ticket_count: number;
  }>;
};

const statusLabel: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  waiting: "Ожидание",
  resolved: "Решена",
  closed: "Закрыта",
  pending_user: "Требует пользователя",
};

const categoryLabel: Record<string, string> = {
  hardware: "Оборудование",
  software: "ПО",
  network: "Сеть",
  hr: "HR / Кадры",
  other: "Прочее",
};

const priorityLabel: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

const priorityBarColor: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-gray-400",
};

const priorityBadgeClass: Record<string, string> = {
  low: "bg-gray-500/20 text-gray-300",
  medium: "bg-blue-500/20 text-blue-300",
  high: "bg-orange-500/20 text-orange-300",
  critical: "bg-red-500/20 text-red-300",
};

const statusBadgeClass: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300",
  in_progress: "bg-yellow-500/20 text-yellow-300",
  waiting: "bg-orange-500/20 text-orange-300",
  resolved: "bg-green-500/20 text-green-300",
  closed: "bg-gray-500/20 text-gray-400",
  pending_user: "bg-purple-500/20 text-purple-300",
};

function formatResolutionTime(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} мин`;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
  }
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h > 0 ? `${d}д ${h}ч` : `${d}д`;
}

const getDatePresets = () => {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const startOfLastWeek = new Date(today);
  startOfLastWeek.setDate(today.getDate() - 7);
  const startOfQuarter = new Date(today);
  startOfQuarter.setDate(1);
  startOfQuarter.setMonth(Math.floor(today.getMonth() / 3) * 3);

  return {
    today: { from: fmt(today), to: fmt(today) },
    week: { from: fmt(startOfLastWeek), to: fmt(today) },
    month: { from: fmt(startOfMonth), to: fmt(today) },
    lastMonth: { from: fmt(startOfLastMonth), to: fmt(endOfLastMonth) },
    quarter: { from: fmt(startOfQuarter), to: fmt(today) },
    year: { from: fmt(startOfYear), to: fmt(today) },
  };
};

const PRESET_LABELS: Record<string, string> = {
  today: "Сегодня",
  week: "Неделя",
  month: "Месяц",
  lastMonth: "Прошлый месяц",
  quarter: "Квартал",
  year: "Год",
};

export function ReportsPage() {
  const navigate = useNavigate();
  const presets = getDatePresets();
  const [reportData, setReportData] = useState<TicketReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(presets.month.from);
  const [dateTo, setDateTo] = useState(presets.month.to);
  const [category, setCategory] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [activePreset, setActivePreset] = useState<string>("month");

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("date_from", dateFrom);
      params.set("date_to", dateTo);
      if (category) params.set("category", category);
      if (priority) params.set("priority", priority);

      const result = await apiGet<{ data: TicketReportData }>(
        `/it/reports/tickets?${params}`,
      );
      setReportData(result.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, category, priority]);

  const handlePresetClick = (presetKey: string) => {
    const preset = presets[presetKey as keyof typeof presets];
    if (!preset) return;
    setDateFrom(preset.from);
    setDateTo(preset.to);
    setActivePreset(presetKey);
  };

  const handleDateChange = (field: "from" | "to", value: string) => {
    if (field === "from") setDateFrom(value);
    else setDateTo(value);
    setActivePreset("");
  };

  const total = reportData?.summary.total_tickets ?? 0;

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <h2 className="text-2xl font-bold text-white mb-1">Отчеты</h2>
        <p className="text-gray-400">Аналитика по заявкам IT-отдела</p>
      </div>

      {/* Фильтры */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESET_LABELS) as Array<keyof typeof PRESET_LABELS>).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetClick(preset)}
              className={`px-4 py-2 text-sm rounded-xl transition-all ${
                activePreset === preset
                  ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/30"
                  : "bg-dark-700/50 text-gray-400 border border-dark-600/50 hover:text-white hover:border-dark-500"
              }`}
            >
              {PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">От</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateChange("from", e.target.value)}
                className="glass-input w-full pl-10 pr-4 py-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">До</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateChange("to", e.target.value)}
                className="glass-input w-full pl-10 pr-4 py-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Категория</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="glass-input w-full px-4 py-3 text-sm"
            >
              <option value="" className="bg-dark-800">Все</option>
              {Object.keys(categoryLabel).map((c) => (
                <option key={c} value={c} className="bg-dark-800">{categoryLabel[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Приоритет</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="glass-input w-full px-4 py-3 text-sm"
            >
              <option value="" className="bg-dark-800">Все</option>
              {Object.keys(priorityLabel).map((p) => (
                <option key={p} value={p} className="bg-dark-800">{priorityLabel[p]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      )}

      {!loading && reportData && (
        <div className="space-y-6">
          {/* Сводка */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-accent-purple" />
                <span className="text-sm text-gray-500">Всего заявок</span>
              </div>
              <div className="text-2xl font-bold text-white">{reportData.summary.total_tickets}</div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-gray-500">Открытые</span>
              </div>
              <div className="text-2xl font-bold text-white">{reportData.summary.open_tickets}</div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-500">Решено/Закрыто</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {reportData.summary.resolved_tickets + reportData.summary.closed_tickets}
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-gray-500">Ср. время</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {formatResolutionTime(reportData.summary.avg_resolution_time_hours)}
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="text-sm text-gray-500">Ср. оценка</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {reportData.summary.avg_rating != null
                  ? reportData.summary.avg_rating.toFixed(1)
                  : "—"}
              </div>
            </div>
          </div>

          {/* По категориям и приоритетам (как в supporit) */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold text-white mb-4">По категориям</h3>
              <div className="space-y-3">
                {reportData.by_category.map((item) => (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-gray-400 shrink-0">
                      {categoryLabel[item.category] || item.category}
                    </span>
                    <div className="flex-1 h-6 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-purple rounded-full transition-all"
                        style={{
                          width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-medium text-white">{item.count}</span>
                  </div>
                ))}
                {reportData.by_category.length === 0 && (
                  <p className="text-sm text-gray-500">Нет данных</p>
                )}
              </div>
            </div>
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold text-white mb-4">По приоритетам</h3>
              <div className="space-y-3">
                {reportData.by_priority.map((item) => (
                  <div key={item.priority} className="flex items-center gap-3">
                    <span
                      className={`w-28 text-sm px-2 py-0.5 rounded shrink-0 ${priorityBadgeClass[item.priority] || "bg-dark-600 text-gray-400"}`}
                    >
                      {priorityLabel[item.priority] || item.priority}
                    </span>
                    <div className="flex-1 h-6 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${priorityBarColor[item.priority] || "bg-gray-400"}`}
                        style={{
                          width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-medium text-white">{item.count}</span>
                  </div>
                ))}
                {reportData.by_priority.length === 0 && (
                  <p className="text-sm text-gray-500">Нет данных</p>
                )}
              </div>
            </div>
          </div>

          {/* Топ пользователей */}
          {reportData.top_creators.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Топ пользователей по количеству обращений
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-600/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ФИО</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Отдел</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Заявок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.top_creators.map((creator, index) => (
                      <tr key={creator.user_id} className="border-t border-dark-700/50">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index === 0
                                ? "bg-yellow-500/20 text-yellow-400"
                                : index === 1
                                  ? "bg-gray-500/20 text-gray-300"
                                  : index === 2
                                    ? "bg-orange-500/20 text-orange-300"
                                    : "bg-dark-600 text-gray-400"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-white">{creator.user_name}</td>
                        <td className="px-4 py-3 text-gray-400">{creator.department || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{creator.user_email}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-purple/20 text-accent-purple">
                            {creator.ticket_count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Заявки по срокам выполнения */}
          <div className="glass-card p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Заявки по срокам выполнения
            </h3>
            {reportData.resolution_details.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-600/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Заявка</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Приоритет</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Создана</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Время выполнения</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Исполнитель</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.resolution_details.map((ticket) => (
                      <tr
                        key={ticket.id}
                        onClick={() => navigate("/it/tickets")}
                        className="border-t border-dark-700/50 cursor-pointer hover:bg-dark-700/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="max-w-xs">
                            <div className="font-medium text-accent-purple truncate hover:underline">
                              {ticket.title}
                            </div>
                            <div className="text-xs text-gray-500">{ticket.creator_name}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {categoryLabel[ticket.category] || ticket.category}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${priorityBadgeClass[ticket.priority] || "bg-dark-600"}`}
                          >
                            {priorityLabel[ticket.priority] || ticket.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusBadgeClass[ticket.status] || "bg-dark-600"}`}
                          >
                            {statusLabel[ticket.status] || ticket.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {ticket.created_at
                            ? new Date(ticket.created_at).toLocaleDateString("ru-RU")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${
                              ticket.resolution_time_hours != null && ticket.resolution_time_hours > 48
                                ? "text-red-400"
                                : ticket.resolution_time_hours != null && ticket.resolution_time_hours > 24
                                  ? "text-orange-400"
                                  : "text-green-400"
                            }`}
                          >
                            {formatResolutionTime(ticket.resolution_time_hours)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {ticket.assignee_name || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">Нет данных за выбранный период</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
