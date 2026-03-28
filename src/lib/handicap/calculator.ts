// WHS (World Handicap System) calculation engine
// Pure TypeScript — no external dependencies

export interface RoundDifferential {
  roundId: string
  differential: number
  date: string
}

export interface HandicapResult {
  estimate: number | null   // null if fewer than 3 rounds
  lowHI: number | null      // lowest in last 365 days
  roundsUsed: number        // how many differentials included
  totalRounds: number       // total rounds in history
  isCapped: boolean         // soft or hard cap applied
  capType: 'soft' | 'hard' | null
}

// WHS count table: number of rounds → number of best differentials to use
const WHS_COUNT_TABLE: Record<number, number> = {
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 2,
  9: 3,
  10: 3,
  11: 3,
  12: 4,
  13: 4,
  14: 4,
  15: 5,
  16: 6,
  17: 6,
  18: 7,
  19: 8,
  20: 8,
}

/**
 * Adjusted Gross Score: applies Net Double Bogey cap per hole.
 * If no HI established yet, use par + 5 as the cap.
 */
export function computeAGS(
  holeScores: number[],
  holePars: number[],
  handicapStrokes?: number[],
): number {
  return holeScores.reduce((sum, score, i) => {
    const par = holePars[i] ?? 0
    const strokes = handicapStrokes?.[i] ?? 0
    const cap = strokes > 0 ? par + 2 + strokes : par + 5
    return sum + Math.min(score, cap)
  }, 0)
}

/**
 * Score Differential formula: (AGS - courseRating) * 113 / slopeRating
 * Rounded to 1 decimal place.
 */
export function computeScoreDifferential(
  ags: number,
  courseRating: number,
  slopeRating: number,
): number {
  const raw = ((ags - courseRating) * 113) / slopeRating
  return Math.round(raw * 10) / 10
}

/**
 * Computes a WHS handicap estimate from a list of round differentials.
 * Uses up to the last 20 rounds, picks the best N per WHS count table,
 * multiplies average by 0.96, then applies soft/hard cap vs Low HI.
 */
export function computeHandicapEstimate(
  differentials: RoundDifferential[],
): HandicapResult {
  const totalRounds = differentials.length

  if (totalRounds < 3) {
    return {
      estimate: null,
      lowHI: null,
      roundsUsed: 0,
      totalRounds,
      isCapped: false,
      capType: null,
    }
  }

  // Sort by date descending, take last 20
  const sorted = [...differentials].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
  const recent = sorted.slice(0, 20)
  const count = recent.length

  const n = WHS_COUNT_TABLE[count]
  if (n === undefined) {
    // Shouldn't happen given count is 3–20, but guard anyway
    return {
      estimate: null,
      lowHI: null,
      roundsUsed: 0,
      totalRounds,
      isCapped: false,
      capType: null,
    }
  }

  // Pick best N differentials (lowest values)
  const bestN = [...recent]
    .sort((a, b) => a.differential - b.differential)
    .slice(0, n)

  const average = bestN.reduce((s, d) => s + d.differential, 0) / n
  let estimate = Math.round(average * 0.96 * 10) / 10

  // Low HI: lowest estimate in last 365 days
  // We compute it from the same differentials available (approximation)
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const recentYear = differentials.filter(
    (d) => new Date(d.date) >= cutoff,
  )

  // Compute lowHI by running the same algorithm on each subset up to the current date
  // Simplified: use the minimum differential from the past year as a proxy for Low HI
  // (full implementation would re-run the algorithm for each historical date)
  let lowHI: number | null = null
  if (recentYear.length >= 3) {
    const yearBestDiff = [...recentYear]
      .sort((a, b) => a.differential - b.differential)
      .slice(0, 1)[0].differential
    lowHI = yearBestDiff * 0.96
  }

  // Apply soft/hard cap
  let isCapped = false
  let capType: 'soft' | 'hard' | null = null

  if (lowHI !== null) {
    const excess = estimate - (lowHI + 3.0)
    if (estimate > lowHI + 5.0) {
      estimate = lowHI + 5.0
      isCapped = true
      capType = 'hard'
    } else if (excess > 0) {
      estimate = Math.round((lowHI + 3.0 + excess * 0.5) * 10) / 10
      isCapped = true
      capType = 'soft'
    }
  }

  return {
    estimate,
    lowHI,
    roundsUsed: n,
    totalRounds,
    isCapped,
    capType,
  }
}
