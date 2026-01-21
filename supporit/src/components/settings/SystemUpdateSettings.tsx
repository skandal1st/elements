/**
 * System Update Settings Component
 * Компонент управления обновлениями системы
 */

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  History,
  RotateCcw,
  Key,
  Shield,
  Server,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  updateService,
  type UpdateInfo,
  type AvailableUpdate,
  type UpdateProgress,
  type UpdateHistoryItem,
} from '../../services/update.service';

export const SystemUpdateSettings = () => {
  // Состояния
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [history, setHistory] = useState<UpdateHistoryItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [currentUpdateId, setCurrentUpdateId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const [licenseKey, setLicenseKey] = useState('');
  const [savingLicense, setSavingLicense] = useState(false);

  // Загрузка данных при монтировании
  useEffect(() => {
    loadInfo();
  }, []);

  // Polling статуса обновления
  useEffect(() => {
    if (!updating || !currentUpdateId) return;

    const interval = setInterval(async () => {
      const result = await updateService.getUpdateStatus(currentUpdateId);
      if (result.data) {
        setUpdateProgress(result.data);

        if (result.data.status === 'completed') {
          setUpdating(false);
          setSuccess('Обновление успешно завершено! Страница будет перезагружена.');
          setTimeout(() => window.location.reload(), 3000);
        } else if (result.data.status === 'failed') {
          setUpdating(false);
          setError(result.data.message || 'Ошибка обновления');
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [updating, currentUpdateId]);

  const loadInfo = async () => {
    setLoading(true);
    const result = await updateService.getInfo();
    if (result.data) {
      setInfo(result.data);
    } else {
      setError(result.error || 'Ошибка загрузки информации');
    }
    setLoading(false);
  };

  const checkForUpdates = async () => {
    setChecking(true);
    setError(null);
    setAvailableUpdate(null);

    const result = await updateService.checkForUpdates();

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      if (result.data.available && result.data.update) {
        setAvailableUpdate(result.data.update);
        if (!result.data.licenseAllowed) {
          setError(result.data.licenseMessage || 'Обновление недоступно по лицензии');
        }
      } else {
        setSuccess(result.data.message || 'Система обновлена до последней версии');
        setTimeout(() => setSuccess(null), 5000);
      }
    }

    setChecking(false);
  };

  const startUpdate = async () => {
    if (!availableUpdate) return;

    setShowConfirmModal(false);
    setUpdating(true);
    setError(null);
    setUpdateProgress(null);

    const result = await updateService.startUpdate(
      availableUpdate.version,
      availableUpdate.downloadUrl
    );

    if (result.error) {
      setError(result.error);
      setUpdating(false);
    } else if (result.data) {
      setCurrentUpdateId(result.data.updateId);
      setUpdateProgress({
        status: 'started',
        progress: 5,
        message: 'Начало обновления...',
      });
    }
  };

  const loadHistory = async () => {
    const result = await updateService.getHistory();
    if (result.data) {
      setHistory(result.data);
    }
    setShowHistoryModal(true);
  };

  const saveLicense = async () => {
    if (!licenseKey.trim()) return;

    setSavingLicense(true);
    setError(null);

    const result = await updateService.saveLicense(licenseKey.trim());

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSuccess(result.data.message);
      setShowLicenseModal(false);
      setLicenseKey('');
      loadInfo(); // Перезагружаем информацию
      setTimeout(() => setSuccess(null), 5000);
    }

    setSavingLicense(false);
  };

  const rollback = async (updateId: string) => {
    if (!confirm('Вы уверены, что хотите откатить это обновление?')) return;

    const result = await updateService.rollbackUpdate(updateId);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Откат выполнен успешно');
      setShowHistoryModal(false);
      loadInfo();
    }
  };

  // Хелперы
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      case 'rolled_back':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      started: 'Начато',
      downloading: 'Скачивание',
      backing_up: 'Резервное копирование',
      migrating: 'Миграция БД',
      deploying: 'Развертывание',
      completed: 'Завершено',
      failed: 'Ошибка',
      rolled_back: 'Откачено',
    };
    return map[status] || status;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ru-RU');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Обновление системы
        </h2>
        <Button variant="secondary" size="sm" onClick={loadHistory}>
          <History className="h-4 w-4 mr-2" />
          История
        </Button>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-red-600 hover:text-red-800 mt-1"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Успех */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
          <p className="text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Информация о системе */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Текущая версия */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center mb-2">
            <Server className="h-5 w-5 text-gray-400 mr-2" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Текущая версия</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            v{info?.system.currentVersion || '-'}
          </p>
          {info?.system.lastUpdateAt && (
            <p className="text-xs text-gray-500 mt-1">
              Обновлено: {formatDate(info.system.lastUpdateAt)}
            </p>
          )}
        </div>

        {/* Лицензия */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Лицензия</span>
            </div>
            <button
              onClick={() => setShowLicenseModal(true)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {info?.license.isValid ? 'Изменить' : 'Активировать'}
            </button>
          </div>
          {info?.license.isValid ? (
            <>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                {info.license.tier}
              </p>
              {info.license.validUntil && (
                <p className="text-xs text-gray-500 mt-1">
                  До: {formatDate(info.license.validUntil)}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg font-semibold text-gray-400">Не активирована</p>
          )}
        </div>
      </div>

      {/* Прогресс обновления */}
      {updateProgress && updating && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <RefreshCw className="h-5 w-5 text-blue-500 mr-2 animate-spin" />
            <span className="font-medium text-blue-700 dark:text-blue-400">
              {getStatusText(updateProgress.status)}
            </span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${updateProgress.progress}%` }}
            />
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-400">{updateProgress.message}</p>
        </div>
      )}

      {/* Доступное обновление */}
      {availableUpdate && !updating && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Download className="h-5 w-5 text-green-500 mr-2" />
              <span className="font-medium text-green-700 dark:text-green-400">
                Доступно обновление до v{availableUpdate.version}
              </span>
            </div>
            <span className="text-sm text-gray-500">
              {formatDate(availableUpdate.releaseDate)}
            </span>
          </div>

          {availableUpdate.changelog && (
            <div className="bg-white dark:bg-gray-800 rounded p-3 mb-3 max-h-32 overflow-y-auto">
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {availableUpdate.changelog}
              </p>
            </div>
          )}

          {availableUpdate.breaking && (
            <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded p-2 mb-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                ⚠️ Это обновление содержит критические изменения
              </p>
            </div>
          )}

          <Button onClick={() => setShowConfirmModal(true)} disabled={!info?.license.isValid}>
            <Download className="h-4 w-4 mr-2" />
            Установить обновление
          </Button>

          {!info?.license.isValid && (
            <p className="text-sm text-red-500 mt-2">
              Для обновления требуется активная лицензия
            </p>
          )}
        </div>
      )}

      {/* Кнопки действий */}
      <div className="flex gap-3">
        <Button onClick={checkForUpdates} disabled={checking || updating} variant="secondary">
          {checking ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Проверить обновления
        </Button>
      </div>

      {/* Последняя проверка */}
      {info?.system.lastUpdateCheck && (
        <p className="text-sm text-gray-500 flex items-center">
          <Clock className="h-4 w-4 mr-1" />
          Последняя проверка: {formatDate(info.system.lastUpdateCheck)}
        </p>
      )}

      {/* Модальное окно подтверждения */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Подтверждение обновления"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Вы собираетесь обновить систему с версии{' '}
            <strong>v{info?.system.currentVersion}</strong> до{' '}
            <strong>v{availableUpdate?.version}</strong>.
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              <strong>Внимание:</strong> Во время обновления система будет недоступна. Перед
              обновлением будет создана резервная копия.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
              Отмена
            </Button>
            <Button onClick={startUpdate}>Начать обновление</Button>
          </div>
        </div>
      </Modal>

      {/* Модальное окно истории */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="История обновлений"
        size="lg"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-8">История обновлений пуста</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      v{item.fromVersion} → v{item.toVersion}
                    </span>
                    <span className={`text-sm ${getStatusColor(item.status)}`}>
                      {getStatusText(item.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{formatDate(item.startedAt)}</p>
                  {item.errorMessage && (
                    <p className="text-sm text-red-500 mt-1">{item.errorMessage}</p>
                  )}
                </div>
                {item.status === 'completed' && item.backupPath && (
                  <Button size="sm" variant="secondary" onClick={() => rollback(item.id)}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Откат
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Модальное окно лицензии */}
      <Modal
        isOpen={showLicenseModal}
        onClose={() => setShowLicenseModal(false)}
        title="Активация лицензии"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Введите лицензионный ключ для активации продукта и получения обновлений.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Лицензионный ключ
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="SUPPORIT-PRO-20271231-UPD-XXXXXXXX"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {info?.license.isValid && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <p className="text-sm text-green-700 dark:text-green-400">
                Текущая лицензия: <strong>{info.license.tier}</strong>
                <br />
                Ключ: {info.license.licenseKey}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowLicenseModal(false)}>
              Отмена
            </Button>
            <Button onClick={saveLicense} disabled={!licenseKey.trim() || savingLicense}>
              {savingLicense ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              Активировать
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SystemUpdateSettings;
