import { get, put, del } from '../lib/api';
import type { Notification } from '../types';

export const notificationsService = {
  // Получить список уведомлений
  async getNotifications(
    unreadOnly = false,
    limit = 50,
    offset = 0
  ): Promise<{
    data: Notification[];
    unread_count: number;
    error: Error | null;
  }> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (unreadOnly) {
        params.append('unread_only', 'true');
      }

      const { data, error } = await get<{
        data: Notification[];
        unread_count: number;
        total: number;
      }>(`/notifications?${params}`);

      if (error || !data) {
        return {
          data: [],
          unread_count: 0,
          error: error || new Error('Ошибка загрузки уведомлений'),
        };
      }

      return {
        data: data.data,
        unread_count: data.unread_count,
        error: null,
      };
    } catch (error) {
      return {
        data: [],
        unread_count: 0,
        error: error as Error,
      };
    }
  },

  // Получить количество непрочитанных уведомлений
  async getUnreadCount(): Promise<{ count: number; error: Error | null }> {
    try {
      const { data, error } = await get<{ count: number }>('/notifications/unread-count');

      if (error || !data) {
        return { count: 0, error: error || new Error('Ошибка получения счетчика') };
      }

      return { count: data.count, error: null };
    } catch (error) {
      return { count: 0, error: error as Error };
    }
  },

  // Отметить уведомление как прочитанное
  async markAsRead(id: string): Promise<{ data: Notification | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: Notification }>(`/notifications/${id}/read`, {});

      if (error || !data) {
        return {
          data: null,
          error: error || new Error('Ошибка обновления уведомления'),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Отметить все уведомления как прочитанные
  async markAllAsRead(): Promise<{ error: Error | null }> {
    try {
      const { error } = await put('/notifications/read-all', {});

      if (error) {
        return { error: error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  // Удалить уведомление
  async deleteNotification(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/notifications/${id}`);

      if (error) {
        return { error: error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  // Очистить все прочитанные уведомления
  async clearAll(): Promise<{ error: Error | null }> {
    try {
      const { error } = await del('/notifications/clear-all');

      if (error) {
        return { error: error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
