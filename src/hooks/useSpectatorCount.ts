import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribes to the spectator presence channel (`spectators:{groupRoundId}`) to count
 * how many spectators are currently watching. Used in the player's leaderboard view
 * to show the optional "X watching" indicator.
 *
 * Spectators join this same channel via useSpectatorChannel and track
 * { role: 'spectator' }. This hook observes without tracking.
 */
export function useSpectatorCount(groupRoundId: string | null): number {
  const [count, setCount] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Unique key so the player doesn't collide with spectator keys
  const presenceKeyRef = useRef(`player-obs:${crypto.randomUUID().slice(0, 8)}`)

  useEffect(() => {
    if (!groupRoundId) {
      setCount(0)
      return
    }

    const presenceKey = presenceKeyRef.current
    const channel = supabase.channel(`spectators:${groupRoundId}`, {
      config: { presence: { key: presenceKey } },
    })

    const syncCount = () => {
      if (!channelRef.current) return
      const state = channelRef.current.presenceState<{ role: string }>()
      const spectators = Object.values(state)
        .flat()
        .filter((p) => (p as { role: string }).role === 'spectator').length
      setCount(spectators)
    }

    channel
      .on('presence', { event: 'sync' }, syncCount)
      .on('presence', { event: 'join' }, syncCount)
      .on('presence', { event: 'leave' }, syncCount)
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      setCount(0)
    }
  }, [groupRoundId])

  return count
}
