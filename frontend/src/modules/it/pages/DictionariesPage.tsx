import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Lock, CheckCircle, XCircle } from "lucide-react";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from "../../../shared/api/client";

type Dictionary = {
  id: string;
  dictionary_type: string;
  key: string;
  label: string;
  color?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

const DICTIONARY_TYPES = [
  "ticket_category",
  "ticket_priority",
  "ticket_status",
  "equipment_category",
  "equipment_status",
  "consumable_type",
];

const dictionaryTypeLabel: Record<string, string> = {
  ticket_category: "Категории заявок",
  ticket_priority: "Приоритеты заявок",
  ticket_status: "Статусы заявок",
  equipment_category: "Категории оборудования",
  equipment_status: "Статусы оборудования",
  consumable_type: "Типы расходников",
};

export function DictionariesPage() {
  const [items, setItems] = useState<Dictionary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Dictionary | null>(null);
  const [form, setForm] = useState({
    dictionary_type: "ticket_category",
    key: "",
    label: "",
    color: "",
    icon: "",
    sort_order: 0,
    is_active: true,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedType) params.set("type", selectedType);
      const data = await apiGet<Dictionary[]>(`/it/dictionaries/?${params}`);
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setMessage(null);
    setForm({
      dictionary_type: selectedType || "ticket_category",
      key: "",
      label: "",
      color: "",
      icon: "",
      sort_order: 0,
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (dic: Dictionary) => {
    setEditing(dic);
    setError(null);
    setMessage(null);
    setForm({
      dictionary_type: dic.dictionary_type,
      key: dic.key,
      label: dic.label,
      color: dic.color || "",
      icon: dic.icon || "",
      sort_order: dic.sort_order,
      is_active: dic.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      if (editing) {
        // Для редактирования убираем поля, которые нельзя менять
        const updateData: any = {
          label: form.label,
          color: form.color || undefined,
          icon: form.icon || undefined,
        };
        if (!editing.is_system) {
          updateData.sort_order = form.sort_order;
          updateData.is_active = form.is_active;
        }
        await apiPatch(`/it/dictionaries/${editing.id}`, updateData);
        setMessage("Элемент справочника обновлен");
      } else {
        if (!form.key || !form.label) {
          setError("Ключ и название обязательны");
          return;
        }
        await apiPost("/it/dictionaries/", form);
        setMessage("Элемент справочника создан");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить элемент справочника?")) return;
    try {
      await apiDelete(`/it/dictionaries/${id}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleActive = async (dic: Dictionary) => {
    if (dic.is_system) return;
    try {
      await apiPatch(`/it/dictionaries/${dic.id}`, {
        is_active: !dic.is_active,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Группируем по типам
  const grouped = items.reduce(
    (acc, item) => {
      if (!acc[item.dictionary_type]) {
        acc[item.dictionary_type] = [];
      }
      acc[item.dictionary_type].push(item);
      return acc;
    },
    {} as Record<string, Dictionary[]>,
  );

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Справочники</h2>
            <p className="text-gray-400">Управление справочниками системы</p>
          </div>
          <button onClick={openCreate} className="glass-button px-4 py-2.5 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Добавить элемент
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">{message}</p>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="glass-input px-4 py-2.5 text-sm"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="" className="bg-dark-800">Все типы</option>
          {DICTIONARY_TYPES.map((t) => (
            <option key={t} value={t} className="bg-dark-800">
              {dictionaryTypeLabel[t] || t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {dictionaryTypeLabel[type] || type}
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                      item.is_active
                        ? "bg-dark-700/30 border-dark-600/50"
                        : "bg-dark-800/50 border-dark-700/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.is_system && <Lock className="w-4 h-4 text-gray-500" />}
                      {item.color && (
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
                      )}
                      <div>
                        <div className="font-medium text-white">{item.label}</div>
                        <div className="text-xs text-gray-500">{item.key}</div>
                      </div>
                      {item.is_active ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!item.is_system && (
                        <button
                          onClick={() => toggleActive(item)}
                          className={`px-3 py-1.5 text-xs rounded-xl transition-all ${
                            item.is_active
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                              : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                          }`}
                        >
                          {item.is_active ? "Деактивировать" : "Активировать"}
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 text-gray-400 hover:text-accent-purple hover:bg-dark-700/50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!item.is_system && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">
              {editing ? "Редактирование элемента" : "Новый элемент справочника"}
            </h3>
            {editing && editing.is_system && (
              <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                Системный элемент: можно изменять только название, цвет и иконку
              </p>
            )}
            {!editing && (
              <select
                className="glass-input w-full px-4 py-3 text-sm"
                value={form.dictionary_type}
                onChange={(e) => setForm((p) => ({ ...p, dictionary_type: e.target.value }))}
              >
                {DICTIONARY_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-dark-800">
                    {dictionaryTypeLabel[t] || t}
                  </option>
                ))}
              </select>
            )}
            {!editing && (
              <input
                className="glass-input w-full px-4 py-3 text-sm"
                placeholder="Ключ (только латиница и _)"
                value={form.key}
                onChange={(e) =>
                  setForm((p) => ({ ...p, key: e.target.value.toLowerCase() }))
                }
              />
            )}
            {editing && (
              <div className="text-sm text-gray-400">
                Ключ: <span className="font-mono text-gray-300">{form.key}</span> (нельзя изменить)
              </div>
            )}
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              placeholder="Название *"
              value={form.label}
              onChange={(e) =>
                setForm((p) => ({ ...p, label: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="glass-input w-full px-4 py-3 text-sm"
                type="color"
                placeholder="Цвет"
                value={form.color || "#000000"}
                onChange={(e) =>
                  setForm((p) => ({ ...p, color: e.target.value }))
                }
              />
              <input
                className="glass-input w-full px-4 py-3 text-sm"
                placeholder="Иконка"
                value={form.icon}
                onChange={(e) =>
                  setForm((p) => ({ ...p, icon: e.target.value }))
                }
              />
            </div>
            {!editing || !editing.is_system ? (
              <>
                <input
                  className="glass-input w-full px-4 py-3 text-sm"
                  type="number"
                  min="0"
                  placeholder="Порядок сортировки"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      sort_order: Number(e.target.value) || 0,
                    }))
                  }
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, is_active: e.target.checked }))
                    }
                  />
                  <span className="text-sm text-gray-400">Активен</span>
                </label>
              </>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="glass-button-secondary px-4 py-2 text-sm font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                className="glass-button px-4 py-2 text-sm font-medium"
              >
                {editing ? "Сохранить" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
