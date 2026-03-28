import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLeaderboardStore } from '../store/leaderboardStore'
import type { ScoreDelta } from '../types'

const STALE_THRESHOLD_MS = 30_000
const STALE_CHECK_INTERVAL_MS = 5_000

function queueKey(groupRoundId: string): string {
  return `multiplayer_score_queue_${groupRoundId}`
}

function readQueue(groupRoundId: string): ScoreDelta[] {
  try {
    const raw = localStorage.getItem(queueKey(groupRoundId))
    return raw ? (JSON.parse(raw) as ScoreDelta[]) : []
  } catch {
    return []
  }
}

function writeQueue(groupRoundId: string, queue: ScoreDelta[]): void {
  try {
    localStorage.setItem(queueKey(groupRoundId), JSON.stringify(queue))
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

function clearQueue(groupRoundId: string): void {
  try {
    localStorage.removeItem(queueKey(groupRoundId))
  } catch {
    // ignore
  }
}

/**
 * Subscribes to the Supabase Realtime broadcast channel for a group round.
 * Incoming score deltas from other players are applied to the leaderboard store.
 * Reconnects automatically on visibility/online events.
 *
 * Offline resilience:
 * - Tracks online/offline state via navigator.onLine + window events
 * - Queues ScoreDeltas in localStorage while offline (last-write-wins per player+hole)
 * - Flushes queue via Realtime broadcast + REST on reconnect
 *
 * Stale player detection:
 * - Polls every 5s; marks remote players isOnline=false if lastSyncedAt >30s ago
 *
 * @param groupRoundId - The UUID of the active group round, or null if not in a group round.
 * @param myPlayerId   - The current player's ID; used to skip own broadcast echoes.
 */
export function useGroupRoundBroadcast(
  groupRoundId: string | null,
  myPlayerId: string,
) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const updateScore = useLeaderboardStore((s) => s.updateScore)
  const setOffline = useLeaderboardStore((s) => s.setOffline)

  // Stable ref to players — avoids recreating the stale-check interval on every score update
  const playersRef = useRef(useLeaderboardStore.getState().players)
  useEffect(() => {
    return useLeaderboardStore.subscribe((state) => {
      playersRef.current = state.players
    })
  }, [])

  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  const subscribe = useCallback(() => {
    if (!groupRoundId) return

    // Tear down any existing subscription before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase.channel(`round:${groupRoundId}`)

    channel
      .on(
        'broadcast',
        { event: 'score' },
        ({ payload }: { payload: ScoreDelta }) => {
          // Skip echoes of our own broadcasts
          if (payload.playerId === myPlayerId) return
          updateScore(payload)
        },
      )
      .subscribe()

    channelRef.current = channel
  }, [groupRoundId, myPlayerId, updateScore])

  // Initial subscription + cleanup on unmount
  useEffect(() => {
    subscribe()
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [subscribe])

  // Offline/online detection + queue flush + re-subscribe
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') subscribe()
    }

    function handleOffline() {
      setIsOffline(true)
    }

    async function handleOnline() {
      setIsOffline(false)
      subscribe()

      if (!groupRoundId) return
      const queue = readQueue(groupRoundId)
      if (queue.length === 0) return

      try {
        for (const delta of queue) {
          // Broadcast via Realtime (best-effort — channel may still be connecting)
          if (channelRef.current) {
            await channelRef.current
              .send({ type: 'broadcast', event: 'score', payload: delta })
              .catch(() => { /* non-fatal */ })
          }
          // Persist via REST so server has the authoritative record
          await fetch(`/api/group-rounds/${groupRoundId}/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(delta),
          }).catch(() => { /* non-fatal — REST may not exist yet */ })
        }
        clearQueue(groupRoundId)
      } catch {
        // Non-fatal — queue persists; will retry on next online event
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [subscribe, groupRoundId])

  // Stale player detection: mark remote players offline if no delta received in >30s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      playersRef.current.forEach((p) => {
        if (p.playerId === myPlayerId) return
        const lastSeen = p.lastSyncedAt ? new Date(p.lastSyncedAt).getTime() : 0
        const isStale = now - lastSeen > STALE_THRESHOLD_MS
        // Only call setOffline when state needs to change to avoid unnecessary renders
        if (isStale === p.isOnline) {
          setOffline(p.playerId, isStale)
        }
      })
    }, STALE_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [myPlayerId, setOffline])

  const broadcastScore = useCallback(
    async (delta: ScoreDelta) => {
      if (!groupRoundId) return

      if (!navigator.onLine) {
        // Queue for later flush — last-write-wins per {playerId, holeNumber}
        const queue = readQueue(groupRoundId)
        const idx = queue.findIndex(
          (q) => q.playerId === delta.playerId && q.holeNumber === delta.holeNumber,
        )
        if (idx >= 0) {
          if (new Date(delta.timestamp) >= new Date(queue[idx].timestamp)) {
            queue[idx] = delta
          }
        } else {
          queue.push(delta)
        }
        writeQueue(groupRoundId, queue)
        return
      }

      if (!channelRef.current) return
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'score',
          payload: delta,
        })
      } catch {
        // Non-fatal — offline or channel not yet subscribed
      }
    },
    [groupRoundId],
  )

  return { broadcastScore, isOffline }
}
