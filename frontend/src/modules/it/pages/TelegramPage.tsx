import { useEffect, useState } from "react";
import {
  MessageCircle,
  Link2,
  Unlink,
  Bell,
  BellOff,
  Send,
  Loader2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { apiGet, apiPost, apiPut } from "../../../shared/api/client";

type TelegramStatus = {
  enabled: boolean;
  connected: boolean;
  bot_username: string | null;
  user_linked: boolean;
  telegram_username: string | null;
  notifications_enabled: boolean;
};

type LinkCode = {
  code: string;
  expires_at: string;
  bot_username: string;
};

export function TelegramPage() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [linkCode, setLinkCode] = useState<LinkCode | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [togglingNotifications, setTogglingNotifications] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<TelegramStatus>("/it/telegram/status");
      setStatus(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const generateCode = async () => {
    setGeneratingCode(true);
    setError(null);
    try {
      const data = await apiPost<LinkCode>("/it/telegram/generate-link-code");
      setLinkCode(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeneratingCode(false);
    }
  };

  const unlinkTelegram = async () => {
    if (!window.confirm("Отвязать Telegram аккаунт? Вы перестанете получать уведомления.")) return;
    setUnlinking(true);
    setError(null);
    try {
      await apiPost("/it/telegram/unlink");
      setSuccess("Telegram аккаунт отвязан");
      setLinkCode(null);
      await loadStatus();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUnlinking(false);
    }
  };

  const toggleNotifications = async () => {
    if (!status) return;
    setTogglingNotifications(true);
    setError(null);
    try {
      await apiPut("/it/telegram/settings", {
        telegram_notifications: !status.notifications_enabled,
      });
      setStatus((prev) =>
        prev ? { ...prev, notifications_enabled: !prev.notifications_enabled } : prev
      );
      setSuccess(
        !status.notifications_enabled
          ? "Уведомления включены"
          : "Уведомления отключены"
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTogglingNotifications(false);
    }
  };

  const sendTestNotification = async () => {
    setSendingTest(true);
    setError(null);
    try {
      const result = await apiPost<{ success: boolean; message: string }>(
        "/it/telegram/test-notification"
      );
      setSuccess(result.message);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingTest(false);
    }
  };

  const copyCode = async () => {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(linkCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-7 h-7 text-accent-purple" />
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Telegram</h2>
            <p className="text-gray-400">
              Привяжите Telegram для получения уведомлений о заявках
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">{success}</p>
        </div>
      )}

      {/* Telegram отключен */}
      {status && !status.enabled && (
        <div className="glass-card p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Telegram интеграция отключена
              </h3>
              <p className="text-gray-400 text-sm">
                Интеграция с Telegram не активирована администратором.
                Обратитесь к администратору для подключения Telegram бота в
                настройках системы.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Не привязан */}
      {status && status.enabled && !status.user_linked && (
        <div className="glass-card p-6">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-6 h-6 text-accent-purple" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Привязка Telegram аккаунта
                </h3>
                <p className="text-gray-400 text-sm">
                  Привяжите свой Telegram аккаунт для получения уведомлений о
                  новых заявках, изменениях статуса и комментариях.
                </p>
              </div>
            </div>

            {!linkCode ? (
              <button
                onClick={generateCode}
                disabled={generatingCode}
                className="glass-button flex items-center gap-2 px-5 py-3 text-sm font-medium"
              >
                {generatingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                {generatingCode ? "Генерация кода..." : "Получить код привязки"}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-dark-700/50 border border-dark-600/50">
                  <p className="text-sm text-gray-400 mb-3">
                    Ваш код привязки:
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-mono font-bold text-white tracking-widest">
                      {linkCode.code}
                    </span>
                    <button
                      onClick={copyCode}
                      className="p-2 text-gray-400 hover:text-white hover:bg-dark-600/50 rounded-lg transition-all"
                      title="Скопировать код"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Код действителен 10 минут
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-accent-purple/5 border border-accent-purple/20">
                  <p className="text-sm text-gray-300 mb-3">
                    Инструкция по привязке:
                  </p>
                  <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                    <li>
                      Перейдите к боту в Telegram по ссылке ниже
                    </li>
                    <li>Нажмите «Start» / «Начать»</li>
                    <li>Бот автоматически привяжет ваш аккаунт</li>
                  </ol>
                  <a
                    href={`https://t.me/${linkCode.bot_username}?start=${linkCode.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-accent-purple hover:text-white bg-accent-purple/10 hover:bg-accent-purple/20 rounded-lg transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Открыть @{linkCode.bot_username}
                  </a>
                </div>

                <button
                  onClick={generateCode}
                  disabled={generatingCode}
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Сгенерировать новый код
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Привязан */}
      {status && status.enabled && status.user_linked && (
        <div className="space-y-4">
          {/* Информация об аккаунте */}
          <div className="glass-card p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  Telegram привязан
                </h3>
                <p className="text-gray-400 text-sm">
                  Аккаунт:{" "}
                  <span className="text-white font-medium">
                    @{status.telegram_username || "—"}
                  </span>
                </p>
              </div>
              <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
                Подключен
              </span>
            </div>
          </div>

          {/* Настройки уведомлений */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {status.notifications_enabled ? (
                  <Bell className="w-5 h-5 text-accent-purple" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <h4 className="text-sm font-medium text-white">
                    Уведомления
                  </h4>
                  <p className="text-xs text-gray-400">
                    {status.notifications_enabled
                      ? "Вы получаете уведомления в Telegram"
                      : "Уведомления в Telegram отключены"}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleNotifications}
                disabled={togglingNotifications}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  status.notifications_enabled
                    ? "bg-accent-purple"
                    : "bg-dark-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    status.notifications_enabled
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Действия */}
          <div className="glass-card p-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={sendTestNotification}
                disabled={sendingTest || !status.notifications_enabled}
                className="glass-button flex items-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingTest ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Тестовое уведомление
              </button>
              <button
                onClick={unlinkTelegram}
                disabled={unlinking}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all disabled:opacity-50"
              >
                {unlinking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                Отвязать Telegram
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
