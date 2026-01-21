import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { equipmentRequestsService } from "../../services/equipment-requests.service";
import type {
  EquipmentRequest,
  EquipmentRequestStatus,
  EquipmentRequestUrgency,
  EquipmentCategory,
} from "../../types";

interface EquipmentRequestDetailsModalProps {
  requestId: string;
  isOpen: boolean;
  onClose: () => void;
}

const getStatusLabel = (status: EquipmentRequestStatus): string => {
  const labels: Record<EquipmentRequestStatus, string> = {
    pending: "На рассмотрении",
    approved: "Одобрена",
    rejected: "Отклонена",
    ordered: "Заказано",
    received: "Получено",
    issued: "Выдано",
    cancelled: "Отменена",
  };
  return labels[status] || status;
};

const getStatusColor = (status: EquipmentRequestStatus): string => {
  const colors: Record<EquipmentRequestStatus, string> = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    approved:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    ordered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    received:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    issued:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };
  return colors[status] || "";
};

const getUrgencyLabel = (urgency: EquipmentRequestUrgency): string => {
  const labels: Record<EquipmentRequestUrgency, string> = {
    low: "Низкая",
    normal: "Обычная",
    high: "Высокая",
    critical: "Критическая",
  };
  return labels[urgency] || urgency;
};

const getCategoryLabel = (category: EquipmentCategory): string => {
  const labels: Record<EquipmentCategory, string> = {
    computer: "Компьютер",
    monitor: "Монитор",
    printer: "Принтер",
    network: "Сетевое",
    server: "Сервер",
    mobile: "Мобильное",
    peripheral: "Периферия",
    other: "Прочее",
  };
  return labels[category] || category;
};

const getRequestTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    new: "Новое оборудование",
    replacement: "Замена существующего",
    upgrade: "Улучшение/апгрейд",
  };
  return labels[type] || type;
};

export const EquipmentRequestDetailsModal = ({
  requestId,
  isOpen,
  onClose,
}: EquipmentRequestDetailsModalProps) => {
  const [request, setRequest] = useState<EquipmentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && requestId) {
      loadRequest();
    }
  }, [isOpen, requestId]);

  const loadRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } =
        await equipmentRequestsService.getRequestById(requestId);
      if (error) {
        setError(error.message);
      } else {
        setRequest(data);
      }
    } catch (err) {
      setError("Ошибка загрузки заявки");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("ru-RU");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Детали заявки" size="lg">
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 dark:text-red-400">
          {error}
        </div>
      ) : request ? (
        <div className="space-y-6">
          {/* Заголовок и статус */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {request.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {getCategoryLabel(request.equipment_category)} •{" "}
                {getRequestTypeLabel(request.request_type)}
              </p>
            </div>
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(request.status)}`}
            >
              {getStatusLabel(request.status)}
            </span>
          </div>

          {/* Основная информация */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Количество
              </span>
              <p className="font-medium text-gray-900 dark:text-white">
                {request.quantity}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Срочность
              </span>
              <p className="font-medium text-gray-900 dark:text-white">
                {getUrgencyLabel(request.urgency)}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Заявитель
              </span>
              <p className="font-medium text-gray-900 dark:text-white">
                {request.requester_name}
              </p>
              {request.requester_department && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {request.requester_department}
                </p>
              )}
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Ориентировочная стоимость
              </span>
              <p className="font-medium text-gray-900 dark:text-white">
                {request.estimated_cost
                  ? `${request.estimated_cost.toLocaleString("ru-RU")} ₽`
                  : "Не указана"}
              </p>
            </div>
          </div>

          {/* Описание */}
          {request.description && (
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Описание
              </span>
              <p className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap">
                {request.description}
              </p>
            </div>
          )}

          {/* Обоснование */}
          {request.justification && (
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Обоснование
              </span>
              <p className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap">
                {request.justification}
              </p>
            </div>
          )}

          {/* Информация о рассмотрении */}
          {request.reviewer_name && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Рассмотрение
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Рассмотрел
                  </span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {request.reviewer_name}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Дата
                  </span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(request.reviewed_at)}
                  </p>
                </div>
              </div>
              {request.review_comment && (
                <div className="mt-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Комментарий
                  </span>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {request.review_comment}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Информация о замене */}
          {request.replace_equipment_name && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Замена оборудования
              </h4>
              <p className="font-medium text-gray-900 dark:text-white">
                {request.replace_equipment_name}
              </p>
              {request.replace_equipment_inventory && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Инв. № {request.replace_equipment_inventory}
                </p>
              )}
            </div>
          )}

          {/* Информация о выданном оборудовании */}
          {request.issued_equipment_name && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Выданное оборудование
              </h4>
              <p className="font-medium text-gray-900 dark:text-white">
                {request.issued_equipment_name}
              </p>
              {request.issued_equipment_inventory && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Инв. № {request.issued_equipment_inventory}
                </p>
              )}
            </div>
          )}

          {/* Даты */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Создана
                </span>
                <p className="text-gray-900 dark:text-white">
                  {formatDate(request.created_at)}
                </p>
              </div>
              {request.ordered_at && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Заказано
                  </span>
                  <p className="text-gray-900 dark:text-white">
                    {formatDate(request.ordered_at)}
                  </p>
                </div>
              )}
              {request.received_at && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Получено
                  </span>
                  <p className="text-gray-900 dark:text-white">
                    {formatDate(request.received_at)}
                  </p>
                </div>
              )}
              {request.issued_at && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Выдано
                  </span>
                  <p className="text-gray-900 dark:text-white">
                    {formatDate(request.issued_at)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
