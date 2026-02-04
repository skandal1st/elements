import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Search, User, Monitor, AlertCircle, Cloud, ChevronDown } from "lucide-react";
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
  employee_id?: number;
  user_id?: string;
  equipment_id?: string;
  assigned_at: string;
  released_at?: string;
  employee_name?: string;
  employee_email?: string;
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

type EmployeeItem = {
  id: number;
  full_name: string;
  email?: string | null;
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

/** Выпадающий список с поиском прямо внутри */
function SearchableSelect<T>({
  label,
  placeholder,
  value,
  onChange,
  loadOptions,
  renderOption,
  getOptionValue,
  getOptionLabel,
  emptyMessage,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  loadOptions: (search: string) => Promise<T[]>;
  renderOption: (item: T) => React.ReactNode;
  getOptionValue: (item: T) => string;
  getOptionLabel: (item: T) => string;
  emptyMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchOptions = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const data = await loadOptions(q);
        setOptions(data);
      } finally {
        setLoading(false);
      }
    },
    [loadOptions]
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchOptions(search), search ? 300 : 0);
    debounceRef.current = t;
    return () => clearTimeout(debounceRef.current);
  }, [open, search, fetchOptions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: T) => {
    const v = getOptionValue(item);
    onChange(v);
    setSelectedLabel(getOptionLabel(item));
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-dark-700/50 border border-dark-600/50 rounded-xl text-sm text-left text-gray-300 hover:border-dark-500 focus:outline-none focus:border-accent-purple/50 transition-all"
      >
        <span className={value ? "text-white" : "text-gray-500"}>
          {value ? selectedLabel || "Выбрано" : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-dark-800 border border-dark-600 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-dark-600">
            <input
              type="text"
              autoFocus
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-dark-700/50 border border-dark-600/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-purple/50"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="py-6 flex justify-center">
                <div className="w-6 h-6 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
              </div>
            ) : options.length === 0 ? (
              <p className="py-4 px-4 text-sm text-gray-500 text-center">{emptyMessage}</p>
            ) : (
              options.map((item) => {
                const v = getOptionValue(item);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-dark-700/80 transition-colors ${
                      value === v ? "bg-accent-purple/20 text-accent-purple" : "text-gray-300"
                    }`}
                  >
                    {renderOption(item)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
    employee_id: "" as string | number,
    equipment_id: "",
    is_saas: false,
  });
  const [assignType, setAssignType] = useState<"equipment" | "employee" | "saas">("equipment");

  // Поиск оборудования (с поиском по имени, инв. номеру)
  const loadEquipment = useCallback(async (searchQuery = "") => {
    try {
      const params = new URLSearchParams();
      params.set("page_size", "100");
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const data = await apiGet<Equipment[]>(`/it/equipment/?${params}`);
      return data.filter(
        (e) => e.category === "computer" || e.category === "server"
      );
    } catch (err) {
      console.error("Ошибка загрузки оборудования:", err);
      return [];
    }
  }, []);

  // Поиск сотрудников
  const loadEmployees = useCallback(async (searchQuery = "") => {
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      const data = await apiGet<EmployeeItem[]>(`/hr/employees/?${params}`);
      return data;
    } catch (err) {
      console.error("Ошибка загрузки сотрудников:", err);
      return [];
    }
  }, []);

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
      employee_id: "",
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
    
    // Для SaaS не нужно указывать сотрудника или оборудование
    if (assignType !== "saas" && !assignForm.employee_id && !assignForm.equipment_id) {
      setError("Укажите сотрудника или оборудование");
      return;
    }

    setError(null);
    try {
      const payload: any = {
        license_id: selectedLicense.id,
      };
      
      if (assignType === "equipment" && assignForm.equipment_id) {
        payload.equipment_id = assignForm.equipment_id;
      } else if (assignType === "employee" && assignForm.employee_id) {
        payload.employee_id = Number(assignForm.employee_id);
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
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Лицензии ПО</h2>
            <p className="text-gray-400">Учет лицензий программного обеспечения</p>
          </div>
          <button onClick={openCreate} className="glass-button px-4 py-2.5 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Добавить лицензию
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
            placeholder="Поиск лицензий..."
          />
        </div>
        <select
          className="glass-input px-4 py-2.5 text-sm"
          value={expiredFilter}
          onChange={(e) => { setExpiredFilter(e.target.value); setPage(1); }}
        >
          <option value="" className="bg-dark-800">Все лицензии</option>
          <option value="false" className="bg-dark-800">Действующие</option>
          <option value="true" className="bg-dark-800">Истекшие</option>
        </select>
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
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ПО</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Производитель</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Использовано</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Доступно</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Срок действия</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {items.map((lic) => (
                <tr
                  key={lic.id}
                  className={`hover:bg-dark-700/30 transition-colors ${
                    isExpired(lic) ? "bg-red-500/10" : isLowAvailable(lic) ? "bg-amber-500/10" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {isExpired(lic) && <AlertCircle className="w-4 h-4 text-red-400" />}
                      {isLowAvailable(lic) && !isExpired(lic) && <AlertCircle className="w-4 h-4 text-amber-400" />}
                      <span className="text-white font-medium">{lic.software_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-400">{lic.vendor || "—"}</td>
                  <td className="px-4 py-4 text-gray-400">
                    <span className="font-medium text-white">{lic.used_licenses}</span> / {lic.total_licenses}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`font-medium ${(lic.available_licenses ?? 0) === 0 ? "text-red-400" : "text-gray-300"}`}>
                      {lic.available_licenses ?? lic.total_licenses - lic.used_licenses}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-400">
                    {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString("ru-RU") : "Бессрочная"}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => openDetail(lic)}
                      className="text-accent-purple hover:text-accent-blue mr-2 transition-colors"
                    >
                      Подробнее
                    </button>
                    <button
                      onClick={() => openEdit(lic)}
                      className="text-green-400 hover:text-green-300 mr-2 transition-colors"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDelete(lic.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-lg font-semibold text-white">
              {editing ? "Редактирование лицензии" : "Новая лицензия ПО"}
            </h3>
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              placeholder="Название ПО *"
              value={form.software_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, software_name: e.target.value }))
              }
            />
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              placeholder="Производитель"
              value={form.vendor}
              onChange={(e) =>
                setForm((p) => ({ ...p, vendor: e.target.value }))
              }
            />
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Тип лицензии
              </label>
              <select
                className="glass-input w-full px-4 py-3 text-sm"
                value={form.license_type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, license_type: e.target.value }))
                }
              >
                <option value="" className="bg-dark-800">Тип не выбран</option>
                {LICENSE_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-dark-800">
                    {LICENSE_TYPE_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="glass-input w-full px-4 py-3 text-sm min-h-[60px] resize-none"
              placeholder="Лицензионный ключ"
              value={form.license_key}
              onChange={(e) =>
                setForm((p) => ({ ...p, license_key: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Количество лицензий
                </label>
                <input
                  className="glass-input w-full px-4 py-3 text-sm"
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
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Стоимость
                </label>
                <input
                  className="glass-input w-full px-4 py-3 text-sm"
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
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Дата начала лицензии
                </label>
                <input
                  className="glass-input w-full px-4 py-3 text-sm"
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, purchase_date: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Дата окончания лицензии
                </label>
                <input
                  className="glass-input w-full px-4 py-3 text-sm"
                  type="date"
                  value={form.expires_at}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, expires_at: e.target.value }))
                  }
                />
              </div>
            </div>
            <textarea
              className="glass-input w-full px-4 py-3 text-sm min-h-[60px] resize-none"
              placeholder="Примечания"
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
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
      {detailModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedLicense.software_name}
                </h3>
                <p className="text-sm text-gray-400">
                  Создана:{" "}
                  {new Date(selectedLicense.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="glass-button-secondary px-3 py-2 text-sm font-medium"
              >
                Закрыть
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-400">
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
                  <p className="mt-1 text-gray-400 font-mono text-xs break-all">
                    {selectedLicense.license_key}
                  </p>
                </div>
              )}
              {selectedLicense.notes && (
                <div className="md:col-span-2">
                  <span className="font-medium">Примечания:</span>
                  <p className="mt-1 text-gray-400">{selectedLicense.notes}</p>
                </div>
              )}
            </div>

            {/* Привязки */}
            <div className="border-t border-dark-600/50 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-white">Привязки лицензий</h4>
                <button
                  onClick={() => { setDetailModalOpen(false); openAssign(selectedLicense); }}
                  className="px-3 py-2 text-sm font-medium text-green-400 bg-green-500/20 border border-green-500/30 rounded-xl hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="bg-dark-700/30 rounded-xl p-3 flex justify-between items-center"
                    >
                      <div className="text-sm">
                        {(assignment.employee_name || assignment.user_name) && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span>{assignment.employee_name || assignment.user_name}</span>
                            {(assignment.employee_email || assignment.user_email) && (
                              <span className="text-gray-500">
                                ({(assignment.employee_email || assignment.user_email)})
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
                        {/* SaaS - без привязки к оборудованию или сотруднику */}
                        {!assignment.employee_name && !assignment.user_name && !assignment.equipment_name && (
                          <div className="flex items-center gap-2">
                            <Cloud className="w-4 h-4 text-purple-500" />
                            <span className="text-accent-purple">SaaS / Облачный сервис</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">
              Назначить лицензию: {selectedLicense.software_name}
            </h3>
            <p className="text-sm text-gray-400">
              Доступно:{" "}
              {selectedLicense.available_licenses ??
                selectedLicense.total_licenses - selectedLicense.used_licenses}{" "}
              лицензий
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Тип назначения</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setAssignType("equipment"); setAssignForm((p) => ({ ...p, employee_id: "", is_saas: false })); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-xl border transition-all ${
                    assignType === "equipment"
                      ? "bg-accent-purple/20 border-accent-purple/50 text-accent-purple"
                      : "bg-dark-700/50 border-dark-600/50 text-gray-400 hover:text-white hover:border-dark-500"
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  Оборудование
                </button>
                <button
                  type="button"
                  onClick={() => { setAssignType("employee"); setAssignForm((p) => ({ ...p, equipment_id: "", is_saas: false })); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-xl border transition-all ${
                    assignType === "employee"
                      ? "bg-accent-purple/20 border-accent-purple/50 text-accent-purple"
                      : "bg-dark-700/50 border-dark-600/50 text-gray-400 hover:text-white hover:border-dark-500"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Сотрудник
                </button>
                <button
                  type="button"
                  onClick={() => { setAssignType("saas"); setAssignForm((p) => ({ ...p, employee_id: "", equipment_id: "", is_saas: true })); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-xl border transition-all ${
                    assignType === "saas"
                      ? "bg-accent-purple/20 border-accent-purple/50 text-accent-purple"
                      : "bg-dark-700/50 border-dark-600/50 text-gray-400 hover:text-white hover:border-dark-500"
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  SaaS
                </button>
              </div>
            </div>

            {/* Выбор оборудования с поиском в выпадающем */}
            {assignType === "equipment" && (
              <SearchableSelect
                label="Оборудование (компьютер / сервер)"
                placeholder="Начните вводить для поиска..."
                value={assignForm.equipment_id}
                onChange={(id) => setAssignForm((p) => ({ ...p, equipment_id: id }))}
                loadOptions={loadEquipment}
                renderOption={(eq) => (
                  <span>
                    {eq.category === "computer" ? "💻" : "🖥️"} {eq.name} ({eq.inventory_number})
                  </span>
                )}
                getOptionValue={(eq) => eq.id}
                getOptionLabel={(eq) => `${eq.category === "computer" ? "💻" : "🖥️"} ${eq.name} (${eq.inventory_number})`}
                emptyMessage="Нет доступного оборудования (компьютеры и серверы)"
              />
            )}

            {/* Выбор сотрудника с поиском в выпадающем */}
            {assignType === "employee" && (
              <SearchableSelect
                label="Сотрудник"
                placeholder="Начните вводить для поиска..."
                value={String(assignForm.employee_id)}
                onChange={(id) => setAssignForm((p) => ({ ...p, employee_id: id ? Number(id) : "" }))}
                loadOptions={loadEmployees}
                renderOption={(emp) => (
                  <span>{emp.full_name}{emp.email ? ` (${emp.email})` : ""}</span>
                )}
                getOptionValue={(emp) => String(emp.id)}
                getOptionLabel={(emp) => `${emp.full_name}${emp.email ? ` (${emp.email})` : ""}`}
                emptyMessage="Сотрудники не найдены"
              />
            )}

            {assignType === "saas" && (
              <div className="bg-accent-purple/10 rounded-xl p-4 border border-accent-purple/20">
                <div className="flex items-start gap-3">
                  <Cloud className="w-5 h-5 text-accent-purple mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">SaaS / Облачный сервис</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Лицензия будет отмечена как используемая без привязки к конкретному оборудованию.
                      Подходит для облачных сервисов и подписок.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="glass-button-secondary px-4 py-2 text-sm font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleAssign}
                disabled={
                  assignType === "equipment" && !assignForm.equipment_id ||
                  assignType === "employee" && !assignForm.employee_id
                }
                className="px-4 py-2 text-sm font-medium text-green-400 bg-green-500/20 border border-green-500/30 rounded-xl hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
