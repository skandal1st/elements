import { get, put, post, del } from '../lib/api';
import type { User } from '../types';

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  role?: 'admin' | 'it_specialist' | 'employee';
  department?: string;
  position?: string;
  phone?: string;
}

export const usersService = {
  // Получить список пользователей
  async getUsers(): Promise<{ data: User[]; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: User[] }>('/users');

      if (error || !data) {
        return { data: [], error: error || new Error('Ошибка загрузки пользователей') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  },

  // Получить пользователя по ID
  async getUserById(id: string): Promise<{ data: User | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: User }>(`/users/${id}`);

      if (error || !data) {
        return { data: null, error: error || new Error('Пользователь не найден') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Создать пользователя
  async createUser(userData: CreateUserData): Promise<{ data: User | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: User }>('/users', userData);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка создания пользователя') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить пользователя
  async updateUser(id: string, updates: Partial<User>): Promise<{ data: User | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: User }>(`/users/${id}`, updates);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка обновления пользователя') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Удалить пользователя
  async deleteUser(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/users/${id}`);

      if (error) {
        return { error: error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};

