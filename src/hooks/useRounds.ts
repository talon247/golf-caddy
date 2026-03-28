/**
 * useRounds — THEA-142
 *
 * Returns local rounds immediately, then merges remote rounds in background
 * when authenticated. Module-level cache prevents redundant fetches on
 * navigation. Cache is invalidated when `roundsVersion` increments (i.e.
 * after completeRound fires).
 */
import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { fetchRounds } from '../lib/sync'
import type { Round } from '../types'

// Module-level cache
let cachedRounds: Round[] | null = null
// Track which version the cache was built for
let cachedVersion = -1

export interface UseRoundsResult {
  rounds: Round[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useRounds(): UseRoundsResult {
  const storeRounds = useAppStore(s => s.rounds)
  const isAuthenticated = useAppStore(s => s.isAuthenticated)
  const userId = useAppStore(s => s.userId)
  const updateRound = useAppStore(s => s.updateRound)
  const roundsVersion = useAppStore(s => s.roundsVersion)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The merged round list shown to callers (starts with local)
  const [rounds, setRounds] = useState<Round[]>(storeRounds)

  // Track if a manual refetch was requested
  const refetchFlagRef = useRef(false)

  // Whenever the local store changes, update rounds immediately (guest mode path)
  useEffect(() => {
    if (!isAuthenticated) {
      setRounds(storeRounds)
    }
  }, [storeRounds, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      // Guest mode — serve local rounds, no fetch needed
      setRounds(storeRounds)
      return
    }

    // If cache is still valid for this version and no manual refetch, use it
    if (
      cachedRounds !== null &&
      cachedVersion === roundsVersion &&
      !refetchFlagRef.current
    ) {
      setRounds(cachedRounds)
      return
    }

    refetchFlagRef.current = false
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const remote = await fetchRounds(userId!)
        if (cancelled) return

        // Merge: union by id, remote wins on conflict
        const local = useAppStore.getState().rounds
        const merged = mergeRounds(local, remote)

        // Update store for each remote round
        for (const r of remote) {
          const localRound = local.find(l => l.id === r.id)
          // Only push to store if remote differs (avoids triggering re-renders in a loop)
          if (!localRound || JSON.stringify(localRound) !== JSON.stringify(r)) {
            updateRound(r)
          }
        }

        cachedRounds = merged
        cachedVersion = roundsVersion
        setRounds(merged)
      } catch (err) {
        if (cancelled) return
        console.error('[useRounds] fetch error:', err)
        setError('Failed to load rounds')
        // Serve stale local data
        setRounds(useAppStore.getState().rounds)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId, roundsVersion])

  function refetch() {
    // Bust the cache and re-fetch
    cachedRounds = null
    cachedVersion = -1
    refetchFlagRef.current = true
    // Re-run the effect by triggering a state update
    setError(null)
    setRounds(useAppStore.getState().rounds)
  }

  return { rounds, loading, error, refetch }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Union of local + remote, remote wins on id conflict.
 */
function mergeRounds(local: Round[], remote: Round[]): Round[] {
  const map = new Map<string, Round>()
  for (const r of local) map.set(r.id, r)
  for (const r of remote) map.set(r.id, r) // remote overwrites
  return Array.from(map.values()).sort((a, b) => b.startedAt - a.startedAt)
}
