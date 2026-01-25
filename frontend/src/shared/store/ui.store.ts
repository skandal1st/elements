import { create } from 'zustand'

interface UIState {
  // Тема
  theme: 'light' | 'dark'
  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void

  // Сайдбар
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  // Инициализация из localStorage
  loadFromStorage: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'light',
  sidebarCollapsed: false,

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light'
    set({ theme: newTheme })
    localStorage.setItem('theme', newTheme)

    // Применяем класс к document
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  setTheme: (theme) => {
    set({ theme })
    localStorage.setItem('theme', theme)

    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  toggleSidebar: () => {
    const newValue = !get().sidebarCollapsed
    set({ sidebarCollapsed: newValue })
    localStorage.setItem('sidebar_collapsed', String(newValue))
  },

  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed })
    localStorage.setItem('sidebar_collapsed', String(collapsed))
  },

  loadFromStorage: () => {
    // Загружаем тему
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = savedTheme || (prefersDark ? 'dark' : 'light')

    set({ theme })

    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Загружаем состояние сайдбара
    const savedCollapsed = localStorage.getItem('sidebar_collapsed')
    if (savedCollapsed === 'true') {
      set({ sidebarCollapsed: true })
    }
  },
}))
