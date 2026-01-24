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

  const testConnection = async (type: "smtp" | "imap" | "ldap") => {
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
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">{label}</span>
        </label>
      );
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) =>
            updateSetting(
              group,
              key,
              type === "number"
                ? parseInt(e.target.value) || 0
                : e.target.value,
            )
          }
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <select
          value={value ?? ""}
          onChange={(e) => updateSetting(group, key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Настройки</h2>
        <p className="text-sm text-gray-500">Системные настройки IT модуля.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Табы */}
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex flex-wrap">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600 bg-white"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Контент табов */}
          <div className="p-6">
            {/* Общие настройки */}
            {activeTab === "general" && (
              <div className="space-y-4 max-w-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
                  <h3 className="text-lg font-semibold text-gray-900">
                    Управление зданиями
                  </h3>
                  <button
                    onClick={() => openBuildingModal()}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
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
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Название
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Адрес
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Статус
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {buildings.map((b) => (
                          <tr key={b.id}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {b.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {b.address || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${b.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                              >
                                {b.is_active ? "Активно" : "Неактивно"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <button
                                onClick={() => openBuildingModal(b)}
                                className="text-blue-600 hover:text-blue-800 mr-3"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBuilding(b.id)}
                                className="text-red-600 hover:text-red-800"
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
                  <h3 className="text-lg font-semibold text-gray-900">
                    Управление кабинетами
                  </h3>
                  <button
                    onClick={() => openRoomModal()}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    disabled={buildings.length === 0}
                  >
                    <Plus className="w-4 h-4" />
                    Добавить кабинет
                  </button>
                </div>

                {/* Фильтр по зданию */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    Здание:
                  </label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => handleBuildingFilterChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Все здания</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
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
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Кабинет
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Здание
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Этаж
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Статус
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rooms.map((r) => (
                          <tr key={r.id}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {r.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {r.building_name || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {r.floor ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${r.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                              >
                                {r.is_active ? "Активен" : "Неактивен"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <button
                                onClick={() => openRoomModal(r)}
                                className="text-blue-600 hover:text-blue-800 mr-3"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRoom(r.id)}
                                className="text-red-600 hover:text-red-800"
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
                  <h3 className="text-lg font-semibold text-gray-900">
                    Настройки SMTP (отправка)
                  </h3>
                  <button
                    onClick={() => testConnection("smtp")}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
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
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Настройки IMAP (получение)
                  </h3>
                  <button
                    onClick={() => testConnection("imap")}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                  >
                    <TestTube className="w-4 h-4" />
                    Тест
                  </button>
                </div>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Настройки Telegram бота
                </h3>
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
                  Получите токен у @BotFather в Telegram.
                </p>
              </div>
            )}

            {/* Zabbix настройки */}
            {activeTab === "zabbix" && (
              <div className="space-y-4 max-w-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
                  <h3 className="text-lg font-semibold text-gray-900">
                    Настройки Active Directory / LDAP
                  </h3>
                  <button
                    onClick={() => testConnection("ldap")}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
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
              <div className="mt-6 pt-4 border-t border-gray-200">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingBuilding ? "Редактирование здания" : "Новое здание"}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={buildingForm.name}
                onChange={(e) =>
                  setBuildingForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Главный корпус"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="ул. Примерная, д. 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Активно</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setBuildingModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveBuilding}
                disabled={!buildingForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editingBuilding ? "Сохранить" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для кабинета */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingRoom ? "Редактирование кабинета" : "Новый кабинет"}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                disabled={!!editingRoom}
              >
                <option value="">Выберите здание</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Номер/название кабинета *
              </label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) =>
                  setRoomForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="101, Серверная, и т.д."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Этаж
              </label>
              <input
                type="number"
                value={roomForm.floor}
                onChange={(e) =>
                  setRoomForm((prev) => ({ ...prev, floor: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Активен</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRoomModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveRoom}
                disabled={!roomForm.building_id || !roomForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
