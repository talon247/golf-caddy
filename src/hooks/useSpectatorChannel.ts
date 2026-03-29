import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { applyScoreDelta } from '../utils/scoring'
import type { PlayerScore, ScoreDelta } from '../types'

export interface SpectatorRoundInfo {
  id: string
  courseName: string | null
  holeCount: number | null
  status: string
  spectatorSideGamesVisible: boolean
}

export type SpectatorError = 'not_found' | 'spectators_disabled' | 'network' | null

interface SpectatorChannelState {
  roundInfo: SpectatorRoundInfo | null
  players: PlayerScore[]
  spectatorCount: number
  isLoading: boolean
  error: SpectatorError
}

/**
 * Subscribes to a group round's Realtime channels as a read-only spectator.
 * - `round:{groupRoundId}`: listens for score broadcast events (no presence here)
 * - `spectators:{groupRoundId}`: tracks presence as a spectator + counts watchers
 *
 * Resolves room code → group round, checks spectators_enabled, then connects.
 * No auth required — works for anonymous viewers.
 */
export function useSpectatorChannel(roomCode: string): SpectatorChannelState {
  const [roundInfo, setRoundInfo] = useState<SpectatorRoundInfo | null>(null)
  const [players, setPlayers] = useState<PlayerScore[]>([])
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<SpectatorError>(null)

  const scoreChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Stable presence key per spectator session
  const presenceKeyRef = useRef(`spectator:${crypto.randomUUID().slice(0, 8)}`)

  const handleScoreDelta = useCallback((delta: ScoreDelta) => {
    setPlayers((prev) => {
      const existing = prev.find((p) => p.playerId === delta.playerId)
      const updated = applyScoreDelta(existing, delta)
      return existing
        ? prev.map((p) => (p.playerId === delta.playerId ? updated : p))
        : [...prev, updated]
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    function teardown() {
      if (scoreChannelRef.current) {
        supabase.removeChannel(scoreChannelRef.current)
        scoreChannelRef.current = null
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current)
        presenceChannelRef.current = null
      }
    }

    async function init() {
      setIsLoading(true)
      setError(null)
      setPlayers([])
      setRoundInfo(null)
      setSpectatorCount(0)

      try {
        const { data, error: dbError } = await supabase
          .from('group_rounds')
          .select('id, course_name, hole_count, status, spectators_enabled, spectator_side_games_visible')
          .eq('room_code', roomCode.toUpperCase())
          .maybeSingle()

        if (cancelled) return

        if (dbError || !data) {
          setError('not_found')
          setIsLoading(false)
          return
        }

        if (!data.spectators_enabled) {
          setError('spectators_disabled')
          setIsLoading(false)
          return
        }

        setRoundInfo({
          id: data.id,
          courseName: data.course_name,
          holeCount: data.hole_count,
          status: data.status,
          spectatorSideGamesVisible: data.spectator_side_games_visible,
        })

        // 1. Score broadcast channel — listen-only, no presence
        const scoreChannel = supabase.channel(`round:${data.id}`)
        scoreChannel
          .on('broadcast', { event: 'score' }, ({ payload }: { payload: ScoreDelta }) => {
            if (!cancelled) handleScoreDelta(payload)
          })
          .subscribe()
        scoreChannelRef.current = scoreChannel

        // 2. Spectator presence channel — track + count watchers
        const presenceKey = presenceKeyRef.current
        const presenceChannel = supabase.channel(`spectators:${data.id}`, {
          config: { presence: { key: presenceKey } },
        })

        const syncCount = () => {
          const state = presenceChannel.presenceState<{ role: string }>()
          const count = Object.values(state)
            .flat()
            .filter((p) => (p as { role: string }).role === 'spectator').length
          if (!cancelled) setSpectatorCount(count)
        }

        presenceChannel
          .on('presence', { event: 'sync' }, syncCount)
          .on('presence', { event: 'join' }, syncCount)
          .on('presence', { event: 'leave' }, syncCount)
          .subscribe(async (status) => {
            if (cancelled) return
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({ role: 'spectator' })
              setIsLoading(false)
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setIsLoading(false)
            }
          })
        presenceChannelRef.current = presenceChannel
      } catch {
        if (!cancelled) {
          setError('network')
          setIsLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      teardown()
    }
  }, [roomCode, handleScoreDelta])

  return { roundInfo, players, spectatorCount, isLoading, error }
}
