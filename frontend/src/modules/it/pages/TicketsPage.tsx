import { useEffect, useState, useRef, useCallback } from "react";
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
  X,
  Filter,
  SortDesc,
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
  attachments?: string[] | null;
  source?: "web" | "email" | "api" | "telegram";
  email_sender?: string;
  email_message_id?: string;
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

type TicketConsumable = {
  id: string;
  ticket_id: string;
  consumable_id: string;
  consumable_name?: string;
  consumable_model?: string;
  quantity: number;
  is_written_off: boolean;
  written_off_at?: string;
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
  new: "bg-accent-blue/20 text-accent-blue",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  waiting: "bg-dark-400/50 text-gray-400",
  resolved: "bg-green-500/20 text-green-400",
  closed: "bg-dark-500/50 text-gray-500",
  pending_user: "bg-orange-500/20 text-orange-400",
};

const priorityLabel: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

const priorityColor: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-accent-blue",
  high: "text-orange-400",
  critical: "text-red-400",
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
          <Mail className="w-4 h-4 text-accent-blue" />
        </span>
      );
    case "telegram":
      return (
        <span title="Telegram">
          <MessageCircle className="w-4 h-4 text-accent-cyan" />
        </span>
      );
    case "api":
      return (
        <span title="API">
          <Link2 className="w-4 h-4 text-accent-purple" />
        </span>
      );
    default:
      return (
        <span title="Веб">
          <Globe className="w-4 h-4 text-green-400" />
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
  const [hideClosed, setHideClosed] = useState<boolean>(() => {
    const saved = localStorage.getItem("tickets_hide_closed");
    return saved === "true";
  });
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

  const [history, setHistory] = useState<TicketHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [assignUserModalOpen, setAssignUserModalOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

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

  const [consumables, setConsumables] = useState<EquipmentConsumable[]>([]);
  const [selectedConsumables, setSelectedConsumables] = useState<Set<string>>(
    new Set(),
  );
  const [consumablesLoading, setConsumablesLoading] = useState(false);

  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false);
  const [pendingCloseTicketId, setPendingCloseTicketId] = useState<
    string | null
  >(null);
  const [ticketConsumables, setTicketConsumables] = useState<
    TicketConsumable[]
  >([]);
  const [writeOffLoading, setWriteOffLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [replyEmailOpen, setReplyEmailOpen] = useState(false);
  const [replyEmailText, setReplyEmailText] = useState("");
  const [replyEmailSending, setReplyEmailSending] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const user = useAuthStore((state) => state.user);

  const canEdit = userRole === "it";

  const isImageAttachment = (path: string) =>
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path);

  const renderAttachments = (attachments?: string[] | null) => {
    if (!attachments || attachments.length === 0) return null;
    return (
      <div className="mt-3 space-y-2">
        <div className="text-xs font-medium text-gray-500">Вложения</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {attachments.map((p) => (
            <a
              key={p}
              href={p}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/40 border border-dark-600/50 hover:border-dark-500/70 transition-all"
              title="Открыть вложение"
            >
              <div className="w-10 h-10 rounded-lg bg-dark-700/60 flex items-center justify-center flex-shrink-0">
                <PaperclipIcon isImage={isImageAttachment(p)} />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-white truncate">
                  {p.split("/").pop()}
                </div>
                <div className="text-xs text-gray-500 truncate">{p}</div>
              </div>
            </a>
          ))}
        </div>
        {/* Превью изображений */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {attachments
            .filter((p) => isImageAttachment(p))
            .map((p) => (
              <a
                key={`img-${p}`}
                href={p}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-dark-600/50 hover:border-dark-500/70 transition-all"
                title="Открыть изображение"
              >
                <img
                  src={p}
                  alt={p.split("/").pop() || "attachment"}
                  className="w-full h-auto max-h-64 object-contain bg-black/20"
                  loading="lazy"
                />
              </a>
            ))}
        </div>
      </div>
    );
  };

  const [sortByPriority, setSortByPriority] = useState<boolean>(() => {
    const saved = localStorage.getItem("tickets_sort_priority");
    return saved === "true";
  });

  const priorityWeight: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const filteredItems = (() => {
    let result = hideClosed
      ? items.filter((t) => t.status !== "closed")
      : items;

    if (sortByPriority) {
      result = [...result].sort((a, b) => {
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        return weightB - weightA;
      });
    }

    return result;
  })();

  const toggleHideClosed = () => {
    const newValue = !hideClosed;
    setHideClosed(newValue);
    localStorage.setItem("tickets_hide_closed", String(newValue));
  };

  const toggleSortByPriority = () => {
    const newValue = !sortByPriority;
    setSortByPriority(newValue);
    localStorage.setItem("tickets_sort_priority", String(newValue));
  };

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
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));

        if (payload.is_superuser) {
          setUserRole("it");
          return;
        }

        const roles = payload.roles || {};
        const itRole = roles.it || "employee";
        const finalRole =
          itRole === "admin" || itRole === "it_specialist" ? "it" : "employee";
        setUserRole(finalRole);
      } catch (err) {
        console.error("Error parsing token:", err);
      }
    } else if (user) {
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

  useEffect(() => {
    if (selectedBuildingId) {
      loadRooms(selectedBuildingId);
    } else {
      setRooms([]);
      setSelectedRoomId("");
      setRoomEquipment([]);
    }
  }, [selectedBuildingId]);

  useEffect(() => {
    if (selectedRoomId) {
      loadRoomEquipment(selectedRoomId);
      setForm((p) => ({ ...p, room_id: selectedRoomId }));
    } else {
      setRoomEquipment([]);
      setForm((p) => ({ ...p, room_id: "", equipment_id: "" }));
    }
  }, [selectedRoomId]);

  useEffect(() => {
    if (editBuildingId && detailId) {
      loadEditRooms(editBuildingId);
    }
  }, [editBuildingId, detailId]);

  useEffect(() => {
    if (editForm.room_id && detailId && canEdit) {
      loadEditRoomEquipment(editForm.room_id);
    }
  }, [editForm.room_id, detailId, canEdit]);

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
      const data = await buildingsService.getBuildings(true);
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

    if (userRole === "it") {
      await loadBuildings();
    } else {
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

      if (userRole === "it") {
        await loadBuildings();
        await loadUsers();

        setEditForm({
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          room_id: t.room_id || "",
          equipment_id: t.equipment_id || "",
        });

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

  const saveChanges = useCallback(
    async (
      currentEditForm: typeof editForm,
      currentSelectedConsumables: Set<string>,
      currentConsumables: typeof consumables,
    ) => {
      if (!detailId || !detail) return;

      setSaving(true);
      setError(null);
      try {
        const payload: any = {};

        if (currentEditForm.title !== detail.title)
          payload.title = currentEditForm.title;
        if (currentEditForm.description !== detail.description)
          payload.description = currentEditForm.description;
        if (currentEditForm.category !== detail.category)
          payload.category = currentEditForm.category;
        if (currentEditForm.priority !== detail.priority)
          payload.priority = currentEditForm.priority;
        if (currentEditForm.room_id !== (detail.room_id || ""))
          payload.room_id = currentEditForm.room_id || null;
        if (currentEditForm.equipment_id !== (detail.equipment_id || ""))
          payload.equipment_id = currentEditForm.equipment_id || null;

        if (currentSelectedConsumables.size > 0) {
          payload.consumables = Array.from(currentSelectedConsumables).map(
            (id) => ({
              consumable_id: id,
              quantity: 1,
            }),
          );
        } else if (currentConsumables.length > 0) {
          payload.consumables = [];
        }

        if (Object.keys(payload).length > 0) {
          await apiPatch(`/it/tickets/${detailId}`, payload);
          const t = await apiGet<Ticket>(`/it/tickets/${detailId}`);
          setDetail(t);
          await load();
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [detailId, detail],
  );

  const debouncedSave = useCallback(
    (
      currentEditForm: typeof editForm,
      currentSelectedConsumables: Set<string>,
      currentConsumables: typeof consumables,
    ) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveChanges(
          currentEditForm,
          currentSelectedConsumables,
          currentConsumables,
        );
      }, 500);
    },
    [saveChanges],
  );

  const updateEditField = (field: keyof typeof editForm, value: string) => {
    const newForm = { ...editForm, [field]: value };
    setEditForm(newForm);
    debouncedSave(newForm, selectedConsumables, consumables);
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
      if (status === "closed") {
        const tc = await apiGet<TicketConsumable[]>(
          `/it/tickets/${id}/consumables`,
        );
        const notWrittenOff = tc.filter((c) => !c.is_written_off);

        if (notWrittenOff.length > 0) {
          setTicketConsumables(notWrittenOff);
          setPendingCloseTicketId(id);
          setWriteOffModalOpen(true);
          return;
        }
      }

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

  const handleWriteOffAndClose = async () => {
    if (!pendingCloseTicketId) return;

    setWriteOffLoading(true);
    try {
      await apiPost(
        `/it/tickets/${pendingCloseTicketId}/write-off-consumables`,
        {},
      );

      await apiPatch(`/it/tickets/${pendingCloseTicketId}`, {
        status: "closed",
      });

      if (detailId === pendingCloseTicketId) {
        const t = await apiGet<Ticket>(`/it/tickets/${pendingCloseTicketId}`);
        setDetail(t);
        if (showHistory) {
          await loadHistory(pendingCloseTicketId);
        }
      }
      await load();

      setWriteOffModalOpen(false);
      setPendingCloseTicketId(null);
      setTicketConsumables([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWriteOffLoading(false);
    }
  };

  const handleCloseWithoutWriteOff = async () => {
    if (!pendingCloseTicketId) return;

    setWriteOffLoading(true);
    try {
      await apiPatch(`/it/tickets/${pendingCloseTicketId}`, {
        status: "closed",
      });

      if (detailId === pendingCloseTicketId) {
        const t = await apiGet<Ticket>(`/it/tickets/${pendingCloseTicketId}`);
        setDetail(t);
        if (showHistory) {
          await loadHistory(pendingCloseTicketId);
        }
      }
      await load();

      setWriteOffModalOpen(false);
      setPendingCloseTicketId(null);
      setTicketConsumables([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWriteOffLoading(false);
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
    debouncedSave(editForm, newSelected, consumables);
  };

  const formatHistoryValue = (field: string, value?: string) => {
    if (!value) return "-";
    if (field === "status") return statusLabel[value] || value;
    if (field === "priority") return priorityLabel[value] || value;
    if (field === "category") return categoryLabel[value] || value;
    return value;
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Заявки</h2>
            <p className="text-gray-400">IT-заявки и тикеты</p>
          </div>
          <button
            onClick={openCreate}
            className="glass-button px-4 py-2.5 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Создать заявку
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Filters */}
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

        <button
          onClick={toggleSortByPriority}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all ${
            sortByPriority
              ? "bg-accent-purple/20 text-accent-purple border-accent-purple/30"
              : "bg-dark-700/50 text-gray-400 border-dark-600/50 hover:text-white hover:border-dark-500"
          }`}
        >
          <SortDesc className="w-4 h-4" />
          {sortByPriority ? "По приоритету" : "Сортировка"}
        </button>

        <button
          onClick={toggleHideClosed}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all ${
            hideClosed
              ? "bg-dark-600/50 text-gray-300 border-dark-500/50"
              : "bg-dark-700/50 text-gray-400 border-dark-600/50 hover:text-white hover:border-dark-500"
          }`}
        >
          <Filter className="w-4 h-4" />
          {hideClosed ? "Показать закрытые" : "Скрыть закрытые"}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-dark-600/50">
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Заголовок
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Категория
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Приоритет
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {filteredItems.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-dark-700/30 cursor-pointer transition-colors"
                  onClick={() => openDetail(t.id)}
                >
                  <td className="px-4 py-4">
                    <SourceIcon source={t.source} />
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-white font-medium">{t.title}</span>
                    {t.status === "pending_user" && t.email_sender && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({t.email_sender})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-400">
                    {categoryLabel[t.category] ?? t.category}
                  </td>
                  <td className="px-4 py-4">
                    <span className={priorityColor[t.priority] || "text-gray-400"}>
                      {priorityLabel[t.priority] ?? t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[t.status] || "bg-dark-500/50 text-gray-400"}`}
                    >
                      {statusLabel[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(t.id);
                      }}
                      className="text-sm text-accent-purple hover:text-accent-violet transition-colors"
                    >
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    Заявки не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 mx-4">
            <h3 className="text-xl font-semibold text-white">Новая заявка</h3>

            <input
              className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all"
              placeholder="Заголовок"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />

            <textarea
              className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all min-h-[100px] resize-none"
              placeholder="Описание проблемы..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <select
                className="px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-purple/50 transition-all"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-dark-800">
                    {categoryLabel[c] ?? c}
                  </option>
                ))}
              </select>

              <select
                className="px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-purple/50 transition-all"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className="bg-dark-800">
                    {priorityLabel[p] ?? p}
                  </option>
                ))}
              </select>
            </div>

            {userRole === "it" && (
              <>
                <select
                  className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-purple/50 transition-all"
                  value={selectedBuildingId}
                  onChange={(e) => {
                    setSelectedBuildingId(e.target.value);
                    setSelectedRoomId("");
                    setRoomEquipment([]);
                  }}
                >
                  <option value="" className="bg-dark-800">Выберите здание</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id} className="bg-dark-800">
                      {b.name}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-purple/50 transition-all disabled:opacity-50"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  disabled={!selectedBuildingId}
                >
                  <option value="" className="bg-dark-800">Выберите кабинет</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id} className="bg-dark-800">
                      {r.name} {r.building_name ? `(${r.building_name})` : ""}
                    </option>
                  ))}
                </select>
              </>
            )}

            {form.room_id && (
              <select
                className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-purple/50 transition-all"
                value={form.equipment_id}
                onChange={(e) => setForm((p) => ({ ...p, equipment_id: e.target.value }))}
              >
                <option value="" className="bg-dark-800">Выберите оборудование (необязательно)</option>
                {roomEquipment.map((eq) => (
                  <option key={eq.id} value={eq.id} className="bg-dark-800">
                    {eq.name} ({eq.inventory_number})
                  </option>
                ))}
              </select>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                className="glass-button px-4 py-2.5"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailId && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 flex-1">
                <SourceIcon source={detail.source} />
                {canEdit ? (
                  <input
                    className="text-xl font-semibold text-white bg-dark-700/50 border border-dark-600/50 rounded-xl px-3 py-2 flex-1 focus:outline-none focus:border-accent-purple/50 transition-all"
                    value={editForm.title}
                    onChange={(e) => updateEditField("title", e.target.value)}
                    placeholder="Заголовок заявки"
                  />
                ) : (
                  <h3 className="text-xl font-semibold text-white">
                    {detail.title}
                  </h3>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {saving && (
                  <span className="text-xs text-accent-purple">Сохранение...</span>
                )}
                <button
                  onClick={closeDetail}
                  className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Email sender for pending_user */}
            {detail.status === "pending_user" && detail.email_sender && (
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <p className="text-sm text-orange-400">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Тикет создан из email: <strong>{detail.email_sender}</strong>
                </p>
                {canEdit && (
                  <button
                    onClick={openAssignUserModal}
                    className="mt-3 px-4 py-2 text-sm font-medium text-orange-400 border border-orange-500/30 rounded-xl hover:bg-orange-500/10 transition-all"
                  >
                    Привязать к пользователю
                  </button>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Описание
              </label>
              {canEdit ? (
                <textarea
                  className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all min-h-[120px] resize-none"
                  value={editForm.description}
                  onChange={(e) => updateEditField("description", e.target.value)}
                  placeholder="Описание проблемы"
                />
              ) : (
                <div className="bg-dark-700/30 p-4 rounded-xl">
                  <p className="text-gray-300 whitespace-pre-wrap">
                    {detail.description}
                  </p>
                  {renderAttachments(detail.attachments)}
                </div>
              )}
            </div>

            {/* Main fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Категория
                </label>
                {canEdit ? (
                  <select
                    className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50 transition-all"
                    value={editForm.category}
                    onChange={(e) => updateEditField("category", e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-dark-800">
                        {categoryLabel[c] ?? c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-gray-300">
                    {categoryLabel[detail.category] ?? detail.category}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Приоритет
                </label>
                {canEdit ? (
                  <select
                    className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50 transition-all"
                    value={editForm.priority}
                    onChange={(e) => updateEditField("priority", e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p} className="bg-dark-800">
                        {priorityLabel[p] ?? p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={priorityColor[detail.priority] || "text-gray-300"}>
                    {priorityLabel[detail.priority] ?? detail.priority}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Статус
                </label>
                {canEdit ? (
                  <select
                    className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50 transition-all"
                    value={detail.status}
                    onChange={(e) => updateStatus(detail.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-dark-800">
                        {statusLabel[s] ?? s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[detail.status] || "bg-dark-500/50 text-gray-400"}`}
                  >
                    {statusLabel[detail.status] ?? detail.status}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Источник
                </label>
                <span className="text-gray-300">
                  {sourceLabel[detail.source || "web"]}
                </span>
              </div>

              {userRole === "it" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Исполнитель
                  </label>
                  {canEdit ? (
                    <select
                      className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50 transition-all"
                      value={detail.assignee_id ?? ""}
                      onChange={async (e) => {
                        const v = e.target.value;
                        if (!detailId) return;
                        setError(null);
                        try {
                          await apiPost(
                            `/it/tickets/${detailId}/assign-executor`,
                            { user_id: v || null }
                          );
                          const t = await apiGet<Ticket>(`/it/tickets/${detailId}`);
                          setDetail(t);
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    >
                      <option value="" className="bg-dark-800">
                        Не назначен
                      </option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id} className="bg-dark-800">
                          {u.full_name} ({u.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-gray-300">
                      {detail.assignee_id
                        ? users.find((u) => u.id === detail.assignee_id)?.full_name ?? "—"
                        : "Не назначен"}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Location and Equipment (IT only) */}
            {canEdit && (
              <div className="border-t border-dark-600/50 pt-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-accent-purple" />
                  <h4 className="text-sm font-semibold text-white">
                    Местоположение и оборудование
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      Здание
                    </label>
                    <select
                      className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-purple/50 transition-all"
                      value={editBuildingId}
                      onChange={(e) => {
                        setEditBuildingId(e.target.value);
                        const newForm = {
                          ...editForm,
                          room_id: "",
                          equipment_id: "",
                        };
                        setEditForm(newForm);
                        setEditRooms([]);
                        setEditRoomEquipment([]);
                        setConsumables([]);
                        setSelectedConsumables(new Set());
                        debouncedSave(newForm, new Set(), []);
                      }}
                    >
                      <option value="" className="bg-dark-800">Выберите здание</option>
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id} className="bg-dark-800">
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      Кабинет
                    </label>
                    <select
                      className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-purple/50 transition-all disabled:opacity-50"
                      value={editForm.room_id}
                      onChange={(e) => {
                        const newForm = {
                          ...editForm,
                          room_id: e.target.value,
                          equipment_id: "",
                        };
                        setEditForm(newForm);
                        setConsumables([]);
                        setSelectedConsumables(new Set());
                        debouncedSave(newForm, new Set(), []);
                      }}
                      disabled={!editBuildingId}
                    >
                      <option value="" className="bg-dark-800">Выберите кабинет</option>
                      {editRooms.map((r) => (
                        <option key={r.id} value={r.id} className="bg-dark-800">
                          {r.name} {r.building_name ? `(${r.building_name})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {editForm.room_id && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="w-4 h-4 text-accent-blue" />
                      <label className="text-xs font-medium text-gray-500">
                        Оборудование
                      </label>
                    </div>
                    <select
                      className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-purple/50 transition-all"
                      value={editForm.equipment_id}
                      onChange={(e) => updateEditField("equipment_id", e.target.value)}
                    >
                      <option value="" className="bg-dark-800">
                        Выберите оборудование (необязательно)
                      </option>
                      {editRoomEquipment.map((eq) => (
                        <option key={eq.id} value={eq.id} className="bg-dark-800">
                          {eq.name} ({eq.inventory_number})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editForm.equipment_id && (
                  <div className="p-4 rounded-xl bg-accent-blue/10 border border-accent-blue/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-5 h-5 text-accent-blue" />
                      <h4 className="font-medium text-white">
                        Расходные материалы
                      </h4>
                    </div>

                    {consumablesLoading ? (
                      <p className="text-sm text-gray-400">
                        Загрузка расходников...
                      </p>
                    ) : consumables.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400 mb-2">
                          Выберите расходные материалы для заявки:
                        </p>
                        {consumables.map((consumable) => {
                          const isSelected = selectedConsumables.has(
                            consumable.consumable_id,
                          );
                          return (
                            <label
                              key={consumable.consumable_id}
                              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-accent-blue/20 border-accent-blue/30"
                                  : "bg-dark-700/30 border-dark-600/50 hover:border-dark-500"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    handleConsumableToggle(consumable.consumable_id)
                                  }
                                  className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30"
                                />
                                <span className="text-sm text-white">
                                  {consumable.consumable_name}
                                  {consumable.consumable_model &&
                                    ` (${consumable.consumable_model})`}
                                  {consumable.consumable_type && (
                                    <span className="ml-2 text-xs text-accent-blue">
                                      [
                                      {consumableTypeLabel[consumable.consumable_type] ||
                                        consumable.consumable_type}
                                      ]
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {consumable.is_low_stock && (
                                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                                )}
                                <span
                                  className={`text-xs ${consumable.is_low_stock ? "text-yellow-400" : "text-gray-500"}`}
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
                      <p className="text-sm text-gray-400">
                        Для данного оборудования не указаны расходные материалы
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* IT Actions */}
            {canEdit && (
              <div className="flex flex-wrap gap-2 border-t border-dark-600/50 pt-4">
                {(detail.source === "email" || !!detail.email_sender) && (
                  <button
                    onClick={() => {
                      setReplyEmailText("");
                      setReplyEmailOpen(true);
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-xl flex items-center gap-2 transition-all bg-dark-700/50 text-gray-300 border border-dark-600/50 hover:text-white"
                    title="Ответить отправителю по email"
                  >
                    <Mail className="w-4 h-4" />
                    Ответить по email
                  </button>
                )}
                <button
                  onClick={handleToggleHistory}
                  className={`px-4 py-2 text-sm font-medium rounded-xl flex items-center gap-2 transition-all ${
                    showHistory
                      ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/30"
                      : "bg-dark-700/50 text-gray-400 border border-dark-600/50 hover:text-white"
                  }`}
                >
                  <History className="w-4 h-4" />
                  История
                </button>
                <button
                  onClick={() => handleDelete(detail.id)}
                  className="px-4 py-2 text-sm font-medium text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 flex items-center gap-2 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              </div>
            )}

            {/* History */}
            {showHistory && (
              <div className="border-t border-dark-600/50 pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-4 h-4 text-accent-purple" />
                  <h4 className="text-sm font-semibold text-white">
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
                        className="bg-dark-700/30 rounded-xl p-4 text-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium text-white">
                              {fieldLabel[h.field] || h.field}
                            </span>
                            <span className="text-gray-500"> изменено </span>
                            <span className="text-gray-400">
                              {h.changed_by_name || "Пользователь"}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(h.created_at).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        <div className="mt-2 text-gray-400">
                          <span className="text-red-400 line-through">
                            {formatHistoryValue(h.field, h.old_value)}
                          </span>
                          {" -> "}
                          <span className="text-green-400">
                            {formatHistoryValue(h.field, h.new_value)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comments */}
            <div className="border-t border-dark-600/50 pt-4">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-accent-blue" />
                <h4 className="text-sm font-semibold text-white">
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
                    <div key={comment.id} className="bg-dark-700/30 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-sm font-medium text-white">
                            {comment.user_name || "Пользователь"}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {new Date(comment.created_at).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {editingCommentId !== comment.id && (
                            <>
                              <button
                                onClick={() => startEditComment(comment)}
                                className="p-1 text-gray-500 hover:text-accent-blue transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="space-y-3">
                          <textarea
                            className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50 transition-all resize-none"
                            value={commentForm}
                            onChange={(e) => setCommentForm(e.target.value)}
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditComment(comment.id)}
                              className="px-3 py-1.5 text-xs font-medium glass-button"
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={cancelEditComment}
                              className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-300 whitespace-pre-wrap">
                            {comment.content}
                          </p>
                          {renderAttachments(comment.attachments)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {editingCommentId === null && (
                <div className="space-y-3">
                  <textarea
                    className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all resize-none"
                    placeholder="Добавить комментарий..."
                    value={commentForm}
                    onChange={(e) => setCommentForm(e.target.value)}
                    rows={3}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentForm.trim()}
                    className="glass-button px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Добавить комментарий
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign User Modal */}
      {assignUserModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-xl font-semibold text-white">
              Привязать к пользователю
            </h3>
            <p className="text-sm text-gray-400">
              Выберите пользователя, к которому нужно привязать email-тикет.
            </p>
            <select
              className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:border-accent-purple/50 transition-all"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="" className="bg-dark-800">Выберите пользователя</option>
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-dark-800">
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setAssignUserModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleAssignUser}
                disabled={!selectedUserId}
                className="glass-button px-4 py-2.5 disabled:opacity-50"
              >
                Привязать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write-off Modal */}
      {writeOffModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 mx-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-xl">
                <Package className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Списание расходников
                </h3>
                <p className="text-sm text-gray-400">
                  К заявке привязаны расходные материалы
                </p>
              </div>
            </div>

            <div className="bg-dark-700/30 rounded-xl p-4">
              <p className="text-sm text-gray-300 mb-3">
                Следующие расходники будут списаны со склада:
              </p>
              <div className="space-y-2">
                {ticketConsumables.map((tc) => (
                  <div
                    key={tc.id}
                    className="flex items-center justify-between bg-dark-800/50 px-4 py-3 rounded-xl border border-dark-600/50"
                  >
                    <div>
                      <span className="text-sm font-medium text-white">
                        {tc.consumable_name}
                      </span>
                      {tc.consumable_model && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({tc.consumable_model})
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-400">
                      {tc.quantity} шт.
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setWriteOffModalOpen(false);
                  setPendingCloseTicketId(null);
                  setTicketConsumables([]);
                }}
                disabled={writeOffLoading}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleCloseWithoutWriteOff}
                disabled={writeOffLoading}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 border border-dark-600/50 rounded-xl hover:bg-dark-700/50 transition-colors disabled:opacity-50"
              >
                Закрыть без списания
              </button>
              <button
                onClick={handleWriteOffAndClose}
                disabled={writeOffLoading}
                className="glass-button px-4 py-2.5 flex items-center gap-2 disabled:opacity-50"
              >
                {writeOffLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Списание...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    Списать и закрыть
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reply Email Modal */}
      {replyEmailOpen && detailId && detail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Ответить по email
                </h3>
                <p className="text-sm text-gray-400">
                  Ответ уйдёт отправителю и будет прикреплён к цепочке письма.
                </p>
              </div>
              <button
                onClick={() => setReplyEmailOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50 transition-all resize-none"
              rows={6}
              placeholder="Текст ответа..."
              value={replyEmailText}
              onChange={(e) => setReplyEmailText(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setReplyEmailOpen(false)}
                disabled={replyEmailSending}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  if (!detailId || !replyEmailText.trim()) return;
                  setReplyEmailSending(true);
                  setError(null);
                  try {
                    await apiPost(`/it/tickets/${detailId}/reply-email`, {
                      message: replyEmailText.trim(),
                    });
                    setReplyEmailOpen(false);
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setReplyEmailSending(false);
                  }
                }}
                disabled={replyEmailSending || !replyEmailText.trim()}
                className="glass-button px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {replyEmailSending ? "Отправка..." : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PaperclipIcon({ isImage }: { isImage: boolean }) {
  // локальная иконка, чтобы не тянуть новые зависимости
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={isImage ? "text-accent-blue" : "text-gray-400"}
    >
      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
