import { useState, useEffect } from "react";
import { Plus, Search, CheckCircle, XCircle, Eye, Trash2 } from "lucide-react";
import {
  equipmentRequestsService,
  type EquipmentRequestFilters,
} from "../services/equipment-requests.service";
import type {
  EquipmentRequest,
  EquipmentRequestStatus,
  EquipmentRequestUrgency,
  EquipmentCategory,
} from "../types";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EquipmentRequestForm } from "../components/equipment-requests/EquipmentRequestForm";
import { EquipmentRequestDetailsModal } from "../components/equipment-requests/EquipmentRequestDetailsModal";
import { ReviewModal } from "../components/equipment-requests/ReviewModal";
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/Table";
import { useAuthStore } from "../store/auth.store";

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

const getUrgencyColor = (urgency: EquipmentRequestUrgency): string => {
  const colors: Record<EquipmentRequestUrgency, string> = {
    low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    normal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return colors[urgency] || "";
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
    new: "Новое",
    replacement: "Замена",
    upgrade: "Улучшение",
  };
  return labels[type] || type;
};

export const EquipmentRequestsPage = () => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingRequestId, setViewingRequestId] = useState<string | null>(null);
  const [reviewingRequest, setReviewingRequest] =
    useState<EquipmentRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<EquipmentRequestFilters>({});
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const isItSpecialist = user?.role === "it_specialist";
  const canReview = isAdmin || isItSpecialist;

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await equipmentRequestsService.getRequests(
        {
          ...filters,
          search: searchTerm || undefined,
        },
        page,
        pageSize,
      );
      if (result.error) {
        console.error("Ошибка загрузки заявок:", result.error);
        setError(result.error.message || "Ошибка при загрузке заявок");
      } else {
        setRequests(result.data);
        setTotalCount(result.count);
      }
    } catch (err) {
      console.error("Исключение при загрузке:", err);
      setError("Произошла ошибка при загрузке заявок");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.status, filters.urgency, filters.category, searchTerm]);

  const handleCreate = () => {
    setIsCreateModalOpen(true);
  };

  const handleView = (request: EquipmentRequest) => {
    setViewingRequestId(request.id);
  };

  const handleSubmit = async (data: any) => {
    const { error } = await equipmentRequestsService.createRequest(data);
    if (error) {
      alert("Ошибка при создании: " + error.message);
      return;
    }
    setIsCreateModalOpen(false);
    loadRequests();
  };

  const handleReview = (request: EquipmentRequest) => {
    setReviewingRequest(request);
  };

  const handleReviewSubmit = async (data: {
    status: "approved" | "rejected";
    comment?: string;
    estimated_cost?: number;
  }) => {
    if (!reviewingRequest) return;

    const { error } = await equipmentRequestsService.reviewRequest(
      reviewingRequest.id,
      data,
    );
    if (error) {
      alert("Ошибка при рассмотрении: " + error.message);
      return;
    }
    setReviewingRequest(null);
    loadRequests();
  };

  const handleCancel = async (request: EquipmentRequest) => {
    if (!confirm("Вы уверены, что хотите отменить заявку?")) return;

    const { error } = await equipmentRequestsService.cancelRequest(request.id);
    if (error) {
      alert("Ошибка при отмене: " + error.message);
      return;
    }
    loadRequests();
  };

  const handleDelete = async (request: EquipmentRequest) => {
    if (!confirm("Вы уверены, что хотите удалить заявку?")) return;

    const { error } = await equipmentRequestsService.deleteRequest(request.id);
    if (error) {
      alert("Ошибка при удалении: " + error.message);
      return;
    }
    loadRequests();
  };

  const handleStatusChange = async (
    requestId: string,
    newStatus: EquipmentRequestStatus,
  ) => {
    const { error } = await equipmentRequestsService.updateRequest(requestId, {
      status: newStatus,
    });
    if (error) {
      alert("Ошибка при изменении статуса: " + error.message);
    } else {
      loadRequests();
    }
  };

  const handleStatusFilter = (status: EquipmentRequestStatus | "all") => {
    setFilters((prev) => ({
      ...prev,
      status: status === "all" ? undefined : status,
    }));
    setPage(1);
  };

  const handleUrgencyFilter = (urgency: EquipmentRequestUrgency | "all") => {
    setFilters((prev) => ({
      ...prev,
      urgency: urgency === "all" ? undefined : urgency,
    }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Заявки на оборудование
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Всего: {totalCount} заявок
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-5 w-5 mr-2" />
          Создать заявку
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию или описанию..."
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
                handleStatusFilter(
                  e.target.value as EquipmentRequestStatus | "all",
                )
              }
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Все статусы</option>
              <option value="pending">На рассмотрении</option>
              <option value="approved">Одобрена</option>
              <option value="rejected">Отклонена</option>
              <option value="ordered">Заказано</option>
              <option value="received">Получено</option>
              <option value="issued">Выдано</option>
              <option value="cancelled">Отменена</option>
            </select>
            <select
              value={filters.urgency || "all"}
              onChange={(e) =>
                handleUrgencyFilter(
                  e.target.value as EquipmentRequestUrgency | "all",
                )
              }
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Все срочности</option>
              <option value="low">Низкая</option>
              <option value="normal">Обычная</option>
              <option value="high">Высокая</option>
              <option value="critical">Критическая</option>
            </select>
          </div>
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
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Заявки не найдены
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableHeaderCell>Название</TableHeaderCell>
              <TableHeaderCell>Категория</TableHeaderCell>
              <TableHeaderCell>Тип</TableHeaderCell>
              <TableHeaderCell>Срочность</TableHeaderCell>
              <TableHeaderCell>Статус</TableHeaderCell>
              <TableHeaderCell>Заявитель</TableHeaderCell>
              <TableHeaderCell>Стоимость</TableHeaderCell>
              <TableHeaderCell>Создана</TableHeaderCell>
              <TableHeaderCell>Действия</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="max-w-xs">
                    <div
                      className="cursor-pointer group"
                      onClick={() => handleView(request)}
                    >
                      <div className="font-medium truncate text-primary-600 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300 group-hover:underline">
                        {request.title}
                      </div>
                      {request.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                          {request.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getCategoryLabel(request.equipment_category)}
                  </TableCell>
                  <TableCell>
                    {getRequestTypeLabel(request.request_type)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getUrgencyColor(request.urgency)}`}
                    >
                      {getUrgencyLabel(request.urgency)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canReview &&
                    ["approved", "ordered", "received"].includes(
                      request.status,
                    ) ? (
                      <select
                        value={request.status}
                        onChange={(e) =>
                          handleStatusChange(
                            request.id,
                            e.target.value as EquipmentRequestStatus,
                          )
                        }
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-primary-500 ${getStatusColor(request.status)} cursor-pointer`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="approved">Одобрена</option>
                        <option value="ordered">Заказано</option>
                        <option value="received">Получено</option>
                        <option value="issued">Выдано</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}
                      >
                        {getStatusLabel(request.status)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {request.requester_name}
                      </div>
                      {request.requester_department && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {request.requester_department}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {request.estimated_cost
                      ? `${request.estimated_cost.toLocaleString("ru-RU")} ₽`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {new Date(request.created_at).toLocaleDateString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(request);
                        }}
                        className="p-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        title="Просмотр"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {/* Действия для IT/Admin */}
                      {canReview && request.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(request);
                            }}
                            className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                            title="Рассмотреть"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {/* Отмена для автора (только pending) */}
                      {request.requester_id === user?.id &&
                        request.status === "pending" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel(request);
                            }}
                            className="p-1 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                            title="Отменить"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}

                      {/* Удаление для админа */}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(request);
                          }}
                          className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
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

      {/* Модальное окно создания заявки */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Создание заявки на оборудование"
        size="lg"
        confirmClose
        confirmMessage="Вы уверены, что хотите закрыть окно? Несохранённые данные будут потеряны."
      >
        <EquipmentRequestForm
          onSubmit={handleSubmit}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Модальное окно просмотра заявки */}
      {viewingRequestId && (
        <EquipmentRequestDetailsModal
          requestId={viewingRequestId}
          isOpen={!!viewingRequestId}
          onClose={() => setViewingRequestId(null)}
        />
      )}

      {/* Модальное окно рассмотрения заявки */}
      {reviewingRequest && (
        <ReviewModal
          request={reviewingRequest}
          isOpen={!!reviewingRequest}
          onClose={() => setReviewingRequest(null)}
          onSubmit={handleReviewSubmit}
        />
      )}
    </div>
  );
};
