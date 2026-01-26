import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Check,
  Trash2,
  X,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  notificationsService,
  type Notification,
} from "../../services/notifications.service";

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return then.toLocaleDateString("ru-RU");
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const result = await notificationsService.getNotifications(false, 20, 0);
      if (!result.error) {
        setNotifications(result.data);
        setUnreadCount(result.unread_count);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    const result = await notificationsService.getUnreadCount();
    if (!result.error) setUnreadCount(result.count);
  };

  useEffect(() => {
    loadUnreadCount();
    const t = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [isOpen]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationsService.markAsRead(id);
    loadNotifications();
    loadUnreadCount();
  };

  const handleMarkAllAsRead = async () => {
    await notificationsService.markAllAsRead();
    loadNotifications();
    loadUnreadCount();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationsService.deleteNotification(id);
    loadNotifications();
    loadUnreadCount();
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) {
      notificationsService.markAsRead(n.id);
      loadUnreadCount();
    }
    if (n.related_type && n.related_id) {
      setIsOpen(false);
      if (n.related_type === "ticket") navigate("/it/tickets");
      else if (n.related_type === "equipment") navigate("/it/equipment");
      else if (n.related_type === "consumable") navigate("/it/consumables");
    }
  };

  const icon = (type: Notification["type"]) => {
    const c = "h-5 w-5 flex-shrink-0";
    switch (type) {
      case "success":
        return <CheckCircle className={`${c} text-green-500`} />;
      case "error":
        return <AlertCircle className={`${c} text-red-500`} />;
      case "warning":
        return <AlertTriangle className={`${c} text-yellow-500`} />;
      default:
        return <Info className={`${c} text-blue-400`} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all cursor-pointer"
        title="Уведомления"
        aria-label="Уведомления"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent-purple rounded-full pointer-events-none" />
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[28rem] flex flex-col bg-dark-800 rounded-xl shadow-xl border border-dark-600 z-50">
          <div className="flex items-center justify-between p-4 border-b border-dark-600">
            <h3 className="text-lg font-semibold text-white">Уведомления</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-accent-purple hover:underline"
                >
                  Прочитать все
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Нет уведомлений</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(n)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleNotificationClick(n)
                  }
                  className={`p-4 border-b border-dark-700 cursor-pointer transition-colors hover:bg-dark-700/50 ${
                    !n.is_read ? "bg-accent-purple/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {icon(n.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">
                        {n.title}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimeAgo(n.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          className="p-1.5 text-accent-purple hover:bg-accent-purple/20 rounded-lg"
                          title="Отметить как прочитанное"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(n.id, e)}
                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
