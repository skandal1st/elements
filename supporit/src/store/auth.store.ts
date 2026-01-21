import { create } from 'zustand';
import type { User } from '../types';
import { authService } from '../services/auth.service';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; requiresPassword?: boolean }>;
  setPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  
  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    set({ loading: true });
    try {
      const user = await authService.getCurrentUser();
      set({ user, loading: false, initialized: true });

      // Подписываемся на изменения аутентификации
      authService.onAuthStateChange((user) => {
        set({ user });
      });
    } catch (error) {
      set({ user: null, loading: false, initialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    const { user, error, requiresPassword } = await authService.signIn(email, password);
    set({ user, loading: false });
    return { error, requiresPassword };
  },

  setPassword: async (email: string, password: string) => {
    set({ loading: true });
    const { user, error } = await authService.setPassword(email, password);
    set({ user, loading: false });
    return { error };
  },

  signUp: async (email: string, password: string, fullName: string) => {
    set({ loading: true });
    const { user, error } = await authService.signUp(email, password, fullName);
    set({ user, loading: false });
    return { error };
  },

  signOut: async () => {
    set({ loading: true });
    await authService.signOut();
    set({ user: null, loading: false });
  },
}));

