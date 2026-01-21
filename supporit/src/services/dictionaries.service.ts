import { get, post, put, del } from '../lib/api';
import type { Dictionary, DictionaryType } from '../types';

export interface CreateDictionaryData {
  dictionary_type: DictionaryType;
  key: string;
  label: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface UpdateDictionaryData {
  label?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

export const dictionariesService = {
  // Получить список справочников (опционально по типу)
  async getDictionaries(
    type?: DictionaryType
  ): Promise<{ data: Dictionary[]; error: Error | null }> {
    try {
      const endpoint = type ? `/dictionaries?type=${type}` : '/dictionaries';
      const { data, error } = await get<{ data: Dictionary[] }>(endpoint);

      if (error || !data) {
        return { data: [], error: error || new Error('Ошибка загрузки справочников') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  },

  // Получить конкретный элемент справочника
  async getDictionary(
    type: DictionaryType,
    key: string
  ): Promise<{ data: Dictionary | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: Dictionary }>(`/dictionaries/${type}/${key}`);

      if (error || !data) {
        return { data: null, error: error || new Error('Элемент справочника не найден') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Создать элемент справочника
  async createDictionary(
    dictionaryData: CreateDictionaryData
  ): Promise<{ data: Dictionary | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: Dictionary }>('/dictionaries', dictionaryData);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка создания элемента') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить элемент справочника
  async updateDictionary(
    id: string,
    updates: UpdateDictionaryData
  ): Promise<{ data: Dictionary | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: Dictionary }>(`/dictionaries/${id}`, updates);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка обновления элемента') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Удалить элемент справочника
  async deleteDictionary(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/dictionaries/${id}`);

      if (error) {
        return { error: error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
