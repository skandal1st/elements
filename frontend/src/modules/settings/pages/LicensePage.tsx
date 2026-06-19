import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  ShieldX,
  XCircle,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../shared/api/client'

type LicenseInfo = {
  id: string
  license_id: string
  customer_name: string
  edition: string
  modules: string[]
  features: Record<string, unknown>
  max_users: number | null
  hardware_id: string | null
  issued_at: string
  expires_at: string
  installed_at: string | null
  installed_by_id: string | null
}

type LicenseStatus = {
  valid: boolean
  state: 'valid' | 'grace' | 'expired' | 'absent' | 'invalid'
  days_until_expiry: number | null
  license: LicenseInfo | null
  hardware_id: string
}

type HistoryEntry = {
  id: string
  license_id: string
  customer_name: string
  edition: string
  expires_at: string
  installed_at: string | null
  is_active: boolean
}

const STATE_META: Record<LicenseStatus['state'], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  valid: { label: 'Активна', cls: 'bg-green-500/20 text-green-400 border-green-500/30', Icon: CheckCircle2 },
  grace: { label: 'Льготный период', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30', Icon: Clock },
  expired: { label: 'Истекла', cls: 'bg-red-500/20 text-red-400 border-red-500/30', Icon: XCircle },
  absent: { label: 'Не установлена', cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30', Icon: AlertTriangle },
  invalid: { label: 'Неверная подпись', cls: 'bg-red-500/20 text-red-400 border-red-500/30', Icon: ShieldX },
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function LicensePage() {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statusData, historyData] = await Promise.all([
        apiGet<LicenseStatus>('/platform/license/status'),
        apiGet<HistoryEntry[]>('/platform/license/history').catch(() => [] as HistoryEntry[]),
      ])
      setStatus(statusData)
      setHistory(historyData)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleInstall = async () => {
    if (!newKey.trim()) {
      setError('Введите лицензионный ключ')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await apiPost<LicenseStatus>('/platform/license/install', {
        license_key: newKey.trim(),
      })
      setStatus(updated)
      setNewKey('')
      setMessage('Лицензия успешно установлена')
      // Подтянем историю заново
      apiGet<HistoryEntry[]>('/platform/license/history').then(setHistory).catch(() => undefined)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const copyHardwareId = async () => {
    if (!status?.hardware_id) return
    try {
      await navigator.clipboard.writeText(status.hardware_id)
      setMessage('Hardware ID скопирован в буфер обмена')
    } catch {
      setError('Не удалось скопировать. Скопируйте вручную.')
    }
  }

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
      </div>
    )
  }

  const meta = status ? STATE_META[status.state] : STATE_META.absent
  const StateIcon = meta.Icon

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center gap-3">
          <KeyRound className="w-7 h-7 text-accent-purple" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Лицензия</h2>
            <p className="text-gray-400">Управление платформенной лицензией Elements</p>
          </div>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">{message}</p>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium ${meta.cls}`}>
              <StateIcon className="w-4 h-4" /> {meta.label}
            </span>
            {status?.days_until_expiry != null && (
              <span className="text-sm text-gray-400">
                {status.days_until_expiry >= 0
                  ? `Осталось ${status.days_until_expiry} дн.`
                  : `Истекла ${Math.abs(status.days_until_expiry)} дн. назад`}
              </span>
            )}
          </div>
        </div>

        {status?.license ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Заказчик" value={status.license.customer_name} />
            <Field label="Редакция" value={status.license.edition} />
            <Field
              label="Модули"
              value={
                <div className="flex flex-wrap gap-1">
                  {status.license.modules.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-purple/20 text-accent-purple"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              }
            />
            <Field label="Макс. пользователей" value={status.license.max_users ?? 'без ограничения'} />
            <Field label="Выдана" value={formatDate(status.license.issued_at)} />
            <Field label="Истекает" value={formatDate(status.license.expires_at)} />
            <Field label="Установлена" value={formatDate(status.license.installed_at)} />
            <Field label="Привязка к Hardware ID" value={status.license.hardware_id ? 'да' : 'нет'} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">Активная лицензия отсутствует. Введите ключ ниже, чтобы активировать платформу.</p>
        )}
      </div>

      <div className="glass-card p-6 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Hardware ID этого экземпляра</h3>
        <p className="text-sm text-gray-400">
          Передайте этот идентификатор вендору для генерации лицензии, привязанной к серверу.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-xl bg-gray-100 text-xs font-mono break-all">
            {status?.hardware_id ?? '—'}
          </code>
          <button
            onClick={copyHardwareId}
            className="glass-button-secondary px-3 py-2 text-sm font-medium flex items-center gap-1"
            disabled={!status?.hardware_id}
          >
            <Copy className="w-4 h-4" /> Копировать
          </button>
        </div>
      </div>

      <div className="glass-card p-6 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Установить новый ключ</h3>
        <p className="text-sm text-gray-400">
          Вставьте полный лицензионный ключ вида <code className="text-xs">ELEM-LIC-v1.…</code>. Подпись и срок будут проверены автоматически.
        </p>
        <textarea
          className="glass-input w-full px-4 py-3 text-xs font-mono min-h-[120px]"
          placeholder="ELEM-LIC-v1.<payload>.<signature>"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          disabled={submitting}
        />
        <div className="flex justify-end">
          <button
            onClick={handleInstall}
            className="glass-button px-4 py-2 text-sm font-medium"
            disabled={submitting || !newKey.trim()}
          >
            {submitting ? 'Проверка…' : 'Установить'}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="glass-card p-6 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">История лицензий</h3>
          <div className="overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Заказчик</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Редакция</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Истекает</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Установлена</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2">{h.customer_name}</td>
                    <td className="px-3 py-2">{h.edition}</td>
                    <td className="px-3 py-2">{formatDate(h.expires_at)}</td>
                    <td className="px-3 py-2">{formatDate(h.installed_at)}</td>
                    <td className="px-3 py-2">
                      {h.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                          Активна
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
                          Заменена
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase text-gray-500 tracking-wider mb-1">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  )
}
