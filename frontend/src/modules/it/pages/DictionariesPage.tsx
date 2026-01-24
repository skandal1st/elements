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
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Справочники</h2>
        <p className="text-sm text-gray-500">
          Управление справочниками системы.
        </p>
      </div>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">Все типы</option>
          {DICTIONARY_TYPES.map((t) => (
            <option key={t} value={t}>
              {dictionaryTypeLabel[t] || t}
            </option>
          ))}
        </select>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Добавить элемент
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
      {!loading && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => (
            <div
              key={type}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {dictionaryTypeLabel[type] || type}
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      item.is_active
                        ? "bg-gray-50 border-gray-200"
                        : "bg-gray-100 border-gray-300 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.is_system && (
                        <Lock className="w-4 h-4 text-gray-500" />
                      )}
                      {item.color && (
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.label}
                        </div>
                        <div className="text-xs text-gray-500">{item.key}</div>
                      </div>
                      {item.is_active ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!item.is_system && (
                        <button
                          onClick={() => toggleActive(item)}
                          className={`px-2 py-1 text-xs rounded ${
                            item.is_active
                              ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {item.is_active ? "Деактивировать" : "Активировать"}
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(item)}
                        className="text-blue-600 hover:underline"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!item.is_system && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:underline"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editing
                ? "Редактирование элемента"
                : "Новый элемент справочника"}
            </h3>
            {editing && editing.is_system && (
              <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                Системный элемент: можно изменять только название, цвет и иконку
              </p>
            )}
            {!editing && (
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={form.dictionary_type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dictionary_type: e.target.value }))
                }
              >
                {DICTIONARY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {dictionaryTypeLabel[t] || t}
                  </option>
                ))}
              </select>
            )}
            {!editing && (
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Ключ (только латиница и _)"
                value={form.key}
                onChange={(e) =>
                  setForm((p) => ({ ...p, key: e.target.value.toLowerCase() }))
                }
              />
            )}
            {editing && (
              <div className="text-sm text-gray-500">
                Ключ: <span className="font-mono">{form.key}</span> (нельзя
                изменить)
              </div>
            )}
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Название *"
              value={form.label}
              onChange={(e) =>
                setForm((p) => ({ ...p, label: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="color"
                placeholder="Цвет"
                value={form.color || "#000000"}
                onChange={(e) =>
                  setForm((p) => ({ ...p, color: e.target.value }))
                }
              />
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                  <span className="text-sm text-gray-700">Активен</span>
                </label>
              </>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
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
