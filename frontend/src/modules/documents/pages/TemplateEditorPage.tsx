import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { DocumentTemplate, Placeholder, documentsService } from '@/shared/services/documents.service'

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [template, setTemplate] = useState<DocumentTemplate | null>(null)
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [showPlaceholderModal, setShowPlaceholderModal] = useState(false)
  const [selectedText, setSelectedText] = useState({ paragraphIndex: 0, start: 0, end: 0, text: '' })
  const [phForm, setPhForm] = useState({ key: '', label: '', type: 'text', required: true, options: '', default_value: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      documentsService.getTemplate(id),
      documentsService.getTemplateContent(id),
    ]).then(([t, content]) => {
      setTemplate(t)
      setHtml(content.html)
    }).catch(console.error).finally(() => setLoading(false))
  }, [id])

  const handleTextSelect = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const range = selection.getRangeAt(0)
    const container = range.startContainer.parentElement
    if (!container) return

    // Find paragraph element with data-paragraph
    let pElement = container
    while (pElement && !pElement.getAttribute('data-paragraph')) {
      pElement = pElement.parentElement as HTMLElement
    }
    if (!pElement) return

    const paragraphIndex = parseInt(pElement.getAttribute('data-paragraph') || '0')
    const fullText = pElement.textContent || ''
    const selectedStr = selection.toString()
    const startOffset = fullText.indexOf(selectedStr)

    if (startOffset < 0 || !selectedStr.trim()) return

    setSelectedText({
      paragraphIndex,
      start: startOffset,
      end: startOffset + selectedStr.length,
      text: selectedStr,
    })
    setPhForm({ key: '', label: '', type: 'text', required: true, options: '', default_value: '' })
    setShowPlaceholderModal(true)
  }

  const handleSetPlaceholder = async () => {
    if (!id || !phForm.key.trim() || !phForm.label.trim()) {
      alert('Ключ и название обязательны')
      return
    }
    setSaving(true)
    try {
      const placeholder: Placeholder = {
        key: phForm.key.trim(),
        label: phForm.label.trim(),
        type: phForm.type,
        required: phForm.required,
        options: phForm.options ? phForm.options.split(',').map(o => o.trim()).filter(Boolean) : [],
        default_value: phForm.default_value,
      }
      const updated = await documentsService.setPlaceholder(id, {
        paragraph_index: selectedText.paragraphIndex,
        start: selectedText.start,
        end: selectedText.end,
        placeholder,
      })
      setTemplate(updated)
      setShowPlaceholderModal(false)
      // Reload content
      const content = await documentsService.getTemplateContent(id)
      setHtml(content.html)
    } catch (err: any) {
      alert(err.message || 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-400">Загрузка...</div>
  if (!template) return <div className="text-gray-400">Шаблон не найден</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/documents/templates')} className="p-2 text-gray-400 hover:text-white rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">{template.name}</h2>
          <p className="text-sm text-gray-400">Выделите текст для создания плейсхолдера</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Document preview */}
        <div className="col-span-2">
          <div
            className="p-6 bg-white rounded-xl text-black text-sm leading-relaxed min-h-[400px] cursor-text"
            onMouseUp={handleTextSelect}
            dangerouslySetInnerHTML={{ __html: html }}
            style={{
              fontFamily: 'serif',
            }}
          />
          <style>{`
            .placeholder {
              background-color: #fef08a;
              padding: 1px 4px;
              border-radius: 3px;
              font-weight: bold;
            }
          `}</style>
        </div>

        {/* Placeholders list */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-300">Плейсхолдеры ({template.placeholders.length})</h3>
          {template.placeholders.length === 0 ? (
            <p className="text-xs text-gray-500">Выделите текст в документе слева, чтобы создать плейсхолдер</p>
          ) : (
            <div className="space-y-2">
              {template.placeholders.map((p, idx) => (
                <div key={idx} className="p-3 bg-dark-700/50 border border-dark-600/50 rounded-xl">
                  <div className="text-sm text-white font-medium">{p.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {`{{${p.key}}}`} &middot; {p.type} {p.required && '&middot; обязательное'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Placeholder creation modal */}
      {showPlaceholderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Создать плейсхолдер</h3>
            <p className="text-sm text-gray-400 mb-4">Выделенный текст: "{selectedText.text}"</p>
            <div className="space-y-3">
              <input type="text" value={phForm.key} onChange={(e) => setPhForm({ ...phForm, key: e.target.value })} placeholder="Ключ (латиница, например: employee_name)" className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50" />
              <input type="text" value={phForm.label} onChange={(e) => setPhForm({ ...phForm, label: e.target.value })} placeholder="Название (например: ФИО сотрудника)" className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50" />
              <select value={phForm.type} onChange={(e) => setPhForm({ ...phForm, type: e.target.value })} className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none">
                <option value="text">Текст</option>
                <option value="date">Дата</option>
                <option value="number">Число</option>
                <option value="select">Выбор из списка</option>
              </select>
              {phForm.type === 'select' && (
                <input type="text" value={phForm.options} onChange={(e) => setPhForm({ ...phForm, options: e.target.value })} placeholder="Варианты через запятую" className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50" />
              )}
              <input type="text" value={phForm.default_value} onChange={(e) => setPhForm({ ...phForm, default_value: e.target.value })} placeholder="Значение по умолчанию" className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50" />
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={phForm.required} onChange={(e) => setPhForm({ ...phForm, required: e.target.checked })} className="rounded" />
                Обязательное поле
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowPlaceholderModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Отмена</button>
              <button onClick={handleSetPlaceholder} disabled={saving} className="px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 text-sm disabled:opacity-50">
                {saving ? 'Сохранение...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
