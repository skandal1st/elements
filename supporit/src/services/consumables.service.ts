import { get, post, put, del } from '../lib/api';
import type { Consumable, ConsumableIssue } from '../types';

export const consumablesService = {
  // Получить список расходников
  async getConsumables(params?: {
    search?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: Consumable[]; count: number; error: Error | null }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append('search', params.search);
      if (params?.category) queryParams.append('category', params.category);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());

      const { data, error } = await get<{ data: Consumable[]; count: number }>(
        `/consumables${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      );

      if (error || !data) {
        return { data: [], count: 0, error: error || new Error('Ошибка загрузки расходников') };
      }

      return { data: data.data, count: data.count, error: null };
    } catch (error) {
      return { data: [], count: 0, error: error as Error };
    }
  },

  // Получить расходник по ID
  async getConsumableById(id: string): Promise<{ data: Consumable | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: Consumable }>(`/consumables/${id}`);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка загрузки расходника') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Создать расходник
  async createConsumable(consumable: Partial<Consumable>): Promise<{ data: Consumable | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: Consumable }>('/consumables', consumable);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка создания расходника') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить расходник
  async updateConsumable(id: string, updates: Partial<Consumable>): Promise<{ data: Consumable | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: Consumable }>(`/consumables/${id}`, updates);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка обновления расходника') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Удалить расходник
  async deleteConsumable(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/consumables/${id}`);

      if (error) {
        return { error: error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  // Получить историю выдачи расходников
  async getConsumableIssues(params?: {
    consumable_id?: string;
    issued_to_id?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: ConsumableIssue[]; count: number; error: Error | null }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.consumable_id) queryParams.append('consumable_id', params.consumable_id);
      if (params?.issued_to_id) queryParams.append('issued_to_id', params.issued_to_id);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());

      const { data, error } = await get<{ data: ConsumableIssue[]; count: number }>(
        `/consumables/issues${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      );

      if (error || !data) {
        return { data: [], count: 0, error: error || new Error('Ошибка загрузки истории выдачи') };
      }

      return { data: data.data, count: data.count, error: null };
    } catch (error) {
      return { data: [], count: 0, error: error as Error };
    }
  },
};

