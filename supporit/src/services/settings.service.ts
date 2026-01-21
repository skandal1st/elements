import { get, put, post, del } from "../lib/api";
import type { SystemSetting } from "../types";

export interface BrandingSettings {
  site_title: string;
  site_favicon: string;
}

export const settingsService = {
  // Получить список всех настроек
  async getSettings(): Promise<{ data: SystemSetting[]; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: SystemSetting[] }>("/settings");

      if (error || !data) {
        return {
          data: [],
          error: error || new Error("Ошибка загрузки настроек"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  },

  // Получить конкретную настройку по ключу
  async getSettingByKey(
    key: string,
  ): Promise<{ data: SystemSetting | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: SystemSetting }>(
        `/settings/${key}`,
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Настройка не найдена"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить настройку
  async updateSetting(
    key: string,
    value: string,
  ): Promise<{ data: SystemSetting | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: SystemSetting }>(
        `/settings/${key}`,
        { value },
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка обновления настройки"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Отправить тестовое email
  async sendTestEmail(to: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await post("/settings/test-email", { to });

      if (error) {
        return { error: error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  // Получить настройки брендинга (публичный endpoint)
  async getBranding(): Promise<{
    data: BrandingSettings;
    error: Error | null;
  }> {
    try {
      const { data, error } = await get<{ data: BrandingSettings }>(
        "/settings/branding",
      );

      if (error || !data) {
        return {
          data: { site_title: "SuppOrIT", site_favicon: "" },
          error: error || new Error("Ошибка загрузки настроек брендинга"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return {
        data: { site_title: "SuppOrIT", site_favicon: "" },
        error: error as Error,
      };
    }
  },

  // Загрузить favicon
  async uploadFavicon(
    file: File,
  ): Promise<{ data: { url: string } | null; error: Error | null }> {
    try {
      const formData = new FormData();
      formData.append("favicon", file);

      const token = localStorage.getItem("auth_token");
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:3001/api";

      const response = await fetch(`${apiUrl}/settings/upload-favicon`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: null,
          error: new Error(errorData.error || "Ошибка загрузки"),
        };
      }

      const result = await response.json();
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Удалить favicon
  async deleteFavicon(): Promise<{ error: Error | null }> {
    try {
      const { error } = await del("/settings/favicon");

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
