import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { knowledgeService } from '@/shared/services/knowledge.service'

interface Props {
  onSearch: (query: string) => void
  onClear: () => void
}

export function KnowledgeSearchBar({ onSearch, onClear }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debouncedQuery = useDebounce(query, 300)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      knowledgeService.autocomplete(debouncedQuery, 8).then((r) => {
        setSuggestions(r.suggestions)
        setShowDropdown(r.suggestions.length > 0)
      }).catch(() => setSuggestions([]))
    } else {
      setSuggestions([])
      setShowDropdown(false)
    }
  }, [debouncedQuery])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const submit = useCallback((value: string) => {
    const trimmed = value.trim()
    if (trimmed) {
      onSearch(trimmed)
      setShowDropdown(false)
    }
  }, [onSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        setQuery(suggestions[activeIndex])
        submit(suggestions[activeIndex])
      } else {
        submit(query)
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const handleClear = () => {
    setQuery('')
    setSuggestions([])
    setShowDropdown(false)
    onClear()
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Поиск по базе знаний…"
          className="w-full pl-10 pr-10 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-dark-800 border border-dark-600/50 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                i === activeIndex
                  ? 'bg-accent-purple/20 text-white'
                  : 'text-gray-300 hover:bg-dark-700/50 hover:text-white'
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => {
                setQuery(s)
                submit(s)
              }}
            >
              <Search className="inline w-3.5 h-3.5 mr-2 text-gray-500" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
