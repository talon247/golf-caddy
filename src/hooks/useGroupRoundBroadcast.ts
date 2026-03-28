import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useLeaderboardStore } from '../store/leaderboardStore'
import { useGroupRoundStore } from '../store/groupRoundStore'
import { fetchSideGameConfig } from '../lib/sideGames/config'
import { trackPresence } from '../lib/presence'
import type { ScoreDelta, SideGameConfig } from '../types'

/**
 * Subscribes to the Supabase Realtime broadcast channel for a group round.
 * Incoming score deltas from other players are applied to the leaderboard store.
 * Handles side_game_config broadcasts, storing config locally in groupRoundStore.
 * Reconnects automatically on visibility/online events.
 *
 * @param groupRoundId - The UUID of the active group round, or null if not in a group round.
 * @param myPlayerId   - The current player's ID; used to skip own broadcast echoes.
 */
export function useGroupRoundBroadcast(
  groupRoundId: string | null,
  myPlayerId: string,
) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Tracks all score deltas we broadcast, keyed by hole number.
  // Storing all holes (not just the last) ensures a reconnecting client re-receives the
  // full picture, not only the most recently played hole.
  const allBroadcastsRef = useRef<Map<number, ScoreDelta>>(new Map())
  const updateScore = useLeaderboardStore((s) => s.updateScore)
  const setSideGameConfig = useGroupRoundStore((s) => s.setSideGameConfig)
  const sideGameConfig = useGroupRoundStore((s) => s.sideGameConfig)

  // Use a ref so the subscribe callback always sees the latest value without
  // needing to be re-created (avoids an unnecessary channel teardown).
  const sideGameConfigRef = useRef(sideGameConfig)
  sideGameConfigRef.current = sideGameConfig

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
      .on(
        'broadcast',
        { event: 'side_game_config' },
        ({ payload }: { payload: SideGameConfig }) => {
          setSideGameConfig(payload)
          void trackPresence({ side_game_ready: true })
        },
      )
      .subscribe(async (status) => {
        // Only run catch-up logic once the channel is fully connected.
        // CHANNEL_ERROR / TIMED_OUT fire the same callback but the channel isn't
        // ready to send yet, so skip those states.
        if (status !== 'SUBSCRIBED') return

        // On (re)connect: re-send ALL previously broadcast hole scores so that
        // any guest who missed one or more holes gets the complete picture.
        // We iterate a Map<holeNumber, ScoreDelta> rather than just the last delta
        // to cover the "guest's phone locked mid-round" scenario where multiple
        // holes were missed.
        for (const delta of allBroadcastsRef.current.values()) {
          try {
            await channel.send({
              type: 'broadcast',
              event: 'score',
              payload: delta,
            })
          } catch {
            // Non-fatal
          }
        }

        // On (re)connect: if we have no config in memory, attempt to rehydrate
        // from the DB. This covers late-joining players and reconnect scenarios.
        if (!sideGameConfigRef.current && groupRoundId) {
          try {
            const config = await fetchSideGameConfig(groupRoundId)
            if (config) {
              setSideGameConfig(config)
              void trackPresence({ side_game_ready: true })
            }
          } catch {
            // Non-fatal — side game config is optional
          }
        }
      })

    channelRef.current = channel
  }, [groupRoundId, myPlayerId, updateScore, setSideGameConfig])

  // Clear stale broadcast deltas when switching to a different group round
  useEffect(() => {
    allBroadcastsRef.current.clear()
  }, [groupRoundId])

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

  // Re-subscribe when the tab becomes visible or the device comes back online
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') subscribe()
    }
    function handleOnline() {
      subscribe()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [subscribe])

  const broadcastScore = useCallback(
    async (delta: ScoreDelta) => {
      if (!channelRef.current) return
      // Upsert into per-hole map so the subscribe callback can re-broadcast all
      // holes on reconnect (not just the most recently played one).
      allBroadcastsRef.current.set(delta.holeNumber, delta)
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
    [],
  )

  /** Host calls this when starting the round to distribute side game config. */
  const broadcastSideGameConfig = useCallback(
    async (config: SideGameConfig) => {
      if (!channelRef.current) return
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'side_game_config',
          payload: config,
        })
      } catch {
        // Non-fatal — offline or channel not yet subscribed
      }
    },
    [],
  )

  return { broadcastScore, broadcastSideGameConfig, isOffline: false }
}
