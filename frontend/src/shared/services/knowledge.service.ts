import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KnowledgeCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  color?: string | null
  parent_id?: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  children?: KnowledgeCategory[]
}

export interface KnowledgeTag {
  id: string
  name: string
  color?: string | null
  usage_count: number
  created_at: string
}

export interface KnowledgeArticle {
  id: string
  title: string
  status: 'draft' | 'unprocessed' | 'normalized' | 'published' | 'archived'
  source: 'manual' | 'ticket'
  raw_content?: string | null
  normalized_content?: string | null
  normalization_version: number
  normalized_by?: 'llm' | 'user' | null
  created_from_ticket_id?: string | null
  equipment_ids: string[]
  linked_article_ids: string[]
  confidence_score: number
  is_typical: boolean
  article_type?: 'instruction' | 'solution' | 'faq' | 'guide' | 'note' | null
  category_id?: string | null
  summary?: string | null
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
  author_id?: string | null
  last_editor_id?: string | null
  reading_time_minutes?: number | null
  views_count: number
  helpful_count: number
  not_helpful_count: number
  is_pinned: boolean
  is_featured: boolean
  published_at?: string | null
  tags: KnowledgeTag[]
  created_at: string
  updated_at: string
}

export interface SearchResultItem {
  id: string
  title: string
  summary?: string | null
  status: string
  article_type?: string | null
  category_id?: string | null
  difficulty_level?: string | null
  views_count: number
  helpful_count: number
  tags: KnowledgeTag[]
  rank: number
  updated_at: string
}

export interface SearchResponse {
  items: SearchResultItem[]
  total: number
  query: string
  search_type: string
}

export interface AutocompleteResponse {
  suggestions: string[]
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const knowledgeService = {
  // Categories
  async getCategories(): Promise<KnowledgeCategory[]> {
    return apiGet<KnowledgeCategory[]>('/it/knowledge/categories/')
  },

  async getCategoryTree(): Promise<KnowledgeCategory[]> {
    return apiGet<KnowledgeCategory[]>('/it/knowledge/categories/tree')
  },

  async createCategory(data: {
    name: string
    description?: string
    icon?: string
    color?: string
    parent_id?: string
    sort_order?: number
  }): Promise<KnowledgeCategory> {
    return apiPost<KnowledgeCategory>('/it/knowledge/categories/', data)
  },

  async updateCategory(id: string, data: {
    name?: string
    description?: string
    icon?: string
    color?: string
    parent_id?: string | null
    sort_order?: number
    is_active?: boolean
  }): Promise<KnowledgeCategory> {
    return apiPatch<KnowledgeCategory>(`/it/knowledge/categories/${id}`, data)
  },

  async deleteCategory(id: string): Promise<void> {
    return apiDelete(`/it/knowledge/categories/${id}`)
  },

  // Tags
  async getTags(search?: string): Promise<KnowledgeTag[]> {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    return apiGet<KnowledgeTag[]>(`/it/knowledge/tags/?${params}`)
  },

  async getPopularTags(limit = 20): Promise<KnowledgeTag[]> {
    return apiGet<KnowledgeTag[]>(`/it/knowledge/tags/popular?limit=${limit}`)
  },

  async createTag(data: { name: string; color?: string }): Promise<KnowledgeTag> {
    return apiPost<KnowledgeTag>('/it/knowledge/tags/', data)
  },

  async deleteTag(id: string): Promise<void> {
    return apiDelete(`/it/knowledge/tags/${id}`)
  },

  // Articles
  async getArticles(params?: {
    status?: string
    category_id?: string
    article_type?: string
    difficulty_level?: string
    tag_ids?: string[]
    is_pinned?: boolean
    search?: string
    limit?: number
  }): Promise<KnowledgeArticle[]> {
    const sp = new URLSearchParams()
    if (params?.status) sp.set('status', params.status)
    if (params?.category_id) sp.set('category_id', params.category_id)
    if (params?.article_type) sp.set('article_type', params.article_type)
    if (params?.difficulty_level) sp.set('difficulty_level', params.difficulty_level)
    if (params?.tag_ids?.length) sp.set('tag_ids', params.tag_ids.join(','))
    if (params?.is_pinned !== undefined) sp.set('is_pinned', String(params.is_pinned))
    if (params?.search) sp.set('search', params.search)
    if (params?.limit) sp.set('limit', String(params.limit))
    return apiGet<KnowledgeArticle[]>(`/it/knowledge/articles/?${sp}`)
  },

  async getArticle(id: string): Promise<KnowledgeArticle> {
    return apiGet<KnowledgeArticle>(`/it/knowledge/articles/${id}`)
  },

  async createArticle(data: {
    title: string
    raw_content?: string | null
    article_type?: string
    category_id?: string
    summary?: string
    difficulty_level?: string
    tag_ids?: string[]
    equipment_ids?: string[]
    linked_article_ids?: string[]
  }): Promise<KnowledgeArticle> {
    return apiPost<KnowledgeArticle>('/it/knowledge/articles/', data)
  },

  async updateArticle(id: string, data: Record<string, unknown>): Promise<KnowledgeArticle> {
    return apiPatch<KnowledgeArticle>(`/it/knowledge/articles/${id}`, data)
  },

  async archiveArticle(id: string): Promise<KnowledgeArticle> {
    return apiPost<KnowledgeArticle>(`/it/knowledge/articles/${id}/archive`, {})
  },

  async normalizePreview(id: string): Promise<{ normalized_content: string; normalization_version: number }> {
    return apiPost(`/it/knowledge/articles/${id}/normalize/preview`, {})
  },

  async normalizeConfirm(id: string, data: { normalized_content: string; normalized_by: string }): Promise<KnowledgeArticle> {
    return apiPost<KnowledgeArticle>(`/it/knowledge/articles/${id}/normalize/confirm`, data)
  },

  async articleFeedback(id: string, helped: boolean): Promise<KnowledgeArticle> {
    return apiPost<KnowledgeArticle>(`/it/knowledge/articles/${id}/feedback`, { helped })
  },

  // Search
  async search(params: {
    q: string
    type?: string
    category_id?: string
    tag_ids?: string[]
    status?: string
    article_type?: string
    difficulty_level?: string
    limit?: number
    offset?: number
  }): Promise<SearchResponse> {
    const sp = new URLSearchParams()
    sp.set('q', params.q)
    if (params.type) sp.set('type', params.type)
    if (params.category_id) sp.set('category_id', params.category_id)
    if (params.tag_ids?.length) sp.set('tag_ids', params.tag_ids.join(','))
    if (params.status) sp.set('status', params.status)
    if (params.article_type) sp.set('article_type', params.article_type)
    if (params.difficulty_level) sp.set('difficulty_level', params.difficulty_level)
    if (params.limit) sp.set('limit', String(params.limit))
    if (params.offset) sp.set('offset', String(params.offset))
    return apiGet<SearchResponse>(`/it/knowledge/search/?${sp}`)
  },

  async autocomplete(q: string, limit = 10): Promise<AutocompleteResponse> {
    return apiGet<AutocompleteResponse>(`/it/knowledge/search/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`)
  },

  async popularQueries(days = 30, limit = 10): Promise<Array<{ query: string; count: number }>> {
    return apiGet(`/it/knowledge/search/popular?days=${days}&limit=${limit}`)
  },
}
