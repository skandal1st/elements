/**
 * Update Service (Frontend)
 * API клиент для системы обновлений
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Типы
export interface SystemInfo {
  currentVersion: string;
  installedAt: string;
  lastUpdateAt: string | null;
  lastUpdateCheck: string | null;
  instanceId: string;
}

export interface LicenseInfo {
  licenseKey: string | null;
  tier: 'BASIC' | 'PRO' | 'ENTERPRISE' | null;
  validUntil: string | null;
  features: string[];
  isValid: boolean;
  instanceId: string;
}

export interface UpdateInfo {
  system: SystemInfo;
  license: LicenseInfo;
}

export interface AvailableUpdate {
  version: string;
  releaseDate: string;
  changelog: string;
  downloadUrl: string;
  checksum: string;
  breaking: boolean;
  requiresRestart: boolean;
}

export interface CheckUpdateResult {
  available: boolean;
  update?: AvailableUpdate;
  licenseAllowed?: boolean;
  licenseMessage?: string;
  message?: string;
}

export interface UpdateProgress {
  status: 'started' | 'downloading' | 'backing_up' | 'migrating' | 'deploying' | 'completed' | 'failed' | 'rolled_back';
  progress: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface UpdateHistoryItem {
  id: string;
  fromVersion: string;
  toVersion: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  performedBy: string | null;
  backupPath: string | null;
  errorMessage: string | null;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Хелпер для запросов
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      return { error: json.error || `Ошибка ${response.status}` };
    }

    return { data: json.data };
  } catch (error) {
    console.error('[Update Service] Request error:', error);
    return { error: 'Ошибка сети' };
  }
}

/**
 * Сервис обновлений
 */
export const updateService = {
  /**
   * Получить информацию о системе и лицензии
   */
  async getInfo(): Promise<ApiResponse<UpdateInfo>> {
    return request<UpdateInfo>('/updates/info');
  },

  /**
   * Проверить наличие обновлений
   */
  async checkForUpdates(): Promise<ApiResponse<CheckUpdateResult>> {
    return request<CheckUpdateResult>('/updates/check');
  },

  /**
   * Начать обновление
   */
  async startUpdate(
    version: string,
    downloadUrl: string
  ): Promise<ApiResponse<{ updateId: string; message: string }>> {
    return request('/updates/start', {
      method: 'POST',
      body: JSON.stringify({ version, downloadUrl }),
    });
  },

  /**
   * Получить статус обновления
   */
  async getUpdateStatus(updateId: string): Promise<ApiResponse<UpdateProgress>> {
    return request<UpdateProgress>(`/updates/status/${updateId}`);
  },

  /**
   * Откатить обновление
   */
  async rollbackUpdate(
    updateId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return request(`/updates/rollback/${updateId}`, {
      method: 'POST',
    });
  },

  /**
   * Получить историю обновлений
   */
  async getHistory(limit = 20): Promise<ApiResponse<UpdateHistoryItem[]>> {
    return request<UpdateHistoryItem[]>(`/updates/history?limit=${limit}`);
  },

  /**
   * Получить информацию о лицензии
   */
  async getLicense(): Promise<ApiResponse<LicenseInfo>> {
    return request<LicenseInfo>('/updates/license');
  },

  /**
   * Сохранить лицензионный ключ
   */
  async saveLicense(licenseKey: string): Promise<
    ApiResponse<{
      success: boolean;
      message: string;
      license: {
        tier: string;
        expiresAt: string | null;
        features: string[];
      };
    }>
  > {
    return request('/updates/license', {
      method: 'POST',
      body: JSON.stringify({ licenseKey }),
    });
  },
};

export default updateService;
