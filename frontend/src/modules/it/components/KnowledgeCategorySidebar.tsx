import { ChevronRight, Folder, FolderOpen, Settings } from 'lucide-react'
import { useState } from 'react'
import type { KnowledgeCategory } from '@/shared/services/knowledge.service'

interface Props {
  categories: KnowledgeCategory[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onManageClick?: () => void
}

function CategoryNode({
  cat,
  selectedId,
  onSelect,
  depth = 0,
}: {
  cat: KnowledgeCategory
  selectedId: string | null
  onSelect: (id: string | null) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = cat.children && cat.children.length > 0
  const isSelected = selectedId === cat.id

  return (
    <div>
      <button
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
          isSelected
            ? 'bg-accent-purple/20 text-white'
            : 'text-gray-400 hover:bg-dark-700/50 hover:text-white'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(isSelected ? null : cat.id)}
      >
        {hasChildren ? (
          <span
            className="flex-shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </span>
        ) : (
          <span className="w-3.5" />
        )}
        {isSelected ? (
          <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: cat.color || undefined }} />
        ) : (
          <Folder className="w-4 h-4 flex-shrink-0" style={{ color: cat.color || undefined }} />
        )}
        <span className="truncate">{cat.name}</span>
      </button>

      {hasChildren && expanded && (
        <div>
          {cat.children!.map((child) => (
            <CategoryNode
              key={child.id}
              cat={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function KnowledgeCategorySidebar({ categories, selectedId, onSelect, onManageClick }: Props) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <button
          className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
            selectedId === null
              ? 'bg-accent-purple/20 text-white'
              : 'text-gray-400 hover:bg-dark-700/50 hover:text-white'
          }`}
          onClick={() => onSelect(null)}
        >
          <Folder className="w-4 h-4" />
          <span>Все категории</span>
        </button>
        {onManageClick && (
          <button
            onClick={onManageClick}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-dark-700/50 rounded-lg transition-all"
            title="Управление категориями"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>

      {categories.map((cat) => (
        <CategoryNode
          key={cat.id}
          cat={cat}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
