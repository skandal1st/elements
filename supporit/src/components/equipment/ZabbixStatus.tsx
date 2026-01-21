import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, FileText, AlertCircle, Droplets } from 'lucide-react';
import { zabbixService } from '../../services/zabbix.service';
import type { ZabbixEquipmentStatus, ZabbixEquipmentCounters } from '../../types';

// Цвета для расходников
const supplyColors: Record<string, string> = {
  black: 'bg-gray-800',
  cyan: 'bg-cyan-500',
  magenta: 'bg-pink-500',
  yellow: 'bg-yellow-400',
};

const getSupplyColorClass = (color?: string): string => {
  if (color && supplyColors[color]) {
    return supplyColors[color];
  }
  return 'bg-blue-500';
};

interface ZabbixStatusProps {
  equipmentId: string;
  category: string;
  ipAddress?: string;
  compact?: boolean;
}

export const ZabbixStatus = ({ equipmentId, category, ipAddress, compact = false }: ZabbixStatusProps) => {
  const [status, setStatus] = useState<ZabbixEquipmentStatus | null>(null);
  const [counters, setCounters] = useState<ZabbixEquipmentCounters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await zabbixService.getEquipmentStatus(equipmentId);
      if (err) {
        setError(err.message);
      } else if (data) {
        setStatus(data);

        // Если это принтер и найден в Zabbix, загружаем счётчики
        if (category === 'printer' && data.found) {
          const { data: countersData } = await zabbixService.getEquipmentCounters(equipmentId);
          if (countersData) {
            setCounters(countersData);
          }
        }
      }
    } catch (e) {
      setError('Ошибка загрузки статуса');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ipAddress) {
      loadStatus();
    } else {
      setLoading(false);
      setStatus({ found: false, reason: 'no_ip', message: 'IP не указан' });
    }
  }, [equipmentId, ipAddress, category]);

  // Компактный вид для таблицы
  if (compact) {
    if (loading) {
      return <span className="text-gray-400 text-sm">...</span>;
    }

    if (!ipAddress) {
      return <span className="text-gray-400 text-sm">—</span>;
    }

    if (error) {
      return (
        <span title={error}>
          <AlertCircle className="h-4 w-4 text-red-500" />
        </span>
      );
    }

    if (!status?.found) {
      return (
        <span className="text-gray-400 text-sm" title="Не в Zabbix">
          —
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1">
        {status.available ? (
          <span title="Online">
            <Wifi className="h-4 w-4 text-green-500" />
          </span>
        ) : (
          <span title="Offline">
            <WifiOff className="h-4 w-4 text-red-500" />
          </span>
        )}
        {counters?.counters?.total !== null && counters?.counters?.total !== undefined && (
          <span className="text-xs text-gray-500" title="Счётчик страниц">
            {counters.counters.total.toLocaleString()}
          </span>
        )}
      </div>
    );
  }

  // Полный вид для карточки/формы
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          Мониторинг Zabbix
        </h4>
        <button
          onClick={loadStatus}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Обновить"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : !ipAddress ? (
        <div className="text-sm text-gray-500">
          Для мониторинга укажите IP-адрес устройства
        </div>
      ) : !status?.found ? (
        <div className="text-sm text-yellow-600 dark:text-yellow-400">
          Устройство не найдено в Zabbix
        </div>
      ) : (
        <div className="space-y-3">
          {/* Статус доступности */}
          <div className="flex items-center gap-2">
            {status.available ? (
              <>
                <Wifi className="h-5 w-5 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">Offline</span>
              </>
            )}
            <span className="text-xs text-gray-400">({status.hostname})</span>
          </div>

          {/* Счётчики страниц для принтеров */}
          {category === 'printer' && counters?.found && counters.counters && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Счётчики страниц
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {counters.counters.total !== null && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Всего</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {counters.counters.total.toLocaleString()}
                    </div>
                  </div>
                )}
                {counters.counters.black !== null && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Ч/Б</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {counters.counters.black.toLocaleString()}
                    </div>
                  </div>
                )}
                {counters.counters.color !== null && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Цвет</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {counters.counters.color.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Уровень расходников (тонер/чернила) */}
          {category === 'printer' && counters?.found && counters.supplies && counters.supplies.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Уровень расходников
                </span>
              </div>
              <div className="space-y-2">
                {counters.supplies.map((supply, index) => {
                  const percent = supply.percent ?? (supply.level !== null && supply.maxLevel !== null
                    ? Math.round((supply.level / supply.maxLevel) * 100)
                    : null);

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[150px]" title={supply.name}>
                          {supply.color ? supply.color.charAt(0).toUpperCase() + supply.color.slice(1) : supply.name}
                        </span>
                        {percent !== null && (
                          <span className="text-gray-700 dark:text-gray-300 font-medium">
                            {percent}%
                          </span>
                        )}
                      </div>
                      {percent !== null && (
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getSupplyColorClass(supply.color)}`}
                            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
