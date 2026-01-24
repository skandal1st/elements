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
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Отчеты</h2>
        <p className="text-sm text-gray-500">
          Статистика по заявкам IT-отдела.
        </p>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePresetClick("week")}
            className={`px-3 py-1 text-sm rounded-lg ${
              activePreset === "week"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Неделя
          </button>
          <button
            onClick={() => handlePresetClick("month")}
            className={`px-3 py-1 text-sm rounded-lg ${
              activePreset === "month"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Месяц
          </button>
          <button
            onClick={() => handlePresetClick("lastMonth")}
            className={`px-3 py-1 text-sm rounded-lg ${
              activePreset === "lastMonth"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Прошлый месяц
          </button>
          <button
            onClick={() => handlePresetClick("year")}
            className={`px-3 py-1 text-sm rounded-lg ${
              activePreset === "year"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Год
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">От</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActivePreset("");
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">До</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActivePreset("");
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Категория
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">Все</option>
              {Object.keys(categoryLabel).map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Приоритет
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">Все</option>
              {Object.keys(priorityLabel).map((p) => (
                <option key={p} value={p}>
                  {priorityLabel[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && <p className="text-sm text-gray-500">Загрузка отчета…</p>}

      {!loading && reportData && (
        <div className="space-y-6">
          {/* Сводная статистика */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-600">Всего</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {reportData.summary.total_tickets}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-gray-600">Открытые</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {reportData.summary.open_tickets}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-gray-600">Решены</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {reportData.summary.resolved_tickets}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600">Закрыты</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {reportData.summary.closed_tickets}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-gray-600">Среднее время</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatHours(reportData.summary.avg_resolution_time_hours)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="text-sm text-gray-600">Средний рейтинг</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {reportData.summary.avg_rating
                  ? reportData.summary.avg_rating.toFixed(1)
                  : "—"}
              </div>
            </div>
          </div>

          {/* Статистика по статусам и категориям */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                По статусам
              </h3>
              <div className="space-y-2">
                {reportData.by_status.map((item) => (
                  <div
                    key={item.status}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm text-gray-700">
                      {statusLabel[item.status] || item.status}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                По категориям
              </h3>
              <div className="space-y-2">
                {reportData.by_category.map((item) => (
                  <div
                    key={item.category}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm text-gray-700">
                      {categoryLabel[item.category] || item.category}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Топ пользователей */}
          {reportData.top_creators.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Топ пользователей по количеству заявок
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">
                        Пользователь
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">
                        Отдел
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-700">
                        Заявок
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.top_creators.map((creator) => (
                      <tr
                        key={creator.user_id}
                        className="border-t border-gray-100"
                      >
                        <td className="px-4 py-2">{creator.user_name}</td>
                        <td className="px-4 py-2 text-gray-600">
                          {creator.department || "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {creator.ticket_count}
                        </td>
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
