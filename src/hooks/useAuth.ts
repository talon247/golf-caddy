import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSession, onAuthChange } from '../lib/auth'

export function useAuth(): { user: User | null; session: Session | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Hydrate from existing session
    getSession()
      .then((s) => {
        setSession(s)
        setUser(s?.user ?? null)
      })
      .catch(() => {
        // Network down or session error — treat as unauthenticated
        setSession(null)
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })

    // Subscribe to auth changes
    const { unsubscribe } = onAuthChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
    })

    return unsubscribe
  }, [])

  return { user, session, loading }
}
