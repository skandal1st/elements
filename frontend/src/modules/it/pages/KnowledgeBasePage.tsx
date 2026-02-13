import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  BookOpen,
  Eye,
  FileText,
  Pin,
  Plus,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  knowledgeService,
  type KnowledgeArticle,
  type KnowledgeCategory,
  type KnowledgeTag,
  type SearchResultItem,
} from "@/shared/services/knowledge.service";
import { KnowledgeSearchBar } from "../components/KnowledgeSearchBar";
import { KnowledgeCategorySidebar } from "../components/KnowledgeCategorySidebar";
import { KnowledgeTagFilter } from "../components/KnowledgeTagFilter";
import { RichTextEditor } from "@/shared/components/RichTextEditor";
import { KnowledgeCategoryManager } from "../components/KnowledgeCategoryManager";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

type ArticleStatus = KnowledgeArticle["status"];

const statusLabel: Record<ArticleStatus, string> = {
  draft: "Черновик",
  unprocessed: "Не обработано",
  normalized: "Нормализовано",
  published: "Опубликовано",
  archived: "Архив",
};

const statusColor: Record<ArticleStatus, string> = {
  draft: "bg-dark-600/50 text-gray-300",
  unprocessed: "bg-orange-500/20 text-orange-300",
  normalized: "bg-green-500/20 text-green-300",
  published: "bg-blue-500/20 text-blue-300",
  archived: "bg-dark-800/40 text-gray-500",
};

const articleTypeLabel: Record<string, string> = {
  instruction: "Инструкция",
  solution: "Решение",
  faq: "FAQ",
  guide: "Руководство",
  note: "Заметка",
};

const difficultyLabel: Record<string, string> = {
  beginner: "Начальный",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function KnowledgeBasePage() {
  // Data
  const [items, setItems] = useState<KnowledgeArticle[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [tags, setTags] = useState<KnowledgeTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // Search
  const [searchMode, setSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTotal, setSearchTotal] = useState(0);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    raw_content: "",
    summary: "",
    article_type: "" as string,
    category_id: "" as string,
    difficulty_level: "" as string,
    tag_ids: [] as string[],
  });

  // Detail modal
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [normalizeLoading, setNormalizeLoading] = useState(false);

  // Edit fields
  const [editTitle, setEditTitle] = useState("");
  const [editRaw, setEditRaw] = useState("");
  const [editNormalized, setEditNormalized] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editArticleType, setEditArticleType] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("");
  const [editTagIds, setEditTagIds] = useState<string[]>([]);

  // Category manager modal
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const pendingOpenRef = useRef<string | null>(null);

  /* ---------------------------------------------------------------- */
  /* URL param handling                                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const openId = (params.get("open") || params.get("article") || "").trim();
    if (openId) pendingOpenRef.current = openId;
  }, [location.search]);

  /* ---------------------------------------------------------------- */
  /* Data loading                                                     */
  /* ---------------------------------------------------------------- */

  const loadArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await knowledgeService.getArticles({
        category_id: selectedCategoryId || undefined,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        status: statusFilter || undefined,
        article_type: typeFilter || undefined,
      });
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    try {
      const [catTree, tagList] = await Promise.all([
        knowledgeService.getCategoryTree(),
        knowledgeService.getPopularTags(50),
      ]);
      setCategories(catTree);
      setTags(tagList);
    } catch {
      // best-effort
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    if (!searchMode) {
      void loadArticles();
    }
  }, [selectedCategoryId, selectedTagIds, statusFilter, typeFilter, searchMode]);

  useEffect(() => {
    const openId = pendingOpenRef.current;
    if (!openId) return;
    if (items.length === 0 && loading) return;
    pendingOpenRef.current = null;
    void openDetail(openId);
    try {
      navigate("/it/knowledge", { replace: true });
    } catch {
      // ignore
    }
  }, [items, loading, navigate]);

  /* ---------------------------------------------------------------- */
  /* Search                                                           */
  /* ---------------------------------------------------------------- */

  const handleSearch = async (q: string) => {
    setSearchMode(true);
    setSearchQuery(q);
    setError(null);
    try {
      const res = await knowledgeService.search({
        q,
        type: "hybrid",
        category_id: selectedCategoryId || undefined,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });
      setSearchResults(res.items);
      setSearchTotal(res.total);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const clearSearch = () => {
    setSearchMode(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchTotal(0);
  };

  /* ---------------------------------------------------------------- */
  /* Detail                                                           */
  /* ---------------------------------------------------------------- */

  const openDetail = async (id: string) => {
    setError(null);
    setDetailId(id);
    try {
      const a = await knowledgeService.getArticle(id);
      setDetail(a);
      setEditTitle(a.title);
      setEditRaw(a.raw_content || "");
      setEditNormalized(a.normalized_content || "");
      setEditSummary(a.summary || "");
      setEditArticleType(a.article_type || "");
      setEditCategoryId(a.category_id || "");
      setEditDifficulty(a.difficulty_level || "");
      setEditTagIds(a.tags?.map((t) => t.id) || []);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
  };

  const saveArticle = async () => {
    if (!detailId) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (editTitle.trim()) payload.title = editTitle.trim();
      payload.raw_content = editRaw;
      payload.summary = editSummary;
      if (editArticleType) payload.article_type = editArticleType;
      if (editCategoryId) payload.category_id = editCategoryId;
      if (editDifficulty) payload.difficulty_level = editDifficulty;
      payload.tag_ids = editTagIds;
      const a = await knowledgeService.updateArticle(detailId, payload);
      setDetail(a);
      setItems((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const requestNormalization = async () => {
    if (!detailId) return;
    setNormalizeLoading(true);
    setError(null);
    try {
      const res = await knowledgeService.normalizePreview(detailId);
      setEditNormalized(res.normalized_content);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setNormalizeLoading(false);
    }
  };

  const confirmNormalization = async () => {
    if (!detailId || !editNormalized.trim()) {
      setError("normalized_content пустой");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const a = await knowledgeService.normalizeConfirm(detailId, {
        normalized_content: editNormalized,
        normalized_by: "user",
      });
      setDetail(a);
      setItems((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const publishArticle = async () => {
    if (!detailId) return;
    setSaving(true);
    setError(null);
    try {
      const a = await knowledgeService.updateArticle(detailId, { status: "published" });
      setDetail(a);
      setItems((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!detailId) return;
    setSaving(true);
    setError(null);
    try {
      const a = await knowledgeService.archiveArticle(detailId);
      setDetail(a);
      setItems((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Tag toggle                                                       */
  /* ---------------------------------------------------------------- */

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const toggleEditTag = (tagId: string) => {
    setEditTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  /* ---------------------------------------------------------------- */
  /* Image upload handler                                             */
  /* ---------------------------------------------------------------- */

  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    const res = await knowledgeService.uploadArticleImage(file);
    return res.url;
  }, []);

  /* ---------------------------------------------------------------- */
  /* Flat categories for selects                                      */
  /* ---------------------------------------------------------------- */

  const flatCategories = useMemo(() => {
    const result: KnowledgeCategory[] = [];
    const flatten = (cats: KnowledgeCategory[], depth = 0) => {
      for (const c of cats) {
        result.push({ ...c, name: "\u00A0\u00A0".repeat(depth) + c.name });
        if (c.children) flatten(c.children, depth + 1);
      }
    };
    flatten(categories);
    return result;
  }, [categories]);

  /* ---------------------------------------------------------------- */
  /* Sorted items                                                     */
  /* ---------------------------------------------------------------- */

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [items]);

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">База знаний</h2>
            <p className="text-gray-400">Статьи, инструкции и решения</p>
          </div>
          <button
            onClick={() => {
              setCreateForm({
                title: "",
                raw_content: "",
                summary: "",
                article_type: "",
                category_id: "",
                difficulty_level: "",
                tag_ids: [],
              });
              setCreateOpen(true);
            }}
            className="glass-button px-4 py-2.5 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Создать статью
          </button>
        </div>

        {/* Search bar */}
        <KnowledgeSearchBar onSearch={handleSearch} onClear={clearSearch} />
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Tag filter strip */}
      {tags.length > 0 && (
        <div className="glass-card p-3">
          <KnowledgeTagFilter
            tags={tags}
            selectedIds={selectedTagIds}
            onToggle={toggleTag}
          />
        </div>
      )}

      {/* Status / type filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-accent-purple/50"
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="unprocessed">Не обработано</option>
          <option value="normalized">Нормализовано</option>
          <option value="published">Опубликовано</option>
          <option value="archived">Архив</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-accent-purple/50"
        >
          <option value="">Все типы</option>
          <option value="instruction">Инструкция</option>
          <option value="solution">Решение</option>
          <option value="faq">FAQ</option>
          <option value="guide">Руководство</option>
          <option value="note">Заметка</option>
        </select>
        {searchMode && (
          <span className="text-sm text-gray-400">
            Результатов: {searchTotal} для «{searchQuery}»
          </span>
        )}
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-4">
        {/* Category sidebar */}
        {categories.length > 0 && (
          <div className="hidden lg:block w-56 flex-shrink-0">
            <div className="glass-card p-3 sticky top-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-3">
                Категории
              </h3>
              <KnowledgeCategorySidebar
                categories={categories}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
                onManageClick={() => setCategoryManagerOpen(true)}
              />
            </div>
          </div>
        )}

        {/* Article list / search results */}
        <div className="flex-1 min-w-0">
          {loading && !searchMode ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
            </div>
          ) : searchMode ? (
            /* Search results */
            <div className="glass-card overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-dark-600/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статья</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">
                      <Eye className="w-3.5 h-3.5 inline" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {searchResults.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-dark-700/30 cursor-pointer transition-colors"
                      onClick={() => void openDetail(r.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="text-white font-medium truncate">{r.title}</div>
                        {r.summary && (
                          <div className="text-xs text-gray-500 truncate mt-0.5">{r.summary}</div>
                        )}
                        {r.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {r.tags.slice(0, 3).map((t) => (
                              <span key={t.id} className="px-1.5 py-0.5 text-[10px] rounded bg-dark-600/50 text-gray-400">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status as ArticleStatus] || ""}`}>
                          {statusLabel[r.status as ArticleStatus] || r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {r.article_type ? articleTypeLabel[r.article_type] || r.article_type : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{r.views_count}</td>
                    </tr>
                  ))}
                  {searchResults.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                        Ничего не найдено
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Regular article list */
            <div className="glass-card overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-dark-600/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статья</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сложность</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">
                      <Eye className="w-3.5 h-3.5 inline" />
                    </th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {sorted.map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-dark-700/30 cursor-pointer transition-colors"
                      onClick={() => void openDetail(a.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {a.is_pinned && <Pin className="w-3.5 h-3.5 text-accent-purple flex-shrink-0" />}
                          <FileText className="w-4 h-4 text-accent-purple flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">{a.title}</div>
                            <div className="text-xs text-gray-500">
                              v{a.normalization_version} • {new Date(a.updated_at).toLocaleString("ru-RU")}
                            </div>
                            {a.tags && a.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {a.tags.slice(0, 3).map((t) => (
                                  <span key={t.id} className="px-1.5 py-0.5 text-[10px] rounded bg-dark-600/50 text-gray-400">
                                    {t.name}
                                  </span>
                                ))}
                                {a.tags.length > 3 && (
                                  <span className="text-[10px] text-gray-500">+{a.tags.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[a.status]}`}>
                          {statusLabel[a.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {a.article_type ? articleTypeLabel[a.article_type] || a.article_type : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {a.difficulty_level ? difficultyLabel[a.difficulty_level] || a.difficulty_level : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{a.views_count}</td>
                      <td className="px-4 py-3">
                        <button className="text-sm text-accent-purple hover:text-accent-violet transition-colors">
                          Открыть
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        Статей пока нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* Create modal                                                 */}
      {/* ============================================================ */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl p-6 space-y-4 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Новая статья</h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all"
              placeholder="Заголовок"
              value={createForm.title}
              onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
            />

            <textarea
              className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all min-h-[100px] resize-none"
              placeholder="Краткое описание (summary)…"
              value={createForm.summary}
              onChange={(e) => setCreateForm((p) => ({ ...p, summary: e.target.value }))}
            />

            <div>
              <div className="text-xs text-gray-500 mb-1">Текст статьи</div>
              <RichTextEditor
                key="create-editor"
                value={createForm.raw_content}
                onChange={(html) => setCreateForm((p) => ({ ...p, raw_content: html }))}
                onImageUpload={handleImageUpload}
                placeholder="Текст статьи (raw_content)…"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={createForm.article_type}
                onChange={(e) => setCreateForm((p) => ({ ...p, article_type: e.target.value }))}
                className="px-3 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-accent-purple/50"
              >
                <option value="">Тип статьи</option>
                <option value="instruction">Инструкция</option>
                <option value="solution">Решение</option>
                <option value="faq">FAQ</option>
                <option value="guide">Руководство</option>
                <option value="note">Заметка</option>
              </select>

              <select
                value={createForm.category_id}
                onChange={(e) => setCreateForm((p) => ({ ...p, category_id: e.target.value }))}
                className="px-3 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-accent-purple/50"
              >
                <option value="">Категория</option>
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={createForm.difficulty_level}
                onChange={(e) => setCreateForm((p) => ({ ...p, difficulty_level: e.target.value }))}
                className="px-3 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-accent-purple/50"
              >
                <option value="">Сложность</option>
                <option value="beginner">Начальный</option>
                <option value="intermediate">Средний</option>
                <option value="advanced">Продвинутый</option>
              </select>
            </div>

            {/* Tags selection */}
            {tags.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-2">Теги</div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const sel = createForm.tag_ids.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setCreateForm((p) => ({
                            ...p,
                            tag_ids: sel ? p.tag_ids.filter((id) => id !== t.id) : [...p.tag_ids, t.id],
                          }))
                        }
                        className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                          sel
                            ? "bg-accent-purple/30 text-white border border-accent-purple/50"
                            : "bg-dark-700/50 text-gray-400 border border-dark-600/50 hover:text-white"
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  if (!createForm.title.trim()) {
                    setError("Заголовок обязателен");
                    return;
                  }
                  setError(null);
                  try {
                    const a = await knowledgeService.createArticle({
                      title: createForm.title.trim(),
                      raw_content: createForm.raw_content || null,
                      summary: createForm.summary || undefined,
                      article_type: createForm.article_type || undefined,
                      category_id: createForm.category_id || undefined,
                      difficulty_level: createForm.difficulty_level || undefined,
                      tag_ids: createForm.tag_ids.length > 0 ? createForm.tag_ids : undefined,
                    });
                    setCreateOpen(false);
                    setItems((prev) => [a, ...prev]);
                    void openDetail(a.id);
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
                className="glass-button px-4 py-2.5"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Detail modal                                                 */}
      {/* ============================================================ */}
      {detailId && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-5xl p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            {/* Title row */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-accent-purple flex-shrink-0" />
                <input
                  className="text-xl font-semibold text-white bg-dark-700/50 border border-dark-600/50 rounded-xl px-3 py-2 flex-1 focus:outline-none focus:border-accent-purple/50 transition-all min-w-0"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Заголовок"
                />
              </div>
              <div className="flex items-center gap-2 ml-4">
                {saving && <span className="text-xs text-accent-purple">Сохранение…</span>}
                <button
                  onClick={closeDetail}
                  className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Status & meta badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[detail.status]}`}>
                {statusLabel[detail.status]}
              </span>
              <span className="text-xs text-gray-500">
                {detail.source === "ticket" ? "Источник: тикет" : "Источник: вручную"}
              </span>
              {detail.reading_time_minutes && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> {detail.reading_time_minutes} мин
                </span>
              )}
              {detail.views_count > 0 && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {detail.views_count}
                </span>
              )}
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" /> {detail.helpful_count}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <ThumbsDown className="w-3 h-3" /> {detail.not_helpful_count}
              </span>
            </div>

            {/* Summary */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500">Краткое описание</div>
              <textarea
                className="w-full px-4 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all min-h-[60px] resize-none"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="Краткое описание статьи…"
              />
            </div>

            {/* Metadata selects row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={editArticleType}
                onChange={(e) => setEditArticleType(e.target.value)}
                className="px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-accent-purple/50"
              >
                <option value="">Тип статьи</option>
                <option value="instruction">Инструкция</option>
                <option value="solution">Решение</option>
                <option value="faq">FAQ</option>
                <option value="guide">Руководство</option>
                <option value="note">Заметка</option>
              </select>

              <select
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
                className="px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-accent-purple/50"
              >
                <option value="">Категория</option>
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={editDifficulty}
                onChange={(e) => setEditDifficulty(e.target.value)}
                className="px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-accent-purple/50"
              >
                <option value="">Сложность</option>
                <option value="beginner">Начальный</option>
                <option value="intermediate">Средний</option>
                <option value="advanced">Продвинутый</option>
              </select>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-2">Теги</div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const sel = editTagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleEditTag(t.id)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                          sel
                            ? "bg-accent-purple/30 text-white border border-accent-purple/50"
                            : "bg-dark-700/50 text-gray-400 border border-dark-600/50 hover:text-white"
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500">raw_content</div>
                <RichTextEditor
                  key={`edit-raw-${detailId}`}
                  value={editRaw}
                  onChange={setEditRaw}
                  onImageUpload={handleImageUpload}
                  placeholder="Свободный текст статьи…"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500">normalized_content</div>
                <textarea
                  className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all min-h-[260px] resize-none"
                  value={editNormalized}
                  onChange={(e) => setEditNormalized(e.target.value)}
                  placeholder={`Problem:\nSymptoms:\nEnvironment:\nRoot cause:\nSolution steps:\nVerification:\nNotes:`}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 border-t border-dark-600/50 pt-4">
              <button
                onClick={() => void saveArticle()}
                disabled={saving}
                className="glass-button px-4 py-2.5 disabled:opacity-50"
              >
                Сохранить
              </button>
              <button
                onClick={() => void requestNormalization()}
                disabled={normalizeLoading || saving}
                className="px-4 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 transition-all bg-dark-700/50 text-gray-300 border border-dark-600/50 hover:text-white disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {normalizeLoading ? "Нормализация…" : "Нормализовать (LLM)"}
              </button>
              <button
                onClick={() => void confirmNormalization()}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 transition-all bg-green-500/15 text-green-300 border border-green-500/25 hover:bg-green-500/20 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                Подтвердить нормализацию
              </button>
              {(detail.status === "normalized" || detail.status === "draft") && (
                <button
                  onClick={() => void publishArticle()}
                  disabled={saving}
                  className="px-4 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 transition-all bg-blue-500/15 text-blue-300 border border-blue-500/25 hover:bg-blue-500/20 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Опубликовать
                </button>
              )}
              <button
                onClick={() => void archive()}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 transition-all bg-dark-700/50 text-gray-400 border border-dark-600/50 hover:text-white disabled:opacity-50"
              >
                <Archive className="w-4 h-4" />
                В архив
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Category Manager modal                                       */}
      {/* ============================================================ */}
      {categoryManagerOpen && (
        <KnowledgeCategoryManager
          onClose={() => setCategoryManagerOpen(false)}
          onCategoriesChanged={() => void loadMeta()}
        />
      )}
    </section>
  );
}
