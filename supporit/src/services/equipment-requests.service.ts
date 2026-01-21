import { get, post, put, del } from "../lib/api";
import type {
  EquipmentRequest,
  EquipmentRequestStatus,
  EquipmentRequestUrgency,
  EquipmentRequestType,
  EquipmentCategory,
} from "../types";

export interface EquipmentRequestFilters {
  status?: EquipmentRequestStatus;
  urgency?: EquipmentRequestUrgency;
  category?: EquipmentCategory;
  request_type?: EquipmentRequestType;
  requester_id?: string;
  search?: string;
}

export interface EquipmentRequestListResponse {
  data: EquipmentRequest[];
  count: number;
  error: Error | null;
}

export interface ProcurementListResponse {
  data: EquipmentRequest[];
  grouped: Record<string, EquipmentRequest[]>;
  totalCost: number;
  error: Error | null;
}

export interface CreateEquipmentRequestData {
  title: string;
  description?: string;
  equipment_category: EquipmentCategory;
  request_type?: EquipmentRequestType;
  quantity?: number;
  urgency?: EquipmentRequestUrgency;
  justification?: string;
  replace_equipment_id?: string;
  estimated_cost?: number;
}

export interface ReviewRequestData {
  status: "approved" | "rejected";
  comment?: string;
  estimated_cost?: number;
}

export const equipmentRequestsService = {
  // Получить список заявок с фильтрами
  async getRequests(
    filters?: EquipmentRequestFilters,
    page = 1,
    pageSize = 20,
  ): Promise<EquipmentRequestListResponse> {
    try {
      const params = new URLSearchParams();

      if (filters?.status) params.append("status", filters.status);
      if (filters?.urgency) params.append("urgency", filters.urgency);
      if (filters?.category) params.append("category", filters.category);
      if (filters?.request_type)
        params.append("request_type", filters.request_type);
      if (filters?.requester_id)
        params.append("requester_id", filters.requester_id);
      if (filters?.search) params.append("search", filters.search);
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());

      const { data, error } = await get<{
        data: EquipmentRequest[];
        count: number;
      }>(`/equipment-requests?${params.toString()}`);

      if (error || !data) {
        return {
          data: [],
          count: 0,
          error: error || new Error("Ошибка загрузки заявок"),
        };
      }

      return {
        data: data.data,
        count: data.count,
        error: null,
      };
    } catch (error) {
      return { data: [], count: 0, error: error as Error };
    }
  },

  // Получить список для закупок (одобренные заявки)
  async getProcurementList(): Promise<ProcurementListResponse> {
    try {
      const { data, error } = await get<{
        data: EquipmentRequest[];
        grouped: Record<string, EquipmentRequest[]>;
        totalCost: number;
      }>("/equipment-requests/procurement-list");

      if (error || !data) {
        return {
          data: [],
          grouped: {},
          totalCost: 0,
          error: error || new Error("Ошибка загрузки списка закупок"),
        };
      }

      return {
        data: data.data,
        grouped: data.grouped,
        totalCost: data.totalCost,
        error: null,
      };
    } catch (error) {
      return { data: [], grouped: {}, totalCost: 0, error: error as Error };
    }
  },

  // Получить заявку по ID
  async getRequestById(
    id: string,
  ): Promise<{ data: EquipmentRequest | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: EquipmentRequest }>(
        `/equipment-requests/${id}`,
      );

      if (error || !data) {
        return { data: null, error: error || new Error("Заявка не найдена") };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Создать заявку
  async createRequest(
    request: CreateEquipmentRequestData,
  ): Promise<{ data: EquipmentRequest | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: EquipmentRequest }>(
        "/equipment-requests",
        request,
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка создания заявки"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить заявку
  async updateRequest(
    id: string,
    updates: Partial<EquipmentRequest>,
  ): Promise<{ data: EquipmentRequest | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: EquipmentRequest }>(
        `/equipment-requests/${id}`,
        updates,
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка обновления заявки"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Одобрить/отклонить заявку
  async reviewRequest(
    id: string,
    reviewData: ReviewRequestData,
  ): Promise<{ data: EquipmentRequest | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: EquipmentRequest }>(
        `/equipment-requests/${id}/review`,
        reviewData,
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка рассмотрения заявки"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Отменить заявку
  async cancelRequest(
    id: string,
  ): Promise<{ data: EquipmentRequest | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: EquipmentRequest }>(
        `/equipment-requests/${id}/cancel`,
        {},
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка отмены заявки"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Удалить заявку
  async deleteRequest(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/equipment-requests/${id}`);
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
