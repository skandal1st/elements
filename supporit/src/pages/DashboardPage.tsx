import { useEffect, useState } from "react";
import {
  Package,
  Ticket,
  AlertCircle,
  Clock,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { equipmentService } from "../services/equipment.service";
import { ticketsService } from "../services/tickets.service";
import { useAuthStore } from "../store/auth.store";
import { useNavigate } from "react-router-dom";
import type { TicketStatus } from "../types";

interface DashboardStats {
  totalEquipment: number;
  equipmentInUse: number;
  equipmentInRepair: number;
  activeTickets: number;
  ticketsInProgress: number;
  ticketsResolved: number;
  criticalTickets: number;
}

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isEmployee = user?.role === "employee";

  // Если сотрудник попал на дашборд, перенаправляем на заявки
  useEffect(() => {
    if (isEmployee) {
      navigate("/tickets", { replace: true });
    }
  }, [isEmployee, navigate]);

  const [stats, setStats] = useState<DashboardStats>({
    totalEquipment: 0,
    equipmentInUse: 0,
    equipmentInRepair: 0,
    activeTickets: 0,
    ticketsInProgress: 0,
    ticketsResolved: 0,
    criticalTickets: 0,
  });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [criticalTicketsList, setCriticalTicketsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideClosedResolved, setHideClosedResolved] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Определяем, какие статусы исключить для критических заявок
        const excludeStatuses: TicketStatus[] = hideClosedResolved
          ? ["closed", "resolved"]
          : [];

        // Загружаем все оборудование для подсчета статистики
        const [
          allEquipment,
          inUseEquipment,
          inRepairEquipment,
          _allTickets,
          activeTickets,
          inProgressTickets,
          resolvedTickets,
          criticalTickets,
        ] = await Promise.all([
          equipmentService.getEquipment({}, 1, 1000), // Загружаем много для статистики
          equipmentService.getEquipment({ status: "in_use" }, 1, 1000),
          equipmentService.getEquipment({ status: "in_repair" }, 1, 1000),
          ticketsService.getTickets({}, 1, 1000), // Загружаем все заявки для статистики
          ticketsService.getTickets({ status: "new" }, 1, 1000), // Новые заявки
          ticketsService.getTickets({ status: "in_progress" }, 1, 1000), // В работе
          ticketsService.getTickets({ status: "resolved" }, 1, 1000), // Решенные
          ticketsService.getTickets(
            {
              priority: "critical",
              excludeStatuses:
                excludeStatuses.length > 0 ? excludeStatuses : undefined,
            },
            1,
            1000,
          ), // Критические (без закрытых/решённых по умолчанию)
        ]);

        // Активные заявки = новые + в работе + ожидание
        const waitingTickets = await ticketsService.getTickets(
          { status: "waiting" },
          1,
          1000,
        );
        const activeTicketsCount =
          (activeTickets.count || 0) +
          (inProgressTickets.count || 0) +
          (waitingTickets.count || 0);

        // Загружаем последние 5 заявок
        const recentTicketsResult = await ticketsService.getTickets({}, 1, 5);

        setStats({
          totalEquipment: allEquipment.count || 0,
          equipmentInUse: inUseEquipment.count || 0,
          equipmentInRepair: inRepairEquipment.count || 0,
          activeTickets: activeTicketsCount,
          ticketsInProgress: inProgressTickets.count || 0,
          ticketsResolved: resolvedTickets.count || 0,
          criticalTickets: criticalTickets.count || 0,
        });

        setRecentTickets(recentTicketsResult.data || []);
        setCriticalTicketsList(criticalTickets.data || []);
      } catch (error) {
        console.error("Ошибка загрузки статистики:", error);
        // В случае ошибки показываем нули
        setStats({
          totalEquipment: 0,
          equipmentInUse: 0,
          equipmentInRepair: 0,
          activeTickets: 0,
          ticketsInProgress: 0,
          ticketsResolved: 0,
          criticalTickets: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [hideClosedResolved]);

  const statCards = [
    {
      title: "Всего оборудования",
      value: stats.totalEquipment,
      icon: Package,
      color: "bg-blue-500",
    },
    {
      title: "В работе",
      value: stats.equipmentInUse,
      icon: CheckCircle,
      color: "bg-green-500",
    },
    {
      title: "В ремонте",
      value: stats.equipmentInRepair,
      icon: AlertCircle,
      color: "bg-yellow-500",
    },
    {
      title: "Активные заявки",
      value: stats.activeTickets,
      icon: Ticket,
      color: "bg-purple-500",
    },
    {
      title: "В работе",
      value: stats.ticketsInProgress,
      icon: Clock,
      color: "bg-indigo-500",
      subtitle: "заявок",
    },
    {
      title: "Критические заявки",
      value: stats.criticalTickets,
      icon: AlertCircle,
      color: "bg-red-500",
      subtitle: "требуют внимания",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Панель управления
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Обзор состояния ИТ-инфраструктуры
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {stat.value}
                  </p>
                  {stat.subtitle && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {stat.subtitle}
                    </p>
                  )}
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Critical Tickets Section */}
      {stats.criticalTickets > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-red-200 dark:border-red-900">
          <div className="p-6 border-b border-red-200 dark:border-red-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Критические заявки ({stats.criticalTickets})
                </h2>
              </div>
              <button
                onClick={() => setHideClosedResolved(!hideClosedResolved)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title={
                  hideClosedResolved
                    ? "Показать закрытые и решённые"
                    : "Скрыть закрытые и решённые"
                }
              >
                {hideClosedResolved ? (
                  <>
                    <Eye className="h-4 w-4" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Показать закрытые
                    </span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Скрыть закрытые
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {criticalTicketsList.map((ticket) => {
                const statusColors: Record<string, string> = {
                  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                  in_progress:
                    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                  waiting:
                    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
                  resolved:
                    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                  closed:
                    "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
                };
                const statusLabels: Record<string, string> = {
                  new: "Новая",
                  in_progress: "В работе",
                  waiting: "Ожидание",
                  resolved: "Решена",
                  closed: "Закрыта",
                };
                return (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {ticket.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(ticket.created_at).toLocaleDateString(
                          "ru-RU",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                        {ticket.assignee && (
                          <span className="ml-2">
                            • Исполнитель: {ticket.assignee.full_name}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`ml-3 px-2 py-1 text-xs font-semibold rounded-full ${statusColors[ticket.status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {statusLabels[ticket.status] || ticket.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Последние заявки
            </h2>
          </div>
          <div className="p-6">
            {recentTickets.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Нет заявок
              </div>
            ) : (
              <div className="space-y-4">
                {recentTickets.slice(0, 5).map((ticket) => {
                  const statusColors: Record<string, string> = {
                    new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                    in_progress:
                      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                    waiting:
                      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
                    resolved:
                      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                    closed:
                      "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
                  };
                  const statusLabels: Record<string, string> = {
                    new: "Новая",
                    in_progress: "В работе",
                    waiting: "Ожидание",
                    resolved: "Решена",
                    closed: "Закрыта",
                  };
                  return (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {ticket.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(ticket.created_at).toLocaleDateString(
                            "ru-RU",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      </div>
                      <span
                        className={`ml-3 px-2 py-1 text-xs font-semibold rounded-full ${statusColors[ticket.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {statusLabels[ticket.status] || ticket.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Equipment Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Статус оборудования
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  В работе
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {stats.equipmentInUse}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{
                    width: `${(stats.equipmentInUse / stats.totalEquipment) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  В ремонте
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {stats.equipmentInRepair}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{
                    width: `${(stats.equipmentInRepair / stats.totalEquipment) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
