import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, Database, Search, Trash2 } from "lucide-react";
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

type DebugResult = {
  base_url?: string;
  configured_url?: string;
  root_status?: number;
  root_keys?: string[];
  root_text_preview?: string;
  root_content_type?: string;
  root_body_preview?: string;
  root_error?: string;
  available_entities?: string[] | string;
  entities_count?: number;
  catalogs?: Record<string, Record<string, {
    status?: number;
    count?: number;
    format?: string;
    content_type?: string;
    keys?: string[];
    sample?: Record<string, unknown>;
    error?: string;
    parse_error?: string;
    body_preview?: string;
  }>>;
  connection_error?: string;
  detail?: string;
  error?: string;
};

export function ZupSyncPage() {
  const [status, setStatus] = useState<ZupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [debugging, setDebugging] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    merged_duplicates: number;
    deleted_dismissed: number;
    deleted_hr_requests: number;
    deleted_tickets: number;
  } | null>(null);

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
      await loadStatus();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const runDebug = async () => {
    setDebugging(true);
    setError(null);
    setDebugResult(null);
    try {
      const data = await apiGet<DebugResult>("/hr/integrations/zup/debug");
      setDebugResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDebugging(false);
    }
  };

  const runCleanup = async () => {
    if (!confirm("Будут удалены дубли сотрудников, уволенные из ЗУП, HR-заявки на приём и тикеты онбординга, созданные сегодня. Продолжить?")) return;
    setCleaning(true);
    setError(null);
    setCleanupResult(null);
    try {
      const data = await apiPost<typeof cleanupResult>("/hr/integrations/zup/cleanup", {});
      setCleanupResult(data);
      setSuccess("Очистка завершена");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCleaning(false);
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

      {cleanupResult && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-300 font-medium mb-2">Результат очистки:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-400">Объединено дублей:</span>
            <span className="text-white">{cleanupResult.merged_duplicates}</span>
            <span className="text-gray-400">Удалено уволенных:</span>
            <span className="text-white">{cleanupResult.deleted_dismissed}</span>
            <span className="text-gray-400">Удалено HR-заявок:</span>
            <span className="text-white">{cleanupResult.deleted_hr_requests}</span>
            <span className="text-gray-400">Удалено тикетов онбординга:</span>
            <span className="text-white">{cleanupResult.deleted_tickets}</span>
          </div>
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
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={runCleanup}
                  disabled={cleaning}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {cleaning ? (
                    <>
                      <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      Очистка...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Очистка дублей
                    </>
                  )}
                </button>
                <button
                  onClick={runDebug}
                  disabled={debugging || !status?.configured}
                  className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  {debugging ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Проверка...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Диагностика
                    </>
                  )}
                </button>
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

          {/* Результат диагностики */}
          {debugResult && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Результат диагностики</h3>

              {(debugResult.connection_error || debugResult.error) && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-4">
                  {debugResult.connection_error && <>Ошибка подключения: {debugResult.connection_error}</>}
                  {debugResult.error && <>{debugResult.error}</>}
                  {debugResult.detail && <> ({debugResult.detail})</>}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">OData URL: <span className="text-white font-mono">{debugResult.base_url}</span></div>
                  {debugResult.configured_url && debugResult.configured_url !== debugResult.base_url && (
                    <div className="text-sm text-amber-400 mb-1">
                      URL из настроек автоскорректирован: <span className="font-mono line-through text-gray-500">{debugResult.configured_url}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-400">
                    Корневой запрос: <span className={debugResult.root_status === 200 ? "text-green-400" : "text-red-400"}>HTTP {debugResult.root_status ?? "—"}</span>
                    {debugResult.root_content_type && <span className="text-gray-500 ml-2">({debugResult.root_content_type})</span>}
                  </div>
                  {debugResult.root_error && (
                    <div className="text-sm text-red-400 mt-1">{debugResult.root_error}</div>
                  )}
                </div>

                {/* Доступные сущности */}
                {debugResult.available_entities && (
                  <div>
                    <div className="text-sm font-medium text-gray-300 mb-2">
                      Доступные сущности OData ({debugResult.entities_count ?? (Array.isArray(debugResult.available_entities) ? debugResult.available_entities.length : "?")}):
                    </div>
                    {Array.isArray(debugResult.available_entities) ? (
                      <div className="p-3 rounded-lg bg-dark-700/50 border border-dark-600/50 max-h-48 overflow-y-auto">
                        <div className="text-xs text-gray-300 font-mono space-y-0.5">
                          {debugResult.available_entities.map((name, i) => (
                            <div key={i} className={
                              name.includes("Сотрудник") || name.includes("Должност") || name.includes("Подразделен") || name.includes("ФизическиеЛица")
                                ? "text-green-400 font-medium"
                                : ""
                            }>{name}</div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-amber-400">{debugResult.available_entities}</div>
                    )}
                  </div>
                )}

                {/* Если вернулся необработанный текст */}
                {debugResult.root_text_preview && (
                  <div>
                    <div className="text-sm font-medium text-gray-300 mb-2">
                      Ответ сервера (Content-Type: {debugResult.root_content_type}):
                    </div>
                    <pre className="p-3 rounded-lg bg-dark-700/50 border border-dark-600/50 text-xs text-gray-300 font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {debugResult.root_text_preview}
                    </pre>
                  </div>
                )}

                {/* Проверка каталогов */}
                {debugResult.catalogs && Object.keys(debugResult.catalogs).length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-300 mb-2">Проверка каталогов:</div>
                    <div className="space-y-3">
                      {Object.entries(debugResult.catalogs).map(([group, variants]) => {
                        const groupLabels: Record<string, string> = {
                          departments: "Подразделения",
                          positions: "Должности",
                          employees: "Сотрудники",
                          hr_history: "Кадровая история (должности/отделы)",
                        };
                        return (
                          <div key={group} className="p-3 rounded-lg bg-dark-700/50 border border-dark-600/50">
                            <div className="text-sm font-medium text-white mb-2">{groupLabels[group] || group}</div>
                            {Object.entries(variants).map(([name, info]) => (
                              <div key={name} className="mb-3 last:mb-0">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  {info.status === 200 ? (
                                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                  )}
                                  <span className="font-mono text-xs text-gray-300">{name}</span>
                                  {info.status === 200 && info.count !== undefined && (
                                    <span className="text-green-400 text-xs">
                                      {info.count} записей {info.format && `(${info.format})`}
                                    </span>
                                  )}
                                  {info.status && info.status !== 200 && (
                                    <span className="text-red-400 text-xs">HTTP {info.status}</span>
                                  )}
                                  {info.error && (
                                    <span className="text-red-400 text-xs">{info.error}</span>
                                  )}
                                  {info.parse_error && (
                                    <span className="text-amber-400 text-xs">{info.parse_error}</span>
                                  )}
                                </div>
                                {info.keys && info.keys.length > 0 && (
                                  <div className="mt-1 ml-6 text-xs text-gray-500">
                                    Поля: {info.keys.join(", ")}
                                  </div>
                                )}
                                {info.sample && (
                                  <pre className="mt-1 ml-6 text-xs text-gray-400 font-mono overflow-x-auto max-h-32 overflow-y-auto bg-dark-800/50 p-2 rounded">
                                    {JSON.stringify(info.sample, null, 2)}
                                  </pre>
                                )}
                                {info.body_preview && (
                                  <pre className="mt-1 ml-6 text-xs text-gray-500 font-mono overflow-x-auto max-h-24 overflow-y-auto">
                                    {info.body_preview}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
