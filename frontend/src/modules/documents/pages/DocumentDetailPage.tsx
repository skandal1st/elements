import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload } from 'lucide-react'
import { DocumentDetail, ApprovalInstance, documentsService } from '@/shared/services/documents.service'
import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { DocumentVersionsList } from '../components/DocumentVersionsList'
import { DocumentAttachments } from '../components/DocumentAttachments'
import { DocumentComments } from '../components/DocumentComments'
import { ApprovalTimeline } from '../components/ApprovalTimeline'
import { ApprovalActions } from '../components/ApprovalActions'

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [approvalInstances, setApprovalInstances] = useState<ApprovalInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'versions' | 'attachments' | 'comments' | 'approval'>('versions')
  const [uploadingVersion, setUploadingVersion] = useState(false)
  const versionFileRef = useRef<HTMLInputElement>(null)

  const currentUserId = (() => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return null
      return JSON.parse(atob(token.split('.')[1])).sub
    } catch { return null }
  })()

  const load = async () => {
    if (!id) return
    try {
      const [d, instances] = await Promise.all([
        documentsService.getDocument(id),
        documentsService.getApprovalStatus(id).catch(() => []),
      ])
      setDoc(d)
      setApprovalInstances(instances)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleUploadVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    const changeNote = prompt('Причина новой версии (необязательно):')
    setUploadingVersion(true)
    try {
      await documentsService.uploadNewVersion(id, file, changeNote || undefined)
      load()
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки')
    } finally {
      setUploadingVersion(false)
      if (versionFileRef.current) versionFileRef.current.value = ''
    }
  }

  if (loading) return <div className="text-gray-400">Загрузка...</div>
  if (!doc) return <div className="text-gray-400">Документ не найден</div>

  const isCreator = currentUserId === doc.creator_id
  const isPendingApprover = approvalInstances.some(inst =>
    inst.status === 'in_progress' &&
    inst.step_instances.some(s =>
      s.approver_id === currentUserId &&
      s.step_order === inst.current_step_order &&
      s.status === 'pending'
    )
  )

  const tabs = [
    { key: 'versions' as const, label: `Версии (${doc.versions.length})` },
    { key: 'attachments' as const, label: `Вложения (${doc.attachments.length})` },
    { key: 'comments' as const, label: 'Комментарии' },
    { key: 'approval' as const, label: 'Согласование' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/documents/list')} className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors mt-0.5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">{doc.title}</h2>
            <DocumentStatusBadge status={doc.status} />
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {doc.document_type_name || 'Без типа'} &middot; {doc.creator_name || 'Пользователь'} &middot; Версия {doc.current_version}
          </div>
          {doc.description && <p className="text-sm text-gray-500 mt-2">{doc.description}</p>}
        </div>
      </div>

      {/* Actions */}
      <ApprovalActions
        documentId={doc.id}
        documentStatus={doc.status}
        isCreator={isCreator}
        isPendingApprover={isPendingApprover}
        hasApprovalRoute={!!doc.approval_route_id}
        onAction={load}
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dark-600/50 pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm rounded-xl transition-colors ${
              activeTab === t.key
                ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          {isCreator && (
            <div>
              <input ref={versionFileRef} type="file" className="hidden" onChange={handleUploadVersion} />
              <button
                onClick={() => versionFileRef.current?.click()}
                disabled={uploadingVersion}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-dark-600/50 hover:border-accent-purple/30 rounded-xl transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploadingVersion ? 'Загрузка...' : 'Загрузить новую версию'}
              </button>
            </div>
          )}
          <DocumentVersionsList documentId={doc.id} versions={doc.versions} />
        </div>
      )}

      {activeTab === 'attachments' && (
        <DocumentAttachments
          documentId={doc.id}
          attachments={doc.attachments}
          canUpload={true}
          onUpdate={load}
        />
      )}

      {activeTab === 'comments' && (
        <DocumentComments documentId={doc.id} />
      )}

      {activeTab === 'approval' && (
        <ApprovalTimeline instances={approvalInstances} />
      )}
    </div>
  )
}
