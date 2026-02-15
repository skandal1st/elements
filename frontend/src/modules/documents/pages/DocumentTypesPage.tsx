import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { DocumentType, documentsService, ApprovalRoute } from '@/shared/services/documents.service'

export function DocumentTypesPage() {
  const [types, setTypes] = useState<DocumentType[]>([])
  const [routes, setRoutes] = useState<ApprovalRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<DocumentType | null>(null)
  const [form, setForm] = useState({ name: '', code: '', description: '', default_route_id: '', is_active: true })

  const load = async () => {
    try {
      const [t, r] = await Promise.all([documentsService.getTypes(), documentsService.getRoutes()])
      setTypes(t)
      setRoutes(r)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', code: '', description: '', default_route_id: '', is_active: true })
    setShowModal(true)
  }

  const openEdit = (t: DocumentType) => {
    setEditing(t)
    setForm({
      name: t.name,
      code: t.code,
      description: t.description || '',
      default_route_id: t.default_route_id || '',
      is_active: t.is_active,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      if (editing) {
        await documentsService.updateType(editing.id, {
          name: form.name,
          code: form.code,
          description: form.description || null,
          default_route_id: form.default_route_id || null,
          is_active: form.is_active,
        })
      } else {
        await documentsService.createType({
          name: form.name,
          code: form.code,
          description: form.description || undefined,
          default_route_id: form.default_route_id || undefined,
          is_active: form.is_active,
        })
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      alert(err.message || 'Ошибка')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить тип документа?')) return
    try {
      await documentsService.deleteType(id)
      load()
    } catch (err: any) {
      alert(err.message || 'Ошибка')
    }
  }

  if (loading) return <div className="text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Типы документов</h2>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 transition-colors text-sm">
          <Plus className="w-4 h-4" />
          Добавить тип
        </button>
      </div>

      <div className="grid gap-3">
        {types.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{t.name}</span>
                <span className="text-xs text-gray-500 bg-dark-700 px-2 py-0.5 rounded">{t.code}</span>
                {!t.is_active && <span className="text-xs text-red-400">Неактивен</span>}
              </div>
              {t.description && <p className="text-sm text-gray-400 mt-1">{t.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEdit(t)} className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(t.id)} className="p-2 text-gray-400 hover:text-red-400 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {types.length === 0 && <p className="text-gray-500 text-center py-8">Нет типов документов</p>}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">{editing ? 'Редактировать тип' : 'Новый тип документа'}</h3>
            <div className="space-y-3">
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Название" className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50" />
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Код (латиница)" className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50" />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Описание" rows={2} className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 resize-none" />
              <select value={form.default_route_id} onChange={(e) => setForm({ ...form, default_route_id: e.target.value })} className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none focus:border-accent-purple/50">
                <option value="">Без маршрута по умолчанию</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                Активен
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Отмена</button>
              <button onClick={handleSave} className="px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 text-sm">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
