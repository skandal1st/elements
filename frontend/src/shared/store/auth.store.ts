import { create } from "zustand";

interface User {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  roles: Record<string, string>;
  is_superuser: boolean;
  is_active: boolean;
  modules: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  checkTokenExpiry: () => boolean;
}

/**
 * Проверяет, истёк ли токен JWT
 */
function decodeJwtPayload(token: string): any | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    // JWT uses base64url, not base64
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  if (!payload.exp) return false;
  const expiryTime = payload.exp * 1000;
  // Буфер 10 сек — избегаем ложного «истёк» при небольшом рассинхроне часов
  return Date.now() >= expiryTime - 10000;
}

/**
 * Извлекает данные пользователя из токена
 */
function getUserFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    id: payload.sub || payload.user_id || "",
    email: payload.email || "",
    full_name: payload.full_name || "",
    role: payload.role,
    roles: payload.roles || {},
    is_superuser: payload.is_superuser || false,
    is_active: payload.is_active !== false,
    modules: payload.modules || [],
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const d = err.detail;
        const msg =
          Array.isArray(d) && d[0]?.msg
            ? d[0].msg
            : typeof d === "string"
              ? d
              : "Ошибка входа";
        throw new Error(msg);
      }

      const data = await response.json();

      localStorage.setItem("token", data.access_token);

      // Получаем данные пользователя из токена или ответа
      const user = data.user || getUserFromToken(data.access_token);

      set({
        token: data.access_token,
        user,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error("Ошибка входа:", error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    // Перенаправляем на страницу логина
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  },

  loadFromStorage: () => {
    const token = localStorage.getItem("token");
    if (token) {
      // Проверяем срок действия токена
      if (isTokenExpired(token)) {
        console.log("Токен истёк, выполняется выход");
        get().logout();
        return;
      }

      try {
        const user = getUserFromToken(token);
        set({
          token,
          user,
          isAuthenticated: true,
        });
      } catch (e) {
        // Если токен невалиден, очищаем
        get().logout();
      }
    } else {
      set({
        token: null,
        user: null,
        isAuthenticated: false,
      });
    }
  },

  checkTokenExpiry: () => {
    const { token, logout } = get();
    if (token && isTokenExpired(token)) {
      logout();
      return false;
    }
    return true;
  },

  setUser: (user: User) => {
    set({ user, isAuthenticated: true });
  },

  setToken: (token: string) => {
    localStorage.setItem("token", token);
    const user = getUserFromToken(token);
    set({ token, user, isAuthenticated: true });
  },
}));
