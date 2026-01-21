import { post, get, setAuthToken, removeAuthToken } from "../lib/api";
import type { User } from "../types";

export interface AuthResponse {
  user: User | null;
  error: Error | null;
}

export const authService = {
  // Регистрация
  async signUp(
    email: string,
    password: string,
    fullName: string,
  ): Promise<AuthResponse> {
    const { data, error } = await post<{ user: User; token: string }>(
      "/auth/signup",
      {
        email,
        password,
        fullName,
      },
    );

    if (error || !data) {
      return { user: null, error: error || new Error("Ошибка регистрации") };
    }

    // Сохраняем токен
    setAuthToken(data.token);

    return { user: data.user, error: null };
  },

  // Вход
  async signIn(
    email: string,
    password: string,
  ): Promise<AuthResponse & { requiresPassword?: boolean }> {
    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3001/api";
      const token = localStorage.getItem("auth_token");

      const response = await fetch(`${API_URL}/auth/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email, password }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Проверяем, требуется ли установка пароля
        if (responseData.requiresPassword) {
          return {
            user: null,
            error: new Error(responseData.error || "Пароль не установлен"),
            requiresPassword: true,
          };
        }
        return {
          user: null,
          error: new Error(responseData.error || "Ошибка входа"),
        };
      }

      // Сохраняем токен
      setAuthToken(responseData.token);

      return { user: responseData.user, error: null };
    } catch (error) {
      return {
        user: null,
        error: error instanceof Error ? error : new Error("Ошибка входа"),
      };
    }
  },

  // Установить пароль при первом входе
  async setPassword(email: string, password: string): Promise<AuthResponse> {
    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3001/api";

      const response = await fetch(`${API_URL}/auth/set-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return {
          user: null,
          error: new Error(responseData.error || "Ошибка установки пароля"),
        };
      }

      // Сохраняем токен
      setAuthToken(responseData.token);

      return { user: responseData.user, error: null };
    } catch (error) {
      return {
        user: null,
        error:
          error instanceof Error ? error : new Error("Ошибка установки пароля"),
      };
    }
  },

  // Выход
  async signOut() {
    await post("/auth/signout");
    removeAuthToken();
    return { error: null };
  },

  // Получить текущего пользователя
  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await get<{ user: User }>("/auth/me");

    if (error || !data) {
      return null;
    }

    return data.user;
  },

  // Получить сессию (для совместимости)
  async getSession() {
    const user = await this.getCurrentUser();
    return user ? { user } : null;
  },

  // Слушать изменения аутентификации (упрощенная версия)
  onAuthStateChange(callback: (user: User | null) => void) {
    // Проверяем токен при загрузке
    this.getCurrentUser().then(callback);

    // Слушаем изменения в localStorage (для синхронизации между вкладками)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth_token") {
        this.getCurrentUser().then(callback);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Возвращаем функцию для отписки
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            window.removeEventListener("storage", handleStorageChange);
          },
        },
      },
    };
  },

  // Смена пароля (для текущего пользователя)
  async updatePassword(currentPassword: string, newPassword: string) {
    const { data, error } = await post<{ message: string }>(
      "/auth/update-password",
      {
        currentPassword,
        newPassword,
      },
    );

    if (error) {
      return { error };
    }

    return { data, error: null };
  },

  // Сброс пароля администратором (для любого пользователя)
  async resetPassword(userId: string, newPassword: string) {
    const { data, error } = await post<{ message: string }>(
      "/auth/reset-password",
      {
        userId,
        newPassword,
      },
    );

    if (error) {
      return { error };
    }

    return { data, error: null };
  },
};
