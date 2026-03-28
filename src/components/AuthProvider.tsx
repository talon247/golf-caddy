import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../store/index'
import { LoadingScreen } from './LoadingScreen'
import { getSession } from '../lib/auth'
import type { UserProfile } from '../types'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { user, loading } = useAuth()
  const setAuthState = useAppStore((s) => s.setAuthState)
  const [hydrated, setHydrated] = useState(false)

  // On mount: eagerly resolve session and populate store (THEA-131)
  useEffect(() => {
    getSession()
      .then((session) => {
        if (session?.user) {
          const profile: UserProfile = {
            id: session.user.id,
            displayName:
              (session.user.user_metadata?.full_name as string | undefined) ??
              session.user.email ??
              'Golfer',
          }
          setAuthState(session.user.id, profile)
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
  }, [setAuthState])

  // Keep store in sync with ongoing auth changes
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
    } else {
      setAuthState(null, null)
    }
  }, [user, loading, setAuthState])

  if (!hydrated) {
    return <LoadingScreen />
  }

  return <>{children}</>
}
