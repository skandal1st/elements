import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Route } from 'lucide-react'
import { ApprovalRoute, documentsService } from '@/shared/services/documents.service'

export function ApprovalRoutesPage() {
  const navigate = useNavigate()
  const [routes, setRoutes] = useState<ApprovalRoute[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setRoutes(await documentsService.getRoutes())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Деактивировать маршрут?')) return
    try {
      await documentsService.deleteRoute(id)
      load()
    } catch (err: any) {
      alert(err.message || 'Ошибка')
    }
  }

  if (loading) return <div className="text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Маршруты согласования</h2>
        <button
          onClick={() => navigate('/documents/route-editor/new')}
          className="flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Создать маршрут
        </button>
      </div>

      <div className="grid gap-3">
        {routes.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Route className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-white font-medium">{r.name}</div>
                {r.description && <p className="text-sm text-gray-400 mt-0.5">{r.description}</p>}
                <div className="text-xs text-gray-500 mt-1">
                  {r.steps.length} шагов &middot; {r.steps.reduce((sum, s) => sum + s.approvers.length, 0)} согласующих
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/documents/route-editor/${r.id}`)}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                className="p-2 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {routes.length === 0 && <p className="text-gray-500 text-center py-8">Нет маршрутов</p>}
      </div>
    </div>
  )
}
