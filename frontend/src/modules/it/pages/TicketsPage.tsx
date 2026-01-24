import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Edit2,
  History,
  Mail,
  Globe,
  MessageCircle,
  Link2,
  Package,
  AlertCircle,
  MapPin,
  Monitor,
  Save,
  X,
} from "lucide-react";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from "../../../shared/api/client";
import {
  roomsService,
  buildingsService,
} from "../../../shared/services/rooms.service";
import { useAuthStore } from "../../../shared/store/auth.store";

type Ticket = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  creator_id?: string;
  assignee_id?: string;
  equipment_id?: string;
  room_id?: string;
  source?: "web" | "email" | "api" | "telegram";
  email_sender?: string;
  created_at?: string;
  updated_at?: string;
};

type TicketComment = {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  attachments?: string[] | null;
  created_at: string;
  user_name?: string;
  user_role?: string;
};

type TicketHistoryItem = {
  id: string;
  ticket_id: string;
  changed_by_id: string;
  field: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
  changed_by_name?: string;
};

type UserOption = {
  id: string;
  full_name: string;
  email: string;
};

type EquipmentConsumable = {
  consumable_id: string;
  consumable_name: string;
  consumable_model?: string;
  consumable_type?: string;
  quantity_in_stock: number;
  min_quantity: number;
  is_low_stock: boolean;
};

type EquipmentItem = {
  id: string;
  name: string;
  inventory_number: string;
  model?: string;
  category?: string;
};

const CATEGORIES = ["hardware", "software", "network", "hr", "other"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES = [
  "new",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
  "pending_user",
];

const statusLabel: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  waiting: "Ожидание",
  resolved: "Решена",
  closed: "Закрыта",
  pending_user: "Ожидает привязки",
};

const statusColor: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  waiting: "bg-gray-100 text-gray-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-600",
  pending_user: "bg-orange-100 text-orange-800",
};

const priorityLabel: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

const categoryLabel: Record<string, string> = {
  hardware: "Оборудование",
  software: "ПО",
  network: "Сеть",
  hr: "HR",
  other: "Прочее",
};

const sourceLabel: Record<string, string> = {
  web: "Веб",
  email: "Email",
  api: "API",
  telegram: "Telegram",
};

const fieldLabel: Record<string, string> = {
  status: "Статус",
  priority: "Приоритет",
  category: "Категория",
  assignee_id: "Исполнитель",
  creator_id: "Создатель",
  title: "Заголовок",
  description: "Описание",
  equipment_id: "Оборудование",
  room_id: "Кабинет",
  resolved_at: "Дата решения",
  closed_at: "Дата закрытия",
};

const consumableTypeLabel: Record<string, string> = {
  cartridge: "Картридж",
  drum: "Фотобарабан",
  toner: "Тонер",
  ink: "Чернила",
  paper: "Бумага",
  other: "Прочее",
};

const SourceIcon = ({ source }: { source?: string }) => {
  switch (source) {
    case "email":
      return (
        <span title="Email">
          <Mail className="w-4 h-4 text-blue-500" />
        </span>
      );
    case "telegram":
      return (
        <span title="Telegram">
          <MessageCircle className="w-4 h-4 text-sky-500" />
        </span>
      );
    case "api":
      return (
        <span title="API">
          <Link2 className="w-4 h-4 text-purple-500" />
        </span>
      );
    default:
      return (
        <span title="Веб">
          <Globe className="w-4 h-4 text-green-500" />
        </span>
      );
  }
};

export function TicketsPage() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, _setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentForm, setCommentForm] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "other",
    priority: "medium",
    room_id: "",
    equipment_id: "",
  });

  // История изменений
  const [history, setHistory] = useState<TicketHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Привязка пользователя
  const [assignUserModalOpen, setAssignUserModalOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Состояния для кабинетов и оборудования (для создания)
  const [buildings, setBuildings] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [rooms, setRooms] = useState<
    Array<{ id: string; name: string; building_name?: string }>
  >([]);
  const [roomEquipment, setRoomEquipment] = useState<EquipmentItem[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("employee");

  // Форма редактирования в карточке тикета (для IT)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
    priority: "",
    room_id: "",
    equipment_id: "",
  });
  const [editBuildingId, setEditBuildingId] = useState<string>("");
  const [editRooms, setEditRooms] = useState<
    Array<{ id: string; name: string; building_name?: string }>
  >([]);
  const [editRoomEquipment, setEditRoomEquipment] = useState<EquipmentItem[]>(
    [],
  );

  // Расходники
  const [consumables, setConsumables] = useState<EquipmentConsumable[]>([]);
  const [selectedConsumables, setSelectedConsumables] = useState<Set<string>>(
    new Set(),
  );
  const [consumablesLoading, setConsumablesLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const user = useAuthStore((state) => state.user);

  // Определяем, можно ли редактировать (IT-специалист или админ)
  const canEdit = userRole === "it";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("page_size", "20");
      const data = await apiGet<Ticket[]>(`/it/tickets/?${params}`);
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  useEffect(() => {
    // Определяем роль пользователя из токена (т.к. user state может быть пустым)
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        console.log("Token payload:", payload);

        // Суперпользователь имеет полный доступ
        if (payload.is_superuser) {
          console.log("Setting userRole to 'it' (superuser from token)");
          setUserRole("it");
          return;
        }

        // Проверяем роль в модуле IT из токена
        const roles = payload.roles || {};
        const itRole = roles.it || "employee";
        const finalRole =
          itRole === "admin" || itRole === "it_specialist" ? "it" : "employee";
        console.log("itRole from token:", itRole, "-> finalRole:", finalRole);
        setUserRole(finalRole);
      } catch (err) {
        console.error("Error parsing token:", err);
      }
    } else if (user) {
      // Fallback на user state
      if (user.is_superuser) {
        setUserRole("it");
        return;
      }
      const itRole = user.roles?.it || user.role || "employee";
      const finalRole =
        itRole === "admin" || itRole === "it_specialist" ? "it" : "employee";
      setUserRole(finalRole);
    }
  }, [user]);

  // Примечание: загрузка зданий теперь происходит в openCreate()

  useEffect(() => {
    // Загружаем кабинеты при выборе здания (для создания)
    if (selectedBuildingId) {
      loadRooms(selectedBuildingId);
    } else {
      setRooms([]);
      setSelectedRoomId("");
      setRoomEquipment([]);
    }
  }, [selectedBuildingId]);

  useEffect(() => {
    // Загружаем оборудование при выборе кабинета (для создания)
    if (selectedRoomId) {
      loadRoomEquipment(selectedRoomId);
      setForm((p) => ({ ...p, room_id: selectedRoomId }));
    } else {
      setRoomEquipment([]);
      setForm((p) => ({ ...p, room_id: "", equipment_id: "" }));
    }
  }, [selectedRoomId]);

  // Эффект для загрузки кабинетов в карточке (для IT)
  useEffect(() => {
    if (editBuildingId && detailId) {
      loadEditRooms(editBuildingId);
    }
  }, [editBuildingId, detailId]);

  // Эффект для загрузки оборудования в карточке (для IT)
  useEffect(() => {
    if (editForm.room_id && detailId && canEdit) {
      loadEditRoomEquipment(editForm.room_id);
    }
  }, [editForm.room_id, detailId, canEdit]);

  // Эффект для загрузки расходников при выборе оборудования
  useEffect(() => {
    if (editForm.equipment_id && detailId && canEdit) {
      loadConsumables(editForm.equipment_id);
    } else if (detailId && canEdit) {
      setConsumables([]);
      setSelectedConsumables(new Set());
    }
  }, [editForm.equipment_id, detailId, canEdit]);

  const loadBuildings = async () => {
    try {
      console.log("Загрузка зданий...");
      const data = await buildingsService.getBuildings(true);
      console.log("Загружено зданий:", data.length, data);
      setBuildings(data.map((b) => ({ id: b.id, name: b.name })));
    } catch (err) {
      console.error("Ошибка загрузки зданий:", err);
    }
  };

  const loadRooms = async (buildingId: string) => {
    try {
      const data = await roomsService.getRooms(buildingId, true);
      setRooms(
        data.map((r) => ({
          id: r.id,
          name: r.name,
          building_name: r.building_name,
        })),
      );
    } catch (err) {
      console.error("Ошибка загрузки кабинетов:", err);
    }
  };

  const loadEditRooms = async (buildingId: string) => {
    try {
      const data = await roomsService.getRooms(buildingId, true);
      setEditRooms(
        data.map((r) => ({
          id: r.id,
          name: r.name,
          building_name: r.building_name,
        })),
      );
    } catch (err) {
      console.error("Ошибка загрузки кабинетов:", err);
    }
  };

  const loadRoomEquipment = async (roomId: string) => {
    try {
      const data = await roomsService.getRoomEquipment(roomId);
      setRoomEquipment(
        data.map((eq) => ({
          id: eq.id,
          name: eq.name,
          inventory_number: eq.inventory_number,
        })),
      );
    } catch (err) {
      console.error("Ошибка загрузки оборудования:", err);
    }
  };

  const loadEditRoomEquipment = async (roomId: string) => {
    try {
      const data = await roomsService.getRoomEquipment(roomId);
      setEditRoomEquipment(
        data.map((eq) => ({
          id: eq.id,
          name: eq.name,
          inventory_number: eq.inventory_number,
          category: eq.category,
        })),
      );
    } catch (err) {
      console.error("Ошибка загрузки оборудования:", err);
    }
  };

  const loadConsumables = async (equipmentId: string) => {
    setConsumablesLoading(true);
    try {
      const data = await apiGet<EquipmentConsumable[]>(
        `/it/equipment/${equipmentId}/consumables`,
      );
      setConsumables(data);
    } catch (err) {
      console.error("Ошибка загрузки расходников:", err);
      setConsumables([]);
    } finally {
      setConsumablesLoading(false);
    }
  };

  const loadEmployeeRoom = async () => {
    try {
      const employees = await apiGet<Array<{ room_id?: string }>>(
        `/hr/employees/?user_id=${user?.id}`,
      );
      if (
        employees &&
        Array.isArray(employees) &&
        employees.length > 0 &&
        employees[0].room_id
      ) {
        const roomId = employees[0].room_id;
        setSelectedRoomId(roomId);
        setForm((p) => ({ ...p, room_id: roomId }));
        await loadRoomEquipment(roomId);
      }
    } catch (err) {
      console.error("Ошибка загрузки кабинета сотрудника:", err);
    }
  };

  const loadHistory = async (ticketId: string) => {
    setHistoryLoading(true);
    try {
      const data = await apiGet<TicketHistoryItem[]>(
        `/it/tickets/${ticketId}/history`,
      );
      setHistory(data);
    } catch (err) {
      console.error("Ошибка загрузки истории:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiGet<UserOption[]>("/hr/users/");
      setUsers(data);
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
    }
  };

  const handleSearch = () => load();

  const openCreate = async () => {
    console.log("openCreate called, userRole:", userRole);
    setForm({
      title: "",
      description: "",
      category: "other",
      priority: "medium",
      room_id: "",
      equipment_id: "",
    });
    setSelectedBuildingId("");
    setSelectedRoomId("");
    setRooms([]);
    setRoomEquipment([]);
    setModalOpen(true);

    // Загружаем здания для IT или кабинет сотрудника
    if (userRole === "it") {
      console.log("Loading buildings for IT user...");
      await loadBuildings();
    } else {
      console.log("Loading employee room...");
      await loadEmployeeRoom();
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.description || !form.category) {
      setError("Заголовок, описание и категория обязательны");
      return;
    }
    setError(null);
    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
        source: "web",
      };
      if (form.room_id) payload.room_id = form.room_id;
      if (form.equipment_id) payload.equipment_id = form.equipment_id;

      await apiPost("/it/tickets/", payload);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadComments = async (ticketId: string) => {
    setCommentsLoading(true);
    try {
      const data = await apiGet<TicketComment[]>(
        `/it/tickets/${ticketId}/comments/`,
      );
      setComments(data);
    } catch (err) {
      console.error("Ошибка загрузки комментариев:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Открытие карточки тикета
  const openDetail = async (id: string) => {
    setDetailId(id);
    setShowHistory(false);
    setConsumables([]);
    setSelectedConsumables(new Set());
    setEditBuildingId("");
    setEditRooms([]);
    setEditRoomEquipment([]);

    try {
      const t = await apiGet<Ticket>(`/it/tickets/${id}`);
      setDetail(t);
      await loadComments(id);

      // Для IT-специалистов: сразу инициализируем форму редактирования
      if (userRole === "it") {
        await loadBuildings();

        setEditForm({
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          room_id: t.room_id || "",
          equipment_id: t.equipment_id || "",
        });

        // Если есть room_id, загружаем здание и кабинеты
        if (t.room_id) {
          try {
            const room = await roomsService.getRoom(t.room_id);
            if (room && room.building_id) {
              setEditBuildingId(room.building_id);
              await loadEditRooms(room.building_id);
              await loadEditRoomEquipment(t.room_id);

              if (t.equipment_id) {
                await loadConsumables(t.equipment_id);
              }
            }
          } catch (err) {
            console.error("Ошибка загрузки информации о кабинете:", err);
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setComments([]);
    setHistory([]);
    setCommentForm("");
    setEditingCommentId(null);
    setShowHistory(false);
    setEditForm({
      title: "",
      description: "",
      category: "",
      priority: "",
      room_id: "",
      equipment_id: "",
    });
    setEditBuildingId("");
    setEditRooms([]);
    setEditRoomEquipment([]);
    setConsumables([]);
    setSelectedConsumables(new Set());
  };

  const saveChanges = async () => {
    if (!detailId) return;

    setSaving(true);
    setError(null);
    try {
      const payload: any = {};

      if (editForm.title !== detail?.title) payload.title = editForm.title;
      if (editForm.description !== detail?.description)
        payload.description = editForm.description;
      if (editForm.category !== detail?.category)
        payload.category = editForm.category;
      if (editForm.priority !== detail?.priority)
        payload.priority = editForm.priority;
      if (editForm.room_id !== (detail?.room_id || ""))
        payload.room_id = editForm.room_id || null;
      if (editForm.equipment_id !== (detail?.equipment_id || ""))
        payload.equipment_id = editForm.equipment_id || null;

      if (Object.keys(payload).length > 0) {
        await apiPatch(`/it/tickets/${detailId}`, payload);
        // Перезагружаем тикет
        const t = await apiGet<Ticket>(`/it/tickets/${detailId}`);
        setDetail(t);
        // Обновляем форму
        setEditForm({
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          room_id: t.room_id || "",
          equipment_id: t.equipment_id || "",
        });
        await load();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!detailId || !commentForm.trim()) return;
    try {
      await apiPost(`/it/tickets/${detailId}/comments/`, {
        content: commentForm,
      });
      setCommentForm("");
      await loadComments(detailId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!detailId || !commentForm.trim()) return;
    try {
      await apiPatch(`/it/tickets/${detailId}/comments/${commentId}`, {
        content: commentForm,
      });
      setCommentForm("");
      setEditingCommentId(null);
      await loadComments(detailId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!detailId || !window.confirm("Удалить комментарий?")) return;
    try {
      await apiDelete(`/it/tickets/${detailId}/comments/${commentId}`);
      await loadComments(detailId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startEditComment = (comment: TicketComment) => {
    setEditingCommentId(comment.id);
    setCommentForm(comment.content);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setCommentForm("");
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiPatch(`/it/tickets/${id}`, { status });
      if (detailId === id) {
        const t = await apiGet<Ticket>(`/it/tickets/${id}`);
        setDetail(t);
        if (showHistory) {
          await loadHistory(id);
        }
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить заявку?")) return;
    try {
      await apiDelete(`/it/tickets/${id}`);
      closeDetail();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleToggleHistory = async () => {
    if (!showHistory && detailId) {
      await loadHistory(detailId);
    }
    setShowHistory(!showHistory);
  };

  const openAssignUserModal = async () => {
    await loadUsers();
    setSelectedUserId("");
    setAssignUserModalOpen(true);
  };

  const handleAssignUser = async () => {
    if (!detailId || !selectedUserId) return;
    try {
      await apiPost(`/it/tickets/${detailId}/assign-user`, {
        user_id: selectedUserId,
      });
      const t = await apiGet<Ticket>(`/it/tickets/${detailId}`);
      setDetail(t);
      setAssignUserModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleConsumableToggle = (consumableId: string) => {
    const newSelected = new Set(selectedConsumables);
    if (newSelected.has(consumableId)) {
      newSelected.delete(consumableId);
    } else {
      newSelected.add(consumableId);
    }
    setSelectedConsumables(newSelected);
  };

  const formatHistoryValue = (field: string, value?: string) => {
    if (!value) return "-";
    if (field === "status") return statusLabel[value] || value;
    if (field === "priority") return priorityLabel[value] || value;
    if (field === "category") return categoryLabel[value] || value;
    return value;
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Заявки</h2>
        <p className="text-sm text-gray-500">IT-заявки и тикеты.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <input
            className="px-3 py-2 text-sm w-48"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
          />
          <button
            onClick={handleSearch}
            className="p-2 bg-gray-100 hover:bg-gray-200"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Создать заявку
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Загрузка...</p>}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700 w-8"></th>
                <th className="px-4 py-3 font-medium text-gray-700">
                  Заголовок
                </th>
                <th className="px-4 py-3 font-medium text-gray-700">
                  Категория
                </th>
                <th className="px-4 py-3 font-medium text-gray-700">
                  Приоритет
                </th>
                <th className="px-4 py-3 font-medium text-gray-700">Статус</th>
                <th className="px-4 py-3 font-medium text-gray-700" />
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => openDetail(t.id)}
                >
                  <td className="px-4 py-3">
                    <SourceIcon source={t.source} />
                  </td>
                  <td className="px-4 py-3">
                    {t.title}
                    {t.status === "pending_user" && t.email_sender && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({t.email_sender})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {categoryLabel[t.category] ?? t.category}
                  </td>
                  <td className="px-4 py-3">
                    {priorityLabel[t.priority] ?? t.priority}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[t.status] || "bg-gray-100"}`}
                    >
                      {statusLabel[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(t.id);
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно создания заявки */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Новая заявка
            </h3>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Заголовок"
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[80px]"
              placeholder="Описание"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
            />
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={form.category}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value }))
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c] ?? c}
                </option>
              ))}
            </select>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={form.priority}
              onChange={(e) =>
                setForm((p) => ({ ...p, priority: e.target.value }))
              }
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel[p] ?? p}
                </option>
              ))}
            </select>

            {/* Выбор кабинета (для IT-сотрудников) */}
            {userRole === "it" && (
              <>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={selectedBuildingId}
                  onChange={(e) => {
                    setSelectedBuildingId(e.target.value);
                    setSelectedRoomId("");
                    setRoomEquipment([]);
                  }}
                >
                  <option value="">Выберите здание</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  disabled={!selectedBuildingId}
                >
                  <option value="">Выберите кабинет</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.building_name ? `(${r.building_name})` : ""}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* Выбор оборудования из кабинета */}
            {form.room_id && (
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={form.equipment_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, equipment_id: e.target.value }))
                }
              >
                <option value="">Выберите оборудование (необязательно)</option>
                {roomEquipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.inventory_number})
                  </option>
                ))}
              </select>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Карточка тикета */}
      {detailId && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Заголовок карточки */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 flex-1">
                <SourceIcon source={detail.source} />
                {canEdit ? (
                  <input
                    className="text-lg font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 flex-1"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Заголовок заявки"
                  />
                ) : (
                  <h3 className="text-lg font-semibold text-gray-900">
                    {detail.title}
                  </h3>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {canEdit && (
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "..." : "Сохранить"}
                  </button>
                )}
                <button
                  onClick={closeDetail}
                  className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                  Закрыть
                </button>
              </div>
            </div>

            {/* Email sender для pending_user тикетов */}
            {detail.status === "pending_user" && detail.email_sender && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Тикет создан из email: <strong>{detail.email_sender}</strong>
                </p>
                {canEdit && (
                  <button
                    onClick={openAssignUserModal}
                    className="mt-2 px-3 py-1 text-sm font-medium text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-100"
                  >
                    Привязать к пользователю
                  </button>
                )}
              </div>
            )}

            {/* Описание */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Описание
              </label>
              {canEdit ? (
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[100px]"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Описание проблемы"
                />
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                  {detail.description}
                </p>
              )}
            </div>

            {/* Основные поля */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Категория */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Категория
                </label>
                {canEdit ? (
                  <select
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, category: e.target.value }))
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel[c] ?? c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm">
                    {categoryLabel[detail.category] ?? detail.category}
                  </span>
                )}
              </div>

              {/* Приоритет */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Приоритет
                </label>
                {canEdit ? (
                  <select
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    value={editForm.priority}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, priority: e.target.value }))
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {priorityLabel[p] ?? p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm">
                    {priorityLabel[detail.priority] ?? detail.priority}
                  </span>
                )}
              </div>

              {/* Статус */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Статус
                </label>
                {canEdit ? (
                  <select
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    value={detail.status}
                    onChange={(e) => updateStatus(detail.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s] ?? s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColor[detail.status] || "bg-gray-100"}`}
                  >
                    {statusLabel[detail.status] ?? detail.status}
                  </span>
                )}
              </div>

              {/* Источник */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Источник
                </label>
                <span className="text-sm">
                  {sourceLabel[detail.source || "web"]}
                </span>
              </div>
            </div>

            {/* Раздел: Кабинет и Оборудование (только для IT) */}
            {canEdit && (
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-semibold text-gray-900">
                    Местоположение и оборудование
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Здание */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Здание
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      value={editBuildingId}
                      onChange={(e) => {
                        setEditBuildingId(e.target.value);
                        setEditForm((p) => ({
                          ...p,
                          room_id: "",
                          equipment_id: "",
                        }));
                        setEditRooms([]);
                        setEditRoomEquipment([]);
                        setConsumables([]);
                        setSelectedConsumables(new Set());
                      }}
                    >
                      <option value="">Выберите здание</option>
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Кабинет */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Кабинет
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      value={editForm.room_id}
                      onChange={(e) => {
                        setEditForm((p) => ({
                          ...p,
                          room_id: e.target.value,
                          equipment_id: "",
                        }));
                        setConsumables([]);
                        setSelectedConsumables(new Set());
                      }}
                      disabled={!editBuildingId}
                    >
                      <option value="">Выберите кабинет</option>
                      {editRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}{" "}
                          {r.building_name ? `(${r.building_name})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Оборудование */}
                {editForm.room_id && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="w-4 h-4 text-gray-500" />
                      <label className="text-xs font-medium text-gray-500">
                        Оборудование
                      </label>
                    </div>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      value={editForm.equipment_id}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          equipment_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Выберите оборудование (необязательно)
                      </option>
                      {editRoomEquipment.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.name} ({eq.inventory_number})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Расходники */}
                {editForm.equipment_id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-5 h-5 text-blue-600" />
                      <h4 className="font-medium text-blue-900">
                        Расходные материалы
                      </h4>
                    </div>

                    {consumablesLoading ? (
                      <p className="text-sm text-blue-700">
                        Загрузка расходников...
                      </p>
                    ) : consumables.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-blue-700 mb-2">
                          Выберите расходные материалы для заявки:
                        </p>
                        {consumables.map((consumable) => {
                          const isSelected = selectedConsumables.has(
                            consumable.consumable_id,
                          );
                          return (
                            <label
                              key={consumable.consumable_id}
                              className={`flex items-center justify-between p-2 rounded border cursor-pointer ${
                                isSelected
                                  ? "bg-blue-100 border-blue-300"
                                  : "bg-white border-gray-200"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    handleConsumableToggle(
                                      consumable.consumable_id,
                                    )
                                  }
                                  className="h-4 w-4 text-blue-600 rounded"
                                />
                                <span className="text-sm text-gray-900">
                                  {consumable.consumable_name}
                                  {consumable.consumable_model &&
                                    ` (${consumable.consumable_model})`}
                                  {consumable.consumable_type && (
                                    <span className="ml-2 text-xs text-blue-600">
                                      [
                                      {consumableTypeLabel[
                                        consumable.consumable_type
                                      ] || consumable.consumable_type}
                                      ]
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {consumable.is_low_stock && (
                                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                                )}
                                <span
                                  className={`text-xs ${consumable.is_low_stock ? "text-yellow-600" : "text-gray-500"}`}
                                >
                                  В наличии: {consumable.quantity_in_stock}
                                  {consumable.min_quantity > 0 &&
                                    ` (мин: ${consumable.min_quantity})`}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-blue-700">
                        Для данного оборудования не указаны расходные материалы
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Действия для IT */}
            {canEdit && (
              <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                <button
                  onClick={handleToggleHistory}
                  className={`px-3 py-1 text-sm font-medium border rounded-lg flex items-center gap-1 ${
                    showHistory
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <History className="w-4 h-4" />
                  История
                </button>
                <button
                  onClick={() => handleDelete(detail.id)}
                  className="px-3 py-1 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Удалить
                </button>
              </div>
            )}

            {/* История изменений */}
            {showHistory && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-semibold text-gray-900">
                    История изменений
                  </h4>
                </div>

                {historyLoading && (
                  <p className="text-sm text-gray-500">Загрузка истории...</p>
                )}
                {!historyLoading && history.length === 0 && (
                  <p className="text-sm text-gray-500">
                    История изменений пуста
                  </p>
                )}
                {!historyLoading && history.length > 0 && (
                  <div className="space-y-2">
                    {history.map((h) => (
                      <div
                        key={h.id}
                        className="bg-gray-50 rounded-lg p-3 text-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium">
                              {fieldLabel[h.field] || h.field}
                            </span>
                            <span className="text-gray-500"> изменено </span>
                            <span className="text-gray-600">
                              {h.changed_by_name || "Пользователь"}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(h.created_at).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        <div className="mt-1 text-gray-600">
                          <span className="text-red-600 line-through">
                            {formatHistoryValue(h.field, h.old_value)}
                          </span>
                          {" -> "}
                          <span className="text-green-600">
                            {formatHistoryValue(h.field, h.new_value)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Комментарии (доступны всем) */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-semibold text-gray-900">
                  Комментарии
                </h4>
              </div>

              {commentsLoading && (
                <p className="text-sm text-gray-500">
                  Загрузка комментариев...
                </p>
              )}
              {!commentsLoading && comments.length === 0 && (
                <p className="text-sm text-gray-500">Комментариев пока нет</p>
              )}
              {!commentsLoading && comments.length > 0 && (
                <div className="space-y-3 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            {comment.user_name || "Пользователь"}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {new Date(comment.created_at).toLocaleString(
                              "ru-RU",
                            )}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {editingCommentId !== comment.id && (
                            <>
                              <button
                                onClick={() => startEditComment(comment)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-xs text-red-600 hover:underline"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="space-y-2">
                          <textarea
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            value={commentForm}
                            onChange={(e) => setCommentForm(e.target.value)}
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditComment(comment.id)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={cancelEditComment}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Форма добавления комментария (доступна всем) */}
              {editingCommentId === null && (
                <div className="space-y-2">
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    placeholder="Добавить комментарий..."
                    value={commentForm}
                    onChange={(e) => setCommentForm(e.target.value)}
                    rows={3}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentForm.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Добавить комментарий
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно привязки пользователя */}
      {assignUserModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Привязать к пользователю
            </h3>
            <p className="text-sm text-gray-600">
              Выберите пользователя, к которому нужно привязать email-тикет.
            </p>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Выберите пользователя</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAssignUserModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleAssignUser}
                disabled={!selectedUserId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                Привязать
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
