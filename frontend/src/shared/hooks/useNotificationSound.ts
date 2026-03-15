import { useEffect, useRef } from 'react'
import { useNotificationStore } from '../store/notification.store'
import { notificationsService } from '../services/notifications.service'

/**
 * Polls unread notification count every 30s.
 * Plays a short sound when count increases (skips on first load).
 * Should be called once at AuthenticatedLayout level.
 */
export function useNotificationSound() {
  const isFirstPoll = useRef(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const userInteracted = useRef(false)

  const initUnreadCount = useNotificationStore((s) => s.initUnreadCount)
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  const soundEnabled = useNotificationStore((s) => s.soundEnabled)

  // Track user interaction for autoplay policy
  useEffect(() => {
    const onInteraction = () => {
      userInteracted.current = true
    }
    document.addEventListener('click', onInteraction, { once: true })
    document.addEventListener('keydown', onInteraction, { once: true })
    return () => {
      document.removeEventListener('click', onInteraction)
      document.removeEventListener('keydown', onInteraction)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      const result = await notificationsService.getUnreadCount()
      if (cancelled || result.error) return

      const store = useNotificationStore.getState()

      if (isFirstPoll.current) {
        isFirstPoll.current = false
        initUnreadCount(result.count)
        return
      }

      const prev = store.unreadCount
      setUnreadCount(result.count)

      if (result.count > prev && soundEnabled && userInteracted.current) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio('/sounds/notification.wav')
            audioRef.current.volume = 0.5
          }
          audioRef.current.currentTime = 0
          audioRef.current.play().catch(() => {})
        } catch {
          // ignore audio errors
        }
      }
    }

    poll()
    const interval = setInterval(poll, 30_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [initUnreadCount, setUnreadCount, soundEnabled])
}
