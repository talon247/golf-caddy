import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../store/index'
import { usePresenceStore } from '../store/presenceStore'
import { LoadingScreen } from './LoadingScreen'
import { getSession } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { UserProfile } from '../types'

interface AuthProviderProps {
  children: ReactNode
}

async function fetchPresenceVisible(userId: string): Promise<boolean> {
  try {
    // profiles.presence_visible added in THEA-162 migration; default true if absent
    const { data } = await supabase
      .from('profiles')
      .select('presence_visible')
      .eq('id', userId)
      .single()
    if (data && typeof (data as Record<string, unknown>)['presence_visible'] === 'boolean') {
      return (data as Record<string, unknown>)['presence_visible'] as boolean
    }
  } catch {
    // Column not yet deployed or network error — default to visible
  }
  return true
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { user, loading } = useAuth()
  const setAuthState = useAppStore((s) => s.setAuthState)
  const reconcileSyncOnAuth = useAppStore((s) => s.reconcileSyncOnAuth)
  const initPresence = usePresenceStore((s) => s.initPresence)
  const teardownPresence = usePresenceStore((s) => s.teardown)
  const [hydrated, setHydrated] = useState(false)

  // On mount: eagerly resolve session and populate store (THEA-131)
  useEffect(() => {
    getSession()
      .then(async (session) => {
        if (session?.user) {
          const profile: UserProfile = {
            id: session.user.id,
            displayName:
              (session.user.user_metadata?.full_name as string | undefined) ??
              session.user.email ??
              'Golfer',
          }
          setAuthState(session.user.id, profile)
          reconcileSyncOnAuth(session.user.id)
          const presenceVisible = await fetchPresenceVisible(session.user.id)
          initPresence(session.user.id, profile.displayName, presenceVisible)
        } else {
          setAuthState(null, null)
        }
      })
      .catch(() => {
        setAuthState(null, null)
      })
      .finally(() => {
        setHydrated(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep store in sync with ongoing auth changes; init/teardown presence accordingly
  useEffect(() => {
    if (loading) return
    if (user) {
      const profile: UserProfile = {
        id: user.id,
        displayName:
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          'Golfer',
      }
      setAuthState(user.id, profile)
      reconcileSyncOnAuth(user.id)
      fetchPresenceVisible(user.id).then((presenceVisible) => {
        initPresence(user.id, profile.displayName, presenceVisible)
      })
    } else {
      setAuthState(null, null)
      teardownPresence()
    }
  }, [user, loading, setAuthState, reconcileSyncOnAuth, initPresence, teardownPresence])

  if (!hydrated) {
    return <LoadingScreen />
  }

  return <>{children}</>
}
