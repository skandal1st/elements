import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Search,
  History,
  Package,
  QrCode,
  Printer,
  Download,
  User,
  MapPin,
  Monitor,
  Cpu,
  HardDrive,
  Key,
  Building2,
  Server,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from "../../../shared/api/client";
import {
  equipmentCatalogService,
  type Brand,
  type EquipmentType,
  type EquipmentModel,
  type ModelConsumable,
} from "../../../shared/services/equipmentCatalog.service";
import {
  roomsService,
  buildingsService,
} from "../../../shared/services/rooms.service";

type Equipment = {
  id: string;
  name: string;
  model?: string;
  model_id?: string;
  inventory_number: string;
  serial_number?: string;
  category: string;
  status: string;
  current_owner_id?: string;
  room_id?: string;
  location_department?: string;
  location_room?: string;
  // Дополнительные поля от backend
  room_name?: string;
  building_name?: string;
  // IP-адрес для сетевого оборудования
  ip_address?: string;
  // Характеристики хранятся в JSON объекте
  specifications?: {
    cpu?: string;
    ram?: string;
    storage?: string;
    os?: string;
    resolution?: string;
    diagonal?: string;
    [key: string]: string | undefined;
  };
};

type EquipmentHistory = {
  id: string;
  equipment_id: string;
  from_user_id?: string;
  to_user_id?: string;
  from_location?: string;
  to_location?: string;
  reason?: string;
  changed_by_id: string;
  created_at: string;
  from_user_name?: string;
  to_user_name?: string;
  changed_by_name?: string;
};

type EquipmentLicense = {
  id: string;
  software_name: string;
  vendor?: string;
  license_type?: string;
  expires_at?: string;
  assigned_at: string;
};

type EquipmentDetail = Equipment & {
  owner_name?: string;
  owner_email?: string;
  room_name?: string;
  building_name?: string;
  model_name?: string;
  brand_name?: string;
  type_name?: string;
};

const CONSUMABLE_TYPES = [
  "cartridge",
  "drum",
  "toner",
  "ink",
  "paper",
  "other",
];

const consumableTypeLabel: Record<string, string> = {
  cartridge: "Картридж",
  drum: "Фотобарабан",
  toner: "Тонер",
  ink: "Чернила",
  paper: "Бумага",
  other: "Прочее",
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

const STATUSES = ["in_stock", "in_use", "in_repair", "written_off"];

const statusLabel: Record<string, string> = {
  in_stock: "На складе",
  in_use: "В использовании",
  in_repair: "В ремонте",
  written_off: "Списано",
};

export function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<
    "" | "in_stock" | "in_use" | "in_repair" | "written_off"
  >("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterBuildingId, setFilterBuildingId] = useState<string>("");
  const [filterRoomId, setFilterRoomId] = useState<string>("");
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("");
  const [filterEmployeeSearch, setFilterEmployeeSearch] = useState("");
  const [filterEmployees, setFilterEmployees] = useState<
    Array<{ id: string; full_name: string }>
  >([]);
  const [filterEmployeesLoading, setFilterEmployeesLoading] = useState(false);
  const [filterBuildings, setFilterBuildings] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [filterRooms, setFilterRooms] = useState<
    Array<{ id: string; name: string; building_name?: string }>
  >([]);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [isLoadingEditData, setIsLoadingEditData] = useState(false); // Флаг загрузки данных для редактирования
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailEquipment, setDetailEquipment] = useState<EquipmentDetail | null>(
    null,
  );
  const [equipmentHistory, setEquipmentHistory] = useState<EquipmentHistory[]>(
    [],
  );
  const [equipmentLicenses, setEquipmentLicenses] = useState<EquipmentLicense[]>([]);
  const [detailConsumables, setDetailConsumables] = useState<ModelConsumable[]>([]);
  const [detailTab, setDetailTab] = useState<"info" | "licenses" | "consumables" | "history">("info");

  // QR-код
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrEquipment, setQrEquipment] = useState<Equipment | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState({
    name: "",
    model_id: "",
    model: "",
    inventory_number: "",
    serial_number: "",
    category: "",
    status: "in_stock",
    room_id: "",
    current_owner_id: "",
    cpu: "",
    ram: "",
    storage: "",
    os: "",
    resolution: "",
    diagonal: "",
    ip_address: "",
  });

  // Состояние для справочника оборудования
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [models, setModels] = useState<EquipmentModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [modelConsumables, setModelConsumables] = useState<ModelConsumable[]>(
    [],
  );

  // Состояния для кабинетов и сотрудников
  const [buildingsForRooms, setBuildingsForRooms] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [roomsForEquipment, setRoomsForEquipment] = useState<
    Array<{ id: string; name: string; building_name?: string }>
  >([]);
  const [selectedBuildingForRoom, setSelectedBuildingForRoom] =
    useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>(
    [],
  );
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Модальные окна для добавления в справочник
  const [addBrandModal, setAddBrandModal] = useState(false);
  const [addTypeModal, setAddTypeModal] = useState(false);
  const [addModelModal, setAddModelModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newModelName, setNewModelName] = useState("");

  // Модальное окно для добавления расходника в модель
  const [addConsumableModal, setAddConsumableModal] = useState(false);
  const [newConsumableName, setNewConsumableName] = useState("");
  const [newConsumableType, setNewConsumableType] = useState("");
  const [newConsumablePartNumber, setNewConsumablePartNumber] = useState("");

  // Вкладки в форме оборудования
  const [formTab, setFormTab] = useState<"main" | "specs" | "location">("main");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab) params.set("status", activeTab);
      if (filterCategory) params.set("category", filterCategory);
      if (filterRoomId) params.set("room_id", filterRoomId);
      if (filterEmployeeId) params.set("owner_id", filterEmployeeId);
      params.set("page", String(page));
      params.set("page_size", "20");
      const data = await apiGet<Equipment[]>(`/it/equipment/?${params}`);
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadFilterBuildings = async () => {
    try {
      const data = await buildingsService.getBuildings(true);
      setFilterBuildings(data.map((b) => ({ id: b.id, name: b.name })));
    } catch (err) {
      console.error("Ошибка загрузки зданий (фильтр):", err);
    }
  };

  const loadFilterRooms = async (buildingId: string) => {
    try {
      if (!buildingId) {
        setFilterRooms([]);
        return;
      }
      const data = await roomsService.getRooms(buildingId, true);
      setFilterRooms(
        data.map((r) => ({
          id: r.id,
          name: r.name,
          building_name: r.building_name,
        })),
      );
    } catch (err) {
      console.error("Ошибка загрузки кабинетов (фильтр):", err);
    }
  };

  const loadFilterEmployees = async () => {
    try {
      setFilterEmployeesLoading(true);
      const params = new URLSearchParams();
      if (filterEmployeeSearch.trim()) params.set("q", filterEmployeeSearch.trim());
      const url = params.toString()
        ? `/hr/employees/?${params.toString()}`
        : "/hr/employees/";
      const data = await apiGet<Array<{ id: string; full_name: string }>>(url);
      setFilterEmployees(data);
    } catch (err) {
      console.error("Ошибка загрузки сотрудников (фильтр):", err);
    } finally {
      setFilterEmployeesLoading(false);
    }
  };

  useEffect(() => {
    loadFilterBuildings();
    loadFilterEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      loadFilterEmployees();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEmployeeSearch]);

  // Загрузка справочника
  const loadBrands = async () => {
    try {
      const data = await equipmentCatalogService.getBrands();
      setBrands(data);
    } catch (err) {
      console.error("Ошибка загрузки марок:", err);
    }
  };

  const loadEquipmentTypes = async (brandId: string, category?: string) => {
    try {
      const data = await equipmentCatalogService.getEquipmentTypes(
        brandId,
        category,
      );
      setEquipmentTypes(data);
    } catch (err) {
      console.error("Ошибка загрузки типов:", err);
    }
  };

  const loadModels = async (typeId: string) => {
    try {
      const data = await equipmentCatalogService.getModels(typeId);
      setModels(data);
    } catch (err) {
      console.error("Ошибка загрузки моделей:", err);
    }
  };

  const loadModelConsumables = async (modelId: string) => {
    try {
      const data = await equipmentCatalogService.getModelConsumables(modelId);
      setModelConsumables(data);
    } catch (err) {
      console.error("Ошибка загрузки расходников модели:", err);
    }
  };

  const handleBuildingForRoomChange = async (buildingId: string) => {
    setSelectedBuildingForRoom(buildingId);
    setSelectedRoomId("");
    setForm((p) => ({ ...p, room_id: "" }));
    if (buildingId) {
      await loadRoomsForEquipment(buildingId);
    } else {
      setRoomsForEquipment([]);
    }
  };

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    setForm((p) => ({ ...p, room_id: roomId }));
  };

  // Обработчики выбора
  const handleBrandChange = async (brandId: string) => {
    setSelectedBrandId(brandId);
    setSelectedTypeId("");
    setSelectedModelId("");
    setModels([]);
    setModelConsumables([]);
    // Загружаем типы для выбранной марки (без фильтра по категории, так как категория теперь определяется через тип)
    if (brandId) {
      await loadEquipmentTypes(brandId);
    } else {
      setEquipmentTypes([]);
    }
  };

  const handleTypeChange = async (typeId: string) => {
    setSelectedTypeId(typeId);
    setSelectedModelId("");
    setModelConsumables([]);
    if (typeId) {
      // Обновляем категорию в форме на основе выбранного типа
      const selectedType = equipmentTypes.find((t) => t.id === typeId);
      if (selectedType) {
        setForm((p) => ({ ...p, category: selectedType.category }));
      }
      await loadModels(typeId);
    }
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModelId(modelId);
    setForm((p) => ({ ...p, model_id: modelId }));
    if (modelId) {
      await loadModelConsumables(modelId);
      const model = models.find((m) => m.id === modelId);
      if (model) {
        setForm((p) => ({ ...p, model: model.name }));
      }
    } else {
      setModelConsumables([]);
    }
  };

  // Создание элементов справочника
  const handleCreateBrand = async () => {
    if (!newBrandName) return;
    try {
      await equipmentCatalogService.createBrand({ name: newBrandName });
      setNewBrandName("");
      setAddBrandModal(false);
      await loadBrands();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCreateType = async () => {
    if (!selectedBrandId || !form.category) return;
    try {
      // Используем русское название категории как название типа
      const typeName = categoryLabel[form.category] || form.category;
      await equipmentCatalogService.createEquipmentType({
        brand_id: selectedBrandId,
        name: typeName,
        category: form.category,
      });
      setAddTypeModal(false);
      await loadEquipmentTypes(selectedBrandId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCreateModel = async () => {
    if (!newModelName || !selectedTypeId) return;
    try {
      const model = await equipmentCatalogService.createModel({
        equipment_type_id: selectedTypeId,
        name: newModelName,
      });
      setNewModelName("");
      setAddModelModal(false);
      await loadModels(selectedTypeId);
      setSelectedModelId(model.id);
      setForm((p) => ({ ...p, model_id: model.id, model: model.name }));
      await loadModelConsumables(model.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCreateModelConsumable = async () => {
    if (!newConsumableName || !selectedModelId) return;
    try {
      await equipmentCatalogService.createModelConsumable(selectedModelId, {
        name: newConsumableName,
        consumable_type: newConsumableType || undefined,
        part_number: newConsumablePartNumber || undefined,
      });
      setNewConsumableName("");
      setNewConsumableType("");
      setNewConsumablePartNumber("");
      setAddConsumableModal(false);
      await loadModelConsumables(selectedModelId);
      setMessage(
        "Расходный материал добавлен в справочник модели и будет доступен в разделе расходных материалов",
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Обновление типов при изменении категории
  useEffect(() => {
    // Не обновляем типы если идет загрузка данных для редактирования
    if (isLoadingEditData) {
      return;
    }

    // Не обновляем типы при редактировании, если уже выбрана модель - это предотвратит сброс
    if (editing && selectedModelId) {
      return;
    }

    // Категория теперь определяется через тип оборудования, поэтому этот useEffect не должен сбрасывать значения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category]);

  const handleSearch = () => {
    setPage(1); // Сбрасываем на первую страницу при поиске
    load();
  };

  const applyFilters = () => {
    setPage(1);
    load();
  };

  const resetFilters = () => {
    setActiveTab("");
    setFilterCategory("");
    setFilterBuildingId("");
    setFilterRoomId("");
    setFilterEmployeeId("");
    setFilterEmployeeSearch("");
    setFilterRooms([]);
    setPage(1);
    load();
  };

  const handleTabClick = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setPage(1);
    // дождёмся обновления состояния и сразу перезагрузим
    window.setTimeout(() => load(), 0);
  };

  const openDetail = async (e: Equipment) => {
    setDetailTab("info");
    setEquipmentHistory([]);
    setEquipmentLicenses([]);
    setDetailConsumables([]);
    
    // Загружаем детальную информацию об оборудовании
    setDetailModalOpen(true);
    
    try {
      // Загружаем детальную информацию с бэкенда
      const detail = await apiGet<EquipmentDetail>(`/it/equipment/${e.id}`);
      setDetailEquipment(detail);
      
      // Загружаем лицензии, привязанные к оборудованию
      try {
        const licenses = await apiGet<EquipmentLicense[]>(`/it/equipment/${e.id}/licenses/`);
        setEquipmentLicenses(licenses);
      } catch (err) {
        console.log("Лицензии не найдены или endpoint не существует");
      }
      
      // Загружаем расходные материалы модели если есть model_id
      if (detail.model_id) {
        try {
          const consumables = await equipmentCatalogService.getModelConsumables(detail.model_id);
          setDetailConsumables(consumables);
        } catch (err) {
          console.log("Расходники модели не найдены");
        }
      }
      
      // Загружаем историю
      await loadHistory(e.id);
    } catch (err) {
      // Если детальный endpoint не существует, используем базовую информацию
      setDetailEquipment(e as EquipmentDetail);
      await loadHistory(e.id);
    }
  };

  const closeDetail = () => {
    setDetailModalOpen(false);
    setDetailEquipment(null);
    setEquipmentHistory([]);
    setEquipmentLicenses([]);
    setDetailConsumables([]);
  };

  // QR-код функции
  const openQrModal = (e: Equipment) => {
    setQrEquipment(e);
    setQrModalOpen(true);
  };

  const closeQrModal = () => {
    setQrModalOpen(false);
    setQrEquipment(null);
  };

  const getQrValue = (e: Equipment) => {
    // Формируем URL или данные для QR-кода
    const baseUrl = window.location.origin;
    return `${baseUrl}/it/equipment/${e.id}`;
  };

  const printQrCode = () => {
    if (!qrRef.current || !qrEquipment) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const qrSvg = qrRef.current.querySelector("svg");
    if (!qrSvg) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR-код: ${qrEquipment.inventory_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .qr-container {
            text-align: center;
            border: 2px solid #000;
            padding: 20px;
            border-radius: 8px;
          }
          .qr-code {
            margin: 20px 0;
          }
          h2 { margin: 0 0 10px 0; font-size: 18px; }
          p { margin: 5px 0; font-size: 14px; color: #333; }
          .inv-number { font-size: 16px; font-weight: bold; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <h2>${qrEquipment.name}</h2>
          <p class="inv-number">Инв. № ${qrEquipment.inventory_number}</p>
          ${qrEquipment.serial_number ? `<p>S/N: ${qrEquipment.serial_number}</p>` : ""}
          <div class="qr-code">${qrSvg.outerHTML}</div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const downloadQrCode = () => {
    if (!qrRef.current || !qrEquipment) return;

    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    // Создаем canvas для конвертации SVG в PNG
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `qr-${qrEquipment.inventory_number}.png`;
      link.href = pngUrl;
      link.click();

      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const loadHistory = async (equipmentId: string) => {
    setHistoryLoading(true);
    try {
      const data = await apiGet<EquipmentHistory[]>(
        `/it/equipment/${equipmentId}/history/`,
      );
      setEquipmentHistory(data);
    } catch (err) {
      console.error("Ошибка загрузки истории:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setMessage(null);
    setForm({
      name: "",
      model_id: "",
      model: "",
      inventory_number: "",
      serial_number: "",
      category: "",
      status: "in_stock",
      room_id: "",
      current_owner_id: "",
      cpu: "",
      ram: "",
      storage: "",
      os: "",
      resolution: "",
      diagonal: "",
      ip_address: "",
    });
    setSelectedBrandId("");
    setSelectedTypeId("");
    setSelectedModelId("");
    setModels([]);
    setModelConsumables([]);
    setSelectedBuildingForRoom("");
    setSelectedRoomId("");
    setRoomsForEquipment([]);
    loadBuildingsForRooms();
    setEmployeeSearch("");
    loadEmployees();
    setFormTab("main");
    setModalOpen(true);
  };

  const openEdit = async (e: Equipment) => {
    setModalLoading(true);
    setIsLoadingEditData(true); // Устанавливаем флаг загрузки
    setEditing(e);
    setError(null);
    setMessage(null);

    // Сначала сбрасываем все состояния
    setSelectedBrandId("");
    setSelectedTypeId("");
    setSelectedModelId("");
    setModels([]);
    setModelConsumables([]);
    setEquipmentTypes([]);
    setSelectedBuildingForRoom("");
    setSelectedRoomId("");
    setRoomsForEquipment([]);

    // Устанавливаем форму
    // Извлекаем характеристики из specifications
    const specs = e.specifications || {};
    setForm({
      name: e.name,
      model: e.model ?? "",
      model_id: e.model_id ?? "",
      inventory_number: e.inventory_number,
      serial_number: e.serial_number ?? "",
      category: e.category,
      status: e.status,
      room_id: e.room_id ?? "",
      current_owner_id: e.current_owner_id ?? "",
      cpu: specs.cpu ?? "",
      ram: specs.ram ?? "",
      storage: specs.storage ?? "",
      os: specs.os ?? "",
      resolution: specs.resolution ?? "",
      diagonal: specs.diagonal ?? "",
      ip_address: e.ip_address ?? "",
    });

    try {
      // Загружаем базовые данные
      setEmployeeSearch("");
      await Promise.all([loadBrands(), loadBuildingsForRooms(), loadEmployees()]);

      // Загружаем марку и модель если есть model_id
      if (e.model_id) {
        try {
          // Получаем модель по ID
          const model = await equipmentCatalogService.getModel(e.model_id);
          if (model && model.equipment_type_id) {
            // Получаем тип по equipment_type_id, чтобы узнать brand_id
            const allTypes = await equipmentCatalogService.getEquipmentTypes();
            const type = allTypes.find((t) => t.id === model.equipment_type_id);
            if (type) {
              // Устанавливаем марку
              setSelectedBrandId(type.brand_id);
              // Загружаем типы для этой марки (без фильтра по категории)
              await loadEquipmentTypes(type.brand_id);
              // Устанавливаем тип
              setSelectedTypeId(model.equipment_type_id);
              // Обновляем категорию в форме на основе типа
              if (type.category) {
                setForm((p) => ({ ...p, category: type.category }));
              }
              // Загружаем модели для этого типа
              await loadModels(model.equipment_type_id);
              // Устанавливаем модель
              setSelectedModelId(e.model_id);
              // Загружаем расходники модели
              await loadModelConsumables(e.model_id);
            } else {
              console.error(
                "Тип оборудования не найден для модели:",
                model.equipment_type_id,
              );
            }
          }
        } catch (err) {
          console.error("Ошибка загрузки модели:", err);
        }
      }

      // Загружаем кабинет если есть room_id
      if (e.room_id) {
        try {
          const room = await roomsService.getRoom(e.room_id);
          if (room) {
            setSelectedRoomId(e.room_id);
            setForm((p) => ({ ...p, room_id: e.room_id! }));
            // Находим здание кабинета
            setSelectedBuildingForRoom(room.building_id);
            await loadRoomsForEquipment(room.building_id);
          }
        } catch (err) {
          console.error("Ошибка загрузки кабинета:", err);
        }
      }
    } finally {
      setModalLoading(false);
      // Небольшая задержка перед открытием формы, чтобы все состояния успели установиться
      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsLoadingEditData(false); // Снимаем флаг загрузки после задержки
      // Открываем форму только после загрузки всех данных
      setFormTab("main");
      setModalOpen(true);
    }
  };

  const loadBuildingsForRooms = async () => {
    try {
      const data = await buildingsService.getBuildings(true);
      setBuildingsForRooms(data.map((b) => ({ id: b.id, name: b.name })));
    } catch (err) {
      console.error("Ошибка загрузки зданий:", err);
    }
  };

  const loadRoomsForEquipment = async (buildingId: string) => {
    try {
      const data = await roomsService.getRooms(buildingId, true);
      setRoomsForEquipment(
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

  const loadEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const params = new URLSearchParams();
      if (employeeSearch.trim()) params.set("q", employeeSearch.trim());
      const url = params.toString()
        ? `/hr/employees/?${params.toString()}`
        : "/hr/employees/";
      const data = await apiGet<Array<{ id: string; full_name: string }>>(url);
      setEmployees(data);
    } catch (err) {
      console.error("Ошибка загрузки сотрудников:", err);
    } finally {
      setEmployeesLoading(false);
    }
  };

  useEffect(() => {
    if (!modalOpen) return;
    const t = window.setTimeout(() => {
      loadEmployees();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeSearch, modalOpen]);

  const handleSubmit = async () => {
    setError(null);
    try {
      const payload: any = {
        name: form.name,
        inventory_number: form.inventory_number,
        serial_number: form.serial_number || undefined,
        category: form.category,
        status: form.status,
      };
      if (form.model_id) payload.model_id = form.model_id;
      if (form.model) payload.model = form.model;
      if (form.room_id) payload.room_id = form.room_id;
      if (form.current_owner_id)
        payload.current_owner_id = form.current_owner_id;
      
      // IP-адрес
      if (form.ip_address) payload.ip_address = form.ip_address;

      // Собираем характеристики в объект specifications
      const specifications: Record<string, string> = {};
      if (form.cpu) specifications.cpu = form.cpu;
      if (form.ram) specifications.ram = form.ram;
      if (form.storage) specifications.storage = form.storage;
      if (form.os) specifications.os = form.os;
      if (form.resolution) specifications.resolution = form.resolution;
      if (form.diagonal) specifications.diagonal = form.diagonal;
      
      // Добавляем specifications если есть хотя бы одна характеристика
      if (Object.keys(specifications).length > 0) {
        payload.specifications = specifications;
      }

      if (editing) {
        await apiPatch(`/it/equipment/${editing.id}`, payload);
        setMessage("Оборудование обновлено");
      } else {
        if (!form.name || !form.inventory_number) {
          setError("Название и инв. номер обязательны");
          return;
        }
        // Категория определяется автоматически через тип оборудования, но если тип не выбран, используем значение по умолчанию
        if (!form.category) {
          payload.category = "other";
        }
        await apiPost("/it/equipment/", payload);
        setMessage("Оборудование создано");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить оборудование?")) return;
    try {
      await apiDelete(`/it/equipment/${id}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Оборудование</h2>
            <p className="text-gray-400">Учет IT-оборудования</p>
          </div>
          <button
            onClick={openCreate}
            className="glass-button px-4 py-2.5 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Добавить
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
            placeholder="Поиск оборудования..."
          />
        </div>
        <button
          onClick={handleSearch}
          className="glass-button-secondary px-4 py-2.5 flex items-center gap-2"
        >
          <Search className="w-4 h-4" /> Найти
        </button>
      </div>

      {/* Табы по статусу */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleTabClick("")}
          className={`px-3 py-2 rounded-xl text-sm border transition-all ${
            activeTab === ""
              ? "bg-accent-purple/20 text-accent-purple border-accent-purple/30"
              : "bg-dark-700/30 text-gray-400 border-dark-600/50 hover:text-gray-200"
          }`}
        >
          Все
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => handleTabClick(s as typeof activeTab)}
            className={`px-3 py-2 rounded-xl text-sm border transition-all ${
              activeTab === s
                ? "bg-accent-purple/20 text-accent-purple border-accent-purple/30"
                : "bg-dark-700/30 text-gray-400 border-dark-600/50 hover:text-gray-200"
            }`}
          >
            {statusLabel[s] || s}
          </button>
        ))}
      </div>

      {/* Фильтры списка */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Тип</label>
            <select
              className="glass-input w-full px-3 py-2.5 text-sm"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="" className="bg-dark-800">
                Все типы
              </option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-dark-800">
                  {categoryLabel[c] || c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Здание</label>
            <select
              className="glass-input w-full px-3 py-2.5 text-sm"
              value={filterBuildingId}
              onChange={async (e) => {
                const v = e.target.value;
                setFilterBuildingId(v);
                setFilterRoomId("");
                await loadFilterRooms(v);
              }}
            >
              <option value="" className="bg-dark-800">
                Все здания
              </option>
              {filterBuildings.map((b) => (
                <option key={b.id} value={b.id} className="bg-dark-800">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Кабинет</label>
            <select
              className="glass-input w-full px-3 py-2.5 text-sm"
              value={filterRoomId}
              onChange={(e) => setFilterRoomId(e.target.value)}
              disabled={!filterBuildingId}
            >
              <option value="" className="bg-dark-800">
                {filterBuildingId ? "Все кабинеты" : "Сначала выберите здание"}
              </option>
              {filterRooms.map((r) => (
                <option key={r.id} value={r.id} className="bg-dark-800">
                  {r.name} {r.building_name ? `(${r.building_name})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Сотрудник</label>
            <div className="mb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  className="glass-input w-full pl-9 pr-3 py-2.5 text-sm"
                  placeholder="Поиск сотрудника..."
                  value={filterEmployeeSearch}
                  onChange={(e) => setFilterEmployeeSearch(e.target.value)}
                />
              </div>
            </div>
            <select
              className="glass-input w-full px-3 py-2.5 text-sm"
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              disabled={filterEmployeesLoading}
            >
              <option value="" className="bg-dark-800">
                {filterEmployeesLoading ? "Загрузка…" : "Все сотрудники"}
              </option>
              {filterEmployees.map((emp) => (
                <option key={emp.id} value={emp.id} className="bg-dark-800">
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end mt-4">
          <button
            onClick={resetFilters}
            className="glass-button-secondary px-4 py-2 text-sm"
          >
            Сбросить
          </button>
          <button onClick={applyFilters} className="glass-button px-4 py-2 text-sm">
            Применить
          </button>
        </div>
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
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Инв. №</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ответственный</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Место</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {items.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-dark-700/30 cursor-pointer transition-colors"
                  onClick={() => openDetail(e)}
                >
                  <td className="px-4 py-4 text-gray-300">{e.inventory_number}</td>
                  <td className="px-4 py-4">
                    <span className="text-white font-medium">{e.name}</span>
                  </td>
                  <td className="px-4 py-4 text-gray-400">
                    {(e as any).owner_name || "—"}
                  </td>
                  <td className="px-4 py-4 text-gray-400">{categoryLabel[e.category] || e.category}</td>
                  <td className="px-4 py-4 text-gray-400">{statusLabel[e.status] || e.status}</td>
                  <td className="px-4 py-4 text-gray-400">
                    {e.room_name
                      ? (e.building_name ? `${e.building_name} / ${e.room_name}` : e.room_name)
                      : ([e.location_department, e.location_room].filter(Boolean).join(" / ") || "—")}
                  </td>
                  <td className="px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(e)}
                        className="text-accent-blue hover:text-accent-purple transition-colors"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => openQrModal(e)}
                        className="p-1.5 text-gray-400 hover:text-accent-purple hover:bg-dark-700/50 rounded-lg transition-all"
                        title="QR-код"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-hidden flex flex-col mx-4">
            {modalLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white mb-4">
                  {editing ? "Редактирование" : "Новое оборудование"}
                </h3>

                {/* Вкладки */}
                <div className="flex border-b border-dark-600/50 mb-4">
                  <button
                    onClick={() => setFormTab("main")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      formTab === "main"
                        ? "border-accent-purple text-accent-purple"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Основное
                  </button>
                  <button
                    onClick={() => setFormTab("specs")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      formTab === "specs"
                        ? "border-accent-purple text-accent-purple"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Характеристики
                  </button>
                  <button
                    onClick={() => setFormTab("location")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      formTab === "location"
                        ? "border-accent-purple text-accent-purple"
                        : "border-transparent text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Расположение
                  </button>
                </div>

                {/* Содержимое вкладок */}
                <div className="flex-1 overflow-y-auto space-y-4">
                  {/* Вкладка "Основное" */}
                  {formTab === "main" && (
                    <>
                      <input
                        className="glass-input w-full px-4 py-3 text-sm"
                        placeholder="Название *"
                        value={form.name}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, name: e.target.value }))
                        }
                      />
                      <input
                        className="glass-input w-full px-4 py-3 text-sm disabled:opacity-60"
                        placeholder="Инв. номер *"
                        value={form.inventory_number}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, inventory_number: e.target.value }))
                        }
                        readOnly={!!editing}
                      />
                      <input
                        className="glass-input w-full px-4 py-3 text-sm"
                        placeholder="Серийный номер"
                        value={form.serial_number}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, serial_number: e.target.value }))
                        }
                      />

                      {/* Справочник оборудования */}
                      <div className="space-y-2 border-t border-dark-600/50 pt-4">
                        <label className="text-sm font-medium text-gray-400">
                          Справочник оборудования
                        </label>

                        {/* Марка */}
                        <div className="flex gap-2">
                          <select
                            className="glass-input flex-1 px-4 py-3 text-sm"
                            value={selectedBrandId}
                            onChange={(e) => handleBrandChange(e.target.value)}
                          >
                            <option value="" className="bg-dark-800">Выберите марку</option>
                            {brands.map((b) => (
                              <option key={b.id} value={b.id} className="bg-dark-800">
                                {b.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setAddBrandModal(true)}
                            className="glass-button-secondary px-3 py-2 text-sm"
                            title="Добавить марку"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Тип оборудования */}
                        {selectedBrandId && (
                          <div className="flex gap-2">
                            <select
                              className="glass-input flex-1 px-4 py-3 text-sm"
                              value={selectedTypeId}
                              onChange={(e) => handleTypeChange(e.target.value)}
                            >
                              <option value="" className="bg-dark-800">Выберите тип</option>
                              {equipmentTypes.map((t) => (
                                <option key={t.id} value={t.id} className="bg-dark-800">
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setAddTypeModal(true)}
                              className="glass-button-secondary px-3 py-2 text-sm"
                              title="Добавить тип"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Модель */}
                        {selectedTypeId && (
                          <div className="flex gap-2">
                            <select
                              className="glass-input flex-1 px-4 py-3 text-sm"
                              value={selectedModelId}
                              onChange={(e) => handleModelChange(e.target.value)}
                            >
                              <option value="" className="bg-dark-800">Выберите модель</option>
                              {models.map((m) => (
                                <option key={m.id} value={m.id} className="bg-dark-800">
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setAddModelModal(true)}
                              className="glass-button-secondary px-3 py-2 text-sm"
                              title="Добавить модель"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Расходники модели */}
                        {selectedModelId && (
                          <div className="mt-2 p-4 bg-dark-700/30 rounded-xl border border-dark-600/50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-accent-purple" />
                                <span className="text-sm font-medium text-gray-300">
                                  Расходные материалы:
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setAddConsumableModal(true)}
                                className="text-xs px-2 py-1 bg-accent-purple/20 text-accent-purple rounded-xl"
                              >
                                <Plus className="w-3 h-3 inline mr-1" />
                                Добавить
                              </button>
                            </div>
                            {modelConsumables.length > 0 ? (
                              <ul className="text-sm text-gray-400 space-y-1">
                                {modelConsumables.map((c) => (
                                  <li key={c.id}>
                                    • {c.name} {c.part_number && `(${c.part_number})`}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">
                                Нет расходных материалов
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Вкладка "Характеристики" */}
                  {formTab === "specs" && (
                    <>
                      {/* Если тип не выбран */}
                      {!form.category && (
                        <p className="text-sm text-gray-500 py-4">
                          Сначала выберите тип оборудования на вкладке "Основное".
                        </p>
                      )}

                      {/* Характеристики для компьютеров и серверов */}
                      {(form.category === "computer" || form.category === "server") && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                              Процессор
                            </label>
                            <input
                              className="glass-input w-full px-4 py-3 text-sm"
                              placeholder="Например: Intel Core i7-12700"
                              value={form.cpu}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, cpu: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                              Оперативная память
                            </label>
                            <input
                              className="glass-input w-full px-4 py-3 text-sm"
                              placeholder="Например: 16 ГБ DDR4"
                              value={form.ram}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, ram: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                              Накопитель
                            </label>
                            <input
                              className="glass-input w-full px-4 py-3 text-sm"
                              placeholder="Например: SSD 512 ГБ"
                              value={form.storage}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, storage: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                              Операционная система
                            </label>
                            <input
                              className="glass-input w-full px-4 py-3 text-sm"
                              placeholder="Например: Windows 11 Pro"
                              value={form.os}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, os: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* Характеристики для мониторов */}
                      {form.category === "monitor" && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                              Диагональ
                            </label>
                            <input
                              className="glass-input w-full px-4 py-3 text-sm"
                              placeholder="Например: 27 дюймов"
                              value={form.diagonal}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, diagonal: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                              Разрешение
                            </label>
                            <input
                              className="glass-input w-full px-4 py-3 text-sm"
                              placeholder="Например: 2560x1440 (QHD)"
                              value={form.resolution}
                              onChange={(e) =>
                                setForm((p) => ({ ...p, resolution: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* Для других типов без специфичных характеристик */}
                      {form.category && !["computer", "server", "monitor"].includes(form.category) && !["computer", "printer", "server", "network"].includes(form.category) && (
                        <p className="text-sm text-gray-500 py-4">
                          Для данного типа оборудования нет дополнительных характеристик.
                        </p>
                      )}

                      {/* IP-адрес */}
                      {(form.category === "computer" || form.category === "printer" || form.category === "server" || form.category === "network") && (
                        <div className={form.category === "computer" || form.category === "server" ? "border-t border-dark-600/50 pt-4 mt-4" : ""}>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            IP-адрес
                          </label>
                          <input
                            className="glass-input w-full px-4 py-3 text-sm"
                            placeholder="Например: 192.168.1.100"
                            value={form.ip_address}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, ip_address: e.target.value }))
                            }
                          />
                        </div>
                      )}

                      {/* Для типов без характеристик и без IP */}
                      {form.category && !["computer", "server", "monitor", "printer", "network"].includes(form.category) && (
                        <p className="text-sm text-gray-500 py-4">
                          Для данного типа оборудования нет дополнительных характеристик.
                        </p>
                      )}
                    </>
                  )}

                  {/* Вкладка "Расположение" */}
                  {formTab === "location" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Здание
                        </label>
                        <select
                          className="glass-input w-full px-4 py-3 text-sm"
                          value={selectedBuildingForRoom}
                          onChange={(e) =>
                            handleBuildingForRoomChange(e.target.value)
                          }
                        >
                          <option value="" className="bg-dark-800">Выберите здание</option>
                          {buildingsForRooms.map((b) => (
                            <option key={b.id} value={b.id} className="bg-dark-800">
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Кабинет
                        </label>
                        <select
                          className="glass-input w-full px-4 py-3 text-sm"
                          value={selectedRoomId}
                          onChange={(e) => handleRoomChange(e.target.value)}
                          disabled={!selectedBuildingForRoom}
                        >
                          <option value="" className="bg-dark-800">Выберите кабинет</option>
                          {roomsForEquipment.map((r) => (
                            <option key={r.id} value={r.id} className="bg-dark-800">
                              {r.name} {r.building_name ? `(${r.building_name})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Ответственный сотрудник
                        </label>
                        <div className="mb-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              className="glass-input w-full pl-9 pr-4 py-2.5 text-sm"
                              placeholder="Поиск сотрудника (ФИО / email / телефон)..."
                              value={employeeSearch}
                              onChange={(e) => setEmployeeSearch(e.target.value)}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {employeesLoading ? "Поиск…" : `Найдено: ${employees.length}`}
                          </div>
                        </div>
                        <select
                          className="glass-input w-full px-4 py-3 text-sm"
                          value={form.current_owner_id}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              current_owner_id: e.target.value,
                            }))
                          }
                          disabled={employeesLoading}
                        >
                          <option value="" className="bg-dark-800">
                            {employeesLoading ? "Загрузка…" : "Выберите сотрудника"}
                          </option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id} className="bg-dark-800">
                              {emp.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Состояние
                        </label>
                        <select
                          className="glass-input w-full px-4 py-3 text-sm"
                          value={form.status}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, status: e.target.value }))
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-dark-800">
                              {statusLabel[s] || s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Кнопки */}
                <div className="flex justify-end gap-2 pt-4 border-t border-dark-600/50 mt-4">
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      setModalLoading(false);
                    }}
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно детального просмотра */}
      {detailModalOpen && detailEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-4xl p-6 max-h-[90vh] overflow-hidden flex flex-col mx-4">
            {/* Заголовок */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {detailEquipment.name}
                </h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                  <span>Инв. № {detailEquipment.inventory_number}</span>
                  {detailEquipment.serial_number && (
                    <span>S/N: {detailEquipment.serial_number}</span>
                  )}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    detailEquipment.status === "in_use" ? "bg-green-500/20 text-green-400" :
                    detailEquipment.status === "in_stock" ? "bg-accent-blue/20 text-accent-blue" :
                    detailEquipment.status === "in_repair" ? "bg-amber-500/20 text-amber-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {statusLabel[detailEquipment.status] || detailEquipment.status}
                  </span>
                </div>
              </div>
              <button
                onClick={closeDetail}
                className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Вкладки */}
            <div className="flex border-b border-dark-600/50 mb-4">
              <button
                onClick={() => setDetailTab("info")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === "info"
                    ? "border-accent-purple text-accent-purple"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                <Monitor className="w-4 h-4" />
                Информация
              </button>
              <button
                onClick={() => setDetailTab("licenses")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === "licenses"
                    ? "border-accent-purple text-accent-purple"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                <Key className="w-4 h-4" />
                Лицензии
                {equipmentLicenses.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent-purple/20 text-accent-purple rounded-full">
                    {equipmentLicenses.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setDetailTab("consumables")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === "consumables"
                    ? "border-accent-purple text-accent-purple"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                <Package className="w-4 h-4" />
                Расходники
                {detailConsumables.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent-purple/20 text-accent-purple rounded-full">
                    {detailConsumables.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setDetailTab("history")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  detailTab === "history"
                    ? "border-accent-purple text-accent-purple"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                <History className="w-4 h-4" />
                История
              </button>
            </div>

            {/* Содержимое вкладок */}
            <div className="flex-1 overflow-y-auto">
              {/* Вкладка "Информация" */}
              {detailTab === "info" && (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Основная информация */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-gray-500" />
                      Основная информация
                    </h4>
                    <div className="bg-dark-700/30 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Категория</span>
                        <span className="text-sm font-medium">{categoryLabel[detailEquipment.category] || detailEquipment.category}</span>
                      </div>
                      {detailEquipment.model && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Модель</span>
                          <span className="text-sm font-medium">{detailEquipment.model}</span>
                        </div>
                      )}
                      {detailEquipment.brand_name && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Марка</span>
                          <span className="text-sm font-medium">{detailEquipment.brand_name}</span>
                        </div>
                      )}
                      {detailEquipment.ip_address && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">IP-адрес</span>
                          <span className="text-sm font-medium font-mono">{detailEquipment.ip_address}</span>
                        </div>
                      )}
                    </div>

                    {/* Ответственный */}
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2 mt-4">
                      <User className="w-4 h-4 text-gray-500" />
                      Ответственный
                    </h4>
                    <div className="bg-dark-700/30 rounded-xl p-4">
                      {detailEquipment.owner_name ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-accent-purple rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{detailEquipment.owner_name}</p>
                              {detailEquipment.owner_email && (
                                <p className="text-xs text-gray-500">{detailEquipment.owner_email}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Не назначен</p>
                      )}
                    </div>

                    {/* Расположение */}
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2 mt-4">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      Расположение
                    </h4>
                    <div className="bg-dark-700/30 rounded-xl p-4">
                      {detailEquipment.building_name || detailEquipment.room_name || detailEquipment.location_department || detailEquipment.location_room ? (
                        <div className="space-y-2">
                          {detailEquipment.building_name && (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{detailEquipment.building_name}</span>
                            </div>
                          )}
                          {(detailEquipment.room_name || detailEquipment.location_room) && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{detailEquipment.room_name || detailEquipment.location_room}</span>
                            </div>
                          )}
                          {detailEquipment.location_department && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              Отдел: {detailEquipment.location_department}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Не указано</p>
                      )}
                    </div>
                  </div>

                  {/* Характеристики */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-gray-500" />
                      Характеристики
                    </h4>
                    <div className="bg-dark-700/30 rounded-xl p-4">
                      {detailEquipment.specifications && Object.keys(detailEquipment.specifications).length > 0 ? (
                        <div className="space-y-3">
                          {detailEquipment.specifications.cpu && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500 flex items-center gap-2">
                                <Cpu className="w-3 h-3" /> Процессор
                              </span>
                              <span className="text-sm font-medium">{detailEquipment.specifications.cpu}</span>
                            </div>
                          )}
                          {detailEquipment.specifications.ram && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500 flex items-center gap-2">
                                <Server className="w-3 h-3" /> ОЗУ
                              </span>
                              <span className="text-sm font-medium">{detailEquipment.specifications.ram}</span>
                            </div>
                          )}
                          {detailEquipment.specifications.storage && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500 flex items-center gap-2">
                                <HardDrive className="w-3 h-3" /> Накопитель
                              </span>
                              <span className="text-sm font-medium">{detailEquipment.specifications.storage}</span>
                            </div>
                          )}
                          {detailEquipment.specifications.os && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">ОС</span>
                              <span className="text-sm font-medium">{detailEquipment.specifications.os}</span>
                            </div>
                          )}
                          {detailEquipment.specifications.diagonal && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">Диагональ</span>
                              <span className="text-sm font-medium">{detailEquipment.specifications.diagonal}</span>
                            </div>
                          )}
                          {detailEquipment.specifications.resolution && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">Разрешение</span>
                              <span className="text-sm font-medium">{detailEquipment.specifications.resolution}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Нет данных о характеристиках</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Вкладка "Лицензии" */}
              {detailTab === "licenses" && (
                <div>
                  {equipmentLicenses.length > 0 ? (
                    <div className="space-y-3">
                      {equipmentLicenses.map((lic) => (
                        <div
                          key={lic.id}
                          className="bg-dark-700/30 rounded-xl p-4 border-l-4 border-green-500"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium text-white">{lic.software_name}</h5>
                              {lic.vendor && (
                                <p className="text-sm text-gray-500">{lic.vendor}</p>
                              )}
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              lic.expires_at && new Date(lic.expires_at) < new Date()
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}>
                              {lic.expires_at
                                ? new Date(lic.expires_at) < new Date()
                                  ? "Истекла"
                                  : `До ${new Date(lic.expires_at).toLocaleDateString("ru-RU")}`
                                : "Бессрочная"
                              }
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Назначена: {new Date(lic.assigned_at).toLocaleDateString("ru-RU")}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Нет привязанных лицензий</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Лицензии можно привязать в разделе "Лицензии ПО"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Вкладка "Расходники" */}
              {detailTab === "consumables" && (
                <div>
                  {detailConsumables.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 mb-4">
                        Расходные материалы для модели оборудования:
                      </p>
                      {detailConsumables.map((consumable) => (
                        <div
                          key={consumable.id}
                          className="bg-dark-700/30 rounded-xl p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent-purple/20 rounded-xl flex items-center justify-center">
                              <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h5 className="font-medium text-white">{consumable.name}</h5>
                              <p className="text-sm text-gray-500">
                                {consumable.consumable_type && (
                                  <span>{consumableTypeLabel[consumable.consumable_type] || consumable.consumable_type}</span>
                                )}
                                {consumable.part_number && (
                                  <span className="ml-2 font-mono text-xs">({consumable.part_number})</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Нет привязанных расходных материалов</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Расходники добавляются через справочник моделей
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Вкладка "История" */}
              {detailTab === "history" && (
                <div>
                  {historyLoading && (
                    <p className="text-sm text-gray-500">Загрузка истории…</p>
                  )}
                  {!historyLoading && equipmentHistory.length === 0 && (
                    <div className="text-center py-8">
                      <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">История перемещений пуста</p>
                    </div>
                  )}
                  {!historyLoading && equipmentHistory.length > 0 && (
                    <div className="space-y-3">
                      {equipmentHistory.map((record) => (
                        <div
                          key={record.id}
                          className="bg-dark-700/30 rounded-xl p-4 border-l-4 border-accent-blue"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-gray-500">
                              {new Date(record.created_at).toLocaleString("ru-RU")}
                            </span>
                            {record.changed_by_name && (
                              <span className="text-xs text-gray-500">
                                Изменил: {record.changed_by_name}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400 space-y-1">
                            {record.from_user_name && (
                              <div>
                                <span className="font-medium">От:</span>{" "}
                                {record.from_user_name}
                                {record.from_location && ` (${record.from_location})`}
                              </div>
                            )}
                            {record.to_user_name && (
                              <div>
                                <span className="font-medium">К:</span>{" "}
                                {record.to_user_name}
                                {record.to_location && ` (${record.to_location})`}
                              </div>
                            )}
                            {!record.from_user_name && !record.to_user_name && (
                              <>
                                {record.from_location && (
                                  <div>
                                    <span className="font-medium">От:</span>{" "}
                                    {record.from_location}
                                  </div>
                                )}
                                {record.to_location && (
                                  <div>
                                    <span className="font-medium">К:</span>{" "}
                                    {record.to_location}
                                  </div>
                                )}
                              </>
                            )}
                            {record.reason && (
                              <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-dark-600/50">
                                <span className="font-medium">Причина:</span>{" "}
                                {record.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Кнопки внизу */}
            <div className="flex justify-between items-center pt-4 border-t border-dark-600/50 mt-4">
              <button
                onClick={() => openQrModal(detailEquipment)}
                className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
              >
                <QrCode className="w-4 h-4" />
                QR-код
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    closeDetail();
                    openEdit(detailEquipment);
                  }}
                  className="glass-button px-4 py-2.5 text-sm font-medium"
                >
                  Редактировать
                </button>
                <button
                  onClick={closeDetail}
                  className="glass-button-secondary px-4 py-2.5 text-sm font-medium"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальные окна для добавления в справочник */}
      {addBrandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">Добавить марку</h3>
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              placeholder="Название марки"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleCreateBrand()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddBrandModal(false)} className="glass-button-secondary px-4 py-2 text-sm font-medium">Отмена</button>
              <button onClick={handleCreateBrand} className="glass-button px-4 py-2 text-sm font-medium">Создать</button>
            </div>
          </div>
        </div>
      )}

      {addTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">Выберите тип оборудования</h3>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Тип устройства</label>
              <select
                className="glass-input w-full px-4 py-3 text-sm"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
                <option value="" className="bg-dark-800">Выберите тип</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-dark-800">{categoryLabel[c] || c}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddTypeModal(false)} className="glass-button-secondary px-4 py-2 text-sm font-medium">Отмена</button>
              <button onClick={handleCreateType} disabled={!form.category} className="glass-button px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">Добавить</button>
            </div>
          </div>
        </div>
      )}

      {addModelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">Добавить модель</h3>
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              placeholder="Название модели (например: ThinkPad X1 Carbon)"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleCreateModel()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddModelModal(false)} className="glass-button-secondary px-4 py-2 text-sm font-medium">Отмена</button>
              <button onClick={handleCreateModel} className="glass-button px-4 py-2 text-sm font-medium">Создать</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для добавления расходника в модель */}
      {addConsumableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <h3 className="text-lg font-semibold text-white">Добавить расходный материал в модель</h3>
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              placeholder="Название расходника *"
              value={newConsumableName}
              onChange={(e) => setNewConsumableName(e.target.value)}
            />
            <select
              className="glass-input w-full px-4 py-3 text-sm"
              value={newConsumableType}
              onChange={(e) => setNewConsumableType(e.target.value)}
            >
              <option value="" className="bg-dark-800">Тип расходника</option>
              {CONSUMABLE_TYPES.map((t) => (
                <option key={t} value={t} className="bg-dark-800">{consumableTypeLabel[t] || t}</option>
              ))}
            </select>
            <input
              className="glass-input w-full px-4 py-3 text-sm"
              placeholder="Артикул/номер детали"
              value={newConsumablePartNumber}
              onChange={(e) => setNewConsumablePartNumber(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setAddConsumableModal(false);
                  setNewConsumableName("");
                  setNewConsumableType("");
                  setNewConsumablePartNumber("");
                }}
                className="glass-button-secondary px-4 py-2 text-sm font-medium"
              >
                Отмена
              </button>
              <button onClick={handleCreateModelConsumable} className="glass-button px-4 py-2 text-sm font-medium">Добавить</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно QR-кода */}
      {qrModalOpen && qrEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 mx-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-white">QR-код оборудования</h3>
                <p className="text-sm text-gray-400">{qrEquipment.name}</p>
              </div>
              <button onClick={closeQrModal} className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center py-4" ref={qrRef}>
              <QRCodeSVG value={getQrValue(qrEquipment)} size={200} level="H" includeMargin={true} />
              <div className="mt-4 text-center">
                <p className="text-lg font-bold text-white">Инв. № {qrEquipment.inventory_number}</p>
                {qrEquipment.serial_number && <p className="text-sm text-gray-400">S/N: {qrEquipment.serial_number}</p>}
              </div>
            </div>
            <div className="flex justify-center gap-3 pt-2 border-t border-dark-600/50">
              <button onClick={printQrCode} className="glass-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
                <Printer className="w-4 h-4" /> Печать
              </button>
              <button onClick={downloadQrCode} className="glass-button flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
                <Download className="w-4 h-4" /> Скачать PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
