import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/shared/api/client";

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string | null;
  image_color: string | null;
  is_active: boolean;
  date: string | null;
  created_at?: string;
}

const COLOR_OPTIONS = [
  { value: "bg-blue-100", label: "Голубой" },
  { value: "bg-green-100", label: "Зелёный" },
  { value: "bg-amber-100", label: "Жёлтый" },
  { value: "bg-orange-100", label: "Оранжевый" },
  { value: "bg-red-100", label: "Красный" },
  { value: "bg-gray-100", label: "Серый" },
];

export function AnnouncementsPage() {
  const [list, setList] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    image_color: "bg-blue-100",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<AnnouncementItem[]>("/portal/announcements");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      title: "",
      content: "",
      image_color: "bg-blue-100",
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (a: AnnouncementItem) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      content: a.content || "",
      image_color: a.image_color || "bg-blue-100",
      is_active: a.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Заголовок обязателен");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await apiPatch(`/portal/announcements/${editingId}`, {
          title: form.title.trim(),
          content: form.content.trim() || null,
          image_color: form.image_color,
          is_active: form.is_active,
        });
      } else {
        await apiPost("/portal/announcements", {
          title: form.title.trim(),
          content: form.content.trim() || null,
          image_color: form.image_color,
          is_active: form.is_active,
        });
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await apiDelete(`/portal/announcements/${id}`);
      setDeleteConfirmId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка удаления");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-green/10">
            <Megaphone className="w-6 h-6 text-brand-green" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Важные объявления
            </h1>
            <p className="text-sm text-gray-500">
              Объявления отображаются на главной странице портала
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Добавить объявление
        </button>
      </div>

      {error && !modalOpen && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">Нет объявлений</p>
          <p className="text-sm text-gray-400 mb-4">
            Добавьте первое объявление — оно появится на главной
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Добавить объявление
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Заголовок
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">
                    Цвет
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 w-28">
                    Статус
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">
                    Дата
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 w-28">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50"
                  >
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{a.title}</span>
                      {a.content && (
                        <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">
                          {a.content}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block w-8 h-6 rounded ${a.image_color || "bg-gray-100"}`}
                        title={a.image_color || ""}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          a.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {a.is_active ? "Показывается" : "Скрыто"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{a.date ?? "—"}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(a)}
                          className="p-2 text-gray-400 hover:text-brand-green hover:bg-gray-100 rounded-lg transition-colors"
                          title="Изменить"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === a.id ? (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(a.id)}
                              className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                              Да
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                              Нет
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(a.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Редактировать объявление" : "Новое объявление"}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Заголовок *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-green"
                  placeholder="Например: Важная информация"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Текст объявления
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-green min-h-[100px] resize-y"
                  placeholder="Описание или ссылка..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цвет плашки на главной
                </label>
                <select
                  value={form.image_color}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, image_color: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-brand-green"
                >
                  {COLOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, is_active: e.target.checked }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                />
                <span className="text-sm text-gray-700">
                  Показывать на главной странице
                </span>
              </label>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2.5 bg-brand-green text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Сохранение..." : editingId ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
