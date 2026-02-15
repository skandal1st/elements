const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  pending_approval: { label: 'На согласовании', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Согласован', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Отклонён', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  cancelled: { label: 'Отменён', className: 'bg-gray-500/20 text-gray-500 border-gray-600/30' },
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  )
}
