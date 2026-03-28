// Skins game logic engine
// Pure TypeScript — all calculations are client-side, no external dependencies

import type { SettlementEntry } from './types'

export interface SkinsWonEntry {
  holes: number[]
  count: number
}

export interface SkinsState {
  stakePerSkin: number
  skinsWon: Record<string, SkinsWonEntry> // playerId → holes won + count
  currentCarry: number // number of skins accumulated in the current carry
  potValue: number // currentCarry * stakePerSkin
  lastWinnerId: string | null // playerId of last player to win a skin (for final carry resolution)
}

/**
 * Build an initial SkinsState for a new round.
 */
export function createSkinsState(playerIds: string[], stakePerSkin: number): SkinsState {
  const skinsWon: Record<string, SkinsWonEntry> = {}
  for (const id of playerIds) {
    skinsWon[id] = { holes: [], count: 0 }
  }
  return {
    stakePerSkin,
    skinsWon,
    currentCarry: 1, // hole 1 starts with 1 skin in play
    potValue: stakePerSkin,
    lastWinnerId: null,
  }
}

/**
 * Process one hole and return the updated SkinsState.
 *
 * scores: Record<playerId, strokesForThisHole> — must include all players
 * holeNumber: 1-based hole number
 * prevState: the state coming into this hole
 *
 * Rules:
 *   - Lowest unique score wins all skins currently in play (currentCarry)
 *   - On a tie for low score: no winner, skin carries to next hole
 *   - After the final hole (18): any remaining carry goes to the lastWinnerId;
 *     if there has been no winner at all, split evenly (handled in getSkinsSettlement)
 */
export function calculateSkinsForHole(
  holeNumber: number,
  scores: Record<string, number>,
  prevState: SkinsState,
): SkinsState {
  const playerIds = Object.keys(scores)
  const strokeValues = Object.values(scores)

  const minScore = Math.min(...strokeValues)
  const playersWithMin = playerIds.filter((id) => scores[id] === minScore)

  const isTie = playersWithMin.length > 1

  if (isTie) {
    // Carry the current skin(s) forward plus the next hole's skin
    const nextCarry = prevState.currentCarry + 1
    return {
      ...prevState,
      skinsWon: { ...prevState.skinsWon },
      currentCarry: nextCarry,
      potValue: nextCarry * prevState.stakePerSkin,
    }
  }

  // Single winner
  const winnerId = playersWithMin[0]
  const updatedEntry = {
    holes: [...prevState.skinsWon[winnerId].holes, holeNumber],
    count: prevState.skinsWon[winnerId].count + prevState.currentCarry,
  }

  const updatedSkinsWon: Record<string, SkinsWonEntry> = {
    ...prevState.skinsWon,
    [winnerId]: updatedEntry,
  }

  return {
    ...prevState,
    skinsWon: updatedSkinsWon,
    currentCarry: 1, // reset to 1 for next hole
    potValue: prevState.stakePerSkin,
    lastWinnerId: winnerId,
  }
}

/**
 * Process all 18 holes and apply final-carry resolution.
 *
 * If there is a carry remaining after hole 18:
 *   - Award it to the last skin winner (standard rule)
 *   - If nobody ever won a skin during the round, the pot splits evenly
 *     (handled in getSkinsSettlement via a null lastWinnerId check)
 *
 * Use this as a convenience wrapper when replaying a full round.
 */
export function calculateSkins(
  allScores: Array<Record<string, number>>, // index 0 = hole 1, index 17 = hole 18
  playerIds: string[],
  stakePerSkin: number,
): SkinsState {
  let state = createSkinsState(playerIds, stakePerSkin)

  for (let i = 0; i < allScores.length; i++) {
    state = calculateSkinsForHole(i + 1, allScores[i], state)
  }

  // Apply final-carry resolution: leftover carry after hole 18 goes to lastWinnerId
  if (state.currentCarry > 1 && state.lastWinnerId !== null) {
    // The carry includes the "next hole" skin that was added but never played
    // Subtract 1 to get the true carryover (hole 18 already added +1 in anticipation of hole 19)
    const carryoverSkins = state.currentCarry - 1
    const winnerId = state.lastWinnerId
    const updatedEntry = {
      holes: [...state.skinsWon[winnerId].holes], // no specific hole for this bonus award
      count: state.skinsWon[winnerId].count + carryoverSkins,
    }
    state = {
      ...state,
      skinsWon: {
        ...state.skinsWon,
        [winnerId]: updatedEntry,
      },
    }
  }

  return state
}

/**
 * Compute the net settlement from a final SkinsState.
 *
 * Each player "buys in" for (totalSkins * stakePerSkin).
 * totalSkins = sum of all skinsWon counts across all players.
 * A player's net = (skinsWon * stakePerSkin) - buyIn.
 * Winners collect from losers proportionally (simplified: pairwise from each loser to each winner).
 *
 * If no player won any skins (all 18 holes were ties), the pot is refunded — returns empty array.
 */
export function getSkinsSettlement(finalState: SkinsState): SettlementEntry[] {
  const { stakePerSkin, skinsWon } = finalState
  const playerIds = Object.keys(skinsWon)

  const totalSkins = playerIds.reduce((sum, id) => sum + skinsWon[id].count, 0)

  if (totalSkins === 0) {
    return [] // full refund — no settlement needed
  }

  const buyIn = totalSkins * stakePerSkin

  // Net per player: positive = they are owed money, negative = they owe money
  const netAmounts: Record<string, number> = {}
  for (const id of playerIds) {
    netAmounts[id] = skinsWon[id].count * stakePerSkin * playerIds.length - buyIn
  }

  // Build pairwise settlement: each net-negative player pays net-positive players
  const winners = playerIds.filter((id) => netAmounts[id] > 0).sort()
  const losers = playerIds.filter((id) => netAmounts[id] < 0).sort()

  const entries: SettlementEntry[] = []
  const remaining = { ...netAmounts }

  for (const loser of losers) {
    let loserOwes = Math.abs(remaining[loser])

    for (const winner of winners) {
      if (loserOwes <= 0) break
      if (remaining[winner] <= 0) continue

      const payment = Math.min(loserOwes, remaining[winner])
      entries.push({
        fromPlayerId: loser,
        toPlayerId: winner,
        amount: Math.round(payment * 100) / 100,
        description: `Skins: ${skinsWon[winner].count} skin${skinsWon[winner].count !== 1 ? 's' : ''} won`,
      })

      remaining[loser] += payment
      remaining[winner] -= payment
      loserOwes -= payment
    }
  }

  return entries
}
