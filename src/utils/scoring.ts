import type { Hole, PlayerScore, ScoreDelta } from '../types'

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
export function calcGIR(
  holes: Hole[],
  putterIds: Set<string> = new Set(),
): { pct: number; hits: number; total: number } | null {
  const eligible = holes.filter(h => h.shots.length > 0 && h.putts !== undefined)
  if (eligible.length === 0) return null
  let hits = 0
  for (const h of eligible) {
    // approach shots = non-putter club taps only
    const approachShots = h.shots.filter(s => !putterIds.has(s.clubId)).length
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

/**
 * Pure function — applies a score delta to an existing player score entry.
 * Returns a new PlayerScore without mutating the input.
 * Exported for unit testing.
 */
export function applyScoreDelta(existing: PlayerScore | undefined, delta: ScoreDelta): PlayerScore {
  if (!existing) {
    return {
      playerId: delta.playerId,
      displayName: delta.playerName,
      currentHole: delta.holeNumber,
      totalStrokes: delta.strokes,
      totalPar: delta.par,
      scoreToPar: delta.strokes - delta.par,
      isOnline: true,
      lastSyncedAt: delta.timestamp,
      holes: { [delta.holeNumber]: { strokes: delta.strokes, putts: delta.putts, par: delta.par } },
    }
  }

  const updatedHoles = {
    ...existing.holes,
    [delta.holeNumber]: { strokes: delta.strokes, putts: delta.putts, par: delta.par },
  }
  const totalStrokes = Object.values(updatedHoles).reduce((sum, h) => sum + h.strokes, 0)
  const totalPar = Object.values(updatedHoles).reduce((sum, h) => sum + h.par, 0)

  return {
    ...existing,
    currentHole: delta.holeNumber,
    totalStrokes,
    totalPar,
    scoreToPar: totalStrokes - totalPar,
    isOnline: true,
    lastSyncedAt: delta.timestamp,
    holes: updatedHoles,
  }
}

