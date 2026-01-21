import { useEffect, useState } from 'react';
import { Key, Calendar, DollarSign, Package, User, Monitor, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { licensesService } from '../../services/licenses.service';
import type { SoftwareLicense } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface LicenseDetailsModalProps {
  licenseId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const LicenseDetailsModal = ({ licenseId, isOpen, onClose, onUpdate }: LicenseDetailsModalProps) => {
  const [license, setLicense] = useState<SoftwareLicense | null>(null);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen && licenseId) {
      loadLicense();
    }
  }, [licenseId, isOpen]);

  const loadLicense = async () => {
    setLoading(true);
    try {
      const result = await licensesService.getLicenseById(licenseId);
      if (!result.error && result.data) {
        setLicense(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (assignmentId: string) => {
    if (!confirm('Освободить лицензию?')) return;

    const result = await licensesService.releaseLicense(licenseId, assignmentId);
    if (result.error) {
      alert('Ошибка: ' + result.error.message);
    } else {
      loadLicense();
      onUpdate();
    }
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={license?.software_name || 'Загрузка...'}
      size="xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : license ? (
        <div className="space-y-6">
          {/* Основная информация */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Поставщик */}
            {license.vendor && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Поставщик
                </label>
                <p className="text-sm text-gray-900 dark:text-white">{license.vendor}</p>
              </div>
            )}

            {/* Тип лицензии */}
            {license.license_type && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Тип лицензии
                </label>
                <p className="text-sm text-gray-900 dark:text-white">{license.license_type}</p>
              </div>
            )}

            {/* Использовано */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Package className="h-4 w-4 inline mr-1" />
                Использование
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {license.used_licenses} / {license.total_licenses}
                {license.available_licenses !== undefined && (
                  <span className="ml-2 text-gray-500 dark:text-gray-400">
                    (доступно: {license.available_licenses})
                  </span>
                )}
              </p>
            </div>

            {/* Срок действия */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar className="h-4 w-4 inline mr-1" />
                Срок действия
              </label>
              <p className={`text-sm ${isExpired(license.expires_at) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-900 dark:text-white'}`}>
                {license.expires_at ? (
                  <>
                    {new Date(license.expires_at).toLocaleDateString('ru-RU')}
                    {isExpired(license.expires_at) && ' (истек)'}
                  </>
                ) : (
                  'Бессрочно'
                )}
              </p>
            </div>

            {/* Дата покупки */}
            {license.purchase_date && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Дата покупки
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {new Date(license.purchase_date).toLocaleDateString('ru-RU')}
                </p>
              </div>
            )}

            {/* Стоимость */}
            {license.cost && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Стоимость
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {license.cost.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            )}
          </div>

          {/* Лицензионный ключ */}
          {license.license_key && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Key className="h-4 w-4 inline mr-1" />
                Лицензионный ключ
              </label>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono text-gray-900 dark:text-white break-all">
                    {showKey ? license.license_key : '••••••••••••••••••••'}
                  </code>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="ml-4 px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    {showKey ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Примечания */}
          {license.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Примечания
              </label>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {license.notes}
                </p>
              </div>
            </div>
          )}

          {/* Разделитель */}
          <div className="border-t border-gray-200 dark:border-gray-700"></div>

          {/* Назначения */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Назначения ({license.assignments?.length || 0})
              </h3>
            </div>

            {!license.assignments || license.assignments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                Лицензия не назначена
              </p>
            ) : (
              <div className="space-y-3">
                {license.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      {assignment.user_id && (
                        <div className="flex items-center text-sm">
                          <User className="h-4 w-4 mr-2 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {assignment.user_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {assignment.user_email}
                            </p>
                          </div>
                        </div>
                      )}
                      {assignment.equipment_id && (
                        <div className="flex items-center text-sm">
                          <Monitor className="h-4 w-4 mr-2 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {assignment.equipment_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {assignment.equipment_inventory_number}
                            </p>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Назначено {formatDistanceToNow(new Date(assignment.assigned_at), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRelease(assignment.id)}
                      className="ml-4 p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                      title="Освободить"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Лицензия не найдена</p>
        </div>
      )}
    </Modal>
  );
};
