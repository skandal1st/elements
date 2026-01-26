/**
 * API-клиент для Elements Platform.
 * Base: /api/v1. Authorization: Bearer <token> из auth.store / localStorage.
 */

import { useAuthStore } from '../store/auth.store'

const API_BASE = '/api/v1'

function getToken(): string | null {
  return localStorage.getItem('token')
}

export interface ApiError {
  detail: string | string[] | Record<string, unknown>
}

/**
 * Обрабатывает 401 ошибку — выполняет logout и перенаправляет на логин
 */
function handleUnauthorized(): void {
  console.log('Сессия истекла, выполняется выход')
  localStorage.removeItem('token')
  // Используем store напрямую для logout
  useAuthStore.getState().logout()
}

async function handleResponse<T>(response: Response): Promise<T> {
  // Обрабатываем 401 — не авторизован
  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Сессия истекла. Пожалуйста, войдите снова.')
  }

  const text = await response.text()
  if (!response.ok) {
    let detail = text
    try {
      const json = JSON.parse(text) as ApiError
      detail = typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail)
    } catch {
      /* use text as-is */
    }
    throw new Error(detail || `Ошибка ${response.status}`)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  
  // Проверяем наличие токена перед запросом
  if (!token && !path.includes('/auth/')) {
    handleUnauthorized()
    throw new Error('Требуется авторизация')
  }
  
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  return handleResponse<T>(response)
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' })
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export async function apiDelete(path: string): Promise<void> {
  return apiFetch<void>(path, { method: 'DELETE' })
}
