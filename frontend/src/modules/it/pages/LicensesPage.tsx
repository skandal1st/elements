import { useEffect, useState } from "react";
import { Plus, Search, User, Monitor, AlertCircle, Cloud } from "lucide-react";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from "../../../shared/api/client";

type SoftwareLicense = {
  id: string;
  software_name: string;
  vendor?: string;
  license_type?: string;
  license_key?: string;
  total_licenses: number;
  used_licenses: number;
  available_licenses?: number;
  expires_at?: string;
  cost?: number;
  purchase_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  assignments?: LicenseAssignment[];
};

type LicenseAssignment = {
  id: string;
  license_id: string;
  user_id?: string;
  equipment_id?: string;
  assigned_at: string;
  released_at?: string;
  user_name?: string;
  user_email?: string;
  equipment_name?: string;
  equipment_inventory?: string;
  is_saas?: boolean;
};

type Equipment = {
  id: string;
  name: string;
  inventory_number: string;
  category: string;
};

type UserItem = {
  id: string;
  full_name: string;
  email: string;
};

const LICENSE_TYPES = [
  "perpetual",
  "subscription",
  "trial",
  "academic",
  "other",
];

const LICENSE_TYPE_LABELS: Record<string, string> = {
  perpetual: "Бессрочная",
  subscription: "Подписка",
  trial: "Пробная",
  academic: "Академическая",
  other: "Другое",
};

export function LicensesPage() {
  const [items, setItems] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expiredFilter, setExpiredFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] =
    useState<SoftwareLicense | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<SoftwareLicense | null>(null);
  const [form, setForm] = useState({
    software_name: "",
    vendor: "",
    license_type: "",
    license_key: "",
    total_licenses: 1,
    expires_at: "",
    cost: "",
    purchase_date: "",
    notes: "",
  });
  const [assignForm, setAssignForm] = useState({
    user_id: "",
    equipment_id: "",
    is_saas: false,
  });
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [assignType, setAssignType] = useState<"equipment" | "user" | "saas">("equipment");

  // Загрузка оборудования (только компьютеры и серверы)
  const loadEquipment = async () => {
    try {
      const data = await apiGet<Equipment[]>("/it/equipment/");
      // Фильтруем только компьютеры и серверы
      const filtered = data.filter(
        (e) => e.category === "computer" || e.category === "server"
      );
      setEquipmentList(filtered);
    } catch (err) {
      console.error("Ошибка загрузки оборудования:", err);
    }
  };

  // Загрузка пользователей
  const loadUsers = async () => {
    try {
      const data = await apiGet<UserItem[]>("/hr/users/");
      setUsersList(data);
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (expiredFilter) params.set("expired", expiredFilter);
      params.set("page", String(page));
      params.set("page_size", "50");
      const data = await apiGet<SoftwareLicense[]>(`/it/licenses/?${params}`);
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
  }, [page, expiredFilter]);

  const handleSearch = () => {
    setPage(1);
    load();
  };

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setMessage(null);
    setForm({
      software_name: "",
      vendor: "",
      license_type: "",
      license_key: "",
      total_licenses: 1,
      expires_at: "",
      cost: "",
      purchase_date: "",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (lic: SoftwareLicense) => {
    setEditing(lic);
    setError(null);
    setMessage(null);
    setForm({
      software_name: lic.software_name,
      vendor: lic.vendor || "",
      license_type: lic.license_type || "",
      license_key: lic.license_key || "",
      total_licenses: lic.total_licenses,
      expires_at: lic.expires_at || "",
      cost: lic.cost ? String(lic.cost) : "",
      purchase_date: lic.purchase_date || "",
      notes: lic.notes || "",
    });
    setModalOpen(true);
  };

  const openDetail = async (lic: SoftwareLicense) => {
    setSelectedLicense(lic);
    setDetailModalOpen(true);
    try {
      const data = await apiGet<SoftwareLicense>(`/it/licenses/${lic.id}`);
      setSelectedLicense(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openAssign = async (lic: SoftwareLicense) => {
    setSelectedLicense(lic);
    setAssignForm({
      user_id: "",
      equipment_id: "",
      is_saas: false,
    });
    // Для подписки по умолчанию показываем SaaS
    if (lic.license_type === "subscription") {
      setAssignType("saas");
    } else {
      setAssignType("equipment");
    }
    setAssignModalOpen(true);
    // Загружаем списки
    await Promise.all([loadEquipment(), loadUsers()]);
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      const submitData = {
        ...form,
        total_licenses: Number(form.total_licenses) || 1,
        cost: form.cost ? Number(form.cost) : undefined,
        expires_at: form.expires_at || undefined,
        purchase_date: form.purchase_date || undefined,
        vendor: form.vendor || undefined,
        license_type: form.license_type || undefined,
        license_key: form.license_key || undefined,
        notes: form.notes || undefined,
      };

      if (editing) {
        await apiPatch(`/it/licenses/${editing.id}`, submitData);
        setMessage("Лицензия обновлена");
      } else {
        if (!form.software_name) {
          setError("Название ПО обязательно");
          return;
        }
        await apiPost("/it/licenses/", submitData);
        setMessage("Лицензия создана");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAssign = async () => {
    if (!selectedLicense) return;
    
    // Для SaaS не нужно указывать пользователя или оборудование
    if (assignType !== "saas" && !assignForm.user_id && !assignForm.equipment_id) {
      setError("Укажите пользователя или оборудование");
      return;
    }

    setError(null);
    try {
      const payload: any = {
        license_id: selectedLicense.id,
      };
      
      if (assignType === "equipment" && assignForm.equipment_id) {
        payload.equipment_id = assignForm.equipment_id;
      } else if (assignType === "user" && assignForm.user_id) {
        payload.user_id = assignForm.user_id;
      } else if (assignType === "saas") {
        // Для SaaS передаём специальный флаг
        payload.is_saas = true;
      }

      await apiPost(`/it/licenses/${selectedLicense.id}/assign`, payload);
      setAssignModalOpen(false);
      setMessage("Лицензия назначена");
      await load();
      if (selectedLicense) {
        const data = await apiGet<SoftwareLicense>(
          `/it/licenses/${selectedLicense.id}`,
        );
        setSelectedLicense(data);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRelease = async (assignmentId: string) => {
    if (!selectedLicense || !window.confirm("Освободить лицензию?")) return;
    try {
      await apiPost(
        `/it/licenses/${selectedLicense.id}/release/${assignmentId}`,
        {},
      );
      setMessage("Лицензия освобождена");
      await load();
      if (selectedLicense) {
        const data = await apiGet<SoftwareLicense>(
          `/it/licenses/${selectedLicense.id}`,
        );
        setSelectedLicense(data);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить лицензию?")) return;
    try {
      await apiDelete(`/it/licenses/${id}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const isExpired = (lic: SoftwareLicense) => {
    if (!lic.expires_at) return false;
    return new Date(lic.expires_at) < new Date();
  };

  const isLowAvailable = (lic: SoftwareLicense) => {
    const available =
      lic.available_licenses ?? lic.total_licenses - lic.used_licenses;
    return available <= lic.total_licenses * 0.1 && available > 0;
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Лицензии ПО</h2>
        <p className="text-sm text-gray-500">
          Учет лицензий программного обеспечения.
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
          />
          <button
            onClick={handleSearch}
            className="p-2 bg-gray-100 hover:bg-gray-200"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
          value={expiredFilter}
          onChange={(e) => {
            setExpiredFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все лицензии</option>
          <option value="false">Действующие</option>
          <option value="true">Истекшие</option>
        </select>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Добавить лицензию
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">ПО</th>
                <th className="px-4 py-3 font-medium text-gray-700">
                  Производитель
                </th>
                <th className="px-4 py-3 font-medium text-gray-700">
                  Использовано
                </th>
                <th className="px-4 py-3 font-medium text-gray-700">
                  Доступно
                </th>
                <th className="px-4 py-3 font-medium text-gray-700">
                  Срок действия
                </th>
                <th className="px-4 py-3 font-medium text-gray-700" />
              </tr>
            </thead>
            <tbody>
              {items.map((lic) => (
                <tr
                  key={lic.id}
                  className={`border-t border-gray-100 ${
                    isExpired(lic)
                      ? "bg-red-50"
                      : isLowAvailable(lic)
                        ? "bg-yellow-50"
                        : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isExpired(lic) && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      {isLowAvailable(lic) && !isExpired(lic) && (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      )}
                      {lic.software_name}
                    </div>
                  </td>
                  <td className="px-4 py-3">{lic.vendor || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{lic.used_licenses}</span> /{" "}
                    {lic.total_licenses}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-medium ${
                        (lic.available_licenses ?? 0) === 0
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      {lic.available_licenses ??
                        lic.total_licenses - lic.used_licenses}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lic.expires_at
                      ? new Date(lic.expires_at).toLocaleDateString("ru-RU")
                      : "Бессрочная"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDetail(lic)}
                      className="text-blue-600 hover:underline mr-2"
                    >
                      Подробнее
                    </button>
                    <button
                      onClick={() => openEdit(lic)}
                      className="text-green-600 hover:underline mr-2"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDelete(lic.id)}
                      className="text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно создания/редактирования */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900">
              {editing ? "Редактирование лицензии" : "Новая лицензия ПО"}
            </h3>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Название ПО *"
              value={form.software_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, software_name: e.target.value }))
              }
            />
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Производитель"
              value={form.vendor}
              onChange={(e) =>
                setForm((p) => ({ ...p, vendor: e.target.value }))
              }
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип лицензии
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={form.license_type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, license_type: e.target.value }))
                }
              >
                <option value="">Тип не выбран</option>
                {LICENSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LICENSE_TYPE_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[60px]"
              placeholder="Лицензионный ключ"
              value={form.license_key}
              onChange={(e) =>
                setForm((p) => ({ ...p, license_key: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Количество лицензий
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={form.total_licenses}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      total_licenses: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Стоимость
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, cost: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата начала лицензии
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, purchase_date: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата окончания лицензии
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  type="date"
                  value={form.expires_at}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, expires_at: e.target.value }))
                  }
                />
              </div>
            </div>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[60px]"
              placeholder="Примечания"
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
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

      {/* Модальное окно детального просмотра */}
      {detailModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedLicense.software_name}
                </h3>
                <p className="text-sm text-gray-500">
                  Создана:{" "}
                  {new Date(selectedLicense.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-sm text-gray-500"
              >
                Закрыть
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Производитель:</span>{" "}
                {selectedLicense.vendor || "—"}
              </div>
              <div>
                <span className="font-medium">Тип:</span>{" "}
                {selectedLicense.license_type || "—"}
              </div>
              <div>
                <span className="font-medium">Всего лицензий:</span>{" "}
                {selectedLicense.total_licenses}
              </div>
              <div>
                <span className="font-medium">Использовано:</span>{" "}
                {selectedLicense.used_licenses}
              </div>
              <div>
                <span className="font-medium">Доступно:</span>{" "}
                {selectedLicense.available_licenses ??
                  selectedLicense.total_licenses -
                    selectedLicense.used_licenses}
              </div>
              <div>
                <span className="font-medium">Срок действия:</span>{" "}
                {selectedLicense.expires_at
                  ? new Date(selectedLicense.expires_at).toLocaleDateString(
                      "ru-RU",
                    )
                  : "Бессрочная"}
              </div>
              {selectedLicense.cost && (
                <div>
                  <span className="font-medium">Стоимость:</span>{" "}
                  {selectedLicense.cost}
                </div>
              )}
              {selectedLicense.purchase_date && (
                <div>
                  <span className="font-medium">Дата покупки:</span>{" "}
                  {new Date(selectedLicense.purchase_date).toLocaleDateString(
                    "ru-RU",
                  )}
                </div>
              )}
              {selectedLicense.license_key && (
                <div className="md:col-span-2">
                  <span className="font-medium">Лицензионный ключ:</span>
                  <p className="mt-1 text-gray-700 font-mono text-xs break-all">
                    {selectedLicense.license_key}
                  </p>
                </div>
              )}
              {selectedLicense.notes && (
                <div className="md:col-span-2">
                  <span className="font-medium">Примечания:</span>
                  <p className="mt-1 text-gray-700">{selectedLicense.notes}</p>
                </div>
              )}
            </div>

            {/* Привязки */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-gray-900">
                  Привязки лицензий
                </h4>
                <button
                  onClick={() => {
                    setDetailModalOpen(false);
                    openAssign(selectedLicense);
                  }}
                  className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
                  disabled={(selectedLicense.available_licenses ?? 0) === 0}
                >
                  Назначить
                </button>
              </div>

                {selectedLicense.assignments &&
              selectedLicense.assignments.length > 0 ? (
                <div className="space-y-2">
                  {selectedLicense.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="bg-gray-50 rounded-lg p-3 flex justify-between items-center"
                    >
                      <div className="text-sm">
                        {assignment.user_name && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span>{assignment.user_name}</span>
                            {assignment.user_email && (
                              <span className="text-gray-500">
                                ({assignment.user_email})
                              </span>
                            )}
                          </div>
                        )}
                        {assignment.equipment_name && (
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-gray-500" />
                            <span>{assignment.equipment_name}</span>
                            {assignment.equipment_inventory && (
                              <span className="text-gray-500">
                                ({assignment.equipment_inventory})
                              </span>
                            )}
                          </div>
                        )}
                        {/* SaaS - без привязки к оборудованию или пользователю */}
                        {!assignment.user_name && !assignment.equipment_name && (
                          <div className="flex items-center gap-2">
                            <Cloud className="w-4 h-4 text-purple-500" />
                            <span className="text-purple-700">SaaS / Облачный сервис</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Назначена:{" "}
                          {new Date(assignment.assigned_at).toLocaleString(
                            "ru-RU",
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRelease(assignment.id)}
                        className="px-3 py-1 text-xs font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50"
                      >
                        Освободить
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Нет привязок</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно назначения */}
      {assignModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Назначить лицензию: {selectedLicense.software_name}
            </h3>
            <p className="text-sm text-gray-500">
              Доступно:{" "}
              {selectedLicense.available_licenses ??
                selectedLicense.total_licenses -
                  selectedLicense.used_licenses}{" "}
              лицензий
            </p>

            {/* Выбор типа назначения */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тип назначения
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignType("equipment");
                    setAssignForm((p) => ({ ...p, user_id: "", is_saas: false }));
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border ${
                    assignType === "equipment"
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  Оборудование
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignType("user");
                    setAssignForm((p) => ({ ...p, equipment_id: "", is_saas: false }));
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border ${
                    assignType === "user"
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Пользователь
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignType("saas");
                    setAssignForm((p) => ({ ...p, user_id: "", equipment_id: "", is_saas: true }));
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border ${
                    assignType === "saas"
                      ? "bg-purple-50 border-purple-500 text-purple-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  SaaS
                </button>
              </div>
            </div>

            {/* Выбор оборудования */}
            {assignType === "equipment" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Оборудование (компьютер / сервер)
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={assignForm.equipment_id}
                  onChange={(e) =>
                    setAssignForm((p) => ({ ...p, equipment_id: e.target.value }))
                  }
                >
                  <option value="">Выберите оборудование</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.category === "computer" ? "💻" : "🖥️"} {eq.name} ({eq.inventory_number})
                    </option>
                  ))}
                </select>
                {equipmentList.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Нет доступного оборудования (компьютеры и серверы)
                  </p>
                )}
              </div>
            )}

            {/* Выбор пользователя */}
            {assignType === "user" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пользователь
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={assignForm.user_id}
                  onChange={(e) =>
                    setAssignForm((p) => ({ ...p, user_id: e.target.value }))
                  }
                >
                  <option value="">Выберите пользователя</option>
                  {usersList.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* SaaS информация */}
            {assignType === "saas" && (
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Cloud className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-purple-900">
                      SaaS / Облачный сервис
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      Лицензия будет отмечена как используемая без привязки к конкретному оборудованию. 
                      Подходит для облачных сервисов и подписок.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleAssign}
                disabled={
                  assignType === "equipment" && !assignForm.equipment_id ||
                  assignType === "user" && !assignForm.user_id
                }
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Назначить
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
