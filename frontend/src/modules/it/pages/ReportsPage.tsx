import { useEffect, useState } from "react";
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Star,
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
};

const categoryLabel: Record<string, string> = {
  hardware: "Оборудование",
  software: "ПО",
  network: "Сеть",
  hr: "HR",
  other: "Прочее",
};

const priorityLabel: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

const getDatePresets = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1,
  );
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const startOfLastWeek = new Date(today);
  startOfLastWeek.setDate(today.getDate() - 7);

  return {
    week: {
      from: startOfLastWeek.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    },
    month: {
      from: startOfMonth.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    },
    lastMonth: {
      from: startOfLastMonth.toISOString().split("T")[0],
      to: endOfLastMonth.toISOString().split("T")[0],
    },
    year: {
      from: startOfYear.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    },
  };
};

export function ReportsPage() {
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
    setDateFrom(preset.from);
    setDateTo(preset.to);
    setActivePreset(presetKey);
  };

  const formatHours = (hours: number | null) => {
    if (hours === null) return "—";
    if (hours < 24) return `${hours.toFixed(1)} ч`;
    return `${(hours / 24).toFixed(1)} дн`;
  };

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <h2 className="text-2xl font-bold text-white mb-1">Отчеты</h2>
        <p className="text-gray-400">Статистика по заявкам IT-отдела</p>
      </div>

      {/* Фильтры */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["week", "month", "lastMonth", "year"] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetClick(preset)}
              className={`px-4 py-2 text-sm rounded-xl transition-all ${
                activePreset === preset
                  ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/30"
                  : "bg-dark-700/50 text-gray-400 border border-dark-600/50 hover:text-white hover:border-dark-500"
              }`}
            >
              {preset === "week" && "Неделя"}
              {preset === "month" && "Месяц"}
              {preset === "lastMonth" && "Прошлый месяц"}
              {preset === "year" && "Год"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">От</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset(""); }}
              className="glass-input w-full px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">До</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset(""); }}
              className="glass-input w-full px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Категория</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="glass-input w-full px-4 py-3 text-sm">
              <option value="" className="bg-dark-800">Все</option>
              {Object.keys(categoryLabel).map((c) => (
                <option key={c} value={c} className="bg-dark-800">{categoryLabel[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Приоритет</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="glass-input w-full px-4 py-3 text-sm">
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
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      )}

      {!loading && reportData && (
        <div className="space-y-6">
          {/* Сводная статистика */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-accent-purple" />
                <span className="text-sm text-gray-600">Всего</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {reportData.summary.total_tickets}
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-gray-600">Открытые</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {reportData.summary.open_tickets}
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-600">Решены</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {reportData.summary.resolved_tickets}
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600">Закрыты</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {reportData.summary.closed_tickets}
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-gray-400">Среднее время</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {formatHours(reportData.summary.avg_resolution_time_hours)}
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="text-sm text-gray-400">Средний рейтинг</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {reportData.summary.avg_rating
                  ? reportData.summary.avg_rating.toFixed(1)
                  : "—"}
              </div>
            </div>
          </div>

          {/* Статистика по статусам и категориям */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold text-white mb-4">
                По статусам
              </h3>
              <div className="space-y-2">
                {reportData.by_status.map((item) => (
                  <div
                    key={item.status}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm text-gray-400">
                      {statusLabel[item.status] || item.status}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold text-white mb-4">
                По категориям
              </h3>
              <div className="space-y-2">
                {reportData.by_category.map((item) => (
                  <div
                    key={item.category}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm text-gray-400">
                      {categoryLabel[item.category] || item.category}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Топ пользователей */}
          {reportData.top_creators.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Топ пользователей по количеству заявок
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-600/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Отдел</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Заявок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.top_creators.map((creator) => (
                      <tr
                        key={creator.user_id}
                        className="border-t border-dark-700/50"
                      >
                        <td className="px-4 py-3 text-white">{creator.user_name}</td>
                        <td className="px-4 py-3 text-gray-400">{creator.department || "—"}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-300">{creator.ticket_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
