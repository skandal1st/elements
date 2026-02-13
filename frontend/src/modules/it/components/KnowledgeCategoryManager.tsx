import { useEffect, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  knowledgeService,
  type KnowledgeCategory,
} from '@/shared/services/knowledge.service'

interface Props {
  onClose: () => void
  onCategoriesChanged: () => void
}

interface EditRow {
  name: string
  description: string
  color: string
  parent_id: string
  sort_order: number
  icon: string
}

const emptyRow: EditRow = {
  name: '',
  description: '',
  color: '#8b5cf6',
  parent_id: '',
  sort_order: 0,
  icon: '',
}

export function KnowledgeCategoryManager({ onClose, onCategoriesChanged }: Props) {
  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<EditRow>(emptyRow)

  // New category form
  const [creating, setCreating] = useState(false)
  const [newRow, setNewRow] = useState<EditRow>({ ...emptyRow })

  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await knowledgeService.getCategories()
      setCategories(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const startEdit = (cat: KnowledgeCategory) => {
    setEditingId(cat.id)
    setEditRow({
      name: cat.name,
      description: cat.description || '',
      color: cat.color || '#8b5cf6',
      parent_id: cat.parent_id || '',
      sort_order: cat.sort_order,
      icon: cat.icon || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditRow(emptyRow)
  }

  const saveEdit = async () => {
    if (!editingId || !editRow.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await knowledgeService.updateCategory(editingId, {
        name: editRow.name.trim(),
        description: editRow.description || undefined,
        color: editRow.color || undefined,
        parent_id: editRow.parent_id || null,
        sort_order: editRow.sort_order,
        icon: editRow.icon || undefined,
      })
      setEditingId(null)
      await load()
      onCategoriesChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!newRow.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await knowledgeService.createCategory({
        name: newRow.name.trim(),
        description: newRow.description || undefined,
        color: newRow.color || undefined,
        parent_id: newRow.parent_id || undefined,
        sort_order: newRow.sort_order,
        icon: newRow.icon || undefined,
      })
      setCreating(false)
      setNewRow({ ...emptyRow })
      await load()
      onCategoriesChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Удалить категорию «${name}»?`)) return
    setError(null)
    try {
      await knowledgeService.deleteCategory(id)
      await load()
      onCategoriesChanged()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Parent options: all categories except the one being edited
  const parentOptions = categories.filter((c) => c.id !== editingId)

  const inputCls =
    'px-2.5 py-1.5 bg-dark-700/50 border border-dark-600/50 rounded-lg text-sm text-white focus:outline-none focus:border-accent-purple/50 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-4xl p-6 space-y-4 mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Управление категориями</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-dark-600/50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Цвет</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Описание</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Родитель</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">Порядок</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Иконка</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50">
                {categories.map((cat) =>
                  editingId === cat.id ? (
                    <tr key={cat.id} className="bg-dark-700/20">
                      <td className="px-3 py-2">
                        <input
                          type="color"
                          value={editRow.color}
                          onChange={(e) => setEditRow((r) => ({ ...r, color: e.target.value }))}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputCls}
                          value={editRow.name}
                          onChange={(e) => setEditRow((r) => ({ ...r, name: e.target.value }))}
                          placeholder="Название"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputCls}
                          value={editRow.description}
                          onChange={(e) => setEditRow((r) => ({ ...r, description: e.target.value }))}
                          placeholder="Описание"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editRow.parent_id}
                          onChange={(e) => setEditRow((r) => ({ ...r, parent_id: e.target.value }))}
                          className={inputCls}
                        >
                          <option value="">Нет</option>
                          {parentOptions.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className={`${inputCls} w-16`}
                          value={editRow.sort_order}
                          onChange={(e) => setEditRow((r) => ({ ...r, sort_order: parseInt(e.target.value) || 0 }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputCls}
                          value={editRow.icon}
                          onChange={(e) => setEditRow((r) => ({ ...r, icon: e.target.value }))}
                          placeholder="icon"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => void saveEdit()}
                            disabled={saving}
                            className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg transition-all disabled:opacity-50"
                            title="Сохранить"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 text-gray-400 hover:bg-dark-600/50 rounded-lg transition-all"
                            title="Отмена"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={cat.id} className="hover:bg-dark-700/20 transition-colors">
                      <td className="px-3 py-2">
                        <div
                          className="w-5 h-5 rounded-full border border-dark-600/50"
                          style={{ backgroundColor: cat.color || '#8b5cf6' }}
                        />
                      </td>
                      <td className="px-3 py-2 text-white text-sm font-medium">{cat.name}</td>
                      <td className="px-3 py-2 text-gray-400 text-sm truncate max-w-[200px]">
                        {cat.description || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-sm">
                        {cat.parent_id
                          ? categories.find((c) => c.id === cat.parent_id)?.name || '—'
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-sm">{cat.sort_order}</td>
                      <td className="px-3 py-2 text-gray-500 text-sm">{cat.icon || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(cat)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-600/50 rounded-lg transition-all"
                            title="Редактировать"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleDelete(cat.id, cat.name)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}

                {/* Create new row */}
                {creating && (
                  <tr className="bg-dark-700/20">
                    <td className="px-3 py-2">
                      <input
                        type="color"
                        value={newRow.color}
                        onChange={(e) => setNewRow((r) => ({ ...r, color: e.target.value }))}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputCls}
                        value={newRow.name}
                        onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
                        placeholder="Название *"
                        autoFocus
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputCls}
                        value={newRow.description}
                        onChange={(e) => setNewRow((r) => ({ ...r, description: e.target.value }))}
                        placeholder="Описание"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={newRow.parent_id}
                        onChange={(e) => setNewRow((r) => ({ ...r, parent_id: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="">Нет</option>
                        {categories.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className={`${inputCls} w-16`}
                        value={newRow.sort_order}
                        onChange={(e) => setNewRow((r) => ({ ...r, sort_order: parseInt(e.target.value) || 0 }))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputCls}
                        value={newRow.icon}
                        onChange={(e) => setNewRow((r) => ({ ...r, icon: e.target.value }))}
                        placeholder="icon"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => void handleCreate()}
                          disabled={saving || !newRow.name.trim()}
                          className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-lg transition-all disabled:opacity-50"
                          title="Создать"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setCreating(false)
                            setNewRow({ ...emptyRow })
                          }}
                          className="p-1.5 text-gray-400 hover:bg-dark-600/50 rounded-lg transition-all"
                          title="Отмена"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {categories.length === 0 && !creating && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                      Категорий пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-dark-600/50">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="glass-button px-4 py-2 flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Добавить категорию
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
