import { get, post, put, del } from "../lib/api";
import type {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "../types";

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  location_department?: string;
  location_room?: string;
  search?: string;
  excludeStatuses?: TicketStatus[];
}

export interface TicketListResponse {
  data: Ticket[];
  count: number;
  error: Error | null;
}

export const ticketsService = {
  // Получить список заявок с фильтрами
  async getTickets(
    filters?: TicketFilters,
    page = 1,
    pageSize = 20,
  ): Promise<TicketListResponse> {
    try {
      const params = new URLSearchParams();

      if (filters?.status) params.append("status", filters.status);
      if (filters?.priority) params.append("priority", filters.priority);
      if (filters?.category) params.append("category", filters.category);
      if (filters?.location_department)
        params.append("location_department", filters.location_department);
      if (filters?.location_room)
        params.append("location_room", filters.location_room);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.excludeStatuses && filters.excludeStatuses.length > 0) {
        params.append("excludeStatuses", filters.excludeStatuses.join(","));
      }
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());

      const { data, error } = await get<{ data: Ticket[]; count: number }>(
        `/tickets?${params.toString()}`,
      );

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

  // Получить заявку по ID
  async getTicketById(
    id: string,
  ): Promise<{ data: Ticket | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: Ticket }>(`/tickets/${id}`);

      if (error || !data) {
        return { data: null, error: error || new Error("Заявка не найдена") };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Создать заявку
  async createTicket(
    ticket: Omit<
      Ticket,
      | "id"
      | "created_at"
      | "updated_at"
      | "creator"
      | "assignee"
      | "equipment"
      | "consumables"
    >,
  ): Promise<{ data: Ticket | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: Ticket }>("/tickets", ticket);

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
  async updateTicket(
    id: string,
    updates: Partial<Ticket>,
  ): Promise<{ data: Ticket | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: Ticket }>(
        `/tickets/${id}`,
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

  // Удалить заявку
  async deleteTicket(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/tickets/${id}`);
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
