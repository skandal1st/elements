import { get, post } from "../lib/api";

// Интерфейс пользователя AD
export interface ADUser {
  dn: string;
  sAMAccountName: string;
  userPrincipalName: string;
  mail: string | null;
  displayName: string;
  givenName: string | null;
  sn: string | null;
  department: string | null;
  title: string | null;
  telephoneNumber: string | null;
  mobile: string | null;
  physicalDeliveryOfficeName: string | null;
  memberOf: string[];
  enabled: boolean;
  whenCreated: string | null;
  lastLogon: string | null;
  // Статус импорта
  imported?: boolean;
  localEmail?: string | null;
  localUserId?: string | null;
}

// Интерфейс группы AD
export interface ADGroup {
  dn: string;
  cn: string;
  description: string | null;
  member: string[];
}

export const adService = {
  // Проверить статус интеграции AD
  async getStatus(): Promise<{ enabled: boolean }> {
    const { data, error } = await get<{ enabled: boolean }>("/ad/status");
    if (error) throw error;
    return data!;
  },

  // Проверить подключение к AD
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const { data, error } = await get<{ success: boolean; message: string }>(
      "/ad/test"
    );
    if (error) throw error;
    return data!;
  },

  // Получить список пользователей из AD
  async getUsers(
    search?: string
  ): Promise<{ data: ADUser[]; count: number }> {
    const params = new URLSearchParams();
    if (search) params.append("search", search);

    const { data, error } = await get<{ data: ADUser[]; count: number }>(
      `/ad/users?${params.toString()}`
    );
    if (error) throw error;
    return data!;
  },

  // Получить пользователя AD по username
  async getUserByUsername(username: string): Promise<ADUser> {
    const { data, error } = await get<{ data: ADUser }>(
      `/ad/users/${encodeURIComponent(username)}`
    );
    if (error) throw error;
    return data!.data;
  },

  // Получить список групп из AD
  async getGroups(
    search?: string
  ): Promise<{ data: ADGroup[]; count: number }> {
    const params = new URLSearchParams();
    if (search) params.append("search", search);

    const { data, error } = await get<{ data: ADGroup[]; count: number }>(
      `/ad/groups?${params.toString()}`
    );
    if (error) throw error;
    return data!;
  },

  // Импортировать одного пользователя
  async importUser(
    username: string,
    role: string = "employee"
  ): Promise<{ message: string; data: any }> {
    const { data, error } = await post<{ message: string; data: any }>(
      "/ad/import",
      { username, role }
    );
    if (error) throw error;
    return data!;
  },

  // Массовый импорт пользователей
  async importBulk(
    usernames: string[],
    role: string = "employee"
  ): Promise<{
    message: string;
    data: {
      success: string[];
      failed: { username: string; error: string }[];
    };
  }> {
    const { data, error } = await post<{
      message: string;
      data: {
        success: string[];
        failed: { username: string; error: string }[];
      };
    }>("/ad/import-bulk", { usernames, role });
    if (error) throw error;
    return data!;
  },

  // Синхронизировать данные пользователя с AD
  async syncUser(userId: string): Promise<{ message: string; data: any }> {
    const { data, error } = await post<{ message: string; data: any }>(
      `/ad/sync/${userId}`,
      {}
    );
    if (error) throw error;
    return data!;
  },
};
