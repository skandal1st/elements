import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { RouteStep, documentsService } from '@/shared/services/documents.service'
import { ApprovalRouteVisualEditor } from '../components/ApprovalRouteVisualEditor'

export function ApprovalRouteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<RouteStep[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isNew && id) {
      documentsService.getRoute(id).then((r) => {
        setName(r.name)
        setDescription(r.description || '')
        setSteps(r.steps)
      }).catch(console.error).finally(() => setLoading(false))
    }
  }, [id, isNew])

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Название маршрута обязательно')
      return
    }
    if (steps.length === 0) {
      alert('Добавьте хотя бы один шаг')
      return
    }
    for (const s of steps) {
      if (s.approvers.length === 0) {
        alert(`Шаг "${s.name}" не имеет согласующих`)
        return
      }
    }

    setSaving(true)
    try {
      if (isNew) {
        await documentsService.createRoute({
          name: name.trim(),
          description: description.trim() || undefined,
          steps,
        })
      } else if (id) {
        await documentsService.updateRoute(id, {
          name: name.trim(),
          description: description.trim() || undefined,
          steps,
        })
      }
      navigate('/documents/routes')
    } catch (err: any) {
      alert(err.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/documents/routes')} className="p-2 text-gray-400 hover:text-white rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-white">{isNew ? 'Новый маршрут' : 'Редактирование маршрута'}</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 transition-colors text-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название маршрута *"
          className="px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание"
          className="px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50"
        />
      </div>

      <ApprovalRouteVisualEditor steps={steps} onChange={setSteps} />
    </div>
  )
}
