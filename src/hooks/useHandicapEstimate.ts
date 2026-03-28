import { useMemo } from 'react'
import { useAppStore } from '../store'
import { calcTotalStrokes } from '../utils/scoring'
import {
  computeAGS,
  computeScoreDifferential,
  computeHandicapEstimate,
  type RoundDifferential,
  type HandicapResult,
} from '../lib/handicap/calculator'

export interface EnrichedDifferential extends RoundDifferential {
  courseName: string
  usedInEstimate: boolean
}

export interface HandicapData {
  result: HandicapResult
  differentials: EnrichedDifferential[]
}

/**
 * Computes the WHS handicap estimate from the user's completed rounds.
 * Only rounds with courseRating + slopeRating contribute to the estimate.
 * Result is memoized — recomputes only when rounds or bag changes.
 */
export function useHandicapEstimate(): HandicapData {
  const rounds = useAppStore(s => s.rounds)
  const bag = useAppStore(s => s.clubBag)

  return useMemo(() => {
    const putterIds = new Set(
      bag.filter(c => c.name.toLowerCase() === 'putter').map(c => c.id),
    )

    const rawDiffs: RoundDifferential[] = []

    for (const round of rounds) {
      if (!round.completedAt) continue
      if (round.courseRating === undefined || round.slopeRating === undefined) continue

      const holeScores = round.holes.map(
        h => calcTotalStrokes(h, putterIds),
      )
      const holePars = round.holes.map(h => h.par)

      const ags = computeAGS(holeScores, holePars)
      const differential = computeScoreDifferential(ags, round.courseRating, round.slopeRating)

      rawDiffs.push({
        roundId: round.id,
        differential,
        date: new Date(round.startedAt).toISOString(),
      })
    }

    const result = computeHandicapEstimate(rawDiffs)

    // Determine which round IDs are used in the estimate
    const sorted = [...rawDiffs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)

    const bestN =
      result.roundsUsed > 0
        ? [...sorted]
            .sort((a, b) => a.differential - b.differential)
            .slice(0, result.roundsUsed)
        : []
    const usedIds = new Set(bestN.map(d => d.roundId))

    const differentials: EnrichedDifferential[] = rawDiffs
      .map(d => {
        const round = rounds.find(r => r.id === d.roundId)
        return {
          ...d,
          courseName: round?.courseName ?? 'Unknown course',
          usedInEstimate: usedIds.has(d.roundId),
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)

    return { result, differentials }
  }, [rounds, bag])
}

/**
 * Computes the score differential for a single round.
 * Returns null if the round lacks course rating/slope data.
 */
export function computeRoundDifferential(
  round: { holes: { number: number; shots: { clubId: string; timestamp: number }[]; putts?: number; par: number }[]; courseRating?: number; slopeRating?: number },
  putterIds: Set<string>,
): number | null {
  if (round.courseRating === undefined || round.slopeRating === undefined) return null

  const holeScores = round.holes.map(
    h => calcTotalStrokes(h, putterIds),
  )
  const holePars = round.holes.map(h => h.par)
  const ags = computeAGS(holeScores, holePars)
  return computeScoreDifferential(ags, round.courseRating, round.slopeRating)
}
