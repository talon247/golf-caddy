import type { Round, Club } from '../types'

export type TimeRange = "last10" | "last30d" | "last90d" | "alltime"

export interface AnalyticsMetrics {
  averageScore: number | null
  bestRound: { strokes: number; roundId: string } | null
  scoringTrend: { slope: number; label: string }
  firPercentage: number | null
  girPercentage: number | null
  puttsPerRound: number | null
  puttsPerHole: number | null
  threePuttPercentage: number | null
  clubUsage: { clubName: string; shots: number; percentage: number }[]
  handicapTrend: { roundId: string; differential: number; date: number }[]
}

function totalStrokes(round: Round): number {
  return round.holes.reduce((acc, h) =>
    acc + h.shots.length + (h.putts ?? 0) + (h.penalties ?? 0), 0)
}

function linearRegression(y: number[]): number {
  const n = y.length
  if (n < 2) return 0
  const x = y.map((_, i) => i)
  const xMean = x.reduce((a, b) => a + b, 0) / n
  const yMean = y.reduce((a, b) => a + b, 0) / n
  const num = x.reduce((acc, xi, i) => acc + (xi - xMean) * (y[i] - yMean), 0)
  const den = x.reduce((acc, xi) => acc + (xi - xMean) ** 2, 0)
  return den === 0 ? 0 : num / den
}

export function filterByTimeRange(rounds: Round[], range: TimeRange): Round[] {
  if (range === "alltime") return rounds
  if (range === "last10") {
    return [...rounds].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10)
  }
  const days = range === "last30d" ? 30 : 90
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return rounds.filter(r => r.startedAt >= cutoff)
}

export function calcAverageScore(rounds: Round[]): number | null {
  if (rounds.length === 0) return null
  const total = rounds.reduce((acc, r) => acc + totalStrokes(r), 0)
  return total / rounds.length
}

export function calcBestRound(rounds: Round[]): { strokes: number; roundId: string } | null {
  const eighteen = rounds.filter(r => r.holeCount === 18)
  if (eighteen.length === 0) return null
  let best: { strokes: number; roundId: string } | null = null
  for (const r of eighteen) {
    const strokes = totalStrokes(r)
    if (best === null || strokes < best.strokes) {
      best = { strokes, roundId: r.id }
    }
  }
  return best
}

export function calcScoringTrend(rounds: Round[]): { slope: number; label: string } {
  if (rounds.length < 2) return { slope: 0, label: "Stable" }
  const sorted = [...rounds].sort((a, b) => a.startedAt - b.startedAt)
  const y = sorted.map(r => totalStrokes(r))
  const slope = linearRegression(y)
  const label = slope <= -0.3 ? "Improving" : slope >= 0.3 ? "Worsening" : "Stable"
  return { slope, label }
}

export function calcFIRPercentage(rounds: Round[]): number | null {
  const parGt3Holes = rounds.flatMap(r => r.holes.filter(h => h.par > 3))
  const tracked = parGt3Holes.filter(h => h.fairwayHit !== undefined)
  if (tracked.length === 0) return null
  const hit = tracked.filter(h => h.fairwayHit === true).length
  return (hit / tracked.length) * 100
}

export function calcGIRPercentage(rounds: Round[]): number | null {
  const allHoles = rounds.flatMap(r => r.holes)
  const tracked = allHoles.filter(h => h.gir !== undefined)
  if (tracked.length === 0) return null
  const hit = tracked.filter(h => h.gir === true).length
  return (hit / tracked.length) * 100
}

export function calcPuttsPerRound(rounds: Round[]): number | null {
  const roundsWithPutts = rounds.filter(r => r.holes.some(h => h.putts !== undefined))
  if (roundsWithPutts.length === 0) return null
  const total = roundsWithPutts.reduce((acc, r) =>
    acc + r.holes.reduce((sum, h) => sum + (h.putts ?? 0), 0), 0)
  return total / roundsWithPutts.length
}

export function calcPuttsPerHole(rounds: Round[]): number | null {
  const holesWithPutts = rounds.flatMap(r => r.holes).filter(h => h.putts !== undefined)
  if (holesWithPutts.length === 0) return null
  const total = holesWithPutts.reduce((acc, h) => acc + (h.putts ?? 0), 0)
  return total / holesWithPutts.length
}

export function calcThreePuttPercentage(rounds: Round[]): number | null {
  const holesWithPutts = rounds.flatMap(r => r.holes).filter(h => h.putts !== undefined)
  if (holesWithPutts.length === 0) return null
  const threePutts = holesWithPutts.filter(h => (h.putts ?? 0) >= 3).length
  return (threePutts / holesWithPutts.length) * 100
}

export function calcClubUsage(rounds: Round[], clubs: Club[]): { clubName: string; shots: number; percentage: number }[] {
  const clubMap = new Map(clubs.map(c => [c.id, c.name]))
  const counts: Record<string, number> = {}
  for (const round of rounds) {
    for (const hole of round.holes) {
      for (const shot of hole.shots) {
        const name = clubMap.get(shot.clubId) ?? shot.clubId
        if (name.toLowerCase().includes("putter")) continue
        counts[shot.clubId] = (counts[shot.clubId] ?? 0) + 1
      }
    }
  }
  const entries = Object.entries(counts)
  if (entries.length === 0) return []
  const totalShots = entries.reduce((acc, [, n]) => acc + n, 0)
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([clubId, shots]) => ({
      clubName: clubMap.get(clubId) ?? clubId,
      shots,
      percentage: Math.round((shots / totalShots) * 100),
    }))
}

export function calcHandicapTrend(rounds: Round[]): { roundId: string; differential: number; date: number }[] {
  return rounds
    .filter(r => r.scoreDifferential != null)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map(r => ({
      roundId: r.id,
      differential: r.scoreDifferential as number,
      date: r.startedAt,
    }))
}
