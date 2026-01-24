import { useEffect, useState } from "react";
import { Plus, Search, TrendingDown, Truck } from "lucide-react";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from "../../../shared/api/client";
import {
  equipmentCatalogService,
  type ModelConsumable,
} from "../../../shared/services/equipmentCatalog.service";

type Consumable = {
  id: string;
  name: string;
  model?: string;
  category?: string;
  consumable_type?: string;
  unit: string;
  quantity_in_stock: number;
  min_quantity: number;
  cost_per_unit?: number;
  supplier?: string;
  last_purchase_date?: string;
  created_at: string;
  updated_at: string;
};

const CONSUMABLE_TYPES = [
  "cartridge",
  "drum",
  "toner",
  "ink",
  "paper",
  "other",
];

const CONSUMABLE_TYPE_LABELS: Record<string, string> = {
  cartridge: "Картридж",
  drum: "Фотобарабан",
  toner: "Тонер",
  ink: "Чернила",
  paper: "Бумага",
  other: "Прочее",
};

export function ConsumablesPage() {
  const [items, setItems] = useState<Consumable[]>([]);
  const [modelConsumables, setModelConsumables] = useState<ModelConsumable[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showFromCatalog, setShowFromCatalog] = useState(false); // Показывать расходники из справочника моделей
  const [modalOpen, setModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedConsumable, setSelectedConsumable] =
    useState<Consumable | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Consumable | null>(null);
  const [form, setForm] = useState({
    name: "",
    model: "",
    category: "",
    consumable_type: "",
    unit: "шт",
    quantity_in_stock: 0,
    min_quantity: 0,
    cost_per_unit: "",
    supplier: "",
    last_purchase_date: "",
  });
  const [issueForm, setIssueForm] = useState({
    issued_to_id: "",
    quantity: 1,
    reason: "",
  });

  // Состояние для поставок
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [supplyForm, setSupplyForm] = useState({
    consumable_id: "",
    quantity: 1,
    cost: "",
    supplier: "",
    invoice_number: "",
    supply_date: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (showFromCatalog) {
        // Загружаем все расходники из справочника моделей
        // Нужно получить все модели и их расходники
        const brands = await equipmentCatalogService.getBrands();
        const allModelConsumables: ModelConsumable[] = [];

        for (const brand of brands) {
          const types = await equipmentCatalogService.getEquipmentTypes(
            brand.id,
          );
          for (const type of types) {
            const models = await equipmentCatalogService.getModels(type.id);
            for (const model of models) {
              const consumables =
                await equipmentCatalogService.getModelConsumables(model.id);
              allModelConsumables.push(
                ...consumables.map(
                  (c) =>
                    ({
                      ...c,
                      // Добавляем информацию о модели для отображения
                      model_name: model.name,
                      brand_name: brand.name,
                      type_name: type.name,
                    }) as ModelConsumable & {
                      model_name?: string;
                      brand_name?: string;
                      type_name?: string;
                    },
                ),
              );
            }
          }
        }

        // Фильтруем по поиску
        const filtered = search
          ? allModelConsumables.filter(
              (c) =>
                c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.part_number?.toLowerCase().includes(search.toLowerCase()),
            )
          : allModelConsumables;

        setModelConsumables(filtered as ModelConsumable[]);
        setItems([]);
      } else {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        params.set("page", String(page));
        params.set("page_size", "20");
        const data = await apiGet<Consumable[]>(`/it/consumables/?${params}`);
        setItems(data);
        setModelConsumables([]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, showFromCatalog]);

  const handleSearch = () => load();

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setMessage(null);
    setForm({
      name: "",
      model: "",
      category: "",
      consumable_type: "",
      unit: "шт",
      quantity_in_stock: 0,
      min_quantity: 0,
      cost_per_unit: "",
      supplier: "",
      last_purchase_date: "",
    });
    setModalOpen(true);
  };

  const openEdit = (c: Consumable) => {
    setEditing(c);
    setError(null);
    setMessage(null);
    setForm({
      name: c.name,
      model: c.model ?? "",
      category: c.category ?? "",
      consumable_type: c.consumable_type ?? "",
      unit: c.unit,
      quantity_in_stock: c.quantity_in_stock,
      min_quantity: c.min_quantity,
      cost_per_unit: c.cost_per_unit ? String(c.cost_per_unit) : "",
      supplier: c.supplier ?? "",
      last_purchase_date: c.last_purchase_date ?? "",
    });
    setModalOpen(true);
  };

  const openIssue = (c: Consumable) => {
    setSelectedConsumable(c);
    setIssueForm({
      issued_to_id: "",
      quantity: 1,
      reason: "",
    });
    setIssueModalOpen(true);
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      const submitData = {
        ...form,
        quantity_in_stock: Number(form.quantity_in_stock) || 0,
        min_quantity: Number(form.min_quantity) || 0,
        cost_per_unit: form.cost_per_unit
          ? Number(form.cost_per_unit)
          : undefined,
        last_purchase_date: form.last_purchase_date || undefined,
        model: form.model || undefined,
        category: form.category || undefined,
        consumable_type: form.consumable_type || undefined,
        supplier: form.supplier || undefined,
      };

      if (editing) {
        await apiPatch(`/it/consumables/${editing.id}`, submitData);
        setMessage("Расходный материал обновлен");
      } else {
        if (!form.name) {
          setError("Название обязательно");
          return;
        }
        await apiPost("/it/consumables/", submitData);
        setMessage("Расходный материал создан");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleIssue = async () => {
    if (!selectedConsumable || !issueForm.issued_to_id) {
      setError("Выберите получателя");
      return;
    }
    if (issueForm.quantity <= 0) {
      setError("Количество должно быть больше 0");
      return;
    }
    if (selectedConsumable.quantity_in_stock < issueForm.quantity) {
      setError(
        `Недостаточно на складе. В наличии: ${selectedConsumable.quantity_in_stock} ${selectedConsumable.unit}`,
      );
      return;
    }

    setError(null);
    try {
      await apiPost("/it/consumables/issues/", {
        consumable_id: selectedConsumable.id,
        quantity: issueForm.quantity,
        issued_to_id: issueForm.issued_to_id,
        reason: issueForm.reason || undefined,
      });
      setIssueModalOpen(false);
      setMessage("Расходный материал выдан");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить расходный материал?")) return;
    try {
      await apiDelete(`/it/consumables/${id}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Функции для поставок
  const openSupply = async () => {
    setError(null);
    setMessage(null);
    setSupplyForm({
      consumable_id: "",
      quantity: 1,
      cost: "",
      supplier: "",
      invoice_number: "",
      supply_date: new Date().toISOString().split("T")[0], // Сегодняшняя дата
      notes: "",
    });
    // Перезагружаем актуальный список расходников перед открытием
    await load();
    setSupplyModalOpen(true);
  };

  const handleSupply = async () => {
    if (!supplyForm.consumable_id) {
      setError("Выберите расходный материал");
      return;
    }
    if (supplyForm.quantity <= 0) {
      setError("Количество должно быть больше 0");
      return;
    }

    setError(null);
    try {
      await apiPost("/it/consumables/supplies/", {
        consumable_id: supplyForm.consumable_id,
        quantity: supplyForm.quantity,
        cost: supplyForm.cost ? Number(supplyForm.cost) : undefined,
        supplier: supplyForm.supplier || undefined,
        invoice_number: supplyForm.invoice_number || undefined,
        supply_date: supplyForm.supply_date || undefined,
        notes: supplyForm.notes || undefined,
      });
      setSupplyModalOpen(false);
      setMessage("Поставка добавлена, количество на складе обновлено");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const isLowStock = (item: Consumable) => {
    return item.quantity_in_stock <= item.min_quantity;
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Расходные материалы
        </h2>
        <p className="text-sm text-gray-500">
          Учет расходных материалов IT-отдела.
        </p>
      </div>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <input
            className="px-3 py-2 text-sm w-48"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="p-2 bg-gray-100 hover:bg-gray-200"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
        <label className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={showFromCatalog}
            onChange={(e) => {
              setShowFromCatalog(e.target.checked);
              setPage(1);
            }}
          />
          <span>Показать из справочника моделей</span>
        </label>
        {!showFromCatalog && (
          <>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <Plus className="w-4 h-4" /> Добавить
            </button>
            <button
              onClick={openSupply}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
            >
              <Truck className="w-4 h-4" /> Добавить поставку
            </button>
          </>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">
                  Название
                </th>
                {showFromCatalog && (
                  <>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      Марка
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">Тип</th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      Модель
                    </th>
                  </>
                )}
                <th className="px-4 py-3 font-medium text-gray-700">
                  Тип расходника
                </th>
                <th className="px-4 py-3 font-medium text-gray-700">Артикул</th>
                {!showFromCatalog && (
                  <>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      На складе
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      Мин. кол-во
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-700">
                      Ед. изм.
                    </th>
                  </>
                )}
                <th className="px-4 py-3 font-medium text-gray-700" />
              </tr>
            </thead>
            <tbody>
              {showFromCatalog ? (
                // Расходники из справочника моделей
                modelConsumables.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Нет расходных материалов в справочнике моделей
                    </td>
                  </tr>
                ) : (
                  modelConsumables.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-4 py-3">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {(item as any).brand_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {(item as any).type_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {(item as any).model_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {item.consumable_type ? (CONSUMABLE_TYPE_LABELS[item.consumable_type] || item.consumable_type) : "—"}
                      </td>
                      <td className="px-4 py-3">{item.part_number || "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={async () => {
                            // Создаем расходник в основном справочнике из расходника модели
                            try {
                              await apiPost("/it/consumables/", {
                                name: item.name,
                                consumable_type: item.consumable_type,
                                model: item.part_number,
                                unit: "шт",
                                quantity_in_stock: 0,
                                min_quantity: 0,
                              });
                              setMessage(
                                `Расходник "${item.name}" добавлен в основной справочник`,
                              );
                              setShowFromCatalog(false);
                              await load();
                            } catch (err) {
                              setError((err as Error).message);
                            }
                          }}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Добавить в справочник
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : // Обычные расходники
              items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Нет расходных материалов
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-gray-100 ${isLowStock(item) ? "bg-red-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isLowStock(item) && (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                        {item.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">{item.consumable_type ? (CONSUMABLE_TYPE_LABELS[item.consumable_type] || item.consumable_type) : "—"}</td>
                    <td className="px-4 py-3">{item.model || "—"}</td>
                    <td className="px-4 py-3 font-medium">
                      {item.quantity_in_stock}
                    </td>
                    <td className="px-4 py-3">{item.min_quantity}</td>
                    <td className="px-4 py-3">{item.unit}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openIssue(item)}
                        className="text-green-600 hover:underline mr-2"
                        disabled={item.quantity_in_stock === 0}
                      >
                        Выдать
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="text-blue-600 hover:underline mr-2"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900">
              {editing ? "Редактирование" : "Новый расходный материал"}
            </h3>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Название *"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Артикул
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Например: HP 85A"
                value={form.model}
                onChange={(e) =>
                  setForm((p) => ({ ...p, model: e.target.value }))
                }
              />
            </div>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Категория"
              value={form.category}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value }))
              }
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип расходника
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={form.consumable_type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, consumable_type: e.target.value }))
                }
              >
                <option value="">Тип не выбран</option>
                {CONSUMABLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONSUMABLE_TYPE_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Количество на складе
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  type="number"
                  placeholder="0"
                  value={form.quantity_in_stock}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      quantity_in_stock: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Минимальное количество
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  type="number"
                  placeholder="0"
                  value={form.min_quantity}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      min_quantity: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Единица измерения"
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
            />
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              type="number"
              step="0.01"
              placeholder="Стоимость за единицу"
              value={form.cost_per_unit}
              onChange={(e) =>
                setForm((p) => ({ ...p, cost_per_unit: e.target.value }))
              }
            />
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Поставщик"
              value={form.supplier}
              onChange={(e) =>
                setForm((p) => ({ ...p, supplier: e.target.value }))
              }
            />
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              type="date"
              placeholder="Дата последней покупки"
              value={form.last_purchase_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, last_purchase_date: e.target.value }))
              }
            />
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

      {/* Модальное окно выдачи */}
      {issueModalOpen && selectedConsumable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Выдача: {selectedConsumable.name}
            </h3>
            <p className="text-sm text-gray-500">
              В наличии: {selectedConsumable.quantity_in_stock}{" "}
              {selectedConsumable.unit}
            </p>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="ID получателя (UUID)"
              value={issueForm.issued_to_id}
              onChange={(e) =>
                setIssueForm((p) => ({ ...p, issued_to_id: e.target.value }))
              }
            />
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              type="number"
              min="1"
              max={selectedConsumable.quantity_in_stock}
              placeholder="Количество"
              value={issueForm.quantity}
              onChange={(e) =>
                setIssueForm((p) => ({
                  ...p,
                  quantity: Number(e.target.value) || 1,
                }))
              }
            />
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[80px]"
              placeholder="Причина выдачи (необязательно)"
              value={issueForm.reason}
              onChange={(e) =>
                setIssueForm((p) => ({ ...p, reason: e.target.value }))
              }
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIssueModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleIssue}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
              >
                Выдать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно добавления поставки */}
      {supplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900">
              Добавить поставку
            </h3>
            <p className="text-sm text-gray-500">
              Добавьте информацию о поступлении расходных материалов на склад
            </p>

            {/* Выбор расходного материала */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Расходный материал *
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={supplyForm.consumable_id}
                onChange={(e) =>
                  setSupplyForm((p) => ({
                    ...p,
                    consumable_id: e.target.value,
                  }))
                }
              >
                <option value="">Выберите расходный материал</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.model ? `(${item.model})` : ""} — на
                    складе: {item.quantity_in_stock} {item.unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Количество */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Количество *
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="number"
                min="1"
                placeholder="Количество"
                value={supplyForm.quantity}
                onChange={(e) =>
                  setSupplyForm((p) => ({
                    ...p,
                    quantity: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>

            {/* Стоимость поставки */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Стоимость поставки
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="number"
                step="0.01"
                placeholder="Общая стоимость поставки"
                value={supplyForm.cost}
                onChange={(e) =>
                  setSupplyForm((p) => ({ ...p, cost: e.target.value }))
                }
              />
            </div>

            {/* Поставщик */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Поставщик
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Название поставщика"
                value={supplyForm.supplier}
                onChange={(e) =>
                  setSupplyForm((p) => ({ ...p, supplier: e.target.value }))
                }
              />
            </div>

            {/* Номер накладной */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Номер накладной
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Номер накладной или счета"
                value={supplyForm.invoice_number}
                onChange={(e) =>
                  setSupplyForm((p) => ({
                    ...p,
                    invoice_number: e.target.value,
                  }))
                }
              />
            </div>

            {/* Дата поставки */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата поставки
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="date"
                value={supplyForm.supply_date}
                onChange={(e) =>
                  setSupplyForm((p) => ({ ...p, supply_date: e.target.value }))
                }
              />
            </div>

            {/* Примечания */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Примечания
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[80px]"
                placeholder="Дополнительная информация о поставке"
                value={supplyForm.notes}
                onChange={(e) =>
                  setSupplyForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSupplyModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleSupply}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
              >
                Добавить поставку
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
