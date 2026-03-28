// Stableford scoring engine
// Pure TypeScript — all calculations are client-side, no external dependencies
//
// Stableford awards points based on score relative to par per hole.
// Players accumulate points over the round; highest total wins.
// There are no per-hole monetary stakes — settlement is a ranking result.

import type { SettlementEntry } from './types'

export interface StablefordState {
  totals: Record<string, number>             // playerId → running point total
  holePoints: Record<string, Record<number, number>> // playerId → hole → points earned
}

/**
 * Convert a score relative to par into Stableford points.
 *
 *   Eagle or better (≤ -2): 4 points
 *   Birdie (-1):             3 points
 *   Par (0):                 2 points
 *   Bogey (+1):              1 point
 *   Double bogey+ (≥ +2):   0 points
 */
function scoreToPar(strokes: number, par: number): number {
  const diff = strokes - par
  if (diff <= -2) return 4
  if (diff === -1) return 3
  if (diff === 0) return 2
  if (diff === 1) return 1
  return 0
}

/**
 * Build an initial StablefordState for a new round.
 */
export function createStablefordState(playerIds: string[]): StablefordState {
  const totals: Record<string, number> = {}
  const holePoints: Record<string, Record<number, number>> = {}
  for (const id of playerIds) {
    totals[id] = 0
    holePoints[id] = {}
  }
  return { totals, holePoints }
}

/**
 * Process one hole and return the updated StablefordState.
 *
 * holeNumber:  1-based hole number (1–18)
 * scores:      Record<playerId, strokesForThisHole> — must include all players
 * par:         par value for this specific hole
 * prevState:   the state entering this hole
 */
export function calculateStablefordForHole(
  holeNumber: number,
  scores: Record<string, number>,
  par: number,
  prevState: StablefordState,
): StablefordState {
  const newTotals: Record<string, number> = { ...prevState.totals }
  const newHolePoints: Record<string, Record<number, number>> = {}

  for (const playerId of Object.keys(prevState.holePoints)) {
    newHolePoints[playerId] = { ...prevState.holePoints[playerId] }
  }

  for (const [playerId, strokes] of Object.entries(scores)) {
    const points = scoreToPar(strokes, par)
    newHolePoints[playerId] = { ...(newHolePoints[playerId] ?? {}), [holeNumber]: points }
    newTotals[playerId] = (newTotals[playerId] ?? 0) + points
  }

  return { totals: newTotals, holePoints: newHolePoints }
}

/**
 * Compute the settlement from a completed StablefordState.
 *
 * Returns one SettlementEntry per player pair. The player with fewer total
 * points "owes" the higher-scoring player. Amount is 0 because Stableford
 * carries no built-in monetary stake — the description records the final
 * totals for display. Tie pairs are omitted.
 *
 * Works for 2–4 players.
 */
export function getStablefordSettlement(
  finalState: StablefordState,
): SettlementEntry[] {
  const players = Object.keys(finalState.totals)
  const entries: SettlementEntry[] = []

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i]
      const p2 = players[j]
      const p1Points = finalState.totals[p1] ?? 0
      const p2Points = finalState.totals[p2] ?? 0

      if (p1Points > p2Points) {
        entries.push({
          fromPlayerId: p2,
          toPlayerId: p1,
          amount: 0,
          description: `Stableford: ${p1Points} pts vs ${p2Points} pts`,
        })
      } else if (p2Points > p1Points) {
        entries.push({
          fromPlayerId: p1,
          toPlayerId: p2,
          amount: 0,
          description: `Stableford: ${p2Points} pts vs ${p1Points} pts`,
        })
      }
      // Tie: no entry
    }
  }

  return entries
}
