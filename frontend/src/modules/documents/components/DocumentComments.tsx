import { useState, useEffect } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { DocumentComment, documentsService } from '@/shared/services/documents.service'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  documentId: string
}

export function DocumentComments({ documentId }: Props) {
  const [comments, setComments] = useState<DocumentComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadComments = async () => {
    try {
      const data = await documentsService.getComments(documentId)
      setComments(data)
    } catch (err) {
      console.error('Ошибка загрузки комментариев:', err)
    }
  }

  useEffect(() => {
    loadComments()
  }, [documentId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      await documentsService.addComment(documentId, newComment.trim())
      setNewComment('')
      loadComments()
    } catch (err) {
      console.error('Ошибка добавления комментария:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Написать комментарий..."
          className="flex-1 px-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2.5 bg-accent-purple/20 text-accent-purple rounded-xl hover:bg-accent-purple/30 transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {comments.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
          <MessageSquare className="w-4 h-4" />
          Нет комментариев
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="p-3 bg-dark-700/50 rounded-xl border border-dark-600/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{c.user_name || 'Пользователь'}</span>
                <span className="text-xs text-gray-500">{formatDate(c.created_at)}</span>
              </div>
              <p className="text-sm text-gray-300">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
