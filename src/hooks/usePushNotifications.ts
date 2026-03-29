import { useEffect, useCallback } from 'react'
import { useNotificationStore } from '../store/notificationStore'

const VAPID_PUBLIC_KEY: string =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Initializes the push notification permission state on mount and provides
 * helpers to request permission and register/unregister subscriptions.
 */
export function usePushNotifications() {
  const { permission, pushSupported, setPermission } = useNotificationStore()

  // Sync browser permission state on mount
  useEffect(() => {
    if (!pushSupported) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
  }, [pushSupported, setPermission])

  /**
   * Request browser notification permission, then register a push subscription.
   * Returns 'granted', 'denied', or 'default'.
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!pushSupported) return 'denied'

    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted') {
      await registerSubscription()
    }

    return result
  }, [pushSupported, setPermission]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Register a push subscription with the service worker and POST it to the
   * backend /api/push/subscribe endpoint (requires VITE_VAPID_PUBLIC_KEY).
   */
  async function registerSubscription(): Promise<void> {
    if (!VAPID_PUBLIC_KEY) {
      // VAPID key not configured yet — skip subscription registration
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      if (existing) return // already subscribed

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // POST subscription to backend (BE infrastructure handles delivery)
      const supabaseUrl: string =
        (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL ?? ''
      if (!supabaseUrl) return

      await fetch(`${supabaseUrl}/functions/v1/push-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })
    } catch {
      // Subscription failed — non-fatal, user can retry from settings
    }
  }

  /**
   * Send a test notification via the backend.
   */
  const sendTestNotification = useCallback(async (): Promise<void> => {
    if (permission !== 'granted') return

    try {
      const supabaseUrl: string =
        (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL ?? ''
      if (!supabaseUrl) return

      await fetch(`${supabaseUrl}/functions/v1/push-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      // Non-fatal
    }
  }, [permission])

  return { requestPermission, sendTestNotification }
}
