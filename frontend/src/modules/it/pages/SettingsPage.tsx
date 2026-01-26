import { useEffect, useState } from "react";
import {
  Save,
  TestTube,
  Settings,
  Mail,
  MessageCircle,
  Server,
  Shield,
  Building2,
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { apiGet, apiPost } from "../../../shared/api/client";
import {
  buildingsService,
  roomsService,
  type Building,
  type Room,
} from "../../../shared/services/rooms.service";

type AllSettings = {
  general: GeneralSettings;
  email: EmailSettings;
  imap: ImapSettings;
  telegram: TelegramSettings;
  zabbix: ZabbixSettings;
  ldap: LdapSettings;
};

type GeneralSettings = {
  company_name?: string;
  company_logo_url?: string;
  system_email?: string;
  default_ticket_priority?: string;
  auto_assign_tickets?: boolean;
  ticket_notifications_enabled?: boolean;
};

type EmailSettings = {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  smtp_use_tls?: boolean;
};

type ImapSettings = {
  imap_host?: string;
  imap_port?: number;
  imap_user?: string;
  imap_password?: string;
  imap_use_ssl?: boolean;
  imap_folder?: string;
  email_check_interval?: number;
};

type TelegramSettings = {
  telegram_bot_token?: string;
  telegram_bot_enabled?: boolean;
  telegram_webhook_url?: string;
};

type ZabbixSettings = {
  zabbix_url?: string;
  zabbix_user?: string;
  zabbix_password?: string;
  zabbix_enabled?: boolean;
};

type LdapSettings = {
  ldap_server?: string;
  ldap_port?: number;
  ldap_use_ssl?: boolean;
  ldap_base_dn?: string;
  ldap_bind_dn?: string;
  ldap_bind_password?: string;
  ldap_user_filter?: string;
  ldap_enabled?: boolean;
};

const TABS = [
  { id: "general", label: "Общие", icon: Settings },
  { id: "buildings", label: "Здания", icon: Building2 },
  { id: "rooms", label: "Кабинеты", icon: DoorOpen },
  { id: "email", label: "Email (SMTP)", icon: Mail },
  { id: "imap", label: "Email (IMAP)", icon: Mail },
  { id: "telegram", label: "Telegram", icon: MessageCircle },
  { id: "zabbix", label: "Zabbix", icon: Server },
  { id: "ldap", label: "Active Directory", icon: Shield },
];

const PRIORITIES = ["low", "medium", "high", "critical"];
const priorityLabel: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  const [settings, setSettings] = useState<AllSettings>({
    general: {},
    email: {},
    imap: {},
    telegram: {},
    zabbix: {},
    ldap: {},
  });

  // Состояния для зданий
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [buildingModalOpen, setBuildingModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [buildingForm, setBuildingForm] = useState({
    name: "",
    address: "",
    description: "",
    is_active: true,
  });

  // Состояния для кабинетов
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [roomForm, setRoomForm] = useState({
    building_id: "",
    name: "",
    floor: "",
    description: "",
    is_active: true,
  });

  const [checkInboxLoading, setCheckInboxLoading] = useState(false);
  const [checkInboxResult, setCheckInboxResult] = useState<{
    emails_processed: number;
    tickets_created: number;
    comments_created: number;
    errors: string[];
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<AllSettings>("/it/settings/all");
      setSettings(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Загрузка зданий при переключении на вкладку
  useEffect(() => {
    if (activeTab === "buildings" || activeTab === "rooms") {
      loadBuildings();
    }
    if (activeTab === "rooms") {
      loadRooms();
    }
  }, [activeTab]);

  const loadBuildings = async () => {
    setBuildingsLoading(true);
    try {
      const data = await buildingsService.getBuildings();
      setBuildings(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBuildingsLoading(false);
    }
  };

  const loadRooms = async (buildingId?: string) => {
    setRoomsLoading(true);
    try {
      const data = await roomsService.getRooms(buildingId);
      setRooms(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRoomsLoading(false);
    }
  };

  // Функции для зданий
  const openBuildingModal = (building?: Building) => {
    if (building) {
      setEditingBuilding(building);
      setBuildingForm({
        name: building.name,
        address: building.address || "",
        description: building.description || "",
        is_active: building.is_active,
      });
    } else {
      setEditingBuilding(null);
      setBuildingForm({
        name: "",
        address: "",
        description: "",
        is_active: true,
      });
    }
    setBuildingModalOpen(true);
  };

  const handleSaveBuilding = async () => {
    try {
      if (editingBuilding) {
        await buildingsService.updateBuilding(editingBuilding.id, buildingForm);
        setSuccess("Здание обновлено");
      } else {
        await buildingsService.createBuilding(buildingForm);
        setSuccess("Здание создано");
      }
      setBuildingModalOpen(false);
      await loadBuildings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteBuilding = async (id: string) => {
    if (
      !window.confirm("Удалить здание? Все кабинеты в нём также будут удалены.")
    )
      return;
    try {
      await buildingsService.deleteBuilding(id);
      setSuccess("Здание удалено");
      await loadBuildings();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Функции для кабинетов
  const openRoomModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setRoomForm({
        building_id: room.building_id,
        name: room.name,
        floor: room.floor?.toString() || "",
        description: room.description || "",
        is_active: room.is_active,
      });
    } else {
      setEditingRoom(null);
      setRoomForm({
        building_id: selectedBuildingId || "",
        name: "",
        floor: "",
        description: "",
        is_active: true,
      });
    }
    setRoomModalOpen(true);
  };

  const handleSaveRoom = async () => {
    try {
      const roomData = {
        ...roomForm,
        floor: roomForm.floor ? parseInt(roomForm.floor) : undefined,
      };
      if (editingRoom) {
        await roomsService.updateRoom(editingRoom.id, roomData);
        setSuccess("Кабинет обновлён");
      } else {
        await roomsService.createRoom(roomData as any);
        setSuccess("Кабинет создан");
      }
      setRoomModalOpen(false);
      await loadRooms(selectedBuildingId || undefined);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!window.confirm("Удалить кабинет?")) return;
    try {
      await roomsService.deleteRoom(id);
      setSuccess("Кабинет удалён");
      await loadRooms(selectedBuildingId || undefined);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleBuildingFilterChange = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    loadRooms(buildingId || undefined);
  };

  const updateSetting = (group: keyof AllSettings, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: value,
      },
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Конвертируем все настройки в плоский массив
      const settingsArray: Array<{
        setting_key: string;
        setting_value: string;
        setting_type: string;
      }> = [];

      for (const [groupKey, groupSettings] of Object.entries(settings)) {
        for (const [key, value] of Object.entries(groupSettings)) {
          if (value !== undefined && value !== null) {
            settingsArray.push({
              setting_key: key,
              setting_value: String(value),
              setting_type: groupKey,
            });
          }
        }
      }

      await apiPost("/it/settings/bulk", { settings: settingsArray });
      setSuccess("Настройки сохранены");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (type: "smtp" | "imap" | "ldap" | "telegram") => {
    setError(null);
    try {
      const result = await apiPost<{ status: string; message: string }>(
        `/it/settings/test/${type}`,
        {},
      );
      if (result.status === "success") {
        setSuccess(result.message);
      } else {
        setError(result.message);
      }
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const checkInbox = async () => {
    setError(null);
    setCheckInboxResult(null);
    setCheckInboxLoading(true);
    try {
      const result = await apiPost<{
        success: boolean;
        emails_processed: number;
        tickets_created: number;
        comments_created: number;
        errors: string[];
      }>("/it/email/check-inbox");
      setCheckInboxResult({
        emails_processed: result.emails_processed ?? 0,
        tickets_created: result.tickets_created ?? 0,
        comments_created: result.comments_created ?? 0,
        errors: result.errors ?? [],
      });
      if (result.errors?.length) {
        setError(result.errors.join("; "));
      } else if ((result.emails_processed ?? 0) > 0) {
        setSuccess(
          `Обработано писем: ${result.emails_processed}, создано тикетов: ${result.tickets_created}, комментариев: ${result.comments_created}`,
        );
      } else {
        setSuccess("Новых непрочитанных писем нет.");
      }
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCheckInboxLoading(false);
    }
  };

  const renderInput = (
    label: string,
    group: keyof AllSettings,
    key: string,
    type: "text" | "password" | "number" | "checkbox" = "text",
    placeholder?: string,
  ) => {
    const value = (settings[group] as any)?.[key];

    if (type === "checkbox") {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => updateSetting(group, key, e.target.checked)}
            className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30"
          />
          <span className="text-sm text-gray-400">{label}</span>
        </label>
      );
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) =>
            updateSetting(
              group,
              key,
              type === "number" ? parseInt(e.target.value) || 0 : e.target.value,
            )
          }
          placeholder={placeholder}
          className="glass-input w-full px-4 py-3 text-sm"
        />
      </div>
    );
  };

  const renderSelect = (
    label: string,
    group: keyof AllSettings,
    key: string,
    options: { value: string; label: string }[],
  ) => {
    const value = (settings[group] as any)?.[key];
    return (
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
        <select
          value={value ?? ""}
          onChange={(e) => updateSetting(group, key, e.target.value)}
          className="glass-input w-full px-4 py-3 text-sm"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-dark-800">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <h2 className="text-2xl font-bold text-white mb-1">Настройки</h2>
        <p className="text-gray-400">Системные настройки IT модуля</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">{success}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="border-b border-dark-600/50">
            <div className="flex flex-wrap">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      activeTab === tab.id
                        ? "border-accent-purple text-accent-purple"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {activeTab === "general" && (
              <div className="space-y-4 max-w-xl">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Общие настройки
                </h3>
                {renderInput(
                  "Название компании",
                  "general",
                  "company_name",
                  "text",
                  'ООО "Компания"',
                )}
                {renderInput(
                  "URL логотипа",
                  "general",
                  "company_logo_url",
                  "text",
                  "https://...",
                )}
                {renderInput(
                  "Email системы",
                  "general",
                  "system_email",
                  "text",
                  "support@company.com",
                )}
                {renderSelect(
                  "Приоритет по умолчанию",
                  "general",
                  "default_ticket_priority",
                  PRIORITIES.map((p) => ({
                    value: p,
                    label: priorityLabel[p],
                  })),
                )}
                <div className="space-y-2 pt-2">
                  {renderInput(
                    "Автоматическое назначение тикетов",
                    "general",
                    "auto_assign_tickets",
                    "checkbox",
                  )}
                  {renderInput(
                    "Уведомления о тикетах включены",
                    "general",
                    "ticket_notifications_enabled",
                    "checkbox",
                  )}
                </div>
              </div>
            )}

            {/* Здания */}
            {activeTab === "buildings" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Управление зданиями
                  </h3>
                  <button
                    onClick={() => openBuildingModal()}
                    className="glass-button flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить здание
                  </button>
                </div>

                {buildingsLoading ? (
                  <p className="text-sm text-gray-500">Загрузка...</p>
                ) : buildings.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Нет зданий. Добавьте первое здание.
                  </p>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-dark-600/50">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-dark-600/50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Адрес</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/50">
                        {buildings.map((b) => (
                          <tr key={b.id} className="hover:bg-dark-700/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-white">
                              {b.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">
                              {b.address || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${b.is_active ? "bg-green-500/20 text-green-400" : "bg-dark-600/50 text-gray-400"}`}
                              >
                                {b.is_active ? "Активно" : "Неактивно"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <button
                                onClick={() => openBuildingModal(b)}
                                className="p-2 text-gray-400 hover:text-accent-purple hover:bg-dark-700/50 rounded-lg mr-1 transition-all"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBuilding(b.id)}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Кабинеты */}
            {activeTab === "rooms" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Управление кабинетами
                  </h3>
                  <button
                    onClick={() => openRoomModal()}
                    className="glass-button flex items-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={buildings.length === 0}
                  >
                    <Plus className="w-4 h-4" />
                    Добавить кабинет
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-400">Здание:</label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => handleBuildingFilterChange(e.target.value)}
                    className="glass-input px-4 py-2.5 text-sm"
                  >
                    <option value="" className="bg-dark-800">Все здания</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id} className="bg-dark-800">
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {roomsLoading ? (
                  <p className="text-sm text-gray-500">Загрузка...</p>
                ) : rooms.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {buildings.length === 0
                      ? "Сначала добавьте здание."
                      : "Нет кабинетов. Добавьте первый кабинет."}
                  </p>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-dark-600/50">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-dark-600/50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кабинет</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Здание</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Этаж</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-700/50">
                        {rooms.map((r) => (
                          <tr key={r.id} className="hover:bg-dark-700/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-white">{r.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{r.building_name || "—"}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{r.floor ?? "—"}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${r.is_active ? "bg-green-500/20 text-green-400" : "bg-dark-600/50 text-gray-400"}`}>
                                {r.is_active ? "Активен" : "Неактивен"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <button
                                onClick={() => openRoomModal(r)}
                                className="p-2 text-gray-400 hover:text-accent-purple hover:bg-dark-700/50 rounded-lg mr-1 transition-all"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRoom(r.id)}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SMTP настройки */}
            {activeTab === "email" && (
              <div className="space-y-4 max-w-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Настройки SMTP (отправка)
                  </h3>
                  <button
                    onClick={() => testConnection("smtp")}
                    className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                  >
                    <TestTube className="w-4 h-4" />
                    Тест
                  </button>
                </div>
                {renderInput(
                  "SMTP сервер",
                  "email",
                  "smtp_host",
                  "text",
                  "smtp.gmail.com",
                )}
                {renderInput("Порт", "email", "smtp_port", "number", "587")}
                {renderInput(
                  "Пользователь",
                  "email",
                  "smtp_user",
                  "text",
                  "user@gmail.com",
                )}
                {renderInput("Пароль", "email", "smtp_password", "password")}
                {renderInput(
                  "Email отправителя",
                  "email",
                  "smtp_from_email",
                  "text",
                  "support@company.com",
                )}
                {renderInput(
                  "Имя отправителя",
                  "email",
                  "smtp_from_name",
                  "text",
                  "IT Support",
                )}
                {renderInput(
                  "Использовать TLS",
                  "email",
                  "smtp_use_tls",
                  "checkbox",
                )}
              </div>
            )}

            {/* IMAP настройки */}
            {activeTab === "imap" && (
              <div className="space-y-4 max-w-xl">
                <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Настройки IMAP (получение)
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => testConnection("imap")}
                      className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                    >
                      <TestTube className="w-4 h-4" />
                      Тест
                    </button>
                    <button
                      onClick={checkInbox}
                      disabled={checkInboxLoading}
                      className="glass-button flex items-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                    >
                      {checkInboxLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Проверка…
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Проверить почту
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {checkInboxResult && (
                  <div className="p-3 rounded-lg bg-dark-700/50 border border-dark-600/50 text-sm text-gray-300">
                    <div>Обработано писем: {checkInboxResult.emails_processed}</div>
                    <div>Создано тикетов: {checkInboxResult.tickets_created}</div>
                    <div>Комментариев: {checkInboxResult.comments_created}</div>
                    {checkInboxResult.errors.length > 0 && (
                      <div className="mt-2 text-amber-400">
                        Ошибки: {checkInboxResult.errors.join("; ")}
                      </div>
                    )}
                  </div>
                )}
                {renderInput(
                  "IMAP сервер",
                  "imap",
                  "imap_host",
                  "text",
                  "imap.gmail.com",
                )}
                {renderInput("Порт", "imap", "imap_port", "number", "993")}
                {renderInput(
                  "Пользователь",
                  "imap",
                  "imap_user",
                  "text",
                  "support@company.com",
                )}
                {renderInput("Пароль", "imap", "imap_password", "password")}
                {renderInput("Папка", "imap", "imap_folder", "text", "INBOX")}
                {renderInput(
                  "Интервал проверки (мин)",
                  "imap",
                  "email_check_interval",
                  "number",
                  "5",
                )}
                {renderInput(
                  "Использовать SSL",
                  "imap",
                  "imap_use_ssl",
                  "checkbox",
                )}
              </div>
            )}

            {/* Telegram настройки */}
            {activeTab === "telegram" && (
              <div className="space-y-4 max-w-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Настройки Telegram бота
                  </h3>
                  <button
                    onClick={() => testConnection("telegram")}
                    className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                  >
                    <TestTube className="w-4 h-4" />
                    Тест
                  </button>
                </div>
                {renderInput(
                  "Включить Telegram бота",
                  "telegram",
                  "telegram_bot_enabled",
                  "checkbox",
                )}
                {renderInput(
                  "Токен бота",
                  "telegram",
                  "telegram_bot_token",
                  "password",
                  "123456789:ABC...",
                )}
                {renderInput(
                  "Webhook URL",
                  "telegram",
                  "telegram_webhook_url",
                  "text",
                  "https://your-domain.com/webhook",
                )}
                <p className="text-sm text-gray-500 mt-2">
                  Получите токен у @BotFather в Telegram. После сохранения нажмите «Тест» для проверки подключения.
                </p>
              </div>
            )}

            {/* Zabbix настройки */}
            {activeTab === "zabbix" && (
              <div className="space-y-4 max-w-xl">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Настройки Zabbix
                </h3>
                {renderInput(
                  "Включить интеграцию",
                  "zabbix",
                  "zabbix_enabled",
                  "checkbox",
                )}
                {renderInput(
                  "URL Zabbix API",
                  "zabbix",
                  "zabbix_url",
                  "text",
                  "https://zabbix.company.com/api_jsonrpc.php",
                )}
                {renderInput(
                  "Пользователь",
                  "zabbix",
                  "zabbix_user",
                  "text",
                  "Admin",
                )}
                {renderInput("Пароль", "zabbix", "zabbix_password", "password")}
              </div>
            )}

            {/* LDAP/AD настройки */}
            {activeTab === "ldap" && (
              <div className="space-y-4 max-w-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Настройки Active Directory / LDAP
                  </h3>
                  <button
                    onClick={() => testConnection("ldap")}
                    className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                  >
                    <TestTube className="w-4 h-4" />
                    Тест
                  </button>
                </div>
                {renderInput(
                  "Включить LDAP",
                  "ldap",
                  "ldap_enabled",
                  "checkbox",
                )}
                {renderInput(
                  "Сервер",
                  "ldap",
                  "ldap_server",
                  "text",
                  "dc.company.local",
                )}
                {renderInput("Порт", "ldap", "ldap_port", "number", "389")}
                {renderInput(
                  "Использовать SSL",
                  "ldap",
                  "ldap_use_ssl",
                  "checkbox",
                )}
                {renderInput(
                  "Base DN",
                  "ldap",
                  "ldap_base_dn",
                  "text",
                  "DC=company,DC=local",
                )}
                {renderInput(
                  "Bind DN",
                  "ldap",
                  "ldap_bind_dn",
                  "text",
                  "CN=Admin,DC=company,DC=local",
                )}
                {renderInput(
                  "Bind Password",
                  "ldap",
                  "ldap_bind_password",
                  "password",
                )}
                {renderInput(
                  "Фильтр пользователей",
                  "ldap",
                  "ldap_user_filter",
                  "text",
                  "(objectClass=user)",
                )}
              </div>
            )}

            {/* Кнопка сохранения - только для вкладок настроек */}
            {!["buildings", "rooms"].includes(activeTab) && (
              <div className="mt-6 pt-4 border-t border-dark-600/50">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Сохранение..." : "Сохранить настройки"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно для здания */}
      {buildingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">
              {editingBuilding ? "Редактирование здания" : "Новое здание"}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={buildingForm.name}
                onChange={(e) =>
                  setBuildingForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="glass-input w-full px-4 py-3 text-sm"
                placeholder="Главный корпус"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Адрес
              </label>
              <input
                type="text"
                value={buildingForm.address}
                onChange={(e) =>
                  setBuildingForm((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
                className="glass-input w-full px-4 py-3 text-sm"
                placeholder="ул. Примерная, д. 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Описание
              </label>
              <textarea
                value={buildingForm.description}
                onChange={(e) =>
                  setBuildingForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="glass-input w-full px-4 py-3 text-sm"
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={buildingForm.is_active}
                onChange={(e) =>
                  setBuildingForm((prev) => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))
                }
                className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30"
              />
              <span className="text-sm text-gray-400">Активно</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setBuildingModalOpen(false)}
                className="glass-button-secondary px-4 py-2 text-sm font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveBuilding}
                disabled={!buildingForm.name.trim()}
                className="glass-button px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingBuilding ? "Сохранить" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для кабинета */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">
              {editingRoom ? "Редактирование кабинета" : "Новый кабинет"}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Здание *
              </label>
              <select
                value={roomForm.building_id}
                onChange={(e) =>
                  setRoomForm((prev) => ({
                    ...prev,
                    building_id: e.target.value,
                  }))
                }
                className="glass-input w-full px-4 py-3 text-sm"
                disabled={!!editingRoom}
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
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Номер/название кабинета *
              </label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) =>
                  setRoomForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="glass-input w-full px-4 py-3 text-sm"
                placeholder="101, Серверная, и т.д."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Этаж
              </label>
              <input
                type="number"
                value={roomForm.floor}
                onChange={(e) =>
                  setRoomForm((prev) => ({ ...prev, floor: e.target.value }))
                }
                className="glass-input w-full px-4 py-3 text-sm"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Описание
              </label>
              <textarea
                value={roomForm.description}
                onChange={(e) =>
                  setRoomForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="glass-input w-full px-4 py-3 text-sm"
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={roomForm.is_active}
                onChange={(e) =>
                  setRoomForm((prev) => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))
                }
                className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30"
              />
              <span className="text-sm text-gray-400">Активен</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRoomModalOpen(false)}
                className="glass-button-secondary px-4 py-2 text-sm font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveRoom}
                disabled={!roomForm.building_id || !roomForm.name.trim()}
                className="glass-button px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingRoom ? "Сохранить" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
