import { apiGet, apiPost, apiPatch, apiPut, apiDelete, apiUpload } from '../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentType {
  id: string
  name: string
  description?: string | null
  code: string
  default_route_id?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DocumentVersion {
  id: string
  document_id: string
  version: number
  file_path: string
  file_name: string
  file_size: number
  mime_type?: string | null
  change_note?: string | null
  created_by?: string | null
  created_at: string
}

export interface DocumentAttachment {
  id: string
  document_id: string
  file_path: string
  file_name: string
  file_size: number
  mime_type?: string | null
  uploaded_by?: string | null
  created_at: string
}

export interface DocumentItem {
  id: string
  document_type_id?: string | null
  template_id?: string | null
  title: string
  description?: string | null
  status: string
  current_version: number
  creator_id: string
  approval_route_id?: string | null
  created_at: string
  updated_at: string
  creator_name?: string | null
  document_type_name?: string | null
}

export interface DocumentDetail extends DocumentItem {
  versions: DocumentVersion[]
  attachments: DocumentAttachment[]
}

export interface DocumentComment {
  id: string
  document_id: string
  user_id: string
  content: string
  created_at: string
  user_name?: string | null
}

export interface DocumentTemplate {
  id: string
  document_type_id?: string | null
  name: string
  description?: string | null
  file_path: string
  file_name: string
  placeholders: Placeholder[]
  version: number
  is_active: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface Placeholder {
  id?: string
  key: string
  label: string
  type: string
  required: boolean
  options: string[]
  default_value: string
}

export interface ApprovalRoute {
  id: string
  name: string
  description?: string | null
  steps: RouteStep[]
  is_active: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface RouteStep {
  order: number
  type: string
  name: string
  approvers: { user_id: string; name: string }[]
  deadline_hours?: number
}

export interface ApprovalStepInstance {
  id: string
  approval_instance_id: string
  step_order: number
  approver_id: string
  status: string
  decision_at?: string | null
  comment?: string | null
  deadline_at?: string | null
  carry_over: boolean
  created_at: string
  approver_name?: string | null
}

export interface ApprovalInstance {
  id: string
  document_id: string
  route_id?: string | null
  route_snapshot?: RouteStep[] | null
  status: string
  current_step_order: number
  attempt: number
  started_at?: string | null
  completed_at?: string | null
  created_at: string
  step_instances: ApprovalStepInstance[]
}

export interface MyApprovalItem {
  document_id: string
  document_title: string
  document_status: string
  step_instance_id: string
  step_order: number
  deadline_at?: string | null
  document_creator_name?: string | null
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const documentsService = {
  // Document Types
  async getTypes(active?: boolean): Promise<DocumentType[]> {
    const params = new URLSearchParams()
    if (active !== undefined) params.set('active', String(active))
    return apiGet<DocumentType[]>(`/documents/types/?${params}`)
  },

  async createType(data: { name: string; code: string; description?: string; default_route_id?: string; is_active?: boolean }): Promise<DocumentType> {
    return apiPost<DocumentType>('/documents/types/', data)
  },

  async updateType(id: string, data: Record<string, unknown>): Promise<DocumentType> {
    return apiPatch<DocumentType>(`/documents/types/${id}`, data)
  },

  async deleteType(id: string): Promise<void> {
    return apiDelete(`/documents/types/${id}`)
  },

  // Documents
  async getDocuments(params?: { status?: string; document_type_id?: string; creator_id?: string; search?: string }): Promise<DocumentItem[]> {
    const sp = new URLSearchParams()
    if (params?.status) sp.set('status', params.status)
    if (params?.document_type_id) sp.set('document_type_id', params.document_type_id)
    if (params?.creator_id) sp.set('creator_id', params.creator_id)
    if (params?.search) sp.set('search', params.search)
    return apiGet<DocumentItem[]>(`/documents/?${sp}`)
  },

  async getDocument(id: string): Promise<DocumentDetail> {
    return apiGet<DocumentDetail>(`/documents/${id}`)
  },

  async uploadDocument(file: File, title: string, description?: string, documentTypeId?: string, approvalRouteId?: string): Promise<DocumentItem> {
    const formData = new FormData()
    formData.append('file', file)
    const params = new URLSearchParams()
    params.set('title', title)
    if (description) params.set('description', description)
    if (documentTypeId) params.set('document_type_id', documentTypeId)
    if (approvalRouteId) params.set('approval_route_id', approvalRouteId)
    return apiUpload<DocumentItem>(`/documents/upload?${params}`, formData)
  },

  async updateDocument(id: string, data: { title?: string; description?: string; document_type_id?: string; approval_route_id?: string }): Promise<DocumentItem> {
    return apiPatch<DocumentItem>(`/documents/${id}`, data)
  },

  async uploadNewVersion(documentId: string, file: File, changeNote?: string): Promise<DocumentVersion> {
    const formData = new FormData()
    formData.append('file', file)
    const params = new URLSearchParams()
    if (changeNote) params.set('change_note', changeNote)
    return apiUpload<DocumentVersion>(`/documents/${documentId}/new-version?${params}`, formData)
  },

  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    return apiGet<DocumentVersion[]>(`/documents/${documentId}/versions`)
  },

  getDownloadUrl(documentId: string, version: number): string {
    return `/api/v1/documents/${documentId}/versions/${version}/download`
  },

  // Attachments
  async addAttachment(documentId: string, file: File): Promise<DocumentAttachment> {
    const formData = new FormData()
    formData.append('file', file)
    return apiUpload<DocumentAttachment>(`/documents/${documentId}/attachments`, formData)
  },

  async getAttachments(documentId: string): Promise<DocumentAttachment[]> {
    return apiGet<DocumentAttachment[]>(`/documents/${documentId}/attachments`)
  },

  // Comments
  async addComment(documentId: string, content: string): Promise<DocumentComment> {
    return apiPost<DocumentComment>(`/documents/${documentId}/comments`, { content })
  },

  async getComments(documentId: string): Promise<DocumentComment[]> {
    return apiGet<DocumentComment[]>(`/documents/${documentId}/comments`)
  },

  // Templates
  async getTemplates(params?: { document_type_id?: string; active?: boolean }): Promise<DocumentTemplate[]> {
    const sp = new URLSearchParams()
    if (params?.document_type_id) sp.set('document_type_id', params.document_type_id)
    if (params?.active !== undefined) sp.set('active', String(params.active))
    return apiGet<DocumentTemplate[]>(`/documents/templates/?${sp}`)
  },

  async getTemplate(id: string): Promise<DocumentTemplate> {
    return apiGet<DocumentTemplate>(`/documents/templates/${id}`)
  },

  async uploadTemplate(file: File, name: string, description?: string, documentTypeId?: string): Promise<DocumentTemplate> {
    const formData = new FormData()
    formData.append('file', file)
    const params = new URLSearchParams()
    params.set('name', name)
    if (description) params.set('description', description)
    if (documentTypeId) params.set('document_type_id', documentTypeId)
    return apiUpload<DocumentTemplate>(`/documents/templates/upload?${params}`, formData)
  },

  async updateTemplate(id: string, data: Record<string, unknown>): Promise<DocumentTemplate> {
    return apiPatch<DocumentTemplate>(`/documents/templates/${id}`, data)
  },

  async deleteTemplate(id: string): Promise<void> {
    await apiDelete(`/documents/templates/${id}`)
  },

  async getTemplateContent(id: string): Promise<{ html: string; placeholders: Placeholder[] }> {
    return apiGet(`/documents/templates/${id}/content`)
  },

  async setPlaceholder(templateId: string, data: { paragraph_index: number; start: number; end: number; placeholder: Placeholder }): Promise<DocumentTemplate> {
    return apiPost<DocumentTemplate>(`/documents/templates/${templateId}/set-placeholder`, data)
  },

  getTemplateDownloadUrl(templateId: string): string {
    return `/api/v1/documents/templates/${templateId}/download`
  },

  async createFromTemplate(data: { template_id: string; title: string; description?: string; document_type_id?: string; approval_route_id?: string; values: Record<string, string> }): Promise<DocumentItem> {
    return apiPost<DocumentItem>('/documents/templates/from-template', data)
  },

  // Approval Routes
  async getRoutes(): Promise<ApprovalRoute[]> {
    return apiGet<ApprovalRoute[]>('/documents/routes/')
  },

  async getRoute(id: string): Promise<ApprovalRoute> {
    return apiGet<ApprovalRoute>(`/documents/routes/${id}`)
  },

  async createRoute(data: { name: string; description?: string; steps: RouteStep[] }): Promise<ApprovalRoute> {
    return apiPost<ApprovalRoute>('/documents/routes/', data)
  },

  async updateRoute(id: string, data: { name?: string; description?: string; steps?: RouteStep[]; is_active?: boolean }): Promise<ApprovalRoute> {
    return apiPut<ApprovalRoute>(`/documents/routes/${id}`, data)
  },

  async deleteRoute(id: string): Promise<void> {
    return apiDelete(`/documents/routes/${id}`)
  },

  // Approval Actions
  async submitForApproval(documentId: string, routeId?: string): Promise<ApprovalInstance> {
    return apiPost<ApprovalInstance>(`/documents/${documentId}/submit`, { route_id: routeId || null })
  },

  async approveDocument(documentId: string, comment?: string): Promise<ApprovalInstance> {
    return apiPost<ApprovalInstance>(`/documents/${documentId}/approve`, { comment: comment || null })
  },

  async rejectDocument(documentId: string, comment?: string): Promise<ApprovalInstance> {
    return apiPost<ApprovalInstance>(`/documents/${documentId}/reject`, { comment: comment || null })
  },

  async cancelDocument(documentId: string): Promise<void> {
    return apiPost(`/documents/${documentId}/cancel`, {})
  },

  async getApprovalStatus(documentId: string): Promise<ApprovalInstance[]> {
    return apiGet<ApprovalInstance[]>(`/documents/${documentId}/approval`)
  },

  async getMyApprovals(): Promise<MyApprovalItem[]> {
    return apiGet<MyApprovalItem[]>('/documents/my-approvals')
  },

  getApprovalSheetUrl(documentId: string): string {
    return `/api/v1/documents/${documentId}/approval-sheet`
  },
}
