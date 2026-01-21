import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import type { Equipment, Building, User, Room } from "../../types";
import { Button } from "../ui/Button";
import { buildingsService } from "../../services/buildings.service";
import { usersService } from "../../services/users.service";
import { ZabbixStatus } from "./ZabbixStatus";

const equipmentSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  model: z.string().optional(),
  inventory_number: z.string().min(1, "Инвентарный номер обязателен"),
  serial_number: z.string().optional(),
  category: z.enum([
    "computer",
    "monitor",
    "printer",
    "network",
    "server",
    "mobile",
    "peripheral",
    "other",
  ]),
  status: z.enum(["in_use", "in_stock", "in_repair", "written_off"]),
  purchase_date: z.string().optional(),
  cost: z.number().optional().nullable(),
  warranty_until: z.string().optional(),
  current_owner_id: z.string().optional().nullable(),
  location_department: z.string().optional(),
  location_room: z.string().optional(),
  manufacturer: z.string().optional(),
  ip_address: z.string().optional(),
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;

interface EquipmentFormProps {
  equipment?: Equipment;
  onSubmit: (data: EquipmentFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// Компонент для дополнительных полей в зависимости от категории
const EquipmentCategoryFields = ({
  category,
  specifications,
  register,
  setValue,
  watch,
}: {
  category: string;
  specifications?: Record<string, any>;
  register: any;
  setValue: any;
  watch: any;
}) => {
  const specData = specifications || {};

  // Устанавливаем значения по умолчанию при изменении категории или при загрузке
  useEffect(() => {
    if (specData && Object.keys(specData).length > 0) {
      Object.keys(specData).forEach((key) => {
        setValue(`specifications.${key}`, specData[key]);
      });
    }
  }, [specData, setValue]);

  if (category === "printer") {
    const printType =
      watch("specifications.print_type") || specData.print_type || "laser";
    const isColor =
      watch("specifications.is_color") === "true" ||
      watch("specifications.is_color") === true ||
      specData.is_color === true ||
      specData.is_color === "true";
    const isLaser = printType === "laser";
    const cartridgeType =
      watch("specifications.cartridge_type") || specData.cartridge_type || "";

    // Определяем, какие расходники нужны
    const needsDrum = isLaser; // Фотобарабан нужен для лазерных принтеров
    const needsMultipleCartridges = isColor; // Несколько картриджей для цветных принтеров

    return (
      <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Тип печати
            </label>
            <select
              {...register("specifications.print_type")}
              name="specifications.print_type"
              defaultValue={specData.print_type || "laser"}
              onChange={(e) => {
                setValue("specifications.print_type", e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="laser">Лазерная</option>
              <option value="inkjet">Струйная</option>
              <option value="dot_matrix">Матричная</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Цветная печать
            </label>
            <select
              {...register("specifications.is_color")}
              name="specifications.is_color"
              defaultValue={
                specData.is_color !== undefined
                  ? specData.is_color
                    ? "true"
                    : "false"
                  : "false"
              }
              onChange={(e) => {
                setValue("specifications.is_color", e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="false">Чёрно-белая</option>
              <option value="true">Цветная</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Тип картриджа
            </label>
            <input
              {...register("specifications.cartridge_type")}
              name="specifications.cartridge_type"
              type="text"
              defaultValue={specData.cartridge_type || ""}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Например: HP 85A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Формат бумаги
            </label>
            <select
              {...register("specifications.paper_format")}
              name="specifications.paper_format"
              defaultValue={specData.paper_format || "A4"}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
          </div>
        </div>

        {/* Секция расходников */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Расходные материалы для принтера
          </h3>

          {/* Фотобарабан для лазерных принтеров */}
          {needsDrum && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Фотобарабан
              </label>
              <input
                {...register("specifications.drum_model")}
                name="specifications.drum_model"
                type="text"
                defaultValue={specData.drum_model || ""}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Например: HP 85A Drum"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Модель фотобарабана для лазерного принтера
              </p>
            </div>
          )}

          {/* Картриджи */}
          <div className="space-y-3">
            {needsMultipleCartridges ? (
              // Цветной принтер - 4 картриджа
              <>
                <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Картридж чёрный
                  </label>
                  <input
                    {...register("specifications.cartridge_black")}
                    name="specifications.cartridge_black"
                    type="text"
                    defaultValue={specData.cartridge_black || cartridgeType}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Например: HP 85A Black"
                  />
                </div>
                <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Картридж голубой (Cyan)
                  </label>
                  <input
                    {...register("specifications.cartridge_cyan")}
                    name="specifications.cartridge_cyan"
                    type="text"
                    defaultValue={specData.cartridge_cyan || ""}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Например: HP 85A Cyan"
                  />
                </div>
                <div className="p-3 bg-magenta-50 dark:bg-magenta-900/20 rounded-lg border border-magenta-200 dark:border-magenta-800">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Картридж пурпурный (Magenta)
                  </label>
                  <input
                    {...register("specifications.cartridge_magenta")}
                    name="specifications.cartridge_magenta"
                    type="text"
                    defaultValue={specData.cartridge_magenta || ""}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Например: HP 85A Magenta"
                  />
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Картридж жёлтый (Yellow)
                  </label>
                  <input
                    {...register("specifications.cartridge_yellow")}
                    name="specifications.cartridge_yellow"
                    type="text"
                    defaultValue={specData.cartridge_yellow || ""}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Например: HP 85A Yellow"
                  />
                </div>
              </>
            ) : (
              // Чёрно-белый принтер - один картридж
              <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Картридж чёрный
                </label>
                <input
                  {...register("specifications.cartridge_black")}
                  name="specifications.cartridge_black"
                  type="text"
                  defaultValue={specData.cartridge_black || cartridgeType}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Например: HP 85A"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (category === "computer") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Процессор
          </label>
          <input
            {...register("specifications.cpu")}
            name="specifications.cpu"
            type="text"
            defaultValue={specData.cpu || ""}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: Intel Core i5-10400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Оперативная память (ГБ)
          </label>
          <input
            {...register("specifications.ram")}
            name="specifications.ram"
            type="number"
            defaultValue={specData.ram || ""}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: 16"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Жесткий диск (ГБ)
          </label>
          <input
            {...register("specifications.storage")}
            name="specifications.storage"
            type="number"
            defaultValue={specData.storage || ""}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: 512"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Видеокарта
          </label>
          <input
            {...register("specifications.gpu")}
            name="specifications.gpu"
            type="text"
            defaultValue={specData.gpu || ""}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: NVIDIA GTX 1660"
          />
        </div>
      </div>
    );
  }

  if (category === "monitor") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Диагональ (дюймы)
          </label>
          <input
            {...register("specifications.screen_size")}
            name="specifications.screen_size"
            type="number"
            defaultValue={specData.screen_size || ""}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: 24"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Разрешение
          </label>
          <select
            {...register("specifications.resolution")}
            name="specifications.resolution"
            defaultValue={specData.resolution || "1920x1080"}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="1920x1080">1920x1080 (Full HD)</option>
            <option value="2560x1440">2560x1440 (2K)</option>
            <option value="3840x2160">3840x2160 (4K)</option>
            <option value="1366x768">1366x768 (HD)</option>
          </select>
        </div>
      </div>
    );
  }

  return null;
};

export const EquipmentForm = ({
  equipment,
  onSubmit,
  onCancel,
  loading,
}: EquipmentFormProps) => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  );
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: equipment
      ? {
          name: equipment.name,
          model: equipment.model || "",
          inventory_number: equipment.inventory_number,
          serial_number: equipment.serial_number || "",
          category: equipment.category,
          status: equipment.status,
          purchase_date: equipment.purchase_date
            ? new Date(equipment.purchase_date).toISOString().split("T")[0]
            : "",
          cost: equipment.cost || null,
          warranty_until: equipment.warranty_until
            ? new Date(equipment.warranty_until).toISOString().split("T")[0]
            : "",
          current_owner_id: equipment.current_owner_id || null,
          location_department: equipment.location_department || "",
          location_room: equipment.location_room || "",
          manufacturer: equipment.manufacturer || "",
          ip_address: equipment.ip_address || "",
        }
      : {
          status: "in_stock",
          category: "computer",
        },
  });

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

  // Загружаем список зданий при монтировании компонента
  useEffect(() => {
    const loadBuildings = async () => {
      setLoadingBuildings(true);
      try {
        const { data, error } = await buildingsService.getBuildings(true); // Только активные
        if (!error && data) {
          setBuildings(data);
          // Если редактируем оборудование, находим здание и загружаем кабинеты
          if (equipment?.location_department) {
            const building = data.find(
              (b: Building) => b.name === equipment.location_department,
            );
            if (building) {
              setSelectedBuildingId(building.id);
            }
          }
        }
      } catch (err) {
        console.error("Ошибка загрузки зданий:", err);
      } finally {
        setLoadingBuildings(false);
      }
    };
    loadBuildings();
  }, [equipment]);

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

  // Загружаем список пользователей при монтировании компонента
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data, error } = await usersService.getUsers();
        if (!error && data) {
          setUsers(data);
        }
      } catch (err) {
        console.error("Ошибка загрузки пользователей:", err);
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    if (equipment) {
      const formData: any = {
        name: equipment.name,
        model: equipment.model || "",
        inventory_number: equipment.inventory_number,
        serial_number: equipment.serial_number || "",
        category: equipment.category,
        status: equipment.status,
        purchase_date: formatDateForInput(equipment.purchase_date),
        cost: equipment.cost || null,
        warranty_until: formatDateForInput(equipment.warranty_until),
        current_owner_id: equipment.current_owner_id || null,
        location_department: equipment.location_department || "",
        location_room: equipment.location_room || "",
        manufacturer: equipment.manufacturer || "",
        ip_address: equipment.ip_address || "",
      };

      // Устанавливаем значения specifications в форму
      if (
        equipment.specifications &&
        typeof equipment.specifications === "object"
      ) {
        Object.keys(equipment.specifications).forEach((key) => {
          formData[`specifications.${key}`] = equipment.specifications![key];
        });
      }

      reset(formData);
    }
  }, [equipment, reset, setValue]);

  // Обработчик отправки формы - собирает specifications из полей формы
  const onSubmitForm = (data: any, event?: React.BaseSyntheticEvent) => {
    // Собираем все поля specifications.* в объект
    const specifications: Record<string, any> = {};

    // Получаем форму из события
    const form = event?.target as HTMLFormElement;

    if (form) {
      console.log("Форма найдена, начинаем сбор данных...");

      // Используем FormData для надежности - это основной способ
      const formData = new FormData(form);
      console.log("FormData entries:", Array.from(formData.entries()));

      for (const [key, value] of formData.entries()) {
        if (key && key.startsWith("specifications.")) {
          const specKey = key.replace("specifications.", "");
          const stringValue = value.toString();

          console.log(
            `Найдено поле specifications: ${specKey} = ${stringValue}`,
          );

          if (
            stringValue !== null &&
            stringValue !== undefined &&
            stringValue !== ""
          ) {
            // Преобразуем числовые строки в числа для числовых полей
            if (
              specKey === "ram" ||
              specKey === "storage" ||
              specKey === "screen_size"
            ) {
              const numValue = Number(stringValue);
              if (!isNaN(numValue)) {
                specifications[specKey] = numValue;
              }
            } else {
              specifications[specKey] = stringValue;
            }
          }
        }
      }

      // Дополнительно проверяем через элементы формы (на случай, если FormData не сработал)
      const formElements = form.elements;
      for (let i = 0; i < formElements.length; i++) {
        const element = formElements[i] as HTMLInputElement | HTMLSelectElement;
        const name = element.name || element.id || "";

        if (name && name.startsWith("specifications.")) {
          const specKey = name.replace("specifications.", "");

          // Пропускаем, если уже собрали через FormData
          if (specifications[specKey] !== undefined) continue;

          let value: any = null;

          if (element.type === "number") {
            value = element.value ? Number(element.value) : null;
          } else if (element.type === "checkbox") {
            value = (element as HTMLInputElement).checked;
          } else {
            value = element.value || null;
          }

          if (value !== null && value !== undefined && value !== "") {
            if (
              specKey === "ram" ||
              specKey === "storage" ||
              specKey === "screen_size"
            ) {
              specifications[specKey] =
                typeof value === "string" ? Number(value) : value;
            } else {
              specifications[specKey] = value;
            }
            console.log(`Собрано из элемента формы: ${specKey} = ${value}`);
          }
        }
      }
    } else {
      console.warn("Форма не найдена в event.target");
    }

    // Также проверяем data на случай, если там есть specifications
    Object.keys(data).forEach((key) => {
      if (key && key.startsWith("specifications.")) {
        const specKey = key.replace("specifications.", "");
        const value = data[key];
        if (value !== undefined && value !== null && value !== "") {
          if (
            specKey === "ram" ||
            specKey === "storage" ||
            specKey === "screen_size"
          ) {
            specifications[specKey] = Number(value);
          } else {
            specifications[specKey] = value;
          }
        }
        delete data[key];
      }
    });

    // Формируем финальные данные
    const submitData = {
      ...data,
      specifications:
        Object.keys(specifications).length > 0 ? specifications : null,
    };

    console.log("Отправка данных формы:", submitData);
    console.log("Собранные specifications:", specifications);
    onSubmit(submitData);
  };

  return (
    <form
      onSubmit={handleSubmit((data, event) => onSubmitForm(data, event))}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Название <span className="text-red-500">*</span>
          </label>
          <input
            {...register("name")}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Модель
          </label>
          <input
            {...register("model")}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Инвентарный номер <span className="text-red-500">*</span>
          </label>
          <input
            {...register("inventory_number")}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {errors.inventory_number && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.inventory_number.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Серийный номер
          </label>
          <input
            {...register("serial_number")}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Категория <span className="text-red-500">*</span>
          </label>
          <select
            {...register("category")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="computer">Компьютер</option>
            <option value="monitor">Монитор</option>
            <option value="printer">Принтер</option>
            <option value="network">Сетевое оборудование</option>
            <option value="server">Сервер</option>
            <option value="mobile">Мобильное устройство</option>
            <option value="peripheral">Периферия</option>
            <option value="other">Прочее</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Статус <span className="text-red-500">*</span>
          </label>
          <select
            {...register("status")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="in_use">В работе</option>
            <option value="in_stock">На складе</option>
            <option value="in_repair">В ремонте</option>
            <option value="written_off">Списано</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Производитель
          </label>
          <input
            {...register("manufacturer")}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Стоимость (₽)
          </label>
          <input
            {...register("cost", { valueAsNumber: true })}
            type="number"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Дата покупки
          </label>
          <input
            {...register("purchase_date")}
            type="date"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Гарантия до
          </label>
          <input
            {...register("warranty_until")}
            type="date"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Пользователь
          </label>
          <select
            {...register("current_owner_id")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loadingUsers}
          >
            <option value="">Не выбрано</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
                {user.department ? ` (${user.department})` : ""}
              </option>
            ))}
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
              setValue("location_department", e.target.value);
              setValue("location_room", "");
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            IP-адрес
          </label>
          <input
            {...register("ip_address")}
            type="text"
            placeholder="Например: 192.168.1.100"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Дополнительные поля в зависимости от категории */}
      <EquipmentCategoryFields
        category={watch("category")}
        specifications={equipment?.specifications}
        register={register}
        setValue={setValue}
        watch={watch}
      />

      {/* Секция мониторинга Zabbix (только для редактирования) */}
      {equipment && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <ZabbixStatus
            equipmentId={equipment.id}
            category={equipment.category}
            ipAddress={equipment.ip_address}
          />
        </div>
      )}

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
          {equipment ? "Сохранить" : "Создать"}
        </Button>
      </div>
    </form>
  );
};
