// Press logic engine — sub-bet of Nassau
//
// A press is triggered automatically when a player is down by `triggerThreshold` holes
// in any Nassau bet segment. The press creates an independent sub-bet from the next hole
// through the end of that segment. Multiple presses can stack: a second press triggers
// when the deficit doubles the threshold, a third when it triples it, and so on.

import type { NassauState } from './nassau'
import type { SettlementEntry } from './types'

export type BetSegment = 'nassau_front' | 'nassau_back' | 'nassau_overall'

export interface Press {
  id: string
  parentBet: BetSegment
  triggeredByPlayerId: string
  startHole: number
  endHole: number // 9 for front, 18 for back/overall
  standing: Record<string, number> // playerId → holes won within press range
  winner: string | null
}

export interface PressState {
  presses: Press[]
  pressEnabled: boolean
  triggerThreshold: number
}

export function createPressState(
  pressEnabled = true,
  triggerThreshold = 2,
): PressState {
  return { presses: [], pressEnabled, triggerThreshold }
}

const BET_END_HOLE: Record<BetSegment, number> = {
  nassau_front: 9,
  nassau_back: 18,
  nassau_overall: 18,
}

function getSegmentStanding(
  bet: BetSegment,
  nassauState: NassauState,
): Record<string, number> {
  if (bet === 'nassau_front') return nassauState.frontStanding
  if (bet === 'nassau_back') return nassauState.backStanding
  return nassauState.overallStanding
}

function activeSegmentsForHole(holeNumber: number): BetSegment[] {
  const segments: BetSegment[] = ['nassau_overall']
  if (holeNumber <= 9) segments.push('nassau_front')
  if (holeNumber >= 10) segments.push('nassau_back')
  return segments
}

/**
 * After processing a hole, check whether any new presses should be triggered.
 * A press fires when floor(deficit / threshold) exceeds the number of presses
 * already active for that loser / bet / opponent combination.
 *
 * Call this AFTER calculateNassauForHole and BEFORE updatePressStandings.
 */
export function checkPressTrigger(
  holeNumber: number,
  nassauState: NassauState,
  pressState: PressState,
): PressState {
  if (!pressState.pressEnabled) return pressState

  const players = Object.keys(nassauState.frontStanding)
  if (players.length < 2) return pressState

  const { triggerThreshold } = pressState
  // Work on a mutable copy so we can check against newly added presses within
  // the same hole.
  const newPresses: Press[] = [...pressState.presses]

  for (const bet of activeSegmentsForHole(holeNumber)) {
    const endHole = BET_END_HOLE[bet]
    // A press starting on the last hole is meaningless — skip.
    if (holeNumber >= endHole) continue

    const standing = getSegmentStanding(bet, nassauState)

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i]
        const p2 = players[j]
        const p1Wins = standing[p1] ?? 0
        const p2Wins = standing[p2] ?? 0
        const rawDiff = p1Wins - p2Wins // positive = p1 leading

        const maybeTrigger = (loser: string, opponent: string, deficit: number) => {
          if (deficit < triggerThreshold) return
          const expectedCount = Math.floor(deficit / triggerThreshold)
          // Count existing presses for exactly this loser/opponent/bet triple.
          const existingCount = newPresses.filter(p => {
            const keys = Object.keys(p.standing)
            return (
              p.parentBet === bet &&
              p.triggeredByPlayerId === loser &&
              keys.length === 2 &&
              keys.includes(loser) &&
              keys.includes(opponent)
            )
          }).length
          if (expectedCount <= existingCount) return

          newPresses.push({
            id: crypto.randomUUID(),
            parentBet: bet,
            triggeredByPlayerId: loser,
            startHole: holeNumber + 1,
            endHole,
            standing: { [loser]: 0, [opponent]: 0 },
            winner: null,
          })
        }

        if (rawDiff < 0) maybeTrigger(p1, p2, Math.abs(rawDiff))
        if (rawDiff > 0) maybeTrigger(p2, p1, rawDiff)
      }
    }
  }

  if (newPresses.length === pressState.presses.length) return pressState
  return { ...pressState, presses: newPresses }
}

/**
 * Apply one hole's scores to all active press standings.
 * Resolves the winner of any press whose endHole matches holeNumber.
 *
 * Call this AFTER checkPressTrigger for the same hole.
 */
export function updatePressStandings(
  holeNumber: number,
  scores: Record<string, number>,
  pressState: PressState,
): PressState {
  if (pressState.presses.length === 0) return pressState

  const updatedPresses = pressState.presses.map((press): Press => {
    if (holeNumber < press.startHole || holeNumber > press.endHole) return press

    const pressPlayers = Object.keys(press.standing)
    // Bail if any player's score is missing for this hole.
    if (pressPlayers.some(p => scores[p] === undefined)) return press

    const minScore = Math.min(...pressPlayers.map(p => scores[p]))
    const holeWinners = pressPlayers.filter(p => scores[p] === minScore)

    const newStanding = { ...press.standing }
    // Ties award nobody.
    if (holeWinners.length === 1) {
      newStanding[holeWinners[0]] = (newStanding[holeWinners[0]] ?? 0) + 1
    }

    // Resolve winner once the press reaches its last hole.
    let winner = press.winner
    if (holeNumber === press.endHole && pressPlayers.length === 2) {
      const [a, b] = pressPlayers
      const aWins = newStanding[a] ?? 0
      const bWins = newStanding[b] ?? 0
      if (aWins > bWins) winner = a
      else if (bWins > aWins) winner = b
      // else tie — winner stays null
    }

    return { ...press, standing: newStanding, winner }
  })

  return { ...pressState, presses: updatedPresses }
}

/**
 * Compute settlement entries for all completed (or in-progress) presses.
 * Ties produce no entry. Stakes equal the corresponding Nassau segment stake.
 */
export function getPressSettlement(
  pressState: PressState,
  nassauStakes: { front: number; back: number; overall: number },
): SettlementEntry[] {
  const entries: SettlementEntry[] = []

  for (const press of pressState.presses) {
    const pressPlayers = Object.keys(press.standing)
    if (pressPlayers.length !== 2) continue

    const [p1, p2] = pressPlayers
    const p1Wins = press.standing[p1] ?? 0
    const p2Wins = press.standing[p2] ?? 0
    if (p1Wins === p2Wins) continue // tie

    const stake =
      press.parentBet === 'nassau_front'
        ? nassauStakes.front
        : press.parentBet === 'nassau_back'
          ? nassauStakes.back
          : nassauStakes.overall

    const betLabel =
      press.parentBet === 'nassau_front'
        ? 'Front 9'
        : press.parentBet === 'nassau_back'
          ? 'Back 9'
          : 'Overall'

    const description = `Press (${betLabel}, h${press.startHole}–${press.endHole})`

    if (p1Wins > p2Wins) {
      entries.push({ fromPlayerId: p2, toPlayerId: p1, amount: stake, description })
    } else {
      entries.push({ fromPlayerId: p1, toPlayerId: p2, amount: stake, description })
    }
  }

  return entries
}
