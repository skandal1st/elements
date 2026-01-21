import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import type { EquipmentRequest } from "../../types";

interface ReviewModalProps {
  request: EquipmentRequest;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    status: "approved" | "rejected";
    comment?: string;
    estimated_cost?: number;
  }) => void;
}

export const ReviewModal = ({
  request,
  isOpen,
  onClose,
  onSubmit,
}: ReviewModalProps) => {
  const [status, setStatus] = useState<"approved" | "rejected">("approved");
  const [comment, setComment] = useState("");
  const [estimatedCost, setEstimatedCost] = useState<string>(
    request.estimated_cost?.toString() || ""
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        status,
        comment: comment.trim() || undefined,
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Рассмотрение заявки"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Информация о заявке */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            {request.title}
          </h4>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>Заявитель: {request.requester_name}</p>
            <p>Количество: {request.quantity}</p>
            {request.description && (
              <p className="line-clamp-2">{request.description}</p>
            )}
          </div>
        </div>

        {/* Решение */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Решение *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="status"
                value="approved"
                checked={status === "approved"}
                onChange={(e) =>
                  setStatus(e.target.value as "approved" | "rejected")
                }
                className="mr-2 text-green-600 focus:ring-green-500"
              />
              <span className="text-green-600 dark:text-green-400 font-medium">
                Одобрить
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="status"
                value="rejected"
                checked={status === "rejected"}
                onChange={(e) =>
                  setStatus(e.target.value as "approved" | "rejected")
                }
                className="mr-2 text-red-600 focus:ring-red-500"
              />
              <span className="text-red-600 dark:text-red-400 font-medium">
                Отклонить
              </span>
            </label>
          </div>
        </div>

        {/* Ориентировочная стоимость (только при одобрении) */}
        {status === "approved" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ориентировочная стоимость (руб.)
            </label>
            <input
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              min="0"
              step="100"
              placeholder="Укажите стоимость для закупки"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Комментарий */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Комментарий {status === "rejected" && "(обязателен при отклонении)"}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={
              status === "approved"
                ? "Дополнительные комментарии (необязательно)"
                : "Причина отклонения заявки"
            }
            required={status === "rejected"}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Кнопки */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="submit"
            loading={loading}
            variant={status === "approved" ? "primary" : "danger"}
          >
            {status === "approved" ? "Одобрить" : "Отклонить"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
