// Nassau game logic engine
// Pure TypeScript — all calculations are client-side, no external dependencies
//
// Nassau is 3 independent bets: front 9 (holes 1-9), back 9 (holes 10-18), overall (holes 1-18).
// Each bet is settled independently. For 3-4 players, every player pair has an independent
// Nassau bet with the same stake. Standings track raw holes won per player per segment;
// pairwise margins are derived in settlement (standing[A] - standing[B] for a 2-player game).

import type { SettlementEntry } from './types'

export interface NassauState {
  stakeFront: number
  stakeBack: number
  stakeOverall: number
  // Holes won per player in each segment (raw count — not a relative +/- margin)
  // For 2 players: holes up = frontStanding[A] - frontStanding[B]
  // For 3-4 players: each pair settles independently from their raw win counts
  frontStanding: Record<string, number>
  backStanding: Record<string, number>
  overallStanding: Record<string, number>
  // Locked after the segment completes; null for ties or 3+ player games
  frontWinner: string | null
  backWinner: string | null
  overallWinner: string | null
}

/**
 * Build an initial NassauState for a new round.
 */
export function createNassauState(
  playerIds: string[],
  stakeFront: number,
  stakeBack: number,
  stakeOverall: number,
): NassauState {
  const zeroed: Record<string, number> = {}
  for (const id of playerIds) {
    zeroed[id] = 0
  }
  return {
    stakeFront,
    stakeBack,
    stakeOverall,
    frontStanding: { ...zeroed },
    backStanding: { ...zeroed },
    overallStanding: { ...zeroed },
    frontWinner: null,
    backWinner: null,
    overallWinner: null,
  }
}

/**
 * Process one hole and return the updated NassauState.
 *
 * scores:      Record<playerId, strokesForThisHole> — must include all players
 * holeNumber:  1-based hole number (1–18)
 * prevState:   the state entering this hole
 *
 * Rules:
 *   - Lowest score on a hole wins that hole for the player
 *   - Ties = no hole awarded to anyone
 *   - Front 9 winner locked at hole 9
 *   - Back 9 and overall winners locked at hole 18
 */
export function calculateNassauForHole(
  holeNumber: number,
  scores: Record<string, number>,
  prevState: NassauState,
): NassauState {
  const players = Object.keys(scores)
  const minScore = Math.min(...Object.values(scores))
  const holeWinners = players.filter((p) => scores[p] === minScore)

  const state: NassauState = {
    ...prevState,
    frontStanding: { ...prevState.frontStanding },
    backStanding: { ...prevState.backStanding },
    overallStanding: { ...prevState.overallStanding },
  }

  // Only award the hole if there is a unique winner (ties count for nobody)
  if (holeWinners.length === 1) {
    const winner = holeWinners[0]

    // Overall tracks all 18 holes
    state.overallStanding[winner] = (state.overallStanding[winner] ?? 0) + 1

    // Front 9: holes 1–9
    if (holeNumber <= 9) {
      state.frontStanding[winner] = (state.frontStanding[winner] ?? 0) + 1
    }

    // Back 9: holes 10–18
    if (holeNumber >= 10) {
      state.backStanding[winner] = (state.backStanding[winner] ?? 0) + 1
    }
  }

  // Lock front 9 winner at hole 9
  if (holeNumber === 9 && state.frontWinner === null) {
    state.frontWinner = resolveTwoPlayerWinner(state.frontStanding, players)
  }

  // Lock back 9 and overall winners at hole 18
  if (holeNumber === 18) {
    if (state.backWinner === null) {
      state.backWinner = resolveTwoPlayerWinner(state.backStanding, players)
    }
    if (state.overallWinner === null) {
      state.overallWinner = resolveTwoPlayerWinner(state.overallStanding, players)
    }
  }

  return state
}

/**
 * For a 2-player game, returns the player with more holes won, or null on a tie.
 * For 3+ players, returns null — settlement handles multi-player results pairwise.
 */
function resolveTwoPlayerWinner(
  standing: Record<string, number>,
  players: string[],
): string | null {
  if (players.length !== 2) return null
  const [a, b] = players
  const aWins = standing[a] ?? 0
  const bWins = standing[b] ?? 0
  if (aWins > bWins) return a
  if (bWins > aWins) return b
  return null // tie
}

/**
 * Compute the net settlement from a completed NassauState.
 *
 * For every player pair and every bet (front / back / overall):
 *   - The player with more holes won in that segment wins the stake from the other
 *   - A tie = no payout for that bet between that pair
 *
 * Works for 2, 3, and 4 players. 3-4 player rounds produce one SettlementEntry
 * per pair per bet (up to 3 pairs × 3 bets = 9 entries for a 4-player round).
 */
export function getNassauSettlement(
  finalState: NassauState,
  players: string[],
): SettlementEntry[] {
  const entries: SettlementEntry[] = []

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i]
      const p2 = players[j]

      const frontEntry = settlePair(
        p1, p2, finalState.frontStanding, finalState.stakeFront, 'Nassau Front 9',
      )
      if (frontEntry) entries.push(frontEntry)

      const backEntry = settlePair(
        p1, p2, finalState.backStanding, finalState.stakeBack, 'Nassau Back 9',
      )
      if (backEntry) entries.push(backEntry)

      const overallEntry = settlePair(
        p1, p2, finalState.overallStanding, finalState.stakeOverall, 'Nassau Overall',
      )
      if (overallEntry) entries.push(overallEntry)
    }
  }

  return entries
}

function settlePair(
  p1: string,
  p2: string,
  standing: Record<string, number>,
  stake: number,
  description: string,
): SettlementEntry | null {
  const p1Wins = standing[p1] ?? 0
  const p2Wins = standing[p2] ?? 0

  if (p1Wins > p2Wins) {
    return { fromPlayerId: p2, toPlayerId: p1, amount: stake, description }
  }
  if (p2Wins > p1Wins) {
    return { fromPlayerId: p1, toPlayerId: p2, amount: stake, description }
  }
  return null // tie — no payout for this bet
}
