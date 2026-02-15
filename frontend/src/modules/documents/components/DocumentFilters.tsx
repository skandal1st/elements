import { Search } from 'lucide-react'
import { DocumentType } from '@/shared/services/documents.service'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  statusFilter: string
  onStatusChange: (v: string) => void
  typeFilter: string
  onTypeChange: (v: string) => void
  types: DocumentType[]
}

const statusOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'draft', label: 'Черновик' },
  { value: 'pending_approval', label: 'На согласовании' },
  { value: 'approved', label: 'Согласован' },
  { value: 'rejected', label: 'Отклонён' },
  { value: 'cancelled', label: 'Отменён' },
]

export function DocumentFilters({ search, onSearchChange, statusFilter, onStatusChange, typeFilter, onTypeChange, types }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Поиск документов..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50"
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none focus:border-accent-purple/50"
      >
        {statusOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value)}
        className="px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none focus:border-accent-purple/50"
      >
        <option value="">Все типы</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  )
}
