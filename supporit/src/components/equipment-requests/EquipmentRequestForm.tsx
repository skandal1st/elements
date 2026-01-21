import { useState } from "react";
import { Button } from "../ui/Button";
import type {
  EquipmentCategory,
  EquipmentRequestType,
  EquipmentRequestUrgency,
} from "../../types";

interface EquipmentRequestFormProps {
  onSubmit: (data: EquipmentRequestFormData) => void;
  onCancel: () => void;
}

export interface EquipmentRequestFormData {
  title: string;
  description?: string;
  equipment_category: EquipmentCategory;
  request_type: EquipmentRequestType;
  quantity: number;
  urgency: EquipmentRequestUrgency;
  justification?: string;
  estimated_cost?: number;
}

const categories: { value: EquipmentCategory; label: string }[] = [
  { value: "computer", label: "Компьютер" },
  { value: "monitor", label: "Монитор" },
  { value: "printer", label: "Принтер" },
  { value: "network", label: "Сетевое оборудование" },
  { value: "server", label: "Сервер" },
  { value: "mobile", label: "Мобильное устройство" },
  { value: "peripheral", label: "Периферия" },
  { value: "other", label: "Прочее" },
];

const requestTypes: { value: EquipmentRequestType; label: string }[] = [
  { value: "new", label: "Новое оборудование" },
  { value: "replacement", label: "Замена существующего" },
  { value: "upgrade", label: "Улучшение/апгрейд" },
];

const urgencyLevels: { value: EquipmentRequestUrgency; label: string }[] = [
  { value: "low", label: "Низкая - можно подождать" },
  { value: "normal", label: "Обычная" },
  { value: "high", label: "Высокая - нужно скоро" },
  { value: "critical", label: "Критическая - срочно" },
];

export const EquipmentRequestForm = ({
  onSubmit,
  onCancel,
}: EquipmentRequestFormProps) => {
  const [formData, setFormData] = useState<EquipmentRequestFormData>({
    title: "",
    description: "",
    equipment_category: "computer",
    request_type: "new",
    quantity: 1,
    urgency: "normal",
    justification: "",
    estimated_cost: undefined,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "quantity"
          ? parseInt(value) || 1
          : name === "estimated_cost"
            ? value
              ? parseFloat(value)
              : undefined
            : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert("Введите название заявки");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Название */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Название заявки *
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Например: Ноутбук для нового сотрудника"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          required
        />
      </div>

      {/* Категория и тип */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Категория оборудования *
          </label>
          <select
            name="equipment_category"
            value={formData.equipment_category}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Тип заявки
          </label>
          <select
            name="request_type"
            value={formData.request_type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {requestTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Количество и срочность */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Количество
          </label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Срочность
          </label>
          <select
            name="urgency"
            value={formData.urgency}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {urgencyLevels.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Описание */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Описание
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          placeholder="Подробное описание требуемого оборудования (модель, характеристики и т.д.)"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Обоснование */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Обоснование необходимости
        </label>
        <textarea
          name="justification"
          value={formData.justification}
          onChange={handleChange}
          rows={2}
          placeholder="Почему нужно это оборудование?"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Ориентировочная стоимость */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Ориентировочная стоимость (руб.)
        </label>
        <input
          type="number"
          name="estimated_cost"
          value={formData.estimated_cost || ""}
          onChange={handleChange}
          min="0"
          step="100"
          placeholder="Если известна"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Кнопки */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" loading={loading}>
          Создать заявку
        </Button>
      </div>
    </form>
  );
};
