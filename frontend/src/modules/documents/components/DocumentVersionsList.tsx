import { Download, FileText } from 'lucide-react'
import { DocumentVersion, documentsService } from '@/shared/services/documents.service'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  documentId: string
  versions: DocumentVersion[]
}

export function DocumentVersionsList({ documentId, versions }: Props) {
  const handleDownload = (version: number) => {
    const token = localStorage.getItem('token')
    const url = documentsService.getDownloadUrl(documentId, version)
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    // For authenticated download we use fetch
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
  }

  if (!versions.length) {
    return <p className="text-gray-500 text-sm">Нет версий</p>
  }

  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div key={v.id} className="flex items-center justify-between p-3 bg-dark-700/50 rounded-xl border border-dark-600/50">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm text-white font-medium">
                Версия {v.version}
                {v.version === versions[0]?.version && (
                  <span className="ml-2 text-xs text-accent-purple">(текущая)</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {v.file_name} &middot; {formatFileSize(v.file_size)} &middot; {formatDate(v.created_at)}
              </div>
              {v.change_note && (
                <div className="text-xs text-gray-400 mt-1">{v.change_note}</div>
              )}
            </div>
          </div>
          <button
            onClick={() => handleDownload(v.version)}
            className="p-2 text-gray-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors"
            title="Скачать"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
