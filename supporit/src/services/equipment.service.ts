import { get, post, put, del } from "../lib/api";
import type { Equipment, EquipmentStatus, EquipmentCategory } from "../types";

export interface EquipmentFilters {
  status?: EquipmentStatus;
  category?: EquipmentCategory;
  search?: string;
  owner_id?: string;
  department?: string;
  room?: string;
}

export interface EquipmentListResponse {
  data: Equipment[];
  count: number;
  error: Error | null;
}

export const equipmentService = {
  // Получить список оборудования с фильтрами
  async getEquipment(
    filters?: EquipmentFilters,
    page = 1,
    pageSize = 20,
  ): Promise<EquipmentListResponse> {
    try {
      const params = new URLSearchParams();

      if (filters?.status) params.append("status", filters.status);
      if (filters?.category) params.append("category", filters.category);
      if (filters?.owner_id) params.append("owner_id", filters.owner_id);
      if (filters?.department) params.append("department", filters.department);
      if (filters?.room) params.append("room", filters.room);
      if (filters?.search) params.append("search", filters.search);
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());

      const { data, error } = await get<{ data: Equipment[]; count: number }>(
        `/equipment?${params.toString()}`,
      );

      if (error || !data) {
        return {
          data: [],
          count: 0,
          error: error || new Error("Ошибка загрузки оборудования"),
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

  // Получить одно оборудование по ID
  async getEquipmentById(
    id: string,
  ): Promise<{ data: Equipment | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: Equipment }>(
        `/equipment/${id}`,
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Оборудование не найдено"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Создать оборудование
  async createEquipment(
    equipment: Omit<Equipment, "id" | "created_at" | "updated_at" | "qr_code">,
  ): Promise<{ data: Equipment | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: Equipment }>(
        "/equipment",
        equipment,
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка создания оборудования"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить оборудование
  async updateEquipment(
    id: string,
    updates: Partial<Equipment>,
  ): Promise<{ data: Equipment | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: Equipment }>(
        `/equipment/${id}`,
        updates,
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка обновления оборудования"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Удалить оборудование
  async deleteEquipment(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/equipment/${id}`);
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },

  // Получить историю перемещений оборудования
  async getEquipmentHistory(
    equipmentId: string,
  ): Promise<{ data: any[]; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: any[] }>(
        `/equipment/${equipmentId}/history`,
      );

      if (error || !data) {
        return {
          data: [],
          error: error || new Error("Ошибка загрузки истории"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  },

  // Изменить владельца оборудования
  async changeOwner(
    equipmentId: string,
    newOwnerId: string | null,
    newLocation: string | null,
    reason?: string,
  ): Promise<{ data: Equipment | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: Equipment }>(
        `/equipment/${equipmentId}/change-owner`,
        {
          newOwnerId,
          newLocation,
          reason,
        },
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка изменения владельца"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Получить оборудование по местоположению
  async getEquipmentByLocation(
    department?: string,
    room?: string,
  ): Promise<{ data: Equipment[]; error: Error | null }> {
    try {
      const params = new URLSearchParams();
      if (department && department.trim())
        params.append("department", department.trim());
      if (room && room.trim()) params.append("room", room.trim());

      const endpoint = `/equipment/by-location${params.toString() ? "?" + params.toString() : ""}`;
      console.log("Запрос оборудования:", endpoint);

      const { data, error } = await get<{ data: Equipment[] }>(endpoint);

      if (error) {
        console.error("Ошибка API:", error);
        return { data: [], error };
      }

      if (!data || !data.data) {
        console.warn("Нет данных в ответе:", data);
        return { data: [], error: new Error("Нет данных в ответе сервера") };
      }

      return { data: data.data, error: null };
    } catch (error) {
      console.error("Исключение при загрузке оборудования:", error);
      return { data: [], error: error as Error };
    }
  },

  // Получить расходные материалы для оборудования
  async getEquipmentConsumables(
    equipmentId: string,
  ): Promise<{ data: any[]; error: Error | null }> {
    try {
      console.log("Запрос расходников для оборудования:", equipmentId);
      const { data, error } = await get<{ data: any[] }>(
        `/equipment/${equipmentId}/consumables`,
      );

      console.log("Ответ API расходников:", { data, error });

      if (error) {
        console.error("Ошибка API при загрузке расходников:", error);
        return { data: [], error: error };
      }

      if (!data) {
        console.warn("Нет данных в ответе API расходников");
        return { data: [], error: new Error("Нет данных в ответе сервера") };
      }

      console.log(
        "Успешно загружено расходников:",
        data.data?.length || 0,
        data.data,
      );
      return { data: data.data || [], error: null };
    } catch (error) {
      console.error("Исключение при загрузке расходников:", error);
      return { data: [], error: error as Error };
    }
  },

  // Связать расходник с оборудованием
  async linkConsumableToEquipment(
    equipmentId: string,
    consumableId: string,
    quantityPerUnit: number = 1,
  ): Promise<{ data: any | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: any }>(
        `/equipment/${equipmentId}/consumables`,
        {
          consumable_id: consumableId,
          quantity_per_unit: quantityPerUnit,
        },
      );

      if (error || !data) {
        return {
          data: null,
          error:
            error || new Error("Ошибка связывания расходника с оборудованием"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Получить QR-код оборудования
  async getQRCode(
    equipmentId: string,
  ): Promise<{ data: { dataUrl: string } | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: { dataUrl: string } }>(
        `/equipment/${equipmentId}/qr-code?format=dataurl`,
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка генерации QR-кода"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Получить оборудование текущего пользователя
  async getMyEquipment(): Promise<{ data: Equipment[]; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: Equipment[] }>("/equipment/my");

      if (error) {
        return { data: [], error };
      }

      return { data: data?.data || [], error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  },
};
