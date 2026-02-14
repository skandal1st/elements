import { useEffect, useState } from "react";
import {
  Save,
  TestTube,
  Settings,
  RefreshCw,
  Mail,
  MessageCircle,
  Server,
  Shield,
  Building2,
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Sparkles,
  Rocket,
  Bell,
  Shuffle,
  X,
  Database,
} from "lucide-react";
import { apiGet, apiPost } from "../../../shared/api/client";
import { useUIStore } from "../../../shared/store/ui.store";
import {
  buildingsService,
  roomsService,
  type Building,
  type Room,
} from "../../../shared/services/rooms.service";

type RocketChatSettings = {
  rocketchat_enabled?: boolean;
  rocketchat_url?: string;
  rocketchat_user_id?: string;
  rocketchat_auth_token?: string;
  rocketchat_webhook_token?: string;
  rocketchat_channel_name?: string;
  rocketchat_bot_user_id?: string;
};

type TicketSettings = {
  ticket_notifications_enabled?: boolean;
  ticket_notification_channels?: string;
  ticket_notification_recipients?: string;
  ticket_notification_custom_users?: string;
  auto_assign_tickets?: boolean;
  ticket_distribution_method?: string;
  ticket_distribution_specialists?: string;
};

type ZupSettings = {
  zup_enabled?: boolean;
  zup_api_url?: string;
  zup_username?: string;
  zup_password?: string;
  zup_sync_interval_minutes?: number;
};

type AllSettings = {
  general: GeneralSettings;
  tickets: TicketSettings;
  email: EmailSettings;
  imap: ImapSettings;
  telegram: TelegramSettings;
  rocketchat: RocketChatSettings;
  zabbix: ZabbixSettings;
  ldap: LdapSettings;
  zup: ZupSettings;
  llm: LlmSettings;
};

type GeneralSettings = {
  company_name?: string;
  company_logo_url?: string;
  system_email?: string;
  public_app_url?: string;
  default_ticket_priority?: string;
  auto_assign_tickets?: boolean;
  ticket_notifications_enabled?: boolean;
};

type EmailSettings = {
  email_enabled?: boolean;
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
  zabbix_api_token?: string;
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
  /** Шлюз для сканирования ПК (Windows с WinRM); используется учётка AD выше */
  scan_gateway_host?: string;
  scan_gateway_port?: number;
  scan_gateway_use_ssl?: boolean;
  /** Пользователь для WinRM: DOMAIN\\user или user@domain.local (если пусто — Bind DN) */
  scan_gateway_username?: string;
};

type LlmSettings = {
  llm_normalization_enabled?: boolean;
  llm_suggestions_enabled?: boolean;
  openrouter_api_key?: string;
  openrouter_base_url?: string;
  openrouter_model?: string;
  openrouter_embedding_model?: string;
  qdrant_url?: string;
  qdrant_collection?: string;
};

type SettingsUser = {
  id: string;
  email: string;
  full_name: string;
  it_role: string;
  is_superuser?: boolean;
  telegram_connected: boolean;
};

type ADUser = {
  dn?: string | null;
  sAMAccountName: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
  department?: string | null;
  title?: string | null;
  enabled: boolean;
  imported: boolean;
};

const TABS = [
  { id: "general", label: "Общие", icon: Settings },
  { id: "tickets", label: "Заявки", icon: Bell },
  { id: "sync", label: "Синхронизации", icon: RefreshCw },
  { id: "buildings", label: "Здания", icon: Building2 },
  { id: "rooms", label: "Кабинеты", icon: DoorOpen },
  { id: "email", label: "Email (SMTP)", icon: Mail },
  { id: "imap", label: "Email (IMAP)", icon: Mail },
  { id: "telegram", label: "Telegram", icon: MessageCircle },
  { id: "rocketchat", label: "RocketChat", icon: Rocket },
  { id: "zabbix", label: "Zabbix", icon: Server },
  { id: "llm", label: "LLM / OpenRouter", icon: Sparkles },
  { id: "ldap", label: "Active Directory", icon: Shield },
  { id: "zup", label: "1\u0421 \u0417\u0423\u041F", icon: Database },
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
    tickets: {},
    email: {},
    imap: {},
    telegram: {},
    rocketchat: {},
    zabbix: {},
    ldap: {},
    zup: {},
    llm: {},
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

  const [ldapSyncLoading, setLdapSyncLoading] = useState(false);
  const [ldapSyncResult, setLdapSyncResult] = useState<{
    total: number;
    created: number;
    updated: number;
    linked_users: number;
    departments_created: number;
    positions_created: number;
    dismissed: number;
    errors: string[];
  } | null>(null);

  const [adPickerOpen, setAdPickerOpen] = useState(false);
  const [adUsers, setAdUsers] = useState<ADUser[]>([]);
  const [adSearch, setAdSearch] = useState("");
  const [adLoading, setAdLoading] = useState(false);
  const [adSelected, setAdSelected] = useState<Set<string>>(new Set());
  const [adClearBeforeSync, setAdClearBeforeSync] = useState(true);
  const [adClearing, setAdClearing] = useState(false);
  const [adSyncing, setAdSyncing] = useState(false);

  // Состояния для вкладки «Заявки»
  const [ticketSpecialists, setTicketSpecialists] = useState<SettingsUser[]>([]);
  const [ticketAllUsers, setTicketAllUsers] = useState<SettingsUser[]>([]);
  const [, setTicketUsersLoading] = useState(false);
  const [ticketUserSearch, setTicketUserSearch] = useState("");
  const [ticketSpecialistSearch, setTicketSpecialistSearch] = useState("");
  const [showNotifUserPicker, setShowNotifUserPicker] = useState(false);
  const [showDistribSpecialistPicker, setShowDistribSpecialistPicker] = useState(false);

  const loadTicketUsers = async () => {
    setTicketUsersLoading(true);
    try {
      const [specialists, allUsers] = await Promise.all([
        apiGet<SettingsUser[]>("/it/settings/specialists/list"),
        apiGet<SettingsUser[]>("/it/settings/users/all"),
      ]);
      setTicketSpecialists(specialists);
      setTicketAllUsers(allUsers);
    } catch (err) {
      console.error("Failed to load ticket users:", err);
    } finally {
      setTicketUsersLoading(false);
    }
  };

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

  useEffect(() => {
    if (!adPickerOpen) {
      setAdUsers([]);
      setAdSelected(new Set());
      setAdSearch("");
      setAdClearBeforeSync(true);
      return;
    }
    // при открытии модалки — подтянуть список пользователей AD
    loadAdUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adPickerOpen]);

  // Загрузка данных при переключении на вкладку
  useEffect(() => {
    if (activeTab === "buildings" || activeTab === "rooms") {
      loadBuildings();
    }
    if (activeTab === "rooms") {
      loadRooms();
    }
    if (activeTab === "tickets") {
      loadTicketUsers();
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

  const testConnection = async (type: "smtp" | "imap" | "ldap" | "telegram" | "rocketchat" | "zabbix" | "zup") => {
    setError(null);
    try {
      if (type === "zabbix") {
        const result = await apiGet<{ connected: boolean; version?: string; error?: string }>(
          `/it/zabbix/status`,
        );
        if (result.connected) {
          setSuccess(`Zabbix подключён, версия ${result.version || "N/A"}`);
        } else {
          setError(result.error || "Не удалось подключиться к Zabbix");
        }
      } else {
        const result = await apiPost<{ status: string; message: string }>(
          `/it/settings/test/${type}`,
          {},
        );
        if (result.status === "success") {
          setSuccess(result.message);
        } else {
          setError(result.message);
        }
      }
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadAdUsers = async (search?: string) => {
    setError(null);
    setAdLoading(true);
    try {
      const q = (search ?? adSearch).trim();
      const url = q
        ? `/it/settings/ldap/ad-users?q=${encodeURIComponent(q)}`
        : "/it/settings/ldap/ad-users";
      const data = await apiGet<ADUser[]>(url);
      setAdUsers(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdLoading(false);
    }
  };

  const toggleAdUser = (username: string) => {
    setAdSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const toggleAdSelectAll = () => {
    const available = adUsers.filter((u) => u.enabled).map((u) => u.sAMAccountName);
    setAdSelected((prev) => {
      if (prev.size === available.length) return new Set();
      return new Set(available);
    });
  };

  const clearAdEmployees = async () => {
    if (
      !window.confirm(
        "Очистить список сотрудников из AD?\n\nЭто действие пометит всех сотрудников, созданных/связанных с AD, как dismissed (они исчезнут из справочника).",
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    setAdClearing(true);
    try {
      const res = await apiPost<{
        success: boolean;
        dismissed: number;
      }>("/it/settings/ldap/clear-employees", {});
      if (res?.success === false) {
        setError("Не удалось очистить список сотрудников");
      } else {
        setSuccess(`Очищено сотрудников (dismissed): ${res.dismissed ?? 0}`);
      }
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 6000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdClearing(false);
    }
  };

  const syncSelectedAdEmployees = async () => {
    if (adSelected.size === 0) return;
    setError(null);
    setSuccess(null);
    setAdSyncing(true);
    setLdapSyncResult(null);
    try {
      const result = await apiPost<{
        success: boolean;
        total: number;
        created: number;
        updated: number;
        linked_users: number;
        departments_created: number;
        positions_created: number;
        dismissed: number;
        errors: string[];
      }>("/it/settings/ldap/sync-selected", {
        usernames: Array.from(adSelected),
        clear_before: adClearBeforeSync,
      });

      setLdapSyncResult({
        total: result.total ?? 0,
        created: result.created ?? 0,
        updated: result.updated ?? 0,
        linked_users: result.linked_users ?? 0,
        departments_created: result.departments_created ?? 0,
        positions_created: result.positions_created ?? 0,
        dismissed: result.dismissed ?? 0,
        errors: result.errors ?? [],
      });

      if (result.success === false || (result.errors && result.errors.length > 0)) {
        setError((result.errors || []).join("; ") || "Ошибка синхронизации");
      } else {
        setSuccess(
          `Синхронизация выбранных выполнена: всего ${result.total}, создано ${result.created}, обновлено ${result.updated}`,
        );
      }

      await loadAdUsers();
      setAdSelected(new Set());
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 6000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdSyncing(false);
    }
  };

  const syncEmployeesFromAD = async () => {
    setError(null);
    setSuccess(null);
    setLdapSyncResult(null);
    setLdapSyncLoading(true);
    try {
      const result = await apiPost<{
        success: boolean;
        total: number;
        created: number;
        updated: number;
        linked_users: number;
        departments_created: number;
        positions_created: number;
        dismissed: number;
        errors: string[];
      }>("/it/settings/ldap/sync-employees");
      setLdapSyncResult({
        total: result.total ?? 0,
        created: result.created ?? 0,
        updated: result.updated ?? 0,
        linked_users: result.linked_users ?? 0,
        departments_created: result.departments_created ?? 0,
        positions_created: result.positions_created ?? 0,
        dismissed: result.dismissed ?? 0,
        errors: result.errors ?? [],
      });
      if (result.success === false || (result.errors && result.errors.length > 0)) {
        setError((result.errors || []).join("; ") || "Ошибка синхронизации");
      } else {
        setSuccess(
          `AD синхронизация выполнена: всего ${result.total}, создано ${result.created}, обновлено ${result.updated}`,
        );
      }
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 6000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLdapSyncLoading(false);
    }
  };

  const setLastEmailCheckAt = useUIStore((s) => s.setLastEmailCheckAt);

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
        last_check_at?: string | null;
      }>("/it/email/check-inbox");
      setCheckInboxResult({
        emails_processed: result.emails_processed ?? 0,
        tickets_created: result.tickets_created ?? 0,
        comments_created: result.comments_created ?? 0,
        errors: result.errors ?? [],
      });
      if (result.last_check_at != null) {
        setLastEmailCheckAt(result.last_check_at);
      }
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
                {renderInput(
                  "Публичный URL системы (для ссылок в Telegram)",
                  "general",
                  "public_app_url",
                  "text",
                  "https://elements.company.com",
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

            {/* Заявки: уведомления и распределение */}
            {activeTab === "tickets" && (
              <div className="space-y-6 max-w-2xl">
                {/* ── Уведомления ── */}
                <div className="glass-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-accent-blue" />
                    <h3 className="text-lg font-semibold text-white">Уведомления о новых заявках</h3>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.tickets?.ticket_notifications_enabled ?? true}
                      onChange={(e) => updateSetting("tickets", "ticket_notifications_enabled", e.target.checked)}
                      className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30"
                    />
                    <span className="text-sm text-gray-400">Включить уведомления о новых заявках</span>
                  </label>

                  {settings.tickets?.ticket_notifications_enabled !== false && (
                    <>
                      {/* Каналы */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Каналы уведомлений</label>
                        <div className="flex flex-wrap gap-3">
                          {[
                            { key: "in_app", label: "В системе", icon: Bell },
                            { key: "telegram", label: "Telegram", icon: MessageCircle },
                            { key: "email", label: "Email", icon: Mail },
                          ].map((ch) => {
                            const channels = (settings.tickets?.ticket_notification_channels || "in_app,telegram").split(",");
                            const active = channels.includes(ch.key);
                            const Icon = ch.icon;
                            return (
                              <button
                                key={ch.key}
                                type="button"
                                onClick={() => {
                                  const next = active
                                    ? channels.filter((c) => c !== ch.key)
                                    : [...channels, ch.key];
                                  updateSetting("tickets", "ticket_notification_channels", next.filter(Boolean).join(","));
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                                  active
                                    ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                                    : "border-dark-500 bg-dark-700 text-gray-400 hover:border-dark-400"
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                {ch.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Кому уведомлять */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Кому отправлять</label>
                        <div className="space-y-2">
                          {[
                            { value: "all_it", label: "Всем IT-специалистам" },
                            { value: "assigned_only", label: "Только назначенному исполнителю" },
                            { value: "custom", label: "Выбранным сотрудникам" },
                          ].map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="ticket_notification_recipients"
                                value={opt.value}
                                checked={(settings.tickets?.ticket_notification_recipients || "all_it") === opt.value}
                                onChange={() => updateSetting("tickets", "ticket_notification_recipients", opt.value)}
                                className="w-4 h-4 border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30"
                              />
                              <span className="text-sm text-gray-300">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Выбор пользователей для custom */}
                      {settings.tickets?.ticket_notification_recipients === "custom" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">Получатели уведомлений</label>
                          {(() => {
                            let selectedIds: string[] = [];
                            try {
                              selectedIds = JSON.parse(settings.tickets?.ticket_notification_custom_users || "[]");
                            } catch {}
                            const selectedUsers = ticketAllUsers.filter((u) => selectedIds.includes(u.id));
                            return (
                              <div className="space-y-2">
                                {selectedUsers.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {selectedUsers.map((u) => (
                                      <span
                                        key={u.id}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20"
                                      >
                                        {u.full_name}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = selectedIds.filter((id) => id !== u.id);
                                            updateSetting("tickets", "ticket_notification_custom_users", JSON.stringify(next));
                                          }}
                                          className="ml-1 hover:text-red-400"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setShowNotifUserPicker(true)}
                                  className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-dark-500 bg-dark-700 text-gray-400 hover:border-accent-purple/50 transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                  Добавить получателя
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Распределение ── */}
                <div className="glass-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-green-400" />
                    <h3 className="text-lg font-semibold text-white">Автоматическое распределение заявок</h3>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.tickets?.auto_assign_tickets ?? false}
                      onChange={(e) => updateSetting("tickets", "auto_assign_tickets", e.target.checked)}
                      className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30"
                    />
                    <span className="text-sm text-gray-400">Автоматически назначать исполнителя при создании заявки</span>
                  </label>

                  {settings.tickets?.auto_assign_tickets && (
                    <>
                      {/* Метод */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Метод распределения</label>
                        <select
                          value={settings.tickets?.ticket_distribution_method || "least_loaded"}
                          onChange={(e) => updateSetting("tickets", "ticket_distribution_method", e.target.value)}
                          className="glass-input w-full px-4 py-3 text-sm"
                        >
                          <option value="least_loaded" className="bg-dark-800">По наименьшей загрузке</option>
                          <option value="round_robin" className="bg-dark-800">По очереди (round-robin)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          {settings.tickets?.ticket_distribution_method === "round_robin"
                            ? "Заявки назначаются по очереди — каждый специалист получает следующую заявку"
                            : "Заявки назначаются на специалиста с наименьшим числом открытых заявок"}
                        </p>
                      </div>

                      {/* Участники распределения */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Участники распределения
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          Если никто не выбран — распределение среди всех IT-специалистов
                        </p>
                        {(() => {
                          let selectedIds: string[] = [];
                          try {
                            selectedIds = JSON.parse(settings.tickets?.ticket_distribution_specialists || "[]");
                          } catch {}
                          const selectedUsers = ticketSpecialists.filter((u) => selectedIds.includes(u.id));
                          return (
                            <div className="space-y-2">
                              {selectedUsers.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {selectedUsers.map((u) => (
                                    <span
                                      key={u.id}
                                      className="inline-flex items-center gap-2 px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/20"
                                    >
                                      {u.full_name}
                                      {u.telegram_connected && (
                                        <span title="Telegram подключён"><MessageCircle className="w-3 h-3 text-blue-400" /></span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = selectedIds.filter((id) => id !== u.id);
                                          updateSetting("tickets", "ticket_distribution_specialists", JSON.stringify(next));
                                        }}
                                        className="ml-1 hover:text-red-400"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setShowDistribSpecialistPicker(true)}
                                className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-dark-500 bg-dark-700 text-gray-400 hover:border-green-500/50 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                                Выбрать специалистов
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Информация о специалистах */}
                      {ticketSpecialists.length > 0 && (
                        <div className="bg-dark-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-2">
                            Все IT-специалисты ({ticketSpecialists.length}):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ticketSpecialists.map((s) => (
                              <span
                                key={s.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-dark-600 text-gray-300"
                              >
                                {s.full_name}
                                {s.telegram_connected && (
                                  <MessageCircle className="w-3 h-3 text-blue-400" />
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Модалка: выбор получателей уведомлений */}
            {showNotifUserPicker && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="glass-card p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Выбрать получателей</h3>
                    <button type="button" onClick={() => setShowNotifUserPicker(false)} className="text-gray-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Поиск по имени или email..."
                      value={ticketUserSearch}
                      onChange={(e) => setTicketUserSearch(e.target.value)}
                      className="glass-input w-full pl-10 pr-4 py-2 text-sm"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {ticketAllUsers
                      .filter((u) => {
                        if (!ticketUserSearch) return true;
                        const q = ticketUserSearch.toLowerCase();
                        return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                      })
                      .map((u) => {
                        let selectedIds: string[] = [];
                        try {
                          selectedIds = JSON.parse(settings.tickets?.ticket_notification_custom_users || "[]");
                        } catch {}
                        const isSelected = selectedIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? selectedIds.filter((id) => id !== u.id)
                                : [...selectedIds, u.id];
                              updateSetting("tickets", "ticket_notification_custom_users", JSON.stringify(next));
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                              isSelected
                                ? "bg-accent-purple/10 border border-accent-purple/30 text-white"
                                : "hover:bg-dark-600 text-gray-300"
                            }`}
                          >
                            <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 rounded" />
                            <div>
                              <div className="font-medium">{u.full_name}</div>
                              <div className="text-xs text-gray-500">{u.email}</div>
                            </div>
                            {u.telegram_connected && (
                              <span title="Telegram"><MessageCircle className="w-3.5 h-3.5 text-blue-400 ml-auto" /></span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowNotifUserPicker(false); setTicketUserSearch(""); }}
                      className="px-4 py-2 bg-accent-purple text-white rounded-lg text-sm hover:bg-accent-purple/80"
                    >
                      Готово
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Модалка: выбор специалистов для распределения */}
            {showDistribSpecialistPicker && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="glass-card p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Выбрать специалистов для распределения</h3>
                    <button type="button" onClick={() => setShowDistribSpecialistPicker(false)} className="text-gray-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Поиск..."
                      value={ticketSpecialistSearch}
                      onChange={(e) => setTicketSpecialistSearch(e.target.value)}
                      className="glass-input w-full pl-10 pr-4 py-2 text-sm"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {ticketSpecialists
                      .filter((u) => {
                        if (!ticketSpecialistSearch) return true;
                        const q = ticketSpecialistSearch.toLowerCase();
                        return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                      })
                      .map((u) => {
                        let selectedIds: string[] = [];
                        try {
                          selectedIds = JSON.parse(settings.tickets?.ticket_distribution_specialists || "[]");
                        } catch {}
                        const isSelected = selectedIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? selectedIds.filter((id) => id !== u.id)
                                : [...selectedIds, u.id];
                              updateSetting("tickets", "ticket_distribution_specialists", JSON.stringify(next));
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                              isSelected
                                ? "bg-green-500/10 border border-green-500/30 text-white"
                                : "hover:bg-dark-600 text-gray-300"
                            }`}
                          >
                            <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 rounded" />
                            <div>
                              <div className="font-medium">{u.full_name}</div>
                              <div className="text-xs text-gray-500">{u.email} — {u.it_role}</div>
                            </div>
                            {u.telegram_connected && (
                              <span title="Telegram"><MessageCircle className="w-3.5 h-3.5 text-blue-400 ml-auto" /></span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowDistribSpecialistPicker(false); setTicketSpecialistSearch(""); }}
                      className="px-4 py-2 bg-accent-purple text-white rounded-lg text-sm hover:bg-accent-purple/80"
                    >
                      Готово
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Синхронизации */}
            {activeTab === "sync" && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Синхронизации
                  </h3>
                  <p className="text-sm text-gray-500">
                    Включение/выключение интеграций, которые работают в фоне.
                  </p>
                </div>

                <div className="glass-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-accent-blue" />
                    <h4 className="text-sm font-semibold text-white">
                      Email (входящие письма и уведомления)
                    </h4>
                  </div>
                  {renderInput(
                    "Включить синхронизацию Email",
                    "email",
                    "email_enabled",
                    "checkbox",
                  )}
                  <p className="text-xs text-gray-500">
                    Если выключено — проверка почты (IMAP) и email‑уведомления не работают.
                  </p>
                </div>

                <div className="glass-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-accent-purple" />
                    <h4 className="text-sm font-semibold text-white">
                      Active Directory (LDAP)
                    </h4>
                  </div>
                  {renderInput(
                    "Включить синхронизацию сотрудников из AD",
                    "ldap",
                    "ldap_enabled",
                    "checkbox",
                  )}
                  <p className="text-xs text-gray-500">
                    Если выключено — синхронизация сотрудников из AD будет недоступна.
                  </p>
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

            {/* RocketChat настройки */}
            {activeTab === "rocketchat" && (
              <div className="space-y-4 max-w-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Настройки RocketChat
                  </h3>
                  <button
                    onClick={() => testConnection("rocketchat")}
                    className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                  >
                    <TestTube className="w-4 h-4" />
                    Тест
                  </button>
                </div>
                {renderInput(
                  "Включить интеграцию RocketChat",
                  "rocketchat",
                  "rocketchat_enabled",
                  "checkbox",
                )}
                {renderInput(
                  "URL RocketChat",
                  "rocketchat",
                  "rocketchat_url",
                  "text",
                  "https://chat.company.com",
                )}
                {renderInput(
                  "User ID бота (X-User-Id)",
                  "rocketchat",
                  "rocketchat_user_id",
                  "text",
                  "aBcDeFgHiJkLmN",
                )}
                {renderInput(
                  "Auth Token бота (X-Auth-Token)",
                  "rocketchat",
                  "rocketchat_auth_token",
                  "password",
                  "aBcDeFgHiJkLmN...",
                )}
                {renderInput(
                  "Webhook Token",
                  "rocketchat",
                  "rocketchat_webhook_token",
                  "password",
                  "Токен для валидации Outgoing Webhook",
                )}
                {renderInput(
                  "Канал для заявок",
                  "rocketchat",
                  "rocketchat_channel_name",
                  "text",
                  "helpdesk",
                )}
                {renderInput(
                  "User ID бота в RocketChat",
                  "rocketchat",
                  "rocketchat_bot_user_id",
                  "text",
                  "rocket.cat или ID бота",
                )}
                <div className="p-3 rounded-lg bg-dark-700/50 border border-dark-600/50 text-sm text-gray-400 space-y-2">
                  <p className="font-medium text-gray-300">Как это работает:</p>
                  <p className="text-xs">
                    Elements периодически опрашивает канал RocketChat (polling каждые 10 сек). Входящие сообщения автоматически создают заявки.
                    Внешний IP для Elements <b>не требуется</b> — достаточно исходящего доступа в интернет.
                  </p>
                  <p className="font-medium text-gray-300 mt-2">Настройка:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Создайте бота в RocketChat (Administration &rarr; Rooms &rarr; создайте пользователя-бота)</li>
                    <li>Скопируйте <b>User ID</b> и <b>Auth Token</b> бота из Administration &rarr; Users &rarr; бот</li>
                    <li>Укажите канал (например, <b>helpdesk</b>), куда сотрудники будут писать заявки</li>
                    <li>Добавьте бота в этот канал</li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-2">
                    <b>Webhook Token</b> — опционально, нужен только если вы дополнительно настроите Outgoing Webhook в RocketChat для мгновенной доставки (требует сетевой доступность Elements из RocketChat).
                  </p>
                </div>
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
                  "API токен",
                  "zabbix",
                  "zabbix_api_token",
                  "password",
                )}
                <p className="text-sm text-gray-500 mt-2">
                  Используется Bearer-аутентификация (Zabbix 7.x). Создайте API-токен в Zabbix: Администрирование → Общие → API-токены.
                </p>
                <button
                  onClick={() => testConnection("zabbix")}
                  className="glass-button-secondary px-4 py-2 text-sm font-medium flex items-center gap-2"
                >
                  <TestTube size={16} /> Тест подключения
                </button>
              </div>
            )}

            {/* LLM / OpenRouter настройки */}
            {activeTab === "llm" && (
              <div className="space-y-4 max-w-xl">
                <h3 className="text-lg font-semibold text-white mb-2">
                  LLM / OpenRouter
                </h3>
                <p className="text-sm text-gray-500">
                  Используется для нормализации статей базы знаний (Этап 1). При
                  выключенном флаге система работает без LLM.
                </p>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
                  Важно: для нормализации нужна <b>chat-модель</b>. Embedding-модели
                  (например, <code>openai/text-embedding-3-small</code>) здесь не
                  подойдут.
                </div>

                {renderInput(
                  "Включить LLM-нормализацию",
                  "llm",
                  "llm_normalization_enabled",
                  "checkbox",
                )}
                {renderInput(
                  "Включить LLM-подсказки (Этап 2)",
                  "llm",
                  "llm_suggestions_enabled",
                  "checkbox",
                )}
                {renderInput(
                  "OpenRouter Base URL",
                  "llm",
                  "openrouter_base_url",
                  "text",
                  "https://openrouter.ai/api/v1",
                )}
                {renderInput(
                  "OpenRouter Model",
                  "llm",
                  "openrouter_model",
                  "text",
                  "openai/gpt-4o-mini",
                )}
                {renderInput(
                  "OpenRouter Embedding Model",
                  "llm",
                  "openrouter_embedding_model",
                  "text",
                  "openai/text-embedding-3-small",
                )}
                {renderInput(
                  "OpenRouter API Key",
                  "llm",
                  "openrouter_api_key",
                  "password",
                  "sk-or-...",
                )}

                <div className="pt-2 border-t border-dark-600/50" />
                <h4 className="text-sm font-semibold text-white">Qdrant</h4>
                {renderInput(
                  "Qdrant URL",
                  "llm",
                  "qdrant_url",
                  "text",
                  "http://qdrant:6333",
                )}
                {renderInput(
                  "Qdrant Collection",
                  "llm",
                  "qdrant_collection",
                  "text",
                  "knowledge_articles_v1",
                )}
              </div>
            )}

            {/* LDAP/AD настройки */}
            {activeTab === "ldap" && (
              <div className="space-y-4 max-w-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Настройки Active Directory / LDAP
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => testConnection("ldap")}
                      className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                    >
                      <TestTube className="w-4 h-4" />
                      Тест
                    </button>
                    <button
                      onClick={() => setAdPickerOpen(true)}
                      disabled={!settings.ldap.ldap_enabled}
                      className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                      title="Выбрать сотрудников из AD и синхронизировать только их"
                    >
                      <Users className="w-4 h-4" />
                      Выбрать сотрудников
                    </button>
                    <button
                      onClick={syncEmployeesFromAD}
                      disabled={ldapSyncLoading || !settings.ldap.ldap_enabled}
                      className="glass-button flex items-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                      title="Синхронизировать сотрудников HR из AD"
                    >
                      {ldapSyncLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Синхронизация…
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4" />
                          Синхронизировать
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {!settings.ldap.ldap_enabled && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
                    LDAP интеграция отключена. Включите её во вкладке «Синхронизации» или ниже («Включить LDAP»), затем сохраните настройки.
                  </div>
                )}
                {ldapSyncResult && (
                  <div className="p-3 rounded-lg bg-dark-700/50 border border-dark-600/50 text-sm text-gray-300">
                    <div>Всего в AD: {ldapSyncResult.total}</div>
                    <div>Создано сотрудников: {ldapSyncResult.created}</div>
                    <div>Обновлено сотрудников: {ldapSyncResult.updated}</div>
                    <div>Связано с пользователями: {ldapSyncResult.linked_users}</div>
                    <div>Создано отделов: {ldapSyncResult.departments_created}</div>
                    <div>Создано должностей: {ldapSyncResult.positions_created}</div>
                    <div>Помечено dismissed: {ldapSyncResult.dismissed}</div>
                    {ldapSyncResult.errors.length > 0 && (
                      <div className="mt-2 text-amber-400">
                        Ошибки: {ldapSyncResult.errors.join("; ")}
                      </div>
                    )}
                  </div>
                )}
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
                <div className="pt-4 mt-4 border-t border-dark-600/50">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">
                    Шлюз для сканирования ПК (WinRM)
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Windows-сервер в домене с включённым WinRM. Для подключения к шлюзу и к целевым ПК используется учётная запись AD выше (Bind DN / Bind Password).
                  </p>
                  {renderInput(
                    "Хост шлюза",
                    "ldap",
                    "scan_gateway_host",
                    "text",
                    "gateway.company.local",
                  )}
                  {renderInput(
                    "Порт WinRM",
                    "ldap",
                    "scan_gateway_port",
                    "number",
                    "5985",
                  )}
                  {renderInput(
                    "Использовать HTTPS (WinRM)",
                    "ldap",
                    "scan_gateway_use_ssl",
                    "checkbox",
                  )}
                  {renderInput(
                    "Пользователь для шлюза (WinRM)",
                    "ldap",
                    "scan_gateway_username",
                    "text",
                    "DOMAIN\\user или user@domain.local",
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Если шлюз отклоняет учётные данные (Bind DN в формате LDAP), укажите здесь имя в формате домена.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "zup" && (
              <div className="space-y-4 max-w-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Настройки 1С ЗУП
                  </h3>
                  <button
                    onClick={() => testConnection("zup")}
                    className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                  >
                    <TestTube className="w-4 h-4" />
                    Тест подключения
                  </button>
                </div>
                {renderInput(
                  "Включить интеграцию с 1С ЗУП",
                  "zup",
                  "zup_enabled",
                  "checkbox",
                )}
                {renderInput(
                  "URL OData API",
                  "zup",
                  "zup_api_url",
                  "text",
                  "http://server/zup/odata/standard.odata",
                )}
                {renderInput(
                  "Имя пользователя",
                  "zup",
                  "zup_username",
                  "text",
                  "Администратор",
                )}
                {renderInput(
                  "Пароль",
                  "zup",
                  "zup_password",
                  "password",
                )}
                {renderInput(
                  "Интервал синхронизации (минуты)",
                  "zup",
                  "zup_sync_interval_minutes",
                  "number",
                  "60",
                )}
                <p className="text-xs text-gray-500">
                  После сохранения настроек и включения интеграции фоновая синхронизация начнётся автоматически при следующем перезапуске бэкенда. Ручную синхронизацию можно запустить на странице HR &rarr; Синхронизация ЗУП.
                </p>
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

      {/* Модалка выбора сотрудников из AD */}
      {adPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-5xl p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Синхронизация сотрудников из AD</h3>
                <p className="text-sm text-gray-500">
                  Выберите пользователей из Active Directory и синхронизируйте только их.
                </p>
              </div>
              <button
                onClick={() => setAdPickerOpen(false)}
                className="glass-button-secondary px-3 py-2 text-sm font-medium"
              >
                Закрыть
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[240px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={adSearch}
                    onChange={(e) => setAdSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") loadAdUsers(e.currentTarget.value);
                    }}
                    placeholder="Поиск (ФИО / логин / email)..."
                    className="glass-input w-full pl-9 pr-4 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() => loadAdUsers()}
                disabled={adLoading}
                className="glass-button-secondary flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {adLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Поиск…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Найти
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={adUsers.filter((u) => u.enabled).length > 0 && adSelected.size === adUsers.filter((u) => u.enabled).length}
                  onChange={toggleAdSelectAll}
                  className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30"
                />
                Выбрать всех (активных): {adUsers.filter((u) => u.enabled).length}
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={adClearBeforeSync}
                  onChange={(e) => setAdClearBeforeSync(e.target.checked)}
                  className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30"
                />
                Очистить список сотрудников перед синхронизацией (dismiss всех AD)
              </label>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearAdEmployees}
                  disabled={adClearing}
                  className="glass-button-secondary flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
                  title="Пометить всех AD-сотрудников как dismissed"
                >
                  {adClearing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Очистка…
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Очистить список
                    </>
                  )}
                </button>
                <button
                  onClick={syncSelectedAdEmployees}
                  disabled={adSelected.size === 0 || adSyncing}
                  className="glass-button flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {adSyncing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Синхронизация…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Синхронизировать выбранных ({adSelected.size})
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-dark-600/50 max-h-[55vh] overflow-y-auto">
              {adLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
                </div>
              ) : adUsers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-60" />
                  Пользователи не найдены
                </div>
              ) : (
                <table className="min-w-full">
                  <thead className="sticky top-0 bg-dark-800/80 backdrop-blur border-b border-dark-600/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Выбор
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Пользователь
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Отдел
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700/50">
                    {adUsers.map((u) => {
                      const disabled = !u.enabled;
                      const selected = adSelected.has(u.sAMAccountName);
                      return (
                        <tr
                          key={u.dn || u.sAMAccountName}
                          className={`hover:bg-dark-700/30 ${
                            disabled ? "opacity-60" : selected ? "bg-accent-purple/10" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={disabled}
                              onChange={() => toggleAdUser(u.sAMAccountName)}
                              className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-purple focus:ring-accent-purple/30 disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-white">{u.displayName || u.sAMAccountName}</div>
                            <div className="text-xs text-gray-500">{u.sAMAccountName}</div>
                            {u.title && <div className="text-xs text-gray-500">{u.title}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {u.mail || u.userPrincipalName || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">{u.department || "—"}</td>
                          <td className="px-4 py-3">
                            {u.imported ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Уже в HR
                              </span>
                            ) : u.enabled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                Доступен
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                <XCircle className="w-3.5 h-3.5" />
                                Отключён
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="text-xs text-gray-500">
              Найдено: {adUsers.length}. Выбрано: {adSelected.size}.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
