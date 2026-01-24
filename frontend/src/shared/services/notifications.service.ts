import { apiGet, apiPatch, apiDelete } from '../api/client'

export type Notification = {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  related_type?: string
  related_id?: string
  is_read: boolean
  created_at: string
}

export type NotificationListResponse = {
  data: Notification[]
  unread_count: number
  total: number
}

export type UnreadCountResponse = {
  count: number
}

export const notificationsService = {
  async getNotifications(
    unreadOnly = false,
    limit = 50,
    offset = 0
  ): Promise<{ data: Notification[]; unread_count: number; error: Error | null }> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })

      if (unreadOnly) {
        params.append('unread_only', 'true')
      }

      const data = await apiGet<NotificationListResponse>(`/it/notifications/?${params}`)

      return {
        data: data.data,
        unread_count: data.unread_count,
        error: null,
      }
    } catch (error) {
      return {
        data: [],
        unread_count: 0,
        error: error as Error,
      }
    }
  },

  async getUnreadCount(): Promise<{ count: number; error: Error | null }> {
    try {
      const data = await apiGet<UnreadCountResponse>('/it/notifications/unread-count')
      return { count: data.count, error: null }
    } catch (error) {
      return { count: 0, error: error as Error }
    }
  },

  async markAsRead(id: string): Promise<{ data: Notification | null; error: Error | null }> {
    try {
      const data = await apiPatch<Notification>(`/it/notifications/${id}/read`, {})
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  },

  async markAllAsRead(): Promise<{ error: Error | null }> {
    try {
      await apiPatch('/it/notifications/read-all', {})
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  },

  async deleteNotification(id: string): Promise<{ error: Error | null }> {
    try {
      await apiDelete(`/it/notifications/${id}`)
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  },

  async clearAll(): Promise<{ error: Error | null }> {
    try {
      await apiDelete('/it/notifications/clear-all')
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  },
}
