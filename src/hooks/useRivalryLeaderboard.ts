import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RemoteRivalryStatus } from '../lib/database.types'

// ── Public types ─────────────────────────────────────────────────────────────

export interface RivalryPlayer {
  userId: string
  displayName: string
  /** Course the player is playing */
  courseName: string | null
  courseRating: number | null
  slopeRating: number | null
  /** Per-hole scores indexed by hole_number (1-based) */
  holeScores: Record<number, { gross: number; par: number }>
  /** Cumulative gross score to par for completed holes */
  scoreToPar: number
  /** WHS-style differential: (grossTotal - courseRating) × 113 / slopeRating */
  projectedDifferential: number | null
  holesCompleted: number
}

export interface RivalryState {
  id: string
  status: RemoteRivalryStatus
  holeCount: number
  challenger: RivalryPlayer
  opponent: RivalryPlayer
  expiresAt: string
}

export type RivalryError = 'not_found' | 'not_participant' | 'network' | null

interface UseRivalryLeaderboardResult {
  rivalry: RivalryState | null
  isLoading: boolean
  error: RivalryError
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcScoreToPar(holeScores: Record<number, { gross: number; par: number }>): number {
  return Object.values(holeScores).reduce((sum, h) => sum + (h.gross - h.par), 0)
}

function calcProjectedDifferential(
  holeScores: Record<number, { gross: number; par: number }>,
  courseRating: number | null,
  slopeRating: number | null,
): number | null {
  if (!courseRating || !slopeRating || slopeRating === 0) return null
  const grossTotal = Object.values(holeScores).reduce((s, h) => s + h.gross, 0)
  if (grossTotal === 0) return null
  return (grossTotal - courseRating) * 113 / slopeRating
}

function buildPlayer(
  userId: string,
  displayName: string,
  courseName: string | null,
  courseRating: number | null,
  slopeRating: number | null,
  scores: Array<{ player_id: string; hole_number: number; gross_score: number; par: number }>,
): RivalryPlayer {
  const holeScores: Record<number, { gross: number; par: number }> = {}
  for (const s of scores) {
    if (s.player_id === userId) {
      holeScores[s.hole_number] = { gross: s.gross_score, par: s.par }
    }
  }
  return {
    userId,
    displayName,
    courseName,
    courseRating,
    slopeRating,
    holeScores,
    scoreToPar: calcScoreToPar(holeScores),
    projectedDifferential: calcProjectedDifferential(holeScores, courseRating, slopeRating),
    holesCompleted: Object.keys(holeScores).length,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Loads a remote rivalry by ID and subscribes to live score updates via
 * Supabase Realtime on the `rivalry_scores` table.
 */
export function useRivalryLeaderboard(rivalryId: string): UseRivalryLeaderboardResult {
  const [rivalry, setRivalry] = useState<RivalryState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<RivalryError>(null)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const applyNewScore = useCallback(
    (newScore: { player_id: string; hole_number: number; gross_score: number; par: number }) => {
      setRivalry((prev) => {
        if (!prev) return prev

        function patchPlayer(p: RivalryPlayer): RivalryPlayer {
          if (p.userId !== newScore.player_id) return p
          const holeScores = {
            ...p.holeScores,
            [newScore.hole_number]: { gross: newScore.gross_score, par: newScore.par },
          }
          return {
            ...p,
            holeScores,
            scoreToPar: calcScoreToPar(holeScores),
            projectedDifferential: calcProjectedDifferential(
              holeScores,
              p.courseRating,
              p.slopeRating,
            ),
            holesCompleted: Object.keys(holeScores).length,
          }
        }

        return {
          ...prev,
          challenger: patchPlayer(prev.challenger),
          opponent: patchPlayer(prev.opponent),
        }
      })
    },
    [],
  )

  useEffect(() => {
    let cancelled = false

    function teardown() {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }

    async function init() {
      setIsLoading(true)
      setError(null)
      setRivalry(null)

      try {
        // 1. Fetch rivalry + both player profiles
        const { data: rr, error: rrErr } = await supabase
          .from('remote_rivalries')
          .select('*')
          .eq('id', rivalryId)
          .maybeSingle()

        if (cancelled) return

        if (rrErr || !rr) {
          setError('not_found')
          setIsLoading(false)
          return
        }

        // 2. Fetch display names for both players
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', [rr.challenger_id, rr.opponent_id])

        if (cancelled) return

        const nameMap: Record<string, string> = {}
        for (const p of profiles ?? []) {
          nameMap[p.id] = p.display_name
        }

        // 3. Fetch existing rivalry scores
        const { data: scores } = await supabase
          .from('rivalry_scores')
          .select('player_id, hole_number, gross_score, par')
          .eq('rivalry_id', rivalryId)

        if (cancelled) return

        const allScores = scores ?? []

        const challenger = buildPlayer(
          rr.challenger_id,
          nameMap[rr.challenger_id] ?? 'Player 1',
          rr.challenger_course_name,
          rr.challenger_course_rating,
          rr.challenger_slope_rating,
          allScores,
        )
        const opponent = buildPlayer(
          rr.opponent_id,
          nameMap[rr.opponent_id] ?? 'Player 2',
          rr.opponent_course_name,
          rr.opponent_course_rating,
          rr.opponent_slope_rating,
          allScores,
        )

        setRivalry({
          id: rr.id,
          status: rr.status,
          holeCount: rr.hole_count,
          challenger,
          opponent,
          expiresAt: rr.expires_at,
        })

        // 4. Subscribe to live rivalry_scores inserts
        const channel = supabase
          .channel(`rivalry:${rivalryId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'rivalry_scores',
              filter: `rivalry_id=eq.${rivalryId}`,
            },
            ({ new: newRow }) => {
              if (!cancelled) {
                applyNewScore(newRow as {
                  player_id: string
                  hole_number: number
                  gross_score: number
                  par: number
                })
              }
            },
          )
          .subscribe()

        channelRef.current = channel
        setIsLoading(false)
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
  }, [rivalryId, applyNewScore])

  return { rivalry, isLoading, error }
}
