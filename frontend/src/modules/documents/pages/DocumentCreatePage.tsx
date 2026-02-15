import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileUp } from 'lucide-react'
import {
  DocumentType,
  DocumentTemplate,
  ApprovalRoute,
  documentsService,
} from '@/shared/services/documents.service'
import { PlaceholderForm } from '../components/PlaceholderForm'

export function DocumentCreatePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'upload' | 'template'>('upload')
  const [types, setTypes] = useState<DocumentType[]>([])
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [routes, setRoutes] = useState<ApprovalRoute[]>([])
  const [loading, setLoading] = useState(false)

  // Upload mode
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [typeId, setTypeId] = useState('')
  const [routeId, setRouteId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Template mode
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [templateTitle, setTemplateTitle] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateTypeId, setTemplateTypeId] = useState('')
  const [templateRouteId, setTemplateRouteId] = useState('')

  useEffect(() => {
    Promise.all([
      documentsService.getTypes(true),
      documentsService.getTemplates({ active: true }),
      documentsService.getRoutes(),
    ]).then(([t, tmpl, r]) => {
      setTypes(t)
      setTemplates(tmpl)
      setRoutes(r)
    })
  }, [])

  useEffect(() => {
    if (selectedTemplateId) {
      const t = templates.find(t => t.id === selectedTemplateId) || null
      setSelectedTemplate(t)
      if (t) {
        setTemplateTypeId(t.document_type_id || '')
      }
    } else {
      setSelectedTemplate(null)
    }
  }, [selectedTemplateId, templates])

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      alert('Укажите название и выберите файл')
      return
    }
    setLoading(true)
    try {
      const doc = await documentsService.uploadDocument(
        file,
        title.trim(),
        description.trim() || undefined,
        typeId || undefined,
        routeId || undefined,
      )
      navigate(`/documents/view/${doc.id}`)
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const handleFromTemplate = async (values: Record<string, string>) => {
    if (!selectedTemplateId || !templateTitle.trim()) {
      alert('Укажите название документа')
      return
    }
    setLoading(true)
    try {
      const doc = await documentsService.createFromTemplate({
        template_id: selectedTemplateId,
        title: templateTitle.trim(),
        description: templateDescription.trim() || undefined,
        document_type_id: templateTypeId || undefined,
        approval_route_id: templateRouteId || undefined,
        values,
      })
      navigate(`/documents/view/${doc.id}`)
    } catch (err: any) {
      alert(err.message || 'Ошибка генерации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-bold text-white">Создание документа</h2>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('upload')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl transition-colors ${
            mode === 'upload'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
              : 'text-gray-400 border border-dark-600/50 hover:text-white'
          }`}
        >
          <Upload className="w-4 h-4" />
          Загрузить файл
        </button>
        <button
          onClick={() => setMode('template')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl transition-colors ${
            mode === 'template'
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
              : 'text-gray-400 border border-dark-600/50 hover:text-white'
          }`}
        >
          <FileUp className="w-4 h-4" />
          Из шаблона
        </button>
      </div>

      {mode === 'upload' ? (
        <div className="space-y-4 p-6 bg-dark-800/50 border border-dark-600/50 rounded-2xl">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название документа *" className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" rows={2} className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none">
              <option value="">Тип документа</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none">
              <option value="">Маршрут согласования</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-3 w-full justify-center text-sm text-gray-400 border border-dashed border-dark-600 rounded-xl hover:text-white hover:border-accent-purple/30 transition-colors">
              <Upload className="w-5 h-5" />
              {file ? file.name : 'Выберите файл'}
            </button>
          </div>
          <button onClick={handleUpload} disabled={loading || !file || !title.trim()} className="w-full px-4 py-2.5 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 text-sm font-medium disabled:opacity-50">
            {loading ? 'Загрузка...' : 'Создать документ'}
          </button>
        </div>
      ) : (
        <div className="space-y-4 p-6 bg-dark-800/50 border border-dark-600/50 rounded-2xl">
          <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none">
            <option value="">Выберите шаблон</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {selectedTemplate && (
            <>
              <input type="text" value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} placeholder="Название документа *" className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50" />
              <textarea value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} placeholder="Описание" rows={2} className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={templateTypeId} onChange={(e) => setTemplateTypeId(e.target.value)} className="px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none">
                  <option value="">Тип документа</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={templateRouteId} onChange={(e) => setTemplateRouteId(e.target.value)} className="px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none">
                  <option value="">Маршрут согласования</option>
                  {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              {selectedTemplate.placeholders.length > 0 ? (
                <div className="border-t border-dark-600/50 pt-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Заполните поля шаблона</h4>
                  <PlaceholderForm
                    placeholders={selectedTemplate.placeholders}
                    onSubmit={handleFromTemplate}
                    loading={loading}
                  />
                </div>
              ) : (
                <button onClick={() => handleFromTemplate({})} disabled={loading || !templateTitle.trim()} className="w-full px-4 py-2.5 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 text-sm font-medium disabled:opacity-50">
                  {loading ? 'Генерация...' : 'Создать документ'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
