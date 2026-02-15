import { CheckCircle, XCircle, Clock, SkipForward } from 'lucide-react'
import { ApprovalInstance } from '@/shared/services/documents.service'

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const stepStatusIcon: Record<string, { icon: typeof CheckCircle; className: string }> = {
  approved: { icon: CheckCircle, className: 'text-green-400' },
  rejected: { icon: XCircle, className: 'text-red-400' },
  pending: { icon: Clock, className: 'text-yellow-400' },
  skipped: { icon: SkipForward, className: 'text-gray-500' },
}

interface Props {
  instances: ApprovalInstance[]
}

export function ApprovalTimeline({ instances }: Props) {
  if (!instances.length) {
    return <p className="text-gray-500 text-sm">Нет данных о согласовании</p>
  }

  return (
    <div className="space-y-6">
      {instances.map((inst) => (
        <div key={inst.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              Попытка #{inst.attempt}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-lg ${
              inst.status === 'approved' ? 'bg-green-500/20 text-green-400' :
              inst.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {inst.status === 'approved' ? 'Согласовано' : inst.status === 'rejected' ? 'Отклонено' : 'В процессе'}
            </span>
          </div>

          <div className="relative pl-6">
            <div className="absolute left-2.5 top-0 bottom-0 w-px bg-dark-600" />

            {inst.step_instances.map((step) => {
              const config = stepStatusIcon[step.status] || stepStatusIcon.pending
              const Icon = config.icon
              return (
                <div key={step.id} className="relative pb-4 last:pb-0">
                  <div className="absolute -left-3.5 top-0.5">
                    <Icon className={`w-4 h-4 ${config.className}`} />
                  </div>
                  <div className="ml-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{step.approver_name || 'Согласующий'}</span>
                      <span className="text-xs text-gray-500">Шаг {step.step_order}</span>
                      {step.carry_over && (
                        <span className="text-xs text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">перенос</span>
                      )}
                    </div>
                    {step.decision_at && (
                      <div className="text-xs text-gray-500 mt-0.5">{formatDate(step.decision_at)}</div>
                    )}
                    {step.comment && (
                      <div className="text-xs text-gray-400 mt-1 italic">"{step.comment}"</div>
                    )}
                    {step.status === 'pending' && step.deadline_at && (
                      <div className="text-xs text-yellow-500 mt-0.5">Дедлайн: {formatDate(step.deadline_at)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
