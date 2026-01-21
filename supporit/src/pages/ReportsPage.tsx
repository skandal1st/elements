import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Calendar,
  Star,
} from "lucide-react";
import {
  reportsService,
  type TicketReportData,
  type ReportFilters,
} from "../services/reports.service";
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/Table";

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    hardware: "Оборудование",
    software: "ПО",
    network: "Сеть",
    hr: "HR / Кадры",
    other: "Прочее",
  };
  return labels[category] || category;
};

const getPriorityLabel = (priority: string): string => {
  const labels: Record<string, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return labels[priority] || priority;
};

const getPriorityColor = (priority: string): string => {
  const colors: Record<string, string> = {
    low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return colors[priority] || "";
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    new: "Новая",
    in_progress: "В работе",
    waiting: "Ожидание",
    resolved: "Решена",
    closed: "Закрыта",
    pending_user: "Требует пользователя",
  };
  return labels[status] || status;
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    in_progress:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    waiting:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    resolved:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    pending_user:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };
  return colors[status] || "";
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

function getDatePresets() {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  return {
    today: {
      label: "Сегодня",
      from: formatDate(today),
      to: formatDate(today),
    },
    week: {
      label: "Неделя",
      from: formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      to: formatDate(today),
    },
    month: {
      label: "Месяц",
      from: formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      to: formatDate(today),
    },
    quarter: {
      label: "Квартал",
      from: formatDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
      to: formatDate(today),
    },
  };
}

export const ReportsPage = () => {
  const navigate = useNavigate();
  const presets = getDatePresets();

  const [reportData, setReportData] = useState<TicketReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ReportFilters>({
    date_from: presets.month.from,
    date_to: presets.month.to,
  });

  const [activePreset, setActivePreset] = useState<string>("month");

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsService.getTicketReport(filters);
      if (result.error) {
        setError(result.error.message);
      } else {
        setReportData(result.data);
      }
    } catch (err) {
      setError("Произошла ошибка при загрузке отчёта");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handlePresetClick = (presetKey: string) => {
    const preset = presets[presetKey as keyof typeof presets];
    setFilters((prev) => ({
      ...prev,
      date_from: preset.from,
      date_to: preset.to,
    }));
    setActivePreset(presetKey);
  };

  const handleDateChange = (field: "date_from" | "date_to", value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setActivePreset("");
  };

  const handleFilterChange = (
    field: "category" | "priority",
    value: string
  ) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value === "all" ? undefined : value,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Отчёты
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Аналитика по заявкам
        </p>
      </div>

      {/* Фильтры */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col gap-4">
          {/* Пресеты периодов */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
              Период:
            </span>
            {Object.entries(presets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handlePresetClick(key)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  activePreset === key
                    ? "bg-primary-100 border-primary-300 text-primary-700 dark:bg-primary-900 dark:border-primary-700 dark:text-primary-300"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Даты и фильтры */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleDateChange("date_from", e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleDateChange("date_to", e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <select
              value={filters.category || "all"}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Все категории</option>
              <option value="hardware">Оборудование</option>
              <option value="software">ПО</option>
              <option value="network">Сеть</option>
              <option value="hr">HR / Кадры</option>
              <option value="other">Прочее</option>
            </select>

            <select
              value={filters.priority || "all"}
              onChange={(e) => handleFilterChange("priority", e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Все приоритеты</option>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
              <option value="critical">Критический</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Загрузка */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : reportData ? (
        <>
          {/* Карточки сводки */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Всего заявок
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.summary.total_tickets}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Открытые
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.summary.open_tickets}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Решено/Закрыто
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.summary.resolved_tickets +
                      reportData.summary.closed_tickets}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ср. время
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatResolutionTime(
                      reportData.summary.avg_resolution_time_hours
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <Star className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ср. оценка
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.summary.avg_rating
                      ? reportData.summary.avg_rating.toFixed(1)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Статистика по категориям и приоритетам */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* По категориям */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                По категориям
              </h3>
              <div className="space-y-3">
                {reportData.by_category.map((item) => (
                  <div key={item.category} className="flex items-center">
                    <span className="w-32 text-sm text-gray-600 dark:text-gray-400">
                      {getCategoryLabel(item.category)}
                    </span>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{
                          width: `${
                            reportData.summary.total_tickets > 0
                              ? (item.count /
                                  reportData.summary.total_tickets) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-medium text-gray-900 dark:text-white ml-2">
                      {item.count}
                    </span>
                  </div>
                ))}
                {reportData.by_category.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Нет данных
                  </p>
                )}
              </div>
            </div>

            {/* По приоритетам */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                По приоритетам
              </h3>
              <div className="space-y-3">
                {reportData.by_priority.map((item) => (
                  <div key={item.priority} className="flex items-center">
                    <span
                      className={`w-32 text-sm px-2 py-0.5 rounded ${getPriorityColor(
                        item.priority
                      )}`}
                    >
                      {getPriorityLabel(item.priority)}
                    </span>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.priority === "critical"
                            ? "bg-red-500"
                            : item.priority === "high"
                            ? "bg-orange-500"
                            : item.priority === "medium"
                            ? "bg-blue-500"
                            : "bg-gray-400"
                        }`}
                        style={{
                          width: `${
                            reportData.summary.total_tickets > 0
                              ? (item.count /
                                  reportData.summary.total_tickets) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-medium text-gray-900 dark:text-white ml-2">
                      {item.count}
                    </span>
                  </div>
                ))}
                {reportData.by_priority.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Нет данных
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Топ пользователей */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-gray-400 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Топ пользователей по количеству обращений
                </h3>
              </div>
            </div>
            {reportData.top_creators.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableHeaderCell>#</TableHeaderCell>
                  <TableHeaderCell>ФИО</TableHeaderCell>
                  <TableHeaderCell>Отдел</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Заявок</TableHeaderCell>
                </TableHeader>
                <TableBody>
                  {reportData.top_creators.map((creator, index) => (
                    <TableRow key={creator.user_id}>
                      <TableCell>
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            index === 0
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : index === 1
                              ? "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
                              : index === 2
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {creator.user_name}
                      </TableCell>
                      <TableCell>
                        {creator.department || (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500 dark:text-gray-400">
                        {creator.user_email}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                          {creator.ticket_count}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Нет данных за выбранный период
              </div>
            )}
          </div>

          {/* Таблица заявок по срокам */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-gray-400 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Заявки по срокам выполнения
                </h3>
              </div>
            </div>
            {reportData.resolution_details.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableHeaderCell>Заявка</TableHeaderCell>
                  <TableHeaderCell>Категория</TableHeaderCell>
                  <TableHeaderCell>Приоритет</TableHeaderCell>
                  <TableHeaderCell>Статус</TableHeaderCell>
                  <TableHeaderCell>Создана</TableHeaderCell>
                  <TableHeaderCell>Время выполнения</TableHeaderCell>
                  <TableHeaderCell>Исполнитель</TableHeaderCell>
                </TableHeader>
                <TableBody>
                  {reportData.resolution_details.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="max-w-xs">
                          <div className="font-medium text-primary-600 dark:text-primary-400 truncate hover:underline">
                            {ticket.title}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {ticket.creator_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getCategoryLabel(ticket.category)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(
                            ticket.priority
                          )}`}
                        >
                          {getPriorityLabel(ticket.priority)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            ticket.status
                          )}`}
                        >
                          {getStatusLabel(ticket.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(ticket.created_at).toLocaleDateString(
                          "ru-RU"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-medium ${
                            ticket.resolution_time_hours !== null &&
                            ticket.resolution_time_hours > 48
                              ? "text-red-600 dark:text-red-400"
                              : ticket.resolution_time_hours !== null &&
                                ticket.resolution_time_hours > 24
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {formatResolutionTime(ticket.resolution_time_hours)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {ticket.assignee_name || (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Нет данных за выбранный период
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
