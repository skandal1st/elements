import { useState, useRef } from 'react'
import { Paperclip, Upload } from 'lucide-react'
import { DocumentAttachment, documentsService } from '@/shared/services/documents.service'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

interface Props {
  documentId: string
  attachments: DocumentAttachment[]
  canUpload: boolean
  onUpdate: () => void
}

export function DocumentAttachments({ documentId, attachments, canUpload, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await documentsService.addAttachment(documentId, file)
      onUpdate()
    } catch (err) {
      console.error('Ошибка загрузки вложения:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {canUpload && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-dark-600/50 hover:border-accent-purple/30 rounded-xl transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Загрузка...' : 'Добавить вложение'}
          </button>
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-gray-500 text-sm">Нет вложений</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-xl border border-dark-600/50">
              <Paperclip className="w-4 h-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{a.file_name}</div>
                <div className="text-xs text-gray-500">{formatFileSize(a.file_size)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
