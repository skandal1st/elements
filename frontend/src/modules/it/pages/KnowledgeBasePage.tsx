import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Archive, FileText, Plus, Sparkles, X } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "../../../shared/api/client";

type KnowledgeArticle = {
  id: string;
  title: string;
  status: "draft" | "unprocessed" | "normalized" | "archived";
  source: "manual" | "ticket";
  raw_content?: string | null;
  normalized_content?: string | null;
  normalization_version: number;
  normalized_by?: "llm" | "user" | null;
  created_from_ticket_id?: string | null;
  equipment_ids: string[];
  linked_article_ids: string[];
  confidence_score: number;
  is_typical: boolean;
  created_at: string;
  updated_at: string;
};

type NormalizePreview = {
  normalized_content: string;
  normalization_version: number;
};

const statusLabel: Record<KnowledgeArticle["status"], string> = {
  draft: "Черновик",
  unprocessed: "Не обработано",
  normalized: "Нормализовано",
  archived: "Архив",
};

const statusColor: Record<KnowledgeArticle["status"], string> = {
  draft: "bg-dark-600/50 text-gray-300",
  unprocessed: "bg-orange-500/20 text-orange-300",
  normalized: "bg-green-500/20 text-green-300",
  archived: "bg-dark-800/40 text-gray-500",
};

export function KnowledgeBasePage() {
  const [items, setItems] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", raw_content: "" });

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [normalizeLoading, setNormalizeLoading] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editRaw, setEditRaw] = useState("");
  const [editNormalized, setEditNormalized] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const pendingOpenRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const openId = (params.get("open") || params.get("article") || "").trim();
    if (openId) pendingOpenRef.current = openId;
  }, [location.search]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<KnowledgeArticle[]>("/it/knowledge/articles/");
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

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

  const openDetail = async (id: string) => {
    setError(null);
    setDetailId(id);
    try {
      const a = await apiGet<KnowledgeArticle>(`/it/knowledge/articles/${id}`);
      setDetail(a);
      setEditTitle(a.title);
      setEditRaw(a.raw_content || "");
      setEditNormalized(a.normalized_content || "");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setEditTitle("");
    setEditRaw("");
    setEditNormalized("");
  };

  const saveArticle = async () => {
    if (!detailId) return;
    setSaving(true);
    setError(null);
    try {
      const payload: any = {};
      if (editTitle.trim()) payload.title = editTitle.trim();
      payload.raw_content = editRaw;
      await apiPatch(`/it/knowledge/articles/${detailId}`, payload);
      const a = await apiGet<KnowledgeArticle>(`/it/knowledge/articles/${detailId}`);
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
      const res = await apiPost<NormalizePreview>(
        `/it/knowledge/articles/${detailId}/normalize/preview`,
        {},
      );
      setEditNormalized(res.normalized_content);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setNormalizeLoading(false);
    }
  };

  const confirmNormalization = async () => {
    if (!detailId) return;
    if (!editNormalized.trim()) {
      setError("normalized_content пустой");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const a = await apiPost<KnowledgeArticle>(
        `/it/knowledge/articles/${detailId}/normalize/confirm`,
        { normalized_content: editNormalized, normalized_by: "user" },
      );
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
      const a = await apiPost<KnowledgeArticle>(
        `/it/knowledge/articles/${detailId}/archive`,
        {},
      );
      setDetail(a);
      setItems((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sorted = useMemo(() => {
    return [...items].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [items]);

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">База знаний</h2>
            <p className="text-gray-400">
              Статьи решений (Knowledge Core, Этап 1)
            </p>
          </div>
          <button
            onClick={() => {
              setCreateForm({ title: "", raw_content: "" });
              setCreateOpen(true);
            }}
            className="glass-button px-4 py-2.5 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Создать статью
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-dark-600/50">
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статья
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Источник
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {sorted.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-dark-700/30 cursor-pointer transition-colors"
                  onClick={() => void openDetail(a.id)}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-accent-purple" />
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">
                          {a.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          v{a.normalization_version} •{" "}
                          {new Date(a.updated_at).toLocaleString("ru-RU")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[a.status]}`}
                    >
                      {statusLabel[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-400">
                    {a.source === "ticket" ? "Тикет" : "Вручную"}
                    {a.is_typical ? (
                      <span className="ml-2 text-xs text-orange-300">
                        (типовое)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <button className="text-sm text-accent-purple hover:text-accent-violet transition-colors">
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    Статей пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 mx-4">
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
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, title: e.target.value }))
              }
            />

            <textarea
              className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all min-h-[140px] resize-none"
              placeholder="Черновик текста (raw_content)…"
              value={createForm.raw_content}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, raw_content: e.target.value }))
              }
            />

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
                    const a = await apiPost<KnowledgeArticle>(
                      "/it/knowledge/articles/",
                      {
                        title: createForm.title.trim(),
                        raw_content: createForm.raw_content || null,
                        equipment_ids: [],
                        linked_article_ids: [],
                      },
                    );
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

      {/* Detail modal */}
      {detailId && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-4xl p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
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
                {saving && (
                  <span className="text-xs text-accent-purple">Сохранение…</span>
                )}
                <button
                  onClick={closeDetail}
                  className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[detail.status]}`}
              >
                {statusLabel[detail.status]}
              </span>
              <span className="text-xs text-gray-500">
                {detail.source === "ticket" ? "Источник: тикет" : "Источник: вручную"}
              </span>
              {detail.created_from_ticket_id ? (
                <span className="text-xs text-gray-500">
                  Тикет: {detail.created_from_ticket_id}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500">raw_content</div>
                <textarea
                  className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all min-h-[260px] resize-none"
                  value={editRaw}
                  onChange={(e) => setEditRaw(e.target.value)}
                  placeholder="Свободный текст статьи…"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500">
                  normalized_content
                </div>
                <textarea
                  className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all min-h-[260px] resize-none"
                  value={editNormalized}
                  onChange={(e) => setEditNormalized(e.target.value)}
                  placeholder={`Problem:\nSymptoms:\nEnvironment:\nRoot cause:\nSolution steps:\nVerification:\nNotes:`}
                />
              </div>
            </div>

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
                title="Сгенерировать структурированный текст из raw_content (LLM только по флагу)"
              >
                <Sparkles className="w-4 h-4" />
                {normalizeLoading ? "Нормализация…" : "Нормализовать (LLM)"}
              </button>
              <button
                onClick={() => void confirmNormalization()}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-medium rounded-xl flex items-center gap-2 transition-all bg-green-500/15 text-green-300 border border-green-500/25 hover:bg-green-500/20 disabled:opacity-50"
                title="Подтвердить (или вручную отредактировать) normalized_content"
              >
                <Sparkles className="w-4 h-4" />
                Подтвердить нормализацию
              </button>
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
    </section>
  );
}

