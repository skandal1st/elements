import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Truck,
  Check,
} from "lucide-react";
import { apiGet, apiPost, apiPatch } from "../../../shared/api/client";

type EquipmentRequest = {
  id: string;
  title: string;
  description?: string;
  equipment_category: string;
  request_type: string;
  quantity: number;
  urgency: string;
  justification?: string;
  status: string;
  requester_id: string;
  requester_name?: string;
  requester_email?: string;
  requester_department?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  replace_equipment_id?: string;
  replace_equipment_name?: string;
  replace_equipment_inventory?: string;
  issued_equipment_id?: string;
  issued_equipment_name?: string;
  issued_equipment_inventory?: string;
  estimated_cost?: number;
  review_comment?: string;
  reviewed_at?: string;
  ordered_at?: string;
  received_at?: string;
  issued_at?: string;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = [
  "computer",
  "monitor",
  "printer",
  "network",
  "server",
  "mobile",
  "peripheral",
  "other",
];

const categoryLabel: Record<string, string> = {
  computer: "Компьютер",
  monitor: "Монитор",
  printer: "Принтер",
  network: "Сетевое оборудование",
  server: "Сервер",
  mobile: "Мобильное устройство",
  peripheral: "Периферия",
  other: "Прочее",
};

const REQUEST_TYPES = ["new", "replacement", "upgrade"];
const URGENCIES = ["low", "normal", "high", "critical"];

const statusLabel: Record<string, string> = {
  pending: "На рассмотрении",
  approved: "Одобрена",
  rejected: "Отклонена",
  ordered: "Заказана",
  received: "Получена",
  issued: "Выдана",
  cancelled: "Отменена",
};

const urgencyLabel: Record<string, string> = {
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  critical: "Критическая",
};

const requestTypeLabel: Record<string, string> = {
  new: "Новое",
  replacement: "Замена",
  upgrade: "Улучшение",
};

export function EquipmentRequestsPage() {
  const [items, setItems] = useState<EquipmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<EquipmentRequest | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<EquipmentRequest | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    equipment_category: "computer",
    request_type: "new",
    quantity: 1,
    urgency: "normal",
    justification: "",
    replace_equipment_id: "",
    estimated_cost: "",
  });
  const [reviewForm, setReviewForm] = useState({
    status: "approved",
    comment: "",
    estimated_cost: "",
  });
  const [equipmentOptions, setEquipmentOptions] = useState<
    { id: string; name: string; inventory_number: string }[]
  >([]);
  const [equipmentOptionsLoading, setEquipmentOptionsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("page_size", "20");
      const data = await apiGet<EquipmentRequest[]>(
        `/it/equipment-requests/?${params}`,
      );
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
  }, [page]);

  const loadEquipmentForReplacement = async () => {
    setEquipmentOptionsLoading(true);
    try {
      const data = await apiGet<{ id: string; name: string; inventory_number: string }[]>(
        `/it/equipment/?page=1&page_size=500&status=in_use`,
      );
      setEquipmentOptions(Array.isArray(data) ? data : []);
    } catch {
      setEquipmentOptions([]);
    } finally {
      setEquipmentOptionsLoading(false);
    }
  };

  useEffect(() => {
    if (modalOpen && form.request_type === "replacement") {
      loadEquipmentForReplacement();
    } else {
      setEquipmentOptions([]);
    }
  }, [modalOpen, form.request_type]);

  const handleSearch = () => {
    setPage(1);
    load();
  };

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setMessage(null);
    setForm({
      title: "",
      description: "",
      equipment_category: "computer",
      request_type: "new",
      quantity: 1,
      urgency: "normal",
      justification: "",
      replace_equipment_id: "",
      estimated_cost: "",
    });
    setModalOpen(true);
  };

  const openEdit = (req: EquipmentRequest) => {
    if (req.status !== "pending") {
      setError('Можно редактировать только заявки в статусе "На рассмотрении"');
      return;
    }
    setEditing(req);
    setError(null);
    setMessage(null);
    setForm({
      title: req.title,
      description: req.description || "",
      equipment_category: req.equipment_category,
      request_type: req.request_type,
      quantity: req.quantity,
      urgency: req.urgency,
      justification: req.justification || "",
      replace_equipment_id: req.replace_equipment_id || "",
      estimated_cost: req.estimated_cost ? String(req.estimated_cost) : "",
    });
    setModalOpen(true);
  };

  const openDetail = async (req: EquipmentRequest) => {
    setSelectedRequest(req);
    setDetailModalOpen(true);
    try {
      const data = await apiGet<EquipmentRequest>(
        `/it/equipment-requests/${req.id}`,
      );
      setSelectedRequest(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openReview = (req: EquipmentRequest) => {
    setSelectedRequest(req);
    setReviewForm({
      status: "approved",
      comment: "",
      estimated_cost: req.estimated_cost ? String(req.estimated_cost) : "",
    });
    setReviewModalOpen(true);
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      const submitData = {
        ...form,
        quantity: Number(form.quantity) || 1,
        estimated_cost: form.estimated_cost
          ? Number(form.estimated_cost)
          : undefined,
        replace_equipment_id:
          form.request_type === "replacement" && form.replace_equipment_id
            ? form.replace_equipment_id
            : undefined,
        description: form.description || undefined,
        justification: form.justification || undefined,
      };

      if (editing) {
        await apiPatch(`/it/equipment-requests/${editing.id}`, submitData);
        setMessage("Заявка обновлена");
      } else {
        if (!form.title || !form.equipment_category) {
          setError("Название и категория обязательны");
          return;
        }
        await apiPost("/it/equipment-requests/", submitData);
        setMessage("Заявка создана");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleReview = async () => {
    if (!selectedRequest) return;
    setError(null);
    try {
      await apiPost(`/it/equipment-requests/${selectedRequest.id}/review`, {
        status: reviewForm.status,
        comment: reviewForm.comment || undefined,
        estimated_cost: reviewForm.estimated_cost
          ? Number(reviewForm.estimated_cost)
          : undefined,
      });
      setReviewModalOpen(false);
      setMessage(
        `Заявка ${reviewForm.status === "approved" ? "одобрена" : "отклонена"}`,
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Отменить заявку?")) return;
    try {
      await apiPost(`/it/equipment-requests/${id}/cancel`, {});
      setMessage("Заявка отменена");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "issued":
        return <Check className="w-4 h-4 text-blue-500" />;
      case "ordered":
        return <Package className="w-4 h-4 text-yellow-500" />;
      case "received":
        return <Truck className="w-4 h-4 text-purple-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Заявки на оборудование</h2>
            <p className="text-gray-400">Заявки сотрудников на новое оборудование или замену</p>
          </div>
          <button onClick={openCreate} className="glass-button px-4 py-2.5 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Создать заявку
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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Поиск заявок..."
          />
        </div>
        <button onClick={handleSearch} className="glass-button-secondary px-4 py-2.5 flex items-center gap-2">
          <Search className="w-4 h-4" /> Найти
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-dark-600/50">
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Срочность</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Заявитель</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {items.map((req) => (
                <tr key={req.id} className="hover:bg-dark-700/30 transition-colors">
                  <td className="px-4 py-4">
                    <span className="text-white font-medium">{req.title}</span>
                  </td>
                  <td className="px-4 py-4 text-gray-400">{categoryLabel[req.equipment_category] || req.equipment_category}</td>
                  <td className="px-4 py-4 text-gray-400">{requestTypeLabel[req.request_type] || req.request_type}</td>
                  <td className="px-4 py-4 text-gray-400">{urgencyLabel[req.urgency] || req.urgency}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 text-gray-400">
                      {getStatusIcon(req.status)}
                      {statusLabel[req.status] || req.status}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-400">{req.requester_name || "—"}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDetail(req)}
                      className="text-accent-purple hover:text-accent-blue transition-colors"
                    >
                      Подробнее
                    </button>
                    {req.status === "pending" && (
                      <>
                        <button
                          onClick={() => openEdit(req)}
                          className="text-green-400 hover:text-green-300 transition-colors"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => handleCancel(req.id)}
                          className="text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          Отменить
                        </button>
                      </>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-lg font-semibold text-white">
              {editing
                ? "Редактирование заявки"
                : "Новая заявка на оборудование"}
            </h3>
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              placeholder="Название *"
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
            <textarea
              className="glass-input w-full px-4 py-3 text-sm min-h-[80px] resize-none"
              placeholder="Описание"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
            <select
              className="glass-input w-full px-4 py-3 text-sm"
              value={form.equipment_category}
              onChange={(e) =>
                setForm((p) => ({ ...p, equipment_category: e.target.value }))
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-dark-800">
                  {categoryLabel[c] || c}
                </option>
              ))}
            </select>
            <select
              className="glass-input w-full px-4 py-3 text-sm"
              value={form.request_type}
              onChange={(e) => {
                const v = e.target.value;
                setForm((p) => ({
                  ...p,
                  request_type: v,
                  replace_equipment_id: v === "replacement" ? p.replace_equipment_id : "",
                }));
              }}
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t} className="bg-dark-800">
                  {requestTypeLabel[t]}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="glass-input w-full px-4 py-3 text-sm"
                type="number"
                min="1"
                placeholder="Количество"
                value={form.quantity}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    quantity: Number(e.target.value) || 1,
                  }))
                }
              />
              <select
                className="glass-input w-full px-4 py-3 text-sm"
                value={form.urgency}
                onChange={(e) =>
                  setForm((p) => ({ ...p, urgency: e.target.value }))
                }
              >
                {URGENCIES.map((u) => (
                  <option key={u} value={u} className="bg-dark-800">
                    {urgencyLabel[u]}
                  </option>
                ))}
              </select>
            </div>
            {form.request_type === "replacement" && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Оборудование для замены
                </label>
                <select
                  className="glass-input w-full px-4 py-3 text-sm"
                  value={form.replace_equipment_id}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      replace_equipment_id: e.target.value,
                    }))
                  }
                  disabled={equipmentOptionsLoading}
                >
                  <option value="" className="bg-dark-800">
                    {equipmentOptionsLoading
                      ? "Загрузка…"
                      : "— Выберите оборудование —"}
                  </option>
                  {equipmentOptions.map((eq) => (
                    <option key={eq.id} value={eq.id} className="bg-dark-800">
                      {eq.name} — инв. № {eq.inventory_number}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              className="glass-input w-full px-4 py-3 text-sm min-h-[60px] resize-none"
              placeholder="Обоснование необходимости"
              value={form.justification}
              onChange={(e) =>
                setForm((p) => ({ ...p, justification: e.target.value }))
              }
            />
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              type="number"
              step="0.01"
              placeholder="Предполагаемая стоимость (необязательно)"
              value={form.estimated_cost}
              onChange={(e) =>
                setForm((p) => ({ ...p, estimated_cost: e.target.value }))
              }
            />
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

      {/* Модальное окно детального просмотра */}
      {detailModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedRequest.title}
                </h3>
                <p className="text-sm text-gray-500">
                  Создана:{" "}
                  {new Date(selectedRequest.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-sm text-gray-500"
              >
                Закрыть
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Категория:</span>{" "}
                {categoryLabel[selectedRequest.equipment_category] || selectedRequest.equipment_category}
              </div>
              <div>
                <span className="font-medium">Тип:</span>{" "}
                {requestTypeLabel[selectedRequest.request_type] ||
                  selectedRequest.request_type}
              </div>
              <div>
                <span className="font-medium">Количество:</span>{" "}
                {selectedRequest.quantity}
              </div>
              <div>
                <span className="font-medium">Срочность:</span>{" "}
                {urgencyLabel[selectedRequest.urgency] ||
                  selectedRequest.urgency}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Статус:</span>
                {getStatusIcon(selectedRequest.status)}
                {statusLabel[selectedRequest.status] || selectedRequest.status}
              </div>
              {selectedRequest.description && (
                <div>
                  <span className="font-medium">Описание:</span>
                  <p className="mt-1 text-gray-700">
                    {selectedRequest.description}
                  </p>
                </div>
              )}
              {selectedRequest.justification && (
                <div>
                  <span className="font-medium">Обоснование:</span>
                  <p className="mt-1 text-gray-700">
                    {selectedRequest.justification}
                  </p>
                </div>
              )}
              {selectedRequest.requester_name && (
                <div>
                  <span className="font-medium">Заявитель:</span>{" "}
                  {selectedRequest.requester_name}
                </div>
              )}
              {selectedRequest.reviewer_name && (
                <div>
                  <span className="font-medium">Рассмотрел:</span>{" "}
                  {selectedRequest.reviewer_name}
                </div>
              )}
              {selectedRequest.review_comment && (
                <div>
                  <span className="font-medium">Комментарий:</span>
                  <p className="mt-1 text-gray-700">
                    {selectedRequest.review_comment}
                  </p>
                </div>
              )}
              {selectedRequest.estimated_cost && (
                <div>
                  <span className="font-medium">Предполагаемая стоимость:</span>{" "}
                  {selectedRequest.estimated_cost}
                </div>
              )}
            </div>

            {selectedRequest.status === "pending" && (
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    setDetailModalOpen(false);
                    openReview(selectedRequest);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
                >
                  Рассмотреть
                </button>
                <button
                  onClick={() => handleCancel(selectedRequest.id)}
                  className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50"
                >
                  Отменить
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно рассмотрения */}
      {reviewModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">
              Рассмотрение заявки
            </h3>
            <p className="text-sm text-gray-700">{selectedRequest.title}</p>
            <select
              className="glass-input w-full px-4 py-3 text-sm"
              value={reviewForm.status}
              onChange={(e) =>
                setReviewForm((p) => ({ ...p, status: e.target.value }))
              }
            >
              <option value="approved" className="bg-dark-800">Одобрить</option>
              <option value="rejected" className="bg-dark-800">Отклонить</option>
            </select>
            <textarea
              className="glass-input w-full px-4 py-3 text-sm min-h-[80px] resize-none"
              placeholder="Комментарий (необязательно)"
              value={reviewForm.comment}
              onChange={(e) =>
                setReviewForm((p) => ({ ...p, comment: e.target.value }))
              }
            />
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              type="number"
              step="0.01"
              placeholder="Предполагаемая стоимость"
              value={reviewForm.estimated_cost}
              onChange={(e) =>
                setReviewForm((p) => ({ ...p, estimated_cost: e.target.value }))
              }
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReviewModalOpen(false)}
                className="glass-button-secondary px-4 py-2 text-sm font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleReview}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
                  reviewForm.status === "approved"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {reviewForm.status === "approved" ? "Одобрить" : "Отклонить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
