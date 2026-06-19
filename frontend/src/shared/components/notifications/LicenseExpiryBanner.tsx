import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../api/client'
import { useAuthStore } from '../../store/auth.store'

type LicenseStatus = {
  valid: boolean
  state: 'valid' | 'grace' | 'expired' | 'absent' | 'invalid'
  days_until_expiry: number | null
}

const STORAGE_KEY = 'license_banner_dismissed_at'
const DISMISS_TTL_MS = 12 * 60 * 60 * 1000 // 12 часов

export function LicenseExpiryBanner() {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [hidden, setHidden] = useState<boolean>(() => {
    const ts = Number(localStorage.getItem(STORAGE_KEY) || 0)
    return ts > 0 && Date.now() - ts < DISMISS_TTL_MS
  })
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus(null)
      return
    }
    let cancelled = false
    apiGet<LicenseStatus>('/platform/license/status')
      .then((data) => {
        if (!cancelled) setStatus(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (!status || hidden) return null

  const days = status.days_until_expiry ?? 0
  const needsWarning =
    status.state === 'grace' ||
    status.state === 'expired' ||
    status.state === 'absent' ||
    status.state === 'invalid' ||
    (status.state === 'valid' && days >= 0 && days <= 30)

  if (!needsWarning) return null

  const message =
    status.state === 'absent'
      ? 'Лицензия платформы не установлена. Доступ некоторых модулей может быть ограничен.'
      : status.state === 'invalid'
        ? 'Подпись лицензии не прошла проверку. Свяжитесь с вендором.'
        : status.state === 'expired'
          ? 'Срок действия лицензии истёк. Доступ к платформе будет ограничен после окончания льготного периода.'
          : status.state === 'grace'
            ? `Лицензия истекла ${Math.abs(days)} дн. назад — действует льготный период. Установите новый ключ.`
            : `Лицензия истекает через ${days} дн. Запросите продление у вендора.`

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setHidden(true)
  }

  return (
    <div className="px-4 py-3 bg-amber-500/15 border-b border-amber-500/30">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-sm text-amber-200 flex-1">{message}</p>
        <button
          onClick={() => navigate('/settings/license')}
          className="px-3 py-1 text-xs font-medium text-amber-300 hover:text-amber-200 underline"
        >
          Перейти к лицензии
        </button>
        <button onClick={dismiss} className="p-1 text-amber-300 hover:text-amber-200" title="Скрыть до завтра">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
