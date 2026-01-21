import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import type {
  Ticket,
  Equipment,
  EquipmentConsumable,
  Building,
  Room,
} from "../../types";
import { Button } from "../ui/Button";
import { equipmentService } from "../../services/equipment.service";
import { buildingsService } from "../../services/buildings.service";
import { AlertCircle, Package } from "lucide-react";

const ticketSchema = z.object({
  title: z.string().min(1, "Заголовок обязателен"),
  description: z.string().min(1, "Описание обязательно"),
  category: z.enum(["hardware", "software", "network", "hr", "other"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  location_department: z.string().optional(),
  location_room: z.string().optional(),
  equipment_id: z.string().optional().nullable(),
  desired_resolution_date: z.string().optional(),
  selected_consumables: z.array(z.string()).optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

interface TicketFormProps {
  ticket?: Ticket;
  onSubmit: (data: TicketFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const TicketForm = ({
  ticket,
  onSubmit,
  onCancel,
  loading,
}: TicketFormProps) => {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null,
  );
  const [consumables, setConsumables] = useState<EquipmentConsumable[]>([]);
  const [selectedConsumables, setSelectedConsumables] = useState<Set<string>>(
    new Set(),
  );
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  );
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [loadingConsumables, setLoadingConsumables] = useState(false);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [userEquipment, setUserEquipment] = useState<Equipment[]>([]);
  const [equipmentSource, setEquipmentSource] = useState<"room" | "user">(
    "room",
  );

  // Функция для преобразования даты в формат yyyy-MM-dd
  const formatDateForInput = (
    dateString: string | undefined | null,
  ): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: ticket
      ? {
          title: ticket.title,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          location_department: ticket.location_department || "",
          location_room: ticket.location_room || "",
          equipment_id: ticket.equipment_id || null,
          desired_resolution_date: formatDateForInput(
            ticket.desired_resolution_date,
          ),
        }
      : {
          priority: "medium",
          category: "hardware",
        },
  });

  const watchedDepartment = watch("location_department");
  const watchedRoom = watch("location_room");
  const watchedEquipmentId = watch("equipment_id");

  // Загружаем список зданий и оборудование пользователя при монтировании
  useEffect(() => {
    const loadBuildings = async () => {
      setLoadingBuildings(true);
      try {
        const { data, error } = await buildingsService.getBuildings(true); // Только активные
        if (!error && data) {
          setBuildings(data);
        }
      } catch (err) {
        console.error("Ошибка загрузки зданий:", err);
      } finally {
        setLoadingBuildings(false);
      }
    };

    const loadUserEquipment = async () => {
      try {
        const { data, error } = await equipmentService.getMyEquipment();
        if (!error && data) {
          setUserEquipment(data);
        }
      } catch (err) {
        console.error("Ошибка загрузки оборудования пользователя:", err);
      }
    };

    loadBuildings();
    loadUserEquipment();
  }, []);

  // Загружаем кабинеты при выборе здания
  useEffect(() => {
    const loadRooms = async () => {
      if (selectedBuildingId) {
        setLoadingRooms(true);
        try {
          const { data, error } =
            await buildingsService.getRooms(selectedBuildingId);
          if (!error && data) {
            setRooms(data.filter((r: Room) => r.is_active));
          }
        } catch (err) {
          console.error("Ошибка загрузки кабинетов:", err);
        } finally {
          setLoadingRooms(false);
        }
      } else {
        setRooms([]);
      }
    };
    loadRooms();
  }, [selectedBuildingId]);

  // Загружаем оборудование при изменении кабинета
  useEffect(() => {
    const loadEquipment = async () => {
      // Загружаем только если указаны оба поля или хотя бы одно
      const dept = watchedDepartment?.trim();
      const room = watchedRoom?.trim();

      if (dept || room) {
        setLoadingEquipment(true);
        setEquipmentList([]); // Очищаем список перед загрузкой
        try {
          const { data, error } = await equipmentService.getEquipmentByLocation(
            dept || undefined,
            room || undefined,
          );
          if (!error && data) {
            setEquipmentList(data);
            console.log("Загружено оборудование:", data.length, "единиц");
          } else {
            console.error("Ошибка загрузки оборудования:", error);
            setEquipmentList([]);
          }
        } catch (err) {
          console.error("Исключение при загрузке оборудования:", err);
          setEquipmentList([]);
        } finally {
          setLoadingEquipment(false);
        }
      } else {
        setEquipmentList([]);
        setLoadingEquipment(false);
      }

      // Сбрасываем выбранное оборудование при смене кабинета ТОЛЬКО если это новый тикет
      // Не сбрасываем, если это просмотр существующего тикета с уже выбранным оборудованием
      if (!ticket || !ticket.equipment_id) {
        // Только для новых тикетов или тикетов без оборудования
        reset({ ...watch(), equipment_id: null });
      }
    };

    const timeoutId = setTimeout(loadEquipment, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [watchedDepartment, watchedRoom, reset, watch, ticket]);

  // Загружаем информацию об оборудовании и расходники при выборе оборудования
  useEffect(() => {
    const loadEquipmentAndConsumables = async () => {
      if (watchedEquipmentId) {
        console.log(
          "Загрузка информации об оборудовании и расходников:",
          watchedEquipmentId,
        );
        setLoadingConsumables(true);
        try {
          // Загружаем полную информацию об оборудовании
          const { data: equipmentData, error: equipmentError } =
            await equipmentService.getEquipmentById(watchedEquipmentId);
          if (!equipmentError && equipmentData) {
            setSelectedEquipment(equipmentData);
          } else {
            setSelectedEquipment(null);
          }

          // Загружаем расходники
          const { data, error } =
            await equipmentService.getEquipmentConsumables(watchedEquipmentId);
          if (!error && data) {
            console.log("Загружено расходников:", data.length, "единиц", data);
            setConsumables(data);

            // Если это существующий тикет, загружаем выбранные расходники
            if (
              ticket?.selected_consumables &&
              Array.isArray(ticket.selected_consumables)
            ) {
              const selected = new Set(ticket.selected_consumables);
              setSelectedConsumables(selected);
            } else if (ticket?.consumables) {
              // Fallback на старый формат, если selected_consumables нет
              const selected = new Set(
                ticket.consumables.map((c) => c.consumable_id),
              );
              setSelectedConsumables(selected);
            }
          } else {
            console.error("Ошибка загрузки расходников:", error);
            setConsumables([]);
          }
        } catch (err) {
          console.error("Исключение при загрузке:", err);
          setConsumables([]);
          setSelectedEquipment(null);
        } finally {
          setLoadingConsumables(false);
        }
      } else {
        setConsumables([]);
        setSelectedEquipment(null);
        setSelectedConsumables(new Set());
      }
    };

    loadEquipmentAndConsumables();
  }, [watchedEquipmentId, ticket]);

  useEffect(() => {
    if (ticket) {
      console.log("Загрузка данных тикета в форму:", ticket);
      reset({
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        location_department: ticket.location_department || "",
        location_room: ticket.location_room || "",
        equipment_id: ticket.equipment_id || null,
        desired_resolution_date: formatDateForInput(
          ticket.desired_resolution_date,
        ),
      });

      // Загружаем выбранные расходники
      if (
        ticket.selected_consumables &&
        Array.isArray(ticket.selected_consumables)
      ) {
        setSelectedConsumables(new Set(ticket.selected_consumables));
      }

      // Если у тикета есть оборудование, загружаем его в список оборудования
      if (
        ticket.equipment_id &&
        ticket.location_department &&
        ticket.location_room
      ) {
        // Загружаем оборудование для отображения в списке
        equipmentService
          .getEquipmentByLocation(
            ticket.location_department,
            ticket.location_room,
          )
          .then(({ data, error }) => {
            if (!error && data) {
              setEquipmentList(data);
            }
          });
      }
    }
  }, [ticket, reset]);

  // Функция для фильтрации расходников в зависимости от типа принтера
  const getFilteredConsumables = () => {
    if (!selectedEquipment || selectedEquipment.category !== "printer") {
      return consumables;
    }

    const specs = selectedEquipment.specifications || {};
    const printType = specs.print_type;
    const isColor = specs.is_color === true || specs.is_color === "true";

    return consumables.filter((consumable) => {
      const consumableType = (consumable as any).consumable_type || "";

      // Для лазерных принтеров показываем картриджи и фотобарабаны
      if (printType === "laser") {
        if (isColor) {
          // Для цветных лазерных принтеров показываем все картриджи (4 цвета) и фотобарабан
          return consumableType === "cartridge" || consumableType === "drum";
        } else {
          // Для чёрно-белых лазерных принтеров показываем один картридж и фотобарабан
          return consumableType === "cartridge" || consumableType === "drum";
        }
      } else if (printType === "inkjet") {
        // Для струйных принтеров показываем только картриджи/чернила
        if (isColor) {
          // Для цветных струйных принтеров показываем все картриджи/чернила (4 цвета)
          return consumableType === "cartridge" || consumableType === "ink";
        } else {
          // Для чёрно-белых струйных принтеров показываем один картридж/чернила
          return consumableType === "cartridge" || consumableType === "ink";
        }
      }

      // Для других типов принтеров показываем все расходники
      return true;
    });
  };

  const filteredConsumables = getFilteredConsumables();

  // Обработчик изменения выбора расходника
  const handleConsumableToggle = (consumableId: string) => {
    const newSelected = new Set(selectedConsumables);
    if (newSelected.has(consumableId)) {
      newSelected.delete(consumableId);
    } else {
      newSelected.add(consumableId);
    }
    setSelectedConsumables(newSelected);
  };

  // Обработчик отправки формы с выбранными расходниками
  const handleFormSubmit = async (data: TicketFormData) => {
    const submitData = {
      ...data,
      selected_consumables: Array.from(selectedConsumables),
    };
    await onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Заголовок <span className="text-red-500">*</span>
          </label>
          <input
            {...register("title")}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Краткое описание проблемы"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Описание <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register("description")}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Подробное описание проблемы..."
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.description.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Категория <span className="text-red-500">*</span>
          </label>
          <select
            {...register("category")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="hardware">Оборудование</option>
            <option value="software">Программное обеспечение</option>
            <option value="network">Сеть</option>
            <option value="hr">HR / Кадры</option>
            <option value="other">Прочее</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Приоритет <span className="text-red-500">*</span>
          </label>
          <select
            {...register("priority")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
            <option value="critical">Критический</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Здание
          </label>
          <select
            {...register("location_department")}
            onChange={(e) => {
              const building = buildings.find((b) => b.name === e.target.value);
              setSelectedBuildingId(building?.id || null);
              reset({
                ...watch(),
                location_department: e.target.value,
                location_room: "",
                equipment_id: null,
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loadingBuildings}
          >
            <option value="">Не выбрано</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.name}>
                {building.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Кабинет
          </label>
          <select
            {...register("location_room")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            disabled={!selectedBuildingId || loadingRooms}
          >
            <option value="">
              {loadingRooms
                ? "Загрузка..."
                : !selectedBuildingId
                  ? "Сначала выберите здание"
                  : "Не выбран"}
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.name}>
                {room.name}
                {room.floor ? ` (этаж ${room.floor})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Выбор источника оборудования */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Оборудование
          </label>

          {/* Переключатель источника */}
          <div className="flex space-x-4 mb-3">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                name="equipmentSource"
                checked={equipmentSource === "room"}
                onChange={() => {
                  setEquipmentSource("room");
                  reset({ ...watch(), equipment_id: null });
                }}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                По кабинету
              </span>
            </label>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                name="equipmentSource"
                checked={equipmentSource === "user"}
                onChange={() => {
                  setEquipmentSource("user");
                  reset({ ...watch(), equipment_id: null });
                }}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Моё оборудование{" "}
                {userEquipment.length > 0 && `(${userEquipment.length})`}
              </span>
            </label>
          </div>

          {/* Список оборудования по кабинету */}
          {equipmentSource === "room" && (
            <>
              {!watchedDepartment?.trim() && !watchedRoom?.trim() ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                  Выберите здание и кабинет для отображения оборудования
                </div>
              ) : loadingEquipment ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                  Загрузка оборудования...
                </div>
              ) : equipmentList.length > 0 ? (
                <>
                  <select
                    {...register("equipment_id")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Не выбрано</option>
                    {equipmentList.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} {eq.model ? `(${eq.model})` : ""} -{" "}
                        {eq.inventory_number} [{eq.category}]
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Найдено {equipmentList.length} единиц оборудования в
                    кабинете
                  </p>
                </>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                  Оборудование в указанном кабинете не найдено
                </div>
              )}
            </>
          )}

          {/* Список оборудования пользователя */}
          {equipmentSource === "user" && (
            <>
              {userEquipment.length > 0 ? (
                <>
                  <select
                    {...register("equipment_id")}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Не выбрано</option>
                    {userEquipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} {eq.model ? `(${eq.model})` : ""} -{" "}
                        {eq.inventory_number}
                        {eq.location_department &&
                          eq.location_room &&
                          ` [${eq.location_department}, ${eq.location_room}]`}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Закреплённое за вами оборудование: {userEquipment.length}{" "}
                    ед.
                  </p>
                </>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                  За вами не закреплено оборудование
                </div>
              )}
            </>
          )}
        </div>

        {/* Расходные материалы для выбранного оборудования */}
        {watchedEquipmentId && (
          <div className="md:col-span-2">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                <h3 className="font-medium text-blue-900 dark:text-blue-100">
                  Расходные материалы для оборудования
                  {selectedEquipment?.category === "printer" && (
                    <span className="text-xs font-normal text-blue-700 dark:text-blue-300 ml-2">
                      (
                      {selectedEquipment.specifications?.print_type === "laser"
                        ? "Лазерный"
                        : selectedEquipment.specifications?.print_type ===
                            "inkjet"
                          ? "Струйный"
                          : "Принтер"}
                      {selectedEquipment.specifications?.is_color === true ||
                      selectedEquipment.specifications?.is_color === "true"
                        ? ", цветной"
                        : ", чёрно-белый"}
                      )
                    </span>
                  )}
                </h3>
              </div>
              {loadingConsumables ? (
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Загрузка расходников...
                </div>
              ) : filteredConsumables.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                    Выберите расходные материалы, которые необходимо
                    использовать:
                  </p>
                  <ul className="space-y-2">
                    {filteredConsumables.map((consumable) => {
                      const isSelected = selectedConsumables.has(
                        consumable.consumable_id,
                      );
                      const consumableType =
                        (consumable as any).consumable_type || "";
                      const typeLabels: Record<string, string> = {
                        cartridge: "Картридж",
                        drum: "Фотобарабан",
                        toner: "Тонер",
                        ink: "Чернила",
                        paper: "Бумага",
                        other: "Прочее",
                      };

                      return (
                        <li
                          key={consumable.consumable_id}
                          className={`flex items-center justify-between text-sm p-2 rounded border ${
                            isSelected
                              ? "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700"
                              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <label className="flex items-center cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                handleConsumableToggle(consumable.consumable_id)
                              }
                              className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-blue-900 dark:text-blue-100 flex-1">
                              {consumable.consumable_name}
                              {consumable.consumable_model &&
                                ` (${consumable.consumable_model})`}
                              {consumableType && (
                                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                  [
                                  {typeLabels[consumableType] || consumableType}
                                  ]
                                </span>
                              )}
                            </span>
                          </label>
                          <div className="flex items-center gap-2 ml-4">
                            {consumable.is_low_stock && (
                              <span title="Низкий остаток">
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              </span>
                            )}
                            <span
                              className={`font-medium text-xs ${consumable.is_low_stock ? "text-yellow-600 dark:text-yellow-400" : "text-blue-700 dark:text-blue-300"}`}
                            >
                              В наличии: {consumable.quantity_in_stock}{" "}
                              {consumable.min_quantity > 0 &&
                                `(мин: ${consumable.min_quantity})`}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : consumables.length > 0 ? (
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Для данного типа принтера не найдено подходящих расходных
                  материалов
                </div>
              ) : (
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Для данного оборудования не указаны расходные материалы
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Желаемая дата решения
          </label>
          <input
            {...register("desired_resolution_date")}
            type="date"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Отмена
        </Button>
        <Button type="submit" loading={loading}>
          {ticket ? "Сохранить" : "Создать заявку"}
        </Button>
      </div>
    </form>
  );
};
