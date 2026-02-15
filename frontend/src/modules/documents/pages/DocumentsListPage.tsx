import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Clock } from 'lucide-react'
import { DocumentItem, DocumentType, MyApprovalItem, documentsService } from '@/shared/services/documents.service'
import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { DocumentFilters } from '../components/DocumentFilters'

type TabType = 'all' | 'my' | 'approvals'

export function DocumentsListPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabType>('all')
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [myApprovals, setMyApprovals] = useState<MyApprovalItem[]>([])
  const [types, setTypes] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const currentUserId = (() => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return null
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub
    } catch { return null }
  })()

  const load = async () => {
    setLoading(true)
    try {
      const [docs, t] = await Promise.all([
        documentsService.getDocuments({
          status: statusFilter || undefined,
          document_type_id: typeFilter || undefined,
          creator_id: tab === 'my' ? currentUserId || undefined : undefined,
          search: search || undefined,
        }),
        documentsService.getTypes(),
      ])
      setDocuments(docs)
      setTypes(t)
    } catch (err) {
      console.error('Ошибка загрузки документов:', err)
    }
    // Загружаем мои согласования отдельно, чтобы ошибка не блокировала список
    try {
      setMyApprovals(await documentsService.getMyApprovals())
    } catch (err) {
      console.error('Ошибка загрузки согласований:', err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [tab, statusFilter, typeFilter])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(), 300)
    return () => clearTimeout(t)
  }, [search])

  const displayedDocs = tab === 'all' || tab === 'my' ? documents : []

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Документы</h2>
        <button
          onClick={() => navigate('/documents/create')}
          className="flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-xl hover:bg-accent-purple/80 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Создать документ
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'all', label: 'Все документы' },
          { key: 'my', label: 'Мои документы' },
          { key: 'approvals', label: `На согласовании (${myApprovals.length})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm rounded-xl transition-colors ${
              tab === key
                ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'approvals' && (
        <DocumentFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          types={types}
        />
      )}

      {loading ? (
        <div className="text-gray-400 text-center py-8">Загрузка...</div>
      ) : tab === 'approvals' ? (
        <div className="space-y-2">
          {myApprovals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Нет документов на согласовании</p>
          ) : (
            myApprovals.map((a) => (
              <div
                key={a.step_instance_id}
                onClick={() => navigate(`/documents/view/${a.document_id}`)}
                className="flex items-center justify-between p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl cursor-pointer hover:border-accent-purple/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <div>
                    <div className="text-sm text-white font-medium">{a.document_title}</div>
                    <div className="text-xs text-gray-500">
                      от {a.document_creator_name || 'Пользователь'} &middot; Шаг {a.step_order}
                      {a.deadline_at && ` &middot; Дедлайн: ${formatDate(a.deadline_at)}`}
                    </div>
                  </div>
                </div>
                <DocumentStatusBadge status={a.document_status} />
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayedDocs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Нет документов</p>
          ) : (
            displayedDocs.map((d) => (
              <div
                key={d.id}
                onClick={() => navigate(`/documents/view/${d.id}`)}
                className="flex items-center justify-between p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl cursor-pointer hover:border-accent-purple/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-white font-medium">{d.title}</div>
                    <div className="text-xs text-gray-500">
                      {d.document_type_name || 'Без типа'} &middot; {d.creator_name || 'Пользователь'} &middot; {formatDate(d.created_at)}
                    </div>
                  </div>
                </div>
                <DocumentStatusBadge status={d.status} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
