import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  User,
  Calendar,
  Clock,
  AlertCircle,
  Tag,
  MapPin,
  Monitor,
  UserPlus,
  Paperclip,
  FileText,
  Image,
  Download,
} from "lucide-react";
import { ticketsService } from "../services/tickets.service";
import { usersService } from "../services/users.service";
import { equipmentService } from "../services/equipment.service";
import { buildingsService } from "../services/buildings.service";
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  User as UserType,
  Equipment,
  Building,
  Room,
} from "../types";
import { Button } from "../components/ui/Button";
import { TicketComments } from "../components/tickets/TicketComments";
import { useAuthStore } from "../store/auth.store";
import { canManageTickets } from "../utils/permissions";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

const getStatusLabel = (status: TicketStatus): string => {
  const labels: Record<TicketStatus, string> = {
    new: "Новая",
    in_progress: "В работе",
    waiting: "Ожидание",
    resolved: "Решена",
    closed: "Закрыта",
    pending_user: "Требует пользователя",
  };
  return labels[status] || status;
};

const getStatusColor = (status: TicketStatus): string => {
  const colors: Record<TicketStatus, string> = {
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    in_progress:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    waiting:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    resolved:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    pending_user:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };
  return colors[status] || "";
};

const getPriorityLabel = (priority: TicketPriority): string => {
  const labels: Record<TicketPriority, string> = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    critical: "Критический",
  };
  return labels[priority] || priority;
};

const getPriorityColor = (priority: TicketPriority): string => {
  const colors: Record<TicketPriority, string> = {
    low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return colors[priority] || "";
};

const getCategoryLabel = (category: TicketCategory): string => {
  const labels: Record<TicketCategory, string> = {
    hardware: "Оборудование",
    software: "ПО",
    network: "Сеть",
    hr: "HR / Кадры",
    other: "Прочее",
  };
  return labels[category] || category;
};

export const TicketWorkPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canManage = canManageTickets(user?.role);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [itSpecialists, setItSpecialists] = useState<UserType[]>([]);

  // Редактируемые поля
  const [editedStatus, setEditedStatus] = useState<TicketStatus>("new");
  const [editedPriority, setEditedPriority] =
    useState<TicketPriority>("medium");
  const [editedAssigneeId, setEditedAssigneeId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedCategory, setEditedCategory] =
    useState<TicketCategory>("hardware");
  const [editedLocationDepartment, setEditedLocationDepartment] = useState("");
  const [editedLocationRoom, setEditedLocationRoom] = useState("");
  const [editedEquipmentId, setEditedEquipmentId] = useState<string | null>(
    null,
  );
  const [editedCreatorId, setEditedCreatorId] = useState<string | null>(null);

  // Справочники для выбора
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (id) {
      loadTicket();
      loadItSpecialists();
      loadBuildings();
      loadAllUsers();
    }
  }, [id]);

  // Загрузка кабинетов при выборе здания
  useEffect(() => {
    if (selectedBuildingId) {
      loadRooms(selectedBuildingId);
    } else {
      setRooms([]);
    }
  }, [selectedBuildingId]);

  // Загрузка оборудования при выборе здания/кабинета
  useEffect(() => {
    if (editedLocationDepartment) {
      loadEquipmentForLocation(editedLocationDepartment, editedLocationRoom);
    } else {
      setEquipmentList([]);
    }
  }, [editedLocationDepartment, editedLocationRoom]);

  const loadTicket = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ticketsService.getTicketById(id);
      if (result.error) {
        setError(result.error.message || "Ошибка загрузки заявки");
      } else if (result.data) {
        setTicket(result.data);
        // Инициализируем редактируемые поля
        setEditedStatus(result.data.status);
        setEditedPriority(result.data.priority);
        setEditedAssigneeId(result.data.assignee_id || null);
        setEditedTitle(result.data.title);
        setEditedDescription(result.data.description);
        setEditedCategory(result.data.category);
        setEditedLocationDepartment(result.data.location_department || "");
        setEditedLocationRoom(result.data.location_room || "");
        setEditedEquipmentId(result.data.equipment_id || null);
        setEditedCreatorId(result.data.creator_id || null);

        // Найдем здание по имени для загрузки кабинетов
        const locationDept = result.data.location_department;
        if (locationDept) {
          const buildingsResult = await buildingsService.getBuildings();
          if (!buildingsResult.error && buildingsResult.data) {
            const building = buildingsResult.data.find(
              (b: Building) => b.name === locationDept,
            );
            if (building) {
              setSelectedBuildingId(building.id);
            }
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadItSpecialists = async () => {
    try {
      const result = await usersService.getUsers();
      if (!result.error && result.data) {
        const specialists = result.data.filter(
          (u: UserType) => u.role === "it_specialist" || u.role === "admin",
        );
        setItSpecialists(specialists);
      }
    } catch (err) {
      console.error("Ошибка загрузки специалистов:", err);
    }
  };

  const loadBuildings = async () => {
    try {
      const result = await buildingsService.getBuildings();
      if (!result.error && result.data) {
        setBuildings(result.data);
      }
    } catch (err) {
      console.error("Ошибка загрузки зданий:", err);
    }
  };

  const loadRooms = async (buildingId: string) => {
    try {
      const result = await buildingsService.getRooms(buildingId);
      if (!result.error && result.data) {
        setRooms(result.data);
      }
    } catch (err) {
      console.error("Ошибка загрузки кабинетов:", err);
    }
  };

  const loadAllUsers = async () => {
    try {
      const result = await usersService.getUsers();
      if (!result.error && result.data) {
        setAllUsers(result.data);
      }
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
    }
  };

  const loadEquipmentForLocation = async (department: string, room: string) => {
    try {
      const result = await equipmentService.getEquipmentByLocation(
        department,
        room,
      );
      if (!result.error && result.data) {
        setEquipmentList(result.data);
      }
    } catch (err) {
      console.error("Ошибка загрузки оборудования:", err);
    }
  };

  const handleStatusChange = (newStatus: TicketStatus) => {
    setEditedStatus(newStatus);
    setHasChanges(true);
  };

  const handlePriorityChange = (newPriority: TicketPriority) => {
    setEditedPriority(newPriority);
    setHasChanges(true);
  };

  const handleAssigneeChange = (assigneeId: string | null) => {
    setEditedAssigneeId(assigneeId);
    setHasChanges(true);
  };

  const handleTitleChange = (title: string) => {
    setEditedTitle(title);
    setHasChanges(true);
  };

  const handleDescriptionChange = (description: string) => {
    setEditedDescription(description);
    setHasChanges(true);
  };

  const handleCategoryChange = (category: TicketCategory) => {
    setEditedCategory(category);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!ticket || !id) return;

    setSaving(true);
    try {
      const updateData: any = {
        status: editedStatus,
        priority: editedPriority,
        assignee_id: editedAssigneeId || null,
        title: editedTitle,
        description: editedDescription,
        category: editedCategory,
        location_department: editedLocationDepartment || null,
        location_room: editedLocationRoom || null,
        equipment_id: editedEquipmentId || null,
        creator_id: editedCreatorId || null,
      };

      // Автоматически устанавливаем даты при изменении статуса
      if (editedStatus === "resolved" && ticket.status !== "resolved") {
        updateData.resolved_at = new Date().toISOString();
      } else if (editedStatus === "closed" && ticket.status !== "closed") {
        updateData.closed_at = new Date().toISOString();
        if (!ticket.resolved_at) {
          updateData.resolved_at = new Date().toISOString();
        }
      } else if (editedStatus !== "resolved" && editedStatus !== "closed") {
        updateData.resolved_at = null;
        updateData.closed_at = null;
      }

      // Автоматически назначаем исполнителя при взятии в работу
      if (editedStatus === "in_progress" && !editedAssigneeId && user) {
        updateData.assignee_id = user.id;
        setEditedAssigneeId(user.id);
      }

      const result = await ticketsService.updateTicket(id, updateData);
      if (result.error) {
        setError(result.error.message || "Ошибка сохранения");
      } else {
        setHasChanges(false);
        loadTicket(); // Перезагружаем для получения обновленных данных
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTakeInWork = async () => {
    if (!user || !id) return;
    setEditedStatus("in_progress");
    setEditedAssigneeId(user.id);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => navigate("/tickets")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад к списку
        </Button>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error || "Заявка не найдена"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="secondary" onClick={() => navigate("/tickets")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Заявка #{ticket.id.slice(0, 8)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Создана{" "}
              {formatDistanceToNow(new Date(ticket.created_at), {
                addSuffix: true,
                locale: ru,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {canManage &&
            ticket.status !== "in_progress" &&
            ticket.status !== "closed" && (
              <Button variant="secondary" onClick={handleTakeInWork}>
                <UserPlus className="h-4 w-4 mr-2" />
                Взять в работу
              </Button>
            )}
          {hasChanges && canManage && (
            <Button onClick={handleSave} loading={saving}>
              <Save className="h-4 w-4 mr-2" />
              Сохранить изменения
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основной контент */}
        <div className="lg:col-span-2 space-y-6">
          {/* Заголовок и описание */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Заголовок
              </label>
              {canManage ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {ticket.title}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Описание
              </label>
              {canManage ? (
                <textarea
                  value={editedDescription}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                    {ticket.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Местоположение и оборудование */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <MapPin className="h-5 w-5 inline mr-2" />
              Местоположение и оборудование
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Здание */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Здание
                </label>
                {canManage ? (
                  <select
                    value={editedLocationDepartment}
                    onChange={(e) => {
                      const selectedBuilding = buildings.find(
                        (b) => b.name === e.target.value,
                      );
                      setEditedLocationDepartment(e.target.value);
                      setSelectedBuildingId(selectedBuilding?.id || null);
                      setEditedLocationRoom("");
                      setEditedEquipmentId(null);
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Не выбрано</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {ticket.location_department || "-"}
                  </p>
                )}
              </div>

              {/* Кабинет */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Кабинет
                </label>
                {canManage ? (
                  <select
                    value={editedLocationRoom}
                    onChange={(e) => {
                      setEditedLocationRoom(e.target.value);
                      setEditedEquipmentId(null);
                      setHasChanges(true);
                    }}
                    disabled={!selectedBuildingId}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                  >
                    <option value="">Не выбран</option>
                    {rooms
                      .filter((r) => r.is_active)
                      .map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                          {r.floor ? ` (этаж ${r.floor})` : ""}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {ticket.location_room || "-"}
                  </p>
                )}
              </div>

              {/* Оборудование */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Monitor className="h-4 w-4 inline mr-1" />
                  Оборудование
                </label>
                {canManage ? (
                  <select
                    value={editedEquipmentId || ""}
                    onChange={(e) => {
                      setEditedEquipmentId(e.target.value || null);
                      setHasChanges(true);
                    }}
                    disabled={!editedLocationDepartment}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                  >
                    <option value="">Не выбрано</option>
                    {equipmentList.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} ({eq.inventory_number})
                      </option>
                    ))}
                  </select>
                ) : ticket.equipment ? (
                  <div>
                    <p className="text-gray-900 dark:text-white">
                      {ticket.equipment.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {ticket.equipment.model} •{" "}
                      {ticket.equipment.inventory_number}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400">-</p>
                )}
              </div>
            </div>
          </div>

          {/* Заявитель (для email-заявок без пользователя) */}
          {canManage && ticket.email_sender && !ticket.creator && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-4">
                <User className="h-5 w-5 inline mr-2" />
                Привязка заявителя
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Заявка создана из email: <strong>{ticket.email_sender}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Выберите пользователя
                </label>
                <select
                  value={editedCreatorId || ""}
                  onChange={(e) => {
                    setEditedCreatorId(e.target.value || null);
                    setHasChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="">Не выбран</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Вложения из email-тикета */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Paperclip className="h-5 w-5 mr-2" />
                Вложения ({ticket.attachments.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {ticket.attachments.map((path, idx) => {
                  const filename = path.split("/").pop() || "Файл";
                  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(
                    path,
                  );
                  const apiUrl =
                    import.meta.env.VITE_API_URL?.replace("/api", "") || "";
                  const fullUrl = `${apiUrl}${path}`;

                  return (
                    <div
                      key={idx}
                      className="relative group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                    >
                      {isImage ? (
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={fullUrl}
                            alt={filename}
                            className="w-full h-32 object-cover group-hover:opacity-90 transition-opacity"
                            onError={(e) => {
                              // Если изображение не загрузилось, показываем заглушку
                              (e.target as HTMLImageElement).style.display =
                                "none";
                              (
                                e.target as HTMLImageElement
                              ).nextElementSibling?.classList.remove("hidden");
                            }}
                          />
                          <div className="hidden w-full h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                            <Image className="h-8 w-8 text-gray-400" />
                          </div>
                        </a>
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
                          <FileText className="h-12 w-12 text-gray-400" />
                        </div>
                      )}
                      <div className="p-2 bg-gray-50 dark:bg-gray-700">
                        <p
                          className="text-xs text-gray-600 dark:text-gray-300 truncate"
                          title={filename}
                        >
                          {filename}
                        </p>
                        <a
                          href={fullUrl}
                          download={filename}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center mt-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Скачать
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Комментарии */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <TicketComments
              ticketId={ticket.id}
              emailSender={ticket.email_sender}
              createdVia={ticket.created_via}
              creatorEmail={ticket.creator?.email}
            />
          </div>
        </div>

        {/* Боковая панель */}
        <div className="space-y-6">
          {/* Статус и управление */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Управление
            </h3>

            {/* Статус */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Статус
              </label>
              {canManage && ticket.status !== "pending_user" ? (
                <select
                  value={editedStatus}
                  onChange={(e) =>
                    handleStatusChange(e.target.value as TicketStatus)
                  }
                  className={`w-full px-3 py-2 rounded-lg font-medium border-0 focus:ring-2 focus:ring-primary-500 ${getStatusColor(editedStatus)}`}
                >
                  <option value="new">Новая</option>
                  <option value="in_progress">В работе</option>
                  <option value="waiting">Ожидание</option>
                  <option value="resolved">Решена</option>
                  <option value="closed">Закрыта</option>
                </select>
              ) : (
                <span
                  className={`inline-flex px-3 py-2 text-sm font-medium rounded-lg ${getStatusColor(ticket.status)}`}
                >
                  {getStatusLabel(ticket.status)}
                </span>
              )}
            </div>

            {/* Приоритет */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Приоритет
              </label>
              {canManage ? (
                <select
                  value={editedPriority}
                  onChange={(e) =>
                    handlePriorityChange(e.target.value as TicketPriority)
                  }
                  className={`w-full px-3 py-2 rounded-lg font-medium border-0 focus:ring-2 focus:ring-primary-500 ${getPriorityColor(editedPriority)}`}
                >
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                  <option value="critical">Критический</option>
                </select>
              ) : (
                <span
                  className={`inline-flex px-3 py-2 text-sm font-medium rounded-lg ${getPriorityColor(ticket.priority)}`}
                >
                  {getPriorityLabel(ticket.priority)}
                </span>
              )}
            </div>

            {/* Категория */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Tag className="h-4 w-4 inline mr-1" />
                Категория
              </label>
              {canManage ? (
                <select
                  value={editedCategory}
                  onChange={(e) =>
                    handleCategoryChange(e.target.value as TicketCategory)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="hardware">Оборудование</option>
                  <option value="software">ПО</option>
                  <option value="network">Сеть</option>
                  <option value="hr">HR / Кадры</option>
                  <option value="other">Прочее</option>
                </select>
              ) : (
                <p className="text-gray-900 dark:text-white">
                  {getCategoryLabel(ticket.category)}
                </p>
              )}
            </div>

            {/* Исполнитель */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Исполнитель
              </label>
              {canManage ? (
                <select
                  value={editedAssigneeId || ""}
                  onChange={(e) => handleAssigneeChange(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Не назначен</option>
                  {itSpecialists.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.full_name} {spec.id === user?.id && "(Вы)"}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 dark:text-white">
                  {ticket.assignee?.full_name || "Не назначен"}
                </p>
              )}
            </div>
          </div>

          {/* Информация */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Информация
            </h3>

            {/* Создатель */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Создатель
              </label>
              <p className="text-gray-900 dark:text-white">
                {ticket.creator?.full_name ||
                  ticket.email_sender ||
                  "Неизвестно"}
              </p>
              {ticket.creator?.department && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {ticket.creator.department}
                </p>
              )}
              {ticket.created_via === "email" && (
                <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  Email
                </span>
              )}
            </div>

            {/* Даты */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar className="h-4 w-4 inline mr-1" />
                Создана
              </label>
              <p className="text-gray-900 dark:text-white">
                {new Date(ticket.created_at).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Clock className="h-4 w-4 inline mr-1" />
                Обновлена
              </label>
              <p className="text-gray-900 dark:text-white">
                {formatDistanceToNow(new Date(ticket.updated_at), {
                  addSuffix: true,
                  locale: ru,
                })}
              </p>
            </div>

            {ticket.desired_resolution_date && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Желаемая дата решения
                </label>
                <p className="text-gray-900 dark:text-white">
                  {new Date(ticket.desired_resolution_date).toLocaleDateString(
                    "ru-RU",
                  )}
                </p>
              </div>
            )}

            {ticket.resolved_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Решена
                </label>
                <p className="text-green-600 dark:text-green-400">
                  {new Date(ticket.resolved_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}

            {ticket.closed_at && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Закрыта
                </label>
                <p className="text-gray-600 dark:text-gray-400">
                  {new Date(ticket.closed_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
