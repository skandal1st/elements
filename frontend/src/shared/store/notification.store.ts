import { create } from 'zustand'

export interface PendingCall {
  id: string
  message: string
  related_id: string | null
  created_at: string
}

interface NotificationState {
  unreadCount: number
  previousUnreadCount: number
  soundEnabled: boolean
  activeCall: PendingCall | null
  dismissedCallIds: Set<string>

  /** First poll — sets both prev+current to avoid false-positive sound */
  initUnreadCount: (count: number) => void
  setUnreadCount: (count: number) => void
  setSoundEnabled: (enabled: boolean) => void
  setActiveCall: (call: PendingCall | null) => void
  dismissCall: (id: string) => void
  loadFromStorage: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  previousUnreadCount: 0,
  soundEnabled: true,
  activeCall: null,
  dismissedCallIds: new Set(),

  initUnreadCount: (count: number) => {
    set({ unreadCount: count, previousUnreadCount: count })
  },

  setUnreadCount: (count: number) => {
    set((state) => ({
      previousUnreadCount: state.unreadCount,
      unreadCount: count,
    }))
  },

  setSoundEnabled: (enabled: boolean) => {
    set({ soundEnabled: enabled })
    localStorage.setItem('notification_sound_enabled', String(enabled))
  },

  setActiveCall: (call: PendingCall | null) => {
    set({ activeCall: call })
  },

  dismissCall: (id: string) => {
    set((state) => {
      const newDismissed = new Set(state.dismissedCallIds)
      newDismissed.add(id)
      return {
        dismissedCallIds: newDismissed,
        activeCall: state.activeCall?.id === id ? null : state.activeCall,
      }
    })
  },

  loadFromStorage: () => {
    const saved = localStorage.getItem('notification_sound_enabled')
    if (saved !== null) {
      set({ soundEnabled: saved === 'true' })
    }
  },
}))
