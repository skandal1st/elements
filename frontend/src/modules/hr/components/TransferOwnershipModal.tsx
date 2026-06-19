import { useState } from 'react'
import { Crown, AlertTriangle } from 'lucide-react'
import { apiPost } from '../../../shared/api/client'

type Candidate = {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_owner: boolean
}

type Props = {
  candidates: Candidate[]
  currentOwnerId: string | undefined
  onClose: () => void
  onSuccess: () => void
}

export function TransferOwnershipModal({ candidates, currentOwnerId, onClose, onSuccess }: Props) {
  const [newOwnerId, setNewOwnerId] = useState<string>('')
  const [password, setPassword] = useState('')
  const [confirmStage, setConfirmStage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const eligible = candidates.filter((u) => u.is_active && u.id !== currentOwnerId && !u.is_owner)

  const handleSubmit = async () => {
    if (!newOwnerId) {
      setError('Выберите нового владельца')
      return
    }
    if (!password) {
      setError('Введите ваш пароль для подтверждения')
      return
    }
    if (!confirmStage) {
      setConfirmStage(true)
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await apiPost('/hr/users/owner/transfer', {
        new_owner_id: newOwnerId,
        password,
      })
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
      setConfirmStage(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 mx-4">
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-amber-400" />
          <h3 className="text-lg font-semibold text-gray-900">Передача прав владельца</h3>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200/90 space-y-1">
              <p>После передачи прав вы перестанете быть владельцем системы.</p>
              <p>Новый владелец получит исключительное право управлять обновлениями платформы и передавать владение дальше.</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Новый владелец</label>
          <select
            className="glass-input w-full px-4 py-3 text-sm"
            value={newOwnerId}
            onChange={(e) => setNewOwnerId(e.target.value)}
            disabled={submitting || confirmStage}
          >
            <option value="">— выберите пользователя —</option>
            {eligible.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </option>
            ))}
          </select>
          {eligible.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">Нет подходящих кандидатов. Активируйте другого пользователя.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Ваш пароль</label>
          <input
            className="glass-input w-full px-4 py-3 text-sm"
            type="password"
            placeholder="Подтвердите свой пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
          />
        </div>

        {confirmStage && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-300 font-medium">
              Подтвердите ещё раз: вы действительно хотите передать права? Это действие нельзя отменить без сотрудничества нового владельца.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="glass-button-secondary px-4 py-2 text-sm font-medium" disabled={submitting}>
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-amber-400 bg-amber-500/20 border border-amber-500/30 rounded-xl hover:bg-amber-500/30 transition-all disabled:opacity-40"
            disabled={submitting || eligible.length === 0}
          >
            {confirmStage ? 'Да, передать права' : 'Продолжить'}
          </button>
        </div>
      </div>
    </div>
  )
}
