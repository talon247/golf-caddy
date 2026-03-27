import type { Hole } from '../types'

/** Average putts per hole, based only on holes that have putts data */
export function calcPuttsAvg(holes: Hole[]): number | null {
  const tracked = holes.filter(h => h.putts !== undefined)
  if (tracked.length === 0) return null
  const total = tracked.reduce((sum, h) => sum + (h.putts as number), 0)
  return total / tracked.length
}

/**
 * GIR (Greens in Regulation) percentage.
 * A hole is GIR if approach shots (club taps, excluding putts) <= (par - 2).
 * Since putts are tracked separately via the putt counter (not as club taps),
 * approach shots = shots.length (all club taps before putting).
 * Only counts holes that have been played and have putts data.
 */
export function calcGIR(holes: Hole[]): { pct: number; hits: number; total: number } | null {
  const eligible = holes.filter(h => h.shots.length > 0 && h.putts !== undefined)
  if (eligible.length === 0) return null
  let hits = 0
  for (const h of eligible) {
    // approach shots = club taps (putts tracked separately, not in shots array)
    const approachShots = h.shots.length
    if (approachShots <= h.par - 2) hits++
  }
  return { pct: (hits / eligible.length) * 100, hits, total: eligible.length }
}

/**
 * Fairways hit percentage.
 * Only counts par-4 and par-5 holes that have been played and have fairwayHit data.
 */
export function calcFairwaysHit(holes: Hole[]): { pct: number; hits: number; total: number } | null {
  const eligible = holes.filter(
    h => (h.par === 4 || h.par === 5) && h.shots.length > 0 && h.fairwayHit !== undefined,
  )
  if (eligible.length === 0) return null
  const hits = eligible.filter(h => h.fairwayHit === true).length
  return { pct: (hits / eligible.length) * 100, hits, total: eligible.length }
}
