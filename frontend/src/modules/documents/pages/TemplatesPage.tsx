import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, FileText, Settings } from 'lucide-react'
import { DocumentTemplate, DocumentType, documentsService } from '@/shared/services/documents.service'

export function TemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [types, setTypes] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadTypeId, setUploadTypeId] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const [t, dt] = await Promise.all([documentsService.getTemplates(), documentsService.getTypes()])
      setTemplates(t)
      setTypes(dt)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) {
      alert('Укажите название и выберите файл .docx')
      return
    }
    setUploading(true)
    try {
      await documentsService.uploadTemplate(
        uploadFile,
        uploadName.trim(),
        uploadDesc.trim() || undefined,
        uploadTypeId || undefined,
      )
      setShowUploadModal(false)
      setUploadName('')
      setUploadDesc('')
      setUploadTypeId('')
      setUploadFile(null)
      load()
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = (templateId: string) => {
    const token = localStorage.getItem('token')
    const url = documentsService.getTemplateDownloadUrl(templateId)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = ''
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
  }

  if (loading) return <div className="text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Шаблоны документов</h2>
        <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 transition-colors text-sm">
          <Plus className="w-4 h-4" />
          Загрузить шаблон
        </button>
      </div>

      <div className="grid gap-3">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{t.name}</span>
                  <span className="text-xs text-gray-500">v{t.version}</span>
                  {!t.is_active && <span className="text-xs text-red-400">Неактивен</span>}
                </div>
                {t.description && <p className="text-sm text-gray-400 mt-0.5">{t.description}</p>}
                <div className="text-xs text-gray-500 mt-1">
                  {t.placeholders.length} плейсхолдеров &middot; {t.file_name}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/documents/template-editor/${t.id}`)}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
                title="Настроить плейсхолдеры"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDownload(t.id)}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
                title="Скачать"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && <p className="text-gray-500 text-center py-8">Нет шаблонов</p>}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Загрузить шаблон .docx</h3>
            <div className="space-y-3">
              <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Название шаблона *" className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50" />
              <textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} placeholder="Описание" rows={2} className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 resize-none" />
              <select value={uploadTypeId} onChange={(e) => setUploadTypeId(e.target.value)} className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none">
                <option value="">Тип документа (необязательно)</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div>
                <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-3 w-full justify-center text-sm text-gray-400 border border-dashed border-dark-600 rounded-xl hover:text-white transition-colors">
                  {uploadFile ? uploadFile.name : 'Выберите .docx файл'}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Отмена</button>
              <button onClick={handleUpload} disabled={uploading} className="px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 text-sm disabled:opacity-50">
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
