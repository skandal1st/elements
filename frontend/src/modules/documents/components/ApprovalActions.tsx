import { useState, useEffect } from 'react'
import { Check, X, Send, Ban, Download } from 'lucide-react'
import { ApprovalRoute, documentsService } from '@/shared/services/documents.service'

interface Props {
  documentId: string
  documentStatus: string
  isCreator: boolean
  isPendingApprover: boolean
  hasApprovalRoute: boolean
  onAction: () => void
}

export function ApprovalActions({ documentId, documentStatus, isCreator, isPendingApprover, hasApprovalRoute, onAction }: Props) {
  const [showModal, setShowModal] = useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRouteSelect, setShowRouteSelect] = useState(false)
  const [routes, setRoutes] = useState<ApprovalRoute[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState('')

  useEffect(() => {
    if (showRouteSelect && routes.length === 0) {
      documentsService.getRoutes().then(setRoutes).catch(console.error)
    }
  }, [showRouteSelect])

  const handleSubmit = async (routeId?: string) => {
    setLoading(true)
    try {
      await documentsService.submitForApproval(documentId, routeId || undefined)
      setShowRouteSelect(false)
      setSelectedRouteId('')
      onAction()
    } catch (err: any) {
      alert(err.message || 'Ошибка отправки на согласование')
    } finally {
      setLoading(false)
    }
  }

  const handleDecision = async () => {
    if (!showModal) return
    setLoading(true)
    try {
      if (showModal === 'approve') {
        await documentsService.approveDocument(documentId, comment || undefined)
      } else {
        await documentsService.rejectDocument(documentId, comment || undefined)
      }
      setShowModal(null)
      setComment('')
      onAction()
    } catch (err: any) {
      alert(err.message || 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Отменить документ?')) return
    setLoading(true)
    try {
      await documentsService.cancelDocument(documentId)
      onAction()
    } catch (err: any) {
      alert(err.message || 'Ошибка отмены')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadSheet = () => {
    const token = localStorage.getItem('token')
    const url = documentsService.getApprovalSheetUrl(documentId)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = 'approval_sheet.pdf'
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Отправить на согласование */}
        {isCreator && (documentStatus === 'draft' || documentStatus === 'rejected') && (
          hasApprovalRoute ? (
            <button
              onClick={() => handleSubmit()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 transition-colors text-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {documentStatus === 'rejected' ? 'Отправить повторно' : 'На согласование'}
            </button>
          ) : (
            <button
              onClick={() => setShowRouteSelect(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 transition-colors text-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              На согласование
            </button>
          )
        )}

        {/* Согласовать / Отклонить */}
        {isPendingApprover && (
          <>
            <button
              onClick={() => setShowModal('approve')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Согласовать
            </button>
            <button
              onClick={() => setShowModal('reject')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Отклонить
            </button>
          </>
        )}

        {/* Отменить */}
        {isCreator && documentStatus !== 'cancelled' && documentStatus !== 'approved' && (
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 border border-dark-600/50 rounded-xl hover:text-white hover:border-red-500/30 transition-colors text-sm disabled:opacity-50"
          >
            <Ban className="w-4 h-4" />
            Отменить
          </button>
        )}

        {/* Скачать лист согласования */}
        {(documentStatus === 'approved' || documentStatus === 'rejected' || documentStatus === 'pending_approval') && (
          <button
            onClick={handleDownloadSheet}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 border border-dark-600/50 rounded-xl hover:text-white transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Лист согласования
          </button>
        )}
      </div>

      {/* Модальное окно решения */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              {showModal === 'approve' ? 'Согласование документа' : 'Отклонение документа'}
            </h3>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Комментарий (необязательно)"
              rows={3}
              className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowModal(null); setComment('') }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Отмена
              </button>
              <button
                onClick={handleDecision}
                disabled={loading}
                className={`px-4 py-2 rounded-xl text-white text-sm transition-colors disabled:opacity-50 ${
                  showModal === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? 'Обработка...' : showModal === 'approve' ? 'Согласовать' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно выбора маршрута */}
      {showRouteSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Выберите маршрут согласования</h3>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white focus:outline-none focus:border-accent-purple/50"
            >
              <option value="">Выберите маршрут...</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowRouteSelect(false); setSelectedRouteId('') }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Отмена
              </button>
              <button
                onClick={() => handleSubmit(selectedRouteId)}
                disabled={loading || !selectedRouteId}
                className="px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 text-sm disabled:opacity-50"
              >
                {loading ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
