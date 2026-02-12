import { Tag } from 'lucide-react'
import type { KnowledgeTag } from '@/shared/services/knowledge.service'

interface Props {
  tags: KnowledgeTag[]
  selectedIds: string[]
  onToggle: (tagId: string) => void
}

export function KnowledgeTagFilter({ tags, selectedIds, onToggle }: Props) {
  if (tags.length === 0) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <Tag className="w-4 h-4 text-gray-500 flex-shrink-0" />
      {tags.map((tag) => {
        const isActive = selectedIds.includes(tag.id)
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-accent-purple/30 text-white border border-accent-purple/50'
                : 'bg-dark-700/50 text-gray-400 border border-dark-600/50 hover:text-white hover:border-dark-500/50'
            }`}
            style={
              isActive && tag.color
                ? { backgroundColor: `${tag.color}30`, borderColor: `${tag.color}80`, color: tag.color }
                : undefined
            }
          >
            {tag.name}
            {tag.usage_count > 0 && (
              <span className="ml-1 opacity-60">{tag.usage_count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
