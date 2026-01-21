import { get, post, put } from '../lib/api';

export interface TelegramStatus {
  linked: boolean;
  telegram_id: string | null;
  telegram_username: string | null;
  linked_at: string | null;
  notifications_enabled: boolean;
}

export interface LinkCodeResponse {
  code: string;
  expires_at: string;
  instructions: string;
  bot_username: string | null;
}

export interface BotInfo {
  bot_username: string | null;
  bot_enabled: boolean;
  bot_configured: boolean;
}

export const telegramService = {
  // Получить информацию о боте
  async getBotInfo(): Promise<{ data: BotInfo | null; error: Error | null }> {
    try {
      const { data, error } = await get<BotInfo>('/telegram/bot-info');

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка получения информации о боте') };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Получить статус привязки Telegram
  async getStatus(): Promise<{ data: TelegramStatus | null; error: Error | null }> {
    try {
      const { data, error } = await get<TelegramStatus>('/telegram/status');

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка получения статуса') };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Генерация кода привязки
  async generateLinkCode(): Promise<{ data: LinkCodeResponse | null; error: Error | null }> {
    try {
      const { data, error } = await post<LinkCodeResponse>('/telegram/generate-link-code', {});

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка генерации кода') };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Отвязка Telegram
  async unlink(): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await post<{ success: boolean }>('/telegram/unlink', {});

      if (error) {
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  },

  // Обновление настроек уведомлений
  async updateSettings(notifications_enabled: boolean): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await put<{ success: boolean; notifications_enabled: boolean }>(
        '/telegram/settings',
        { notifications_enabled }
      );

      if (error) {
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  },
};
