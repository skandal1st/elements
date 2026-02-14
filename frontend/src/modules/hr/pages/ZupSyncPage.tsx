import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, Database } from "lucide-react";
import { apiGet, apiPost } from "../../../shared/api/client";

type ZupStatus = {
  configured: boolean;
  enabled: boolean;
  last_sync: string | null;
  last_sync_result: {
    timestamp?: string;
    departments?: { created: number; updated: number; errors: number };
    positions?: { created: number; updated: number; errors: number };
    employees?: {
      created: number;
      updated: number;
      errors: number;
      hired: number;
      fired: number;
      position_changed: number;
    };
    error_details?: string[];
  } | null;
  sync_interval_minutes: number;
};

export function ZupSyncPage() {
  const [status, setStatus] = useState<ZupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ZupStatus>("/hr/integrations/zup/status");
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

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPost("/hr/integrations/zup/sync", {});
      setSuccess("Синхронизация выполнена успешно");
      // Перезагружаем статус
      await loadStatus();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Никогда";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("ru-RU");
    } catch {
      return dateStr;
    }
  };

  const r = status?.last_sync_result;
  const emp = r?.employees;

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center gap-3">
          <Database className="w-7 h-7 text-accent-purple" />
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Синхронизация с 1С ЗУП</h2>
            <p className="text-gray-400">Односторонняя синхронизация сотрудников, отделов и должностей</p>
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Статус подключения */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Статус интеграции</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                {status?.configured ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <div className="text-sm text-gray-400">Настроено</div>
                  <div className="text-white font-medium">
                    {status?.configured ? "Да" : "Нет"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {status?.enabled ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                )}
                <div>
                  <div className="text-sm text-gray-400">Включено</div>
                  <div className="text-white font-medium">
                    {status?.enabled ? "Да" : "Нет"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-400">Интервал</div>
                  <div className="text-white font-medium">
                    {status?.sync_interval_minutes ?? 60} мин.
                  </div>
                </div>
              </div>
            </div>

            {!status?.configured && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
                Интеграция не настроена. Перейдите в Настройки &rarr; 1С ЗУП для настройки подключения.
              </div>
            )}
          </div>

          {/* Последняя синхронизация */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Последняя синхронизация</h3>
              <button
                onClick={runSync}
                disabled={syncing || !status?.configured}
                className="glass-button flex items-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Синхронизация...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Синхронизировать сейчас
                  </>
                )}
              </button>
            </div>

            <div className="text-sm text-gray-400 mb-4">
              Время: <span className="text-white">{formatDate(status?.last_sync ?? null)}</span>
            </div>

            {r ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Отделы */}
                <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600/50">
                  <div className="text-sm text-gray-400 mb-2">Отделы</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Создано:</span>
                      <span className="text-green-400">{r.departments?.created ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Обновлено:</span>
                      <span className="text-blue-400">{r.departments?.updated ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ошибки:</span>
                      <span className={r.departments?.errors ? "text-red-400" : "text-gray-500"}>{r.departments?.errors ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Должности */}
                <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600/50">
                  <div className="text-sm text-gray-400 mb-2">Должности</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Создано:</span>
                      <span className="text-green-400">{r.positions?.created ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Обновлено:</span>
                      <span className="text-blue-400">{r.positions?.updated ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ошибки:</span>
                      <span className={r.positions?.errors ? "text-red-400" : "text-gray-500"}>{r.positions?.errors ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Сотрудники */}
                <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600/50">
                  <div className="text-sm text-gray-400 mb-2">Сотрудники</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Создано:</span>
                      <span className="text-green-400">{emp?.created ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Обновлено:</span>
                      <span className="text-blue-400">{emp?.updated ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ошибки:</span>
                      <span className={emp?.errors ? "text-red-400" : "text-gray-500"}>{emp?.errors ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Кадровые события */}
                {(emp?.hired || emp?.fired || emp?.position_changed) ? (
                  <div className="md:col-span-3 p-4 rounded-lg bg-dark-700/50 border border-dark-600/50">
                    <div className="text-sm text-gray-400 mb-2">Кадровые события (HR-заявки и IT-тикеты)</div>
                    <div className="flex flex-wrap gap-6 text-sm">
                      {emp?.hired ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-400" />
                          <span className="text-gray-400">Приём на работу:</span>
                          <span className="text-green-400 font-medium">{emp.hired}</span>
                        </div>
                      ) : null}
                      {emp?.fired ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-400" />
                          <span className="text-gray-400">Увольнение:</span>
                          <span className="text-red-400 font-medium">{emp.fired}</span>
                        </div>
                      ) : null}
                      {emp?.position_changed ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-gray-400">Смена должности:</span>
                          <span className="text-amber-400 font-medium">{emp.position_changed}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* Ошибки */}
                {r.error_details && r.error_details.length > 0 && (
                  <div className="md:col-span-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-sm text-red-400 mb-2">Ошибки синхронизации:</div>
                    <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
                      {r.error_details.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-60" />
                <p>Синхронизация ещё не выполнялась</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
