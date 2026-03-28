import { describe, it, expect } from 'vitest'
import {
  computeAGS,
  computeScoreDifferential,
  computeHandicapEstimate,
  type RoundDifferential,
} from './calculator'

// ─── computeAGS ───────────────────────────────────────────────────────────────

describe('computeAGS', () => {
  it('caps each hole to par + 5 when no handicap established', () => {
    // Par 4 hole, player took 12 strokes — cap is 4+5=9
    expect(computeAGS([12], [4])).toBe(9)
  })

  it('sums uncapped holes normally when score is within cap', () => {
    // 3 holes, all within par+5 cap
    expect(computeAGS([4, 5, 3], [4, 5, 3])).toBe(12)
  })

  it('applies Net Double Bogey cap when handicap strokes provided', () => {
    // Par 4, 1 stroke → cap = 4+2+1=7; player scored 10
    expect(computeAGS([10], [4], [1])).toBe(7)
  })

  it('mixes capped and uncapped holes', () => {
    // hole1: par4, 0 strokes, score 6 → cap=9, use 6
    // hole2: par4, 1 stroke, score 10 → cap=7, use 7
    expect(computeAGS([6, 10], [4, 4], [0, 1])).toBe(13)
  })
})

// ─── computeScoreDifferential ─────────────────────────────────────────────────

describe('computeScoreDifferential', () => {
  it('calculates differential with known values', () => {
    // (90 - 72) * 113 / 113 = 18.0
    expect(computeScoreDifferential(90, 72, 113)).toBe(18.0)
  })

  it('rounds to 1 decimal place', () => {
    // (85 - 71.5) * 113 / 125 = 13.5 * 0.904 = 12.204 → 12.2
    const result = computeScoreDifferential(85, 71.5, 125)
    expect(result).toBe(12.2)
  })

  it('handles scratch golfer with standard slope', () => {
    // (72 - 72) * 113 / 113 = 0.0
    expect(computeScoreDifferential(72, 72, 113)).toBe(0.0)
  })

  it('handles negative differentials for elite players', () => {
    // (70 - 72) * 113 / 113 = -2.0
    expect(computeScoreDifferential(70, 72, 113)).toBe(-2.0)
  })
})

// ─── computeHandicapEstimate ──────────────────────────────────────────────────

function makeDiffs(values: number[], daysAgo?: number[]): RoundDifferential[] {
  return values.map((d, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (daysAgo?.[i] ?? i))
    return {
      roundId: `round-${i}`,
      differential: d,
      date: date.toISOString(),
    }
  })
}

describe('computeHandicapEstimate', () => {
  it('returns null estimate for fewer than 3 rounds', () => {
    const result = computeHandicapEstimate(makeDiffs([10, 12]))
    expect(result.estimate).toBeNull()
    expect(result.totalRounds).toBe(2)
    expect(result.roundsUsed).toBe(0)
  })

  it('uses best 1 of 3 rounds (3-round table)', () => {
    // diffs: 10, 15, 20 → best 1 = 10 → 10 * 0.96 = 9.6
    const result = computeHandicapEstimate(makeDiffs([10, 15, 20]))
    expect(result.estimate).toBe(9.6)
    expect(result.roundsUsed).toBe(1)
    expect(result.totalRounds).toBe(3)
  })

  it('uses best 2 of 6 rounds (6-round table)', () => {
    // diffs: 8, 10, 12, 14, 16, 18 → best 2 = 8,10 → avg=9 → 9*0.96=8.64 → rounds to 8.6
    const result = computeHandicapEstimate(makeDiffs([8, 10, 12, 14, 16, 18]))
    expect(result.estimate).toBe(8.6)
    expect(result.roundsUsed).toBe(2)
    expect(result.totalRounds).toBe(6)
  })

  it('uses best 8 of 20 rounds (20-round table)', () => {
    // 20 diffs: 5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24
    // best 8 = 5,6,7,8,9,10,11,12 → avg=8.5 → 8.5*0.96=8.16 → 8.2
    const values = Array.from({ length: 20 }, (_, i) => i + 5)
    const result = computeHandicapEstimate(makeDiffs(values))
    expect(result.roundsUsed).toBe(8)
    expect(result.totalRounds).toBe(20)
    // avg of 5..12 = 8.5 * 0.96 = 8.16 → raw 8.2
    // lowHI = 5 * 0.96 = 4.8; excess = 8.16 - 7.8 = 0.36 → soft cap = 7.8 + 0.18 = 7.98 → 8.0
    expect(result.estimate).toBe(8.0)
  })

  it('applies soft cap when estimate exceeds lowHI + 3', () => {
    // 20 rounds diffs 1..20: best 8 = 1..8, avg=4.5, raw=4.32
    // lowHI = 1*0.96=0.96; excess = 4.32-(0.96+3)=0.36 → soft cap applied
    const now = new Date()
    const softCapDiffs = Array.from({ length: 20 }, (_, i) => ({
      roundId: `r${i}`,
      differential: i + 1,
      date: new Date(now.getTime() - i * 86400000).toISOString(),
    }))
    const softResult = computeHandicapEstimate(softCapDiffs)
    expect(softResult.isCapped).toBe(true)
    expect(softResult.capType).toBe('soft')
    expect(softResult.estimate).toBeLessThan(4.5 * 0.96) // capped below raw estimate
  })

  it('applies hard cap when estimate exceeds lowHI + 5', () => {
    // 20 rounds with diffs 1..20
    // best 8 = 1..8, avg=4.5, *0.96=4.32, lowHI=0.96
    // 4.32 > 0.96+3=3.96 → soft cap (not hard in this case)
    // For hard cap: need estimate > lowHI+5
    // Use 20 rounds with diffs 10..29 → best 8 = 10..17, avg=13.5, *0.96=12.96
    // lowHI = 10*0.96 = 9.6
    // 12.96 > 9.6+5=14.6? No.
    // Need bigger spread: diffs 1, 20,20,...20 (19 rounds of 20, 1 round of 1)
    // best 8 of 20: eight 20s and one 1 → sorted: 1,20,20... → best 8 = 1,20,20,20,20,20,20,20
    // avg=(1+7*20)/8=(1+140)/8=141/8=17.625 *0.96=16.92
    // lowHI = 1*0.96=0.96
    // 16.92 > 0.96+5=5.96 → hard cap: lowHI+5=5.96
    const now = new Date()
    const hardCapDiffs: RoundDifferential[] = [
      { roundId: 'r0', differential: 1, date: new Date(now.getTime() - 0 * 86400000).toISOString() },
      ...Array.from({ length: 19 }, (_, i) => ({
        roundId: `r${i + 1}`,
        differential: 20,
        date: new Date(now.getTime() - (i + 1) * 86400000).toISOString(),
      })),
    ]
    const hardResult = computeHandicapEstimate(hardCapDiffs)
    expect(hardResult.isCapped).toBe(true)
    expect(hardResult.capType).toBe('hard')
    expect(hardResult.estimate).toBe(0.96 + 5.0) // lowHI + 5
  })

  it('returns isCapped=false when estimate is within Low HI + 3', () => {
    // 3 rounds all same diff: best 1 = same → estimate = diff*0.96
    // lowHI = diff*0.96 → estimate = lowHI → no cap
    const result = computeHandicapEstimate(makeDiffs([10, 10, 10]))
    expect(result.isCapped).toBe(false)
    expect(result.capType).toBeNull()
    expect(result.estimate).toBe(9.6)
  })
})
