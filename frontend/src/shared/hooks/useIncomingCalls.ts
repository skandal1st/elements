import { useEffect, useRef, useCallback } from 'react'
import { useNotificationStore } from '../store/notification.store'
import { notificationsService } from '../services/notifications.service'

const AUTO_DISMISS_MS = 60_000

/**
 * Polls GET /it/notifications/pending-calls every 5s.
 * When a new call arrives, sets activeCall and starts looping ringtone.
 * Auto-dismisses after 60s.
 * Should be called once at AuthenticatedLayout level.
 */
export function useIncomingCalls() {
  const ringtoneRef = useRef<HTMLAudioElement | null>(null)
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeCall = useNotificationStore((s) => s.activeCall)
  const setActiveCall = useNotificationStore((s) => s.setActiveCall)
  const dismissCall = useNotificationStore((s) => s.dismissCall)

  // Manage ringtone playback based on activeCall state
  useEffect(() => {
    if (activeCall) {
      try {
        if (!ringtoneRef.current) {
          ringtoneRef.current = new Audio('/sounds/ringtone.wav')
          ringtoneRef.current.loop = true
          ringtoneRef.current.volume = 0.7
        }
        ringtoneRef.current.currentTime = 0
        ringtoneRef.current.play().catch(() => {})
      } catch {
        // ignore audio errors
      }

      // Auto-dismiss after 60s
      autoDismissTimer.current = setTimeout(() => {
        const current = useNotificationStore.getState().activeCall
        if (current) {
          dismissCall(current.id)
        }
      }, AUTO_DISMISS_MS)
    } else {
      // Stop ringtone
      if (ringtoneRef.current) {
        ringtoneRef.current.pause()
        ringtoneRef.current.currentTime = 0
      }
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current)
        autoDismissTimer.current = null
      }
    }

    return () => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current)
      }
    }
  }, [activeCall, dismissCall])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause()
        ringtoneRef.current = null
      }
    }
  }, [])

  // Poll for pending calls
  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      const result = await notificationsService.getPendingCalls()
      if (cancelled || result.error) return

      const store = useNotificationStore.getState()
      if (store.activeCall) return // already showing a call

      // Find first call not already dismissed
      const newCall = result.calls.find(
        (c) => !store.dismissedCallIds.has(c.id)
      )

      if (newCall) {
        setActiveCall(newCall)
      }
    }

    poll()
    const interval = setInterval(poll, 5_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [setActiveCall])

  const handleAccept = useCallback(() => {
    const call = useNotificationStore.getState().activeCall
    if (!call) return

    // Open Jitsi conference
    if (call.related_id) {
      window.open(
        `https://meet.teplocentral.org/elements-${call.related_id}`,
        '_blank'
      )
    }

    // Mark notification as read and dismiss
    notificationsService.markAsRead(call.id)
    dismissCall(call.id)
  }, [dismissCall])

  const handleDecline = useCallback(() => {
    const call = useNotificationStore.getState().activeCall
    if (!call) return

    notificationsService.markAsRead(call.id)
    dismissCall(call.id)
  }, [dismissCall])

  return { activeCall, handleAccept, handleDecline }
}
