import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  QrCode,
  Download,
  Printer,
  X,
} from "lucide-react";
import {
  equipmentService,
  type EquipmentFilters,
} from "../services/equipment.service";
import { consumablesService } from "../services/consumables.service";
import { buildingsService } from "../services/buildings.service";
import { usersService } from "../services/users.service";
import type {
  Equipment,
  EquipmentStatus,
  EquipmentCategory,
  Building,
  Room,
  User,
} from "../types";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EquipmentForm } from "../components/equipment/EquipmentForm";
import { ZabbixStatus } from "../components/equipment/ZabbixStatus";
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/Table";
import {
  formatCurrency,
  getStatusLabel,
  getStatusColor,
  getCategoryLabel,
} from "../utils/format";
import { useAuthStore } from "../store/auth.store";
import { canManageEquipment } from "../utils/permissions";

// Категории оборудования для фильтра
const equipmentCategories: { value: EquipmentCategory; label: string }[] = [
  { value: "computer", label: "Компьютер" },
  { value: "monitor", label: "Монитор" },
  { value: "printer", label: "Принтер" },
  { value: "network", label: "Сетевое оборудование" },
  { value: "server", label: "Сервер" },
  { value: "mobile", label: "Мобильное устройство" },
  { value: "peripheral", label: "Периферия" },
  { value: "other", label: "Прочее" },
];

export const EquipmentPage = () => {
  const { user } = useAuthStore();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<
    Equipment | undefined
  >();
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<EquipmentFilters>({});
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrEquipment, setQrEquipment] = useState<Equipment | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const canManage = canManageEquipment(user?.role);

  // Данные для фильтров
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");

  const loadEquipment = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await equipmentService.getEquipment(
        {
          ...filters,
          search: searchTerm || undefined,
        },
        page,
        pageSize,
      );
      if (result.error) {
        console.error("Ошибка загрузки оборудования:", result.error);
        setError(result.error.message || "Ошибка при загрузке оборудования");
      } else {
        setEquipment(result.data);
        setTotalCount(result.count);
      }
    } catch (err) {
      console.error("Исключение при загрузке:", err);
      setError("Произошла ошибка при загрузке оборудования");
    } finally {
      setLoading(false);
    }
  };

  // Загрузка данных для фильтров
  const loadFilterData = async () => {
    // Загружаем здания
    const buildingsResult = await buildingsService.getBuildings();
    if (!buildingsResult.error) {
      setBuildings(buildingsResult.data);
    }

    // Загружаем пользователей
    const usersResult = await usersService.getUsers();
    if (!usersResult.error) {
      setUsers(usersResult.data);
    }
  };

  // Загрузка кабинетов при выборе здания
  const loadRooms = async (buildingId: string) => {
    if (!buildingId) {
      setRooms([]);
      return;
    }
    const roomsResult = await buildingsService.getRooms(buildingId);
    if (!roomsResult.error) {
      setRooms(roomsResult.data);
    }
  };

  useEffect(() => {
    loadFilterData();
  }, []);

  useEffect(() => {
    loadEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    filters.status,
    filters.category,
    filters.department,
    filters.room,
    filters.owner_id,
    searchTerm,
  ]);

  useEffect(() => {
    loadRooms(selectedBuilding);
  }, [selectedBuilding]);

  const handleCreate = () => {
    setEditingEquipment(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Equipment) => {
    setEditingEquipment(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить это оборудование?")) return;

    const { error } = await equipmentService.deleteEquipment(id);
    if (error) {
      alert("Ошибка при удалении: " + error.message);
    } else {
      loadEquipment();
    }
  };

  const handleSubmit = async (data: any) => {
    // Форма уже собрала specifications в объект, просто используем данные как есть
    const submitData = {
      ...data,
      // specifications уже должен быть в data, если он был заполнен
    };

    console.log("Данные для отправки:", submitData);

    let createdEquipmentId: string | null = null;

    if (editingEquipment) {
      const { data: updatedEquipment, error } =
        await equipmentService.updateEquipment(editingEquipment.id, submitData);
      if (error) {
        alert("Ошибка при обновлении: " + error.message);
        return;
      }
      createdEquipmentId = updatedEquipment?.id || null;
    } else {
      const { data: newEquipment, error } =
        await equipmentService.createEquipment(submitData);
      if (error) {
        alert("Ошибка при создании: " + error.message);
        return;
      }
      createdEquipmentId = newEquipment?.id || null;
    }

    // Если это принтер и есть данные о расходниках, создаем их и связываем с оборудованием
    if (
      createdEquipmentId &&
      submitData.category === "printer" &&
      submitData.specifications
    ) {
      const specs = submitData.specifications;
      const printType = specs.print_type;
      const isColor = specs.is_color === true || specs.is_color === "true";
      const isLaser = printType === "laser";

      try {
        // Создаем фотобарабан для лазерных принтеров
        if (isLaser && specs.drum_model) {
          const { data: drum, error: drumError } =
            await consumablesService.createConsumable({
              name: `Фотобарабан ${specs.drum_model}`,
              model: specs.drum_model,
              category: "printer_consumable",
              consumable_type: "drum",
              unit: "шт",
              quantity_in_stock: 0,
              min_quantity: 1,
            });

          if (!drumError && drum) {
            await equipmentService.linkConsumableToEquipment(
              createdEquipmentId,
              drum.id,
              1,
            );
          }
        }

        // Создаем картриджи
        if (isColor) {
          // Цветной принтер - 4 картриджа
          const cartridges = [
            {
              key: "cartridge_black",
              name: "Картридж чёрный",
              model: specs.cartridge_black,
            },
            {
              key: "cartridge_cyan",
              name: "Картридж голубой",
              model: specs.cartridge_cyan,
            },
            {
              key: "cartridge_magenta",
              name: "Картридж пурпурный",
              model: specs.cartridge_magenta,
            },
            {
              key: "cartridge_yellow",
              name: "Картридж жёлтый",
              model: specs.cartridge_yellow,
            },
          ];

          for (const cartridge of cartridges) {
            if (cartridge.model) {
              const { data: consumable, error: consumableError } =
                await consumablesService.createConsumable({
                  name: cartridge.name,
                  model: cartridge.model,
                  category: "printer_consumable",
                  consumable_type: "cartridge",
                  unit: "шт",
                  quantity_in_stock: 0,
                  min_quantity: 1,
                });

              if (!consumableError && consumable) {
                await equipmentService.linkConsumableToEquipment(
                  createdEquipmentId,
                  consumable.id,
                  1,
                );
              }
            }
          }
        } else {
          // Чёрно-белый принтер - один картридж
          if (specs.cartridge_black || specs.cartridge_type) {
            const cartridgeModel =
              specs.cartridge_black || specs.cartridge_type;
            const { data: consumable, error: consumableError } =
              await consumablesService.createConsumable({
                name: "Картридж чёрный",
                model: cartridgeModel,
                category: "printer_consumable",
                consumable_type: "cartridge",
                unit: "шт",
                quantity_in_stock: 0,
                min_quantity: 1,
              });

            if (!consumableError && consumable) {
              await equipmentService.linkConsumableToEquipment(
                createdEquipmentId,
                consumable.id,
                1,
              );
            }
          }
        }
      } catch (error) {
        console.error("Ошибка при создании расходников:", error);
        // Не прерываем выполнение, просто логируем ошибку
      }
    }

    setIsModalOpen(false);
    setEditingEquipment(undefined);
    loadEquipment();
  };

  const handleStatusFilter = (status: EquipmentStatus | "all") => {
    setFilters((prev) => ({
      ...prev,
      status: status === "all" ? undefined : status,
    }));
    setPage(1);
  };

  const handleCategoryFilter = (category: EquipmentCategory | "all") => {
    setFilters((prev) => ({
      ...prev,
      category: category === "all" ? undefined : category,
    }));
    setPage(1);
  };

  const handleBuildingFilter = (buildingName: string) => {
    setSelectedBuilding(
      buildingName
        ? buildings.find((b) => b.name === buildingName)?.id || ""
        : "",
    );
    setFilters((prev) => ({
      ...prev,
      department: buildingName || undefined,
      room: undefined, // Сбрасываем кабинет при смене здания
    }));
    setPage(1);
  };

  const handleRoomFilter = (roomName: string) => {
    setFilters((prev) => ({
      ...prev,
      room: roomName || undefined,
    }));
    setPage(1);
  };

  const handleOwnerFilter = (ownerId: string) => {
    setFilters((prev) => ({
      ...prev,
      owner_id: ownerId || undefined,
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSelectedBuilding("");
    setSearchTerm("");
    setPage(1);
  };

  const hasActiveFilters =
    filters.status ||
    filters.category ||
    filters.department ||
    filters.room ||
    filters.owner_id ||
    searchTerm;

  const handleShowQR = async (item: Equipment) => {
    setQrEquipment(item);
    setQrModalOpen(true);
    setQrLoading(true);
    setQrDataUrl(null);

    try {
      const { data, error: qrError } = await equipmentService.getQRCode(
        item.id,
      );
      if (qrError) {
        console.error("Ошибка получения QR-кода:", qrError);
      } else if (data?.dataUrl) {
        setQrDataUrl(data.dataUrl);
      }
    } catch (err) {
      console.error("Ошибка получения QR-кода:", err);
    } finally {
      setQrLoading(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl || !qrEquipment) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-${qrEquipment.inventory_number}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintQR = () => {
    if (!qrDataUrl || !qrEquipment) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR-код: ${qrEquipment.inventory_number}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              text-align: center;
              padding: 20px;
              border: 1px solid #ccc;
            }
            img {
              width: 200px;
              height: 200px;
            }
            .equipment-name {
              font-size: 14px;
              font-weight: bold;
              margin-top: 10px;
            }
            .equipment-inv {
              font-size: 12px;
              color: #666;
              margin-top: 5px;
            }
            @media print {
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <img src="${qrDataUrl}" alt="QR Code" />
            <div class="equipment-name">${qrEquipment.name}</div>
            <div class="equipment-inv">${qrEquipment.inventory_number}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Оборудование
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Всего: {totalCount} единиц
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreate}>
            <Plus className="h-5 w-5 mr-2" />
            Добавить оборудование
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию, инвентарному или серийному номеру..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filters.status || "all"}
              onChange={(e) =>
                handleStatusFilter(e.target.value as EquipmentStatus | "all")
              }
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Все статусы</option>
              <option value="in_use">В работе</option>
              <option value="in_stock">На складе</option>
              <option value="in_repair">В ремонте</option>
              <option value="written_off">Списано</option>
            </select>

            {/* Фильтр по категории */}
            <select
              value={filters.category || "all"}
              onChange={(e) =>
                handleCategoryFilter(
                  e.target.value as EquipmentCategory | "all",
                )
              }
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Все категории</option>
              {equipmentCategories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Вторая строка фильтров */}
        <div className="flex flex-col md:flex-row gap-4 mt-4">
          {/* Фильтр по зданию */}
          <select
            value={filters.department || ""}
            onChange={(e) => handleBuildingFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Все здания</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.name}>
                {building.name}
              </option>
            ))}
          </select>

          {/* Фильтр по кабинету */}
          <select
            value={filters.room || ""}
            onChange={(e) => handleRoomFilter(e.target.value)}
            disabled={!selectedBuilding}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">Все кабинеты</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.name}>
                {room.name}
              </option>
            ))}
          </select>

          {/* Фильтр по владельцу */}
          <select
            value={filters.owner_id || ""}
            onChange={(e) => handleOwnerFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Все владельцы</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>

          {/* Кнопка сброса фильтров */}
          {hasActiveFilters && (
            <Button variant="secondary" onClick={clearFilters} size="sm">
              <X className="h-4 w-4 mr-1" />
              Сбросить
            </Button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 dark:text-red-400">
            {error}
          </div>
        ) : equipment.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Оборудование не найдено
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableHeaderCell>Название</TableHeaderCell>
              <TableHeaderCell>Инвентарный номер</TableHeaderCell>
              <TableHeaderCell>Категория</TableHeaderCell>
              <TableHeaderCell>Статус</TableHeaderCell>
              <TableHeaderCell>Владелец</TableHeaderCell>
              <TableHeaderCell>Местоположение</TableHeaderCell>
              <TableHeaderCell>Стоимость</TableHeaderCell>
              <TableHeaderCell>Мониторинг</TableHeaderCell>
              {canManage && <TableHeaderCell>Действия</TableHeaderCell>}
            </TableHeader>
            <TableBody>
              {equipment.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      {item.model && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {item.model}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.inventory_number}</TableCell>
                  <TableCell>{getCategoryLabel(item.category)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}
                    >
                      {getStatusLabel(item.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.current_owner ? (
                      <div>
                        <div className="font-medium">
                          {item.current_owner.full_name}
                        </div>
                        {item.current_owner.department && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {item.current_owner.department}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.location_department ? (
                      <div>
                        {item.location_department}
                        {item.location_room && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {item.location_room}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(item.cost)}</TableCell>
                  <TableCell>
                    <ZabbixStatus
                      equipmentId={item.id}
                      category={item.category}
                      ipAddress={item.ip_address}
                      compact
                    />
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleShowQR(item)}
                          className="p-1 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          title="QR-код"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                          title="Редактировать"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">
                        Только просмотр
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {!loading && totalCount > pageSize && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Показано {(page - 1) * pageSize + 1} -{" "}
              {Math.min(page * pageSize, totalCount)} из {totalCount}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Назад
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= totalCount}
              >
                Вперед
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEquipment(undefined);
        }}
        title={
          editingEquipment
            ? "Редактирование оборудования"
            : "Добавление оборудования"
        }
        size="xl"
        confirmClose
        confirmMessage="Вы уверены, что хотите закрыть окно? Несохранённые данные оборудования будут потеряны."
      >
        <EquipmentForm
          equipment={editingEquipment}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingEquipment(undefined);
          }}
        />
      </Modal>

      {/* QR Code Modal */}
      <Modal
        isOpen={qrModalOpen}
        onClose={() => {
          setQrModalOpen(false);
          setQrEquipment(null);
          setQrDataUrl(null);
        }}
        title="QR-код оборудования"
        size="sm"
      >
        <div className="flex flex-col items-center space-y-4">
          {qrLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : qrDataUrl ? (
            <>
              <div className="bg-white p-4 rounded-lg">
                <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
              </div>
              {qrEquipment && (
                <div className="text-center">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {qrEquipment.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {qrEquipment.inventory_number}
                  </div>
                </div>
              )}
              <div className="flex space-x-3">
                <Button variant="secondary" onClick={handleDownloadQR}>
                  <Download className="h-4 w-4 mr-2" />
                  Скачать
                </Button>
                <Button onClick={handlePrintQR}>
                  <Printer className="h-4 w-4 mr-2" />
                  Печать
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-red-500 dark:text-red-400">
              Ошибка загрузки QR-кода
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
