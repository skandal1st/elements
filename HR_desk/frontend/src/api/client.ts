const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Ошибка запроса");
  }
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<void> {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!response.ok) {
    throw new Error("Неверные данные для входа");
  }
  const data = await response.json();
  localStorage.setItem("token", data.access_token);
}
