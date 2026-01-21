import { get, post, put, del } from '../lib/api';
import type { SoftwareLicense } from '../types';

export interface LicenseFilters {
  search?: string;
  expired?: boolean;
}

export const licensesService = {
  // Получить список лицензий
  async getLicenses(
    filters?: LicenseFilters,
    page = 1,
    pageSize = 50
  ): Promise<{ data: SoftwareLicense[]; count: number; error: Error | null }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filters?.search) {
        params.append('search', filters.search);
      }

      if (filters?.expired !== undefined) {
        params.append('expired', filters.expired.toString());
      }

      const { data, error } = await get<{ data: SoftwareLicense[]; count: number }>(
        `/licenses?${params}`
      );

      if (error || !data) {
        return {
          data: [],
          count: 0,
          error: error || new Error('Ошибка загрузки лицензий'),
        };
      }

      return { data: data.data, count: data.count, error: null };
    } catch (error) {
      return { data: [], count: 0, error: error as Error };
    }
  },

  // Получить лицензию по ID
  async getLicenseById(
    id: string
  ): Promise<{ data: SoftwareLicense | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: SoftwareLicense }>(
        `/licenses/${id}`
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error('Ошибка загрузки лицензии'),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Создать лицензию
  async createLicense(
    license: Omit<SoftwareLicense, 'id' | 'created_at' | 'updated_at' | 'used_licenses' | 'available_licenses'>
  ): Promise<{ data: SoftwareLicense | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: SoftwareLicense }>(
        '/licenses',
        license
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error('Ошибка создания лицензии'),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить лицензию
  async updateLicense(
    id: string,
    updates: Partial<SoftwareLicense>
  ): Promise<{ data: SoftwareLicense | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: SoftwareLicense }>(
        `/licenses/${id}`,
        updates
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error('Ошибка обновления лицензии'),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Удалить лицензию
  async deleteLicense(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/licenses/${id}`);

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  // Назначить лицензию
  async assignLicense(
    licenseId: string,
    data: { user_id?: string; equipment_id?: string }
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await post(`/licenses/${licenseId}/assign`, data);

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  // Освободить лицензию
  async releaseLicense(
    licenseId: string,
    assignmentId: string
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await post(
        `/licenses/${licenseId}/release/${assignmentId}`,
        {}
      );

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
