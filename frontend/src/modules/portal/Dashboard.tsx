import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Bell,
  Users,
  Ticket,
  Server,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  Zap,
  BarChart3,
  Activity,
} from "lucide-react";
import { useUIStore } from "../../shared/store/ui.store";
import { formatRelative } from "../../shared/utils/formatRelative";

interface Birthday {
  id: number;
  name: string;
  date: string;
  days_left: number;
  department?: string;
}

interface Announcement {
  id: number;
  title: string;
  date: string;
}

interface Stats {
  employees_count: number;
  active_tickets: number;
  equipment_in_use: number;
  devices_online?: number | null;
}

interface DashboardData {
  birthdays: Birthday[];
  announcements: Announcement[];
  stats: Stats;
  available_modules: string[];
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const lastEmailCheckAt = useUIStore((s) => s.lastEmailCheckAt);
  const [, setTick] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/v1/portal/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"></div>
          <p className="text-gray-400">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <Zap className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-lg text-red-400">Ошибка загрузки данных</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 glass-button text-sm"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      label: "Сотрудников",
      value: data.stats.employees_count,
      icon: Users,
      trend: "+12%",
      trendUp: true,
      color: "purple",
    },
    {
      label: "Активных заявок",
      value: data.stats.active_tickets,
      icon: Ticket,
      trend: "-5%",
      trendUp: false,
      color: "blue",
    },
    {
      label: "Оборудования",
      value: data.stats.equipment_in_use,
      icon: Server,
      trend: "+3%",
      trendUp: true,
      color: "cyan",
    },
    {
      label: "Устройств онлайн",
      value: data.stats.devices_online != null ? String(data.stats.devices_online) : "—",
      icon: Activity,
      trend: undefined,
      trendUp: undefined,
      color: "green",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Добро пожаловать в Elements Platform
            </h1>
            <p className="text-gray-400">
              Обзор ключевых показателей и активности вашей организации
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Последнее обновление: {formatRelative(lastEmailCheckAt)}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          const isPrimary = index === 0;

          return (
            <div
              key={stat.label}
              className={`${isPrimary ? "glass-card-purple" : "glass-card"} p-5 group hover:shadow-card-hover transition-all duration-300`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    stat.color === "purple"
                      ? "bg-accent-purple/20"
                      : stat.color === "blue"
                        ? "bg-accent-blue/20"
                        : stat.color === "cyan"
                          ? "bg-accent-cyan/20"
                          : "bg-green-500/20"
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 ${
                      stat.color === "purple"
                        ? "text-accent-purple"
                        : stat.color === "blue"
                          ? "text-accent-blue"
                          : stat.color === "cyan"
                            ? "text-accent-cyan"
                            : "text-green-400"
                    }`}
                  />
                </div>
                {stat.trend != null && (
                  <div
                    className={`flex items-center gap-1 text-sm ${
                      stat.trendUp ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {stat.trendUp ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span>{stat.trend}</span>
                  </div>
                )}
              </div>
              <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Birthdays */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-purple/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-accent-purple" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                Ближайшие дни рождения
              </h2>
            </div>
            <Link
              to="/hr/birthdays"
              className="text-sm text-accent-purple hover:text-accent-violet flex items-center gap-1 transition-colors"
            >
              Все <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {data.birthdays.length > 0 ? (
            <div className="space-y-3">
              {data.birthdays.slice(0, 5).map((birthday, index) => (
                <div
                  key={birthday.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    index === 0
                      ? "bg-gradient-to-r from-accent-purple/10 to-transparent border border-accent-purple/20"
                      : "bg-dark-700/30 hover:bg-dark-700/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold ${
                        index === 0
                          ? "bg-accent-purple/20 text-accent-purple"
                          : "bg-dark-600/50 text-gray-400"
                      }`}
                    >
                      {birthday.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{birthday.name}</p>
                      {birthday.department && (
                        <p className="text-sm text-gray-500">
                          {birthday.department}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {new Date(birthday.date).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    <p
                      className={`text-xs ${birthday.days_left === 0 ? "text-accent-purple" : "text-gray-500"}`}
                    >
                      {birthday.days_left === 0
                        ? "Сегодня!"
                        : `через ${birthday.days_left} дн.`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400">Ближайших дней рождения нет</p>
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                Важные объявления
              </h2>
            </div>
          </div>

          {data.announcements.length > 0 ? (
            <div className="space-y-3">
              {data.announcements.map((announcement, index) => (
                <div
                  key={announcement.id}
                  className={`p-4 rounded-xl border-l-2 ${
                    index === 0
                      ? "bg-yellow-500/10 border-yellow-400"
                      : "bg-dark-700/30 border-dark-500 hover:bg-dark-700/50"
                  } transition-all`}
                >
                  <p className="font-medium text-white mb-1">
                    {announcement.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(announcement.date).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400">Нет активных объявлений</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent-indigo/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-accent-indigo" />
          </div>
          <h2 className="text-lg font-semibold text-white">Быстрый доступ</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.available_modules?.includes("hr") && (
            <Link
              to="/hr"
              className="group p-5 rounded-xl bg-dark-700/30 border border-dark-600/50 hover:border-accent-purple/30 hover:bg-dark-700/50 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-accent-purple/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-accent-purple" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-accent-purple group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-semibold text-white mb-1">HR</h3>
              <p className="text-sm text-gray-500">Управление кадрами</p>
            </Link>
          )}

          {data.available_modules?.includes("it") && (
            <Link
              to="/it"
              className="group p-5 rounded-xl bg-dark-700/30 border border-dark-600/50 hover:border-accent-blue/30 hover:bg-dark-700/50 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-accent-blue/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Server className="w-6 h-6 text-accent-blue" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-accent-blue group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-semibold text-white mb-1">IT</h3>
              <p className="text-sm text-gray-500">Учет оборудования и заявки</p>
            </Link>
          )}

        </div>
      </div>
    </div>
  );
}
