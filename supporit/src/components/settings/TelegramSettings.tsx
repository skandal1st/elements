import { useState, useEffect } from 'react';
import { MessageCircle, Link2, Unlink, Bell, BellOff, Copy, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { telegramService, type TelegramStatus, type LinkCodeResponse, type BotInfo } from '../../services/telegram.service';

export const TelegramSettings = () => {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<LinkCodeResponse | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [togglingNotifications, setTogglingNotifications] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResult, botInfoResult] = await Promise.all([
        telegramService.getStatus(),
        telegramService.getBotInfo(),
      ]);

      if (statusResult.error) {
        setError(statusResult.error.message || 'Ошибка загрузки статуса');
      } else {
        setStatus(statusResult.data);
      }

      if (botInfoResult.data) {
        setBotInfo(botInfoResult.data);
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateLinkCode = async () => {
    setGeneratingCode(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await telegramService.generateLinkCode();
      if (result.error) {
        setError(result.error.message || 'Ошибка генерации кода');
      } else {
        setLinkCode(result.data);
      }
    } catch (err) {
      setError('Произошла ошибка при генерации кода');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Вы уверены, что хотите отвязать Telegram? Вы перестанете получать уведомления.')) {
      return;
    }

    setUnlinking(true);
    setError(null);

    try {
      const result = await telegramService.unlink();
      if (result.error) {
        setError(result.error.message || 'Ошибка отвязки');
      } else {
        setSuccess('Telegram успешно отвязан');
        setStatus(null);
        await loadData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError('Произошла ошибка при отвязке');
    } finally {
      setUnlinking(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (!status) return;

    setTogglingNotifications(true);
    setError(null);

    try {
      const result = await telegramService.updateSettings(!status.notifications_enabled);
      if (result.error) {
        setError(result.error.message || 'Ошибка обновления настроек');
      } else {
        setStatus({
          ...status,
          notifications_enabled: !status.notifications_enabled,
        });
        setSuccess(status.notifications_enabled ? 'Уведомления отключены' : 'Уведомления включены');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError('Произошла ошибка при обновлении настроек');
    } finally {
      setTogglingNotifications(false);
    }
  };

  const handleCopyCode = () => {
    if (!linkCode?.code) return;
    navigator.clipboard.writeText(`/link ${linkCode.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
          <MessageCircle className="h-5 w-5 mr-2 text-blue-500" />
          Telegram
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Привязка аккаунта Telegram для получения уведомлений
        </p>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : status?.linked ? (
          // Telegram привязан
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                <span className="font-medium text-green-800 dark:text-green-300">
                  Telegram привязан
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Telegram ID
                </label>
                <p className="mt-1 text-gray-900 dark:text-white font-mono">
                  {status.telegram_id}
                </p>
              </div>

              {status.telegram_username && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                    Username
                  </label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    @{status.telegram_username}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Дата привязки
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">
                  {formatDate(status.linked_at)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Уведомления
                </label>
                <p className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      status.notifications_enabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {status.notifications_enabled ? (
                      <>
                        <Bell className="h-3 w-3 mr-1" />
                        Включены
                      </>
                    ) : (
                      <>
                        <BellOff className="h-3 w-3 mr-1" />
                        Отключены
                      </>
                    )}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={handleToggleNotifications}
                disabled={togglingNotifications}
                variant="secondary"
              >
                {togglingNotifications ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : status.notifications_enabled ? (
                  <BellOff className="h-4 w-4 mr-2" />
                ) : (
                  <Bell className="h-4 w-4 mr-2" />
                )}
                {status.notifications_enabled ? 'Отключить уведомления' : 'Включить уведомления'}
              </Button>

              <Button
                onClick={handleUnlink}
                disabled={unlinking}
                variant="danger"
              >
                {unlinking ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Отвязать Telegram
              </Button>
            </div>
          </div>
        ) : (
          // Telegram не привязан
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <p className="text-gray-600 dark:text-gray-300">
                Telegram не привязан. Привяжите аккаунт, чтобы получать уведомления о новых заявках,
                изменениях статуса и комментариях.
              </p>
            </div>

            {!linkCode ? (
              <Button onClick={handleGenerateLinkCode} disabled={generatingCode}>
                {generatingCode ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Получить код привязки
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                    Инструкция по привязке:
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-300 text-sm">
                    <li>Откройте бота <strong>@{botInfo?.bot_username || linkCode?.bot_username || 'бота'}</strong> в Telegram</li>
                    <li>Отправьте боту команду:</li>
                  </ol>

                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 bg-white dark:bg-gray-800 px-4 py-2 rounded border border-blue-200 dark:border-blue-600 font-mono text-lg text-gray-900 dark:text-gray-100">
                      /link {linkCode.code}
                    </code>
                    <Button onClick={handleCopyCode} variant="secondary" size="sm">
                      {copied ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                    Код действителен до {formatDate(linkCode.expires_at)}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleGenerateLinkCode} variant="secondary" disabled={generatingCode}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${generatingCode ? 'animate-spin' : ''}`} />
                    Новый код
                  </Button>
                  <Button onClick={loadData} variant="secondary">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Проверить статус
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
