import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  History,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../shared/api/client'
import { useAuthStore } from '../../../shared/store/auth.store'

type CurrentVersion = { version: string; build: string }

type UpdateCheck = {
  latest: string
  current: string
  available: boolean
  changelog: string
  released_at: string | null
  download_url: string | null
  sha256: string | null
  min_required: string | null
  signature_valid: boolean
}

type UpdateTask = {
  id: string
  requested_version: string
  current_version: string
  status: string
  progress_percent: number
  log: string
  error: string | null
  backup_path: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

const ACTIVE_STATUSES = new Set([
  'queued',
  'running',
  'backing_up',
  'pulling',
  'building',
  'migrating',
])

const STATUS_LABELS: Record<string, string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  backing_up: 'Резервная копия',
  pulling: 'Загрузка релиза',
  building: 'Сборка контейнеров',
  migrating: 'Применение миграций',
  done: 'Завершено',
  failed: 'Ошибка',
  rolled_back: 'Откат выполнен',
  cancelled: 'Отменено',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU')
}

export function UpdatesPage() {
  const [current, setCurrent] = useState<CurrentVersion | null>(null)
  const [check, setCheck] = useState<UpdateCheck | null>(null)
  const [history, setHistory] = useState<UpdateTask[]>([])
  const [activeTask, setActiveTask] = useState<UpdateTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const reloadingRef = useRef(false)
  const user = useAuthStore((s) => s.user)

  const reloadHistory = useCallback(async () => {
    try {
      const tasks = await apiGet<UpdateTask[]>('/platform/updates/tasks?limit=20')
      setHistory(tasks)
      const running = tasks.find((t) => ACTIVE_STATUSES.has(t.status))
      setActiveTask(running ?? null)
    } catch (err) {
      // молча — это polling
    }
  }, [])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cur = await apiGet<CurrentVersion>('/platform/updates/current')
      setCurrent(cur)
      await reloadHistory()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [reloadHistory])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  // Polling активной задачи
  useEffect(() => {
    if (!activeTask) return
    const interval = window.setInterval(async () => {
      try {
        const fresh = await apiGet<UpdateTask>(`/platform/updates/tasks/${activeTask.id}`)
        setActiveTask(fresh)
        if (!ACTIVE_STATUSES.has(fresh.status)) {
          await reloadHistory()
        }
      } catch (err) {
        // ignore — задача обновится на следующем тике
      }
    }, 2000)
    return () => window.clearInterval(interval)
  }, [activeTask?.id, reloadHistory])

  // Когда статус done — пингуем /health и перезагружаемся при смене версии
  useEffect(() => {
    if (!activeTask || activeTask.status !== 'done' || reloadingRef.current) return
    reloadingRef.current = true
    let cancelled = false
    const baseVersion = current?.version
    const tick = async () => {
      if (cancelled) return
      try {
        const resp = await fetch('/health')
        if (resp.ok) {
          const data = await resp.json()
          if (baseVersion && data.version && data.version !== baseVersion) {
            window.location.reload()
            return
          }
        }
      } catch {
        // backend ещё перезапускается — продолжаем ждать
      }
      window.setTimeout(tick, 5000)
    }
    tick()
    return () => {
      cancelled = true
    }
  }, [activeTask?.status, current?.version])

  const handleCheck = async () => {
    setChecking(true)
    setError(null)
    try {
      const data = await apiGet<UpdateCheck>('/platform/updates/check')
      setCheck(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setChecking(false)
    }
  }

  const handleInstall = async () => {
    if (!check?.latest) return
    setInstalling(true)
    setError(null)
    try {
      const task = await apiPost<UpdateTask>('/platform/updates/install', {
        version: check.latest,
      })
      setActiveTask(task)
      setConfirmOpen(false)
      await reloadHistory()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setInstalling(false)
    }
  }

  const canInstall = useMemo(() => {
    return (
      !!user?.is_owner &&
      !!check?.available &&
      !!check?.signature_valid &&
      !activeTask
    )
  }, [user?.is_owner, check, activeTask])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center gap-3">
          <Download className="w-7 h-7 text-accent-purple" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Центр обновлений</h2>
            <p className="text-gray-400">Проверка и установка новых версий платформы</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>
      )}

      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase text-gray-500 tracking-wider">Текущая версия</div>
            <div className="text-2xl font-semibold text-gray-900">
              v{current?.version ?? '—'}
              {current?.build && <span className="text-sm text-gray-400 ml-2">build {current.build}</span>}
            </div>
          </div>
          <button
            onClick={handleCheck}
            className="glass-button-secondary px-4 py-2 text-sm font-medium flex items-center gap-2"
            disabled={checking}
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Проверяем…' : 'Проверить обновления'}
          </button>
        </div>

        {check && (
          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {check.available ? (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-green-500/15 border border-green-500/30 text-sm text-green-400">
                  <CheckCircle2 className="w-4 h-4" /> Доступна версия v{check.latest}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-gray-500/15 border border-gray-500/30 text-sm text-gray-400">
                  Установлена последняя версия (v{check.latest})
                </span>
              )}
              {check.released_at && (
                <span className="text-xs text-gray-400">Выпущена {formatDate(check.released_at)}</span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                  check.signature_valid
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-red-500/15 text-red-400'
                }`}
              >
                {check.signature_valid ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
                Подпись метаданных: {check.signature_valid ? 'валидна' : 'не прошла'}
              </span>
            </div>
            {check.changelog && (
              <div>
                <div className="text-xs uppercase text-gray-500 tracking-wider mb-1">Changelog</div>
                <pre className="text-xs whitespace-pre-wrap text-gray-700 bg-gray-50 rounded-lg p-3 font-sans">{check.changelog}</pre>
              </div>
            )}
            {check.min_required && check.min_required !== current?.version && (
              <p className="text-xs text-gray-500">Минимальная требуемая версия: {check.min_required}</p>
            )}
            <div className="flex justify-end gap-2">
              {!user?.is_owner && (
                <p className="text-xs text-gray-400 self-center">
                  Установка обновлений доступна только владельцу системы.
                </p>
              )}
              <button
                onClick={() => setConfirmOpen(true)}
                className="glass-button px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-40"
                disabled={!canInstall}
                title={
                  !user?.is_owner
                    ? 'Только владелец может устанавливать обновления'
                    : !check.signature_valid
                      ? 'Подпись метаданных недействительна'
                      : ''
                }
              >
                <Download className="w-4 h-4" />
                Установить обновление
              </button>
            </div>
          </div>
        )}
      </div>

      {activeTask && (
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Установка v{activeTask.requested_version}</h3>
            <span className="text-sm font-medium text-accent-purple">
              {STATUS_LABELS[activeTask.status] || activeTask.status}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-accent-purple transition-all duration-500"
              style={{ width: `${activeTask.progress_percent}%` }}
            />
          </div>
          {activeTask.error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {activeTask.error}
            </div>
          )}
          {activeTask.log && (
            <pre className="text-xs whitespace-pre-wrap text-gray-700 bg-gray-50 rounded-lg p-3 max-h-64 overflow-auto font-mono">
              {activeTask.log}
            </pre>
          )}
          {activeTask.status === 'done' && (
            <p className="text-sm text-green-500">
              Обновление завершено. Дождитесь автоматической перезагрузки страницы…
            </p>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">История обновлений</h3>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Версия</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Начато</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Завершено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">{t.current_version} → {t.requested_version}</td>
                  <td className="px-3 py-2">{STATUS_LABELS[t.status] || t.status}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDate(t.started_at ?? t.created_at)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDate(t.finished_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmOpen && check && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 mx-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-semibold text-gray-900">Подтверждение обновления</h3>
            </div>
            <p className="text-sm text-gray-700">
              Будет установлена версия <strong>v{check.latest}</strong>. Перед обновлением будет создан бэкап
              БД. Контейнеры backend и frontend перезапустятся — ожидаемый downtime 5–10 минут.
            </p>
            <p className="text-sm text-gray-700">
              При сбое обновление откатится автоматически. Продолжить?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="glass-button-secondary px-4 py-2 text-sm font-medium"
                disabled={installing}
              >
                Отмена
              </button>
              <button
                onClick={handleInstall}
                className="px-4 py-2 text-sm font-medium text-amber-400 bg-amber-500/20 border border-amber-500/30 rounded-xl hover:bg-amber-500/30 transition-all disabled:opacity-40"
                disabled={installing}
              >
                {installing ? 'Установка…' : 'Да, установить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
