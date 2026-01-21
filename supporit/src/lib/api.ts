const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Получить токен из localStorage
const getToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Базовый запрос
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Если токен невалиден (401), автоматически очищаем его
      if (response.status === 401) {
        removeAuthToken();
        // Перенаправляем на страницу логина только если не находимся на ней
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }

      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Если не удалось распарсить JSON, используем текст ответа
        const text = await response.text().catch(() => '');
        errorMessage = text || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('API Error:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Неизвестная ошибка'),
    };
  }
}

// GET запрос
export async function get<T>(endpoint: string): Promise<{ data: T | null; error: Error | null }> {
  return request<T>(endpoint, { method: 'GET' });
}

// POST запрос
export async function post<T>(
  endpoint: string,
  body?: any
): Promise<{ data: T | null; error: Error | null }> {
  return request<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// PUT запрос
export async function put<T>(
  endpoint: string,
  body?: any
): Promise<{ data: T | null; error: Error | null }> {
  return request<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// DELETE запрос
export async function del<T>(endpoint: string): Promise<{ data: T | null; error: Error | null }> {
  return request<T>(endpoint, { method: 'DELETE' });
}

// Сохранить токен
export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

// Удалить токен
export const removeAuthToken = () => {
  localStorage.removeItem('auth_token');
};



