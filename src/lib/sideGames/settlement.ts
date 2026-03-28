// Settlement aggregation — collects all SettlementEntry arrays from each active game
// engine, groups by player pair, and nets to a single directional amount per pair.

import type { SettlementEntry } from './types'
import type { SideGameComputedState } from '../../hooks/useSideGameState'
import type { SideGameConfig } from '../../types'
import { getSkinsSettlement } from './skins'
import { getNassauSettlement } from './nassau'
import { getPressSettlement } from './press'
import { getStablefordSettlement } from './stableford'

/** A single net settlement line: fromPlayerId owes toPlayerId totalAmount. */
export interface NetAmount {
  fromPlayerId: string
  toPlayerId: string
  /** Rounded to cents. 0 means all square (should be filtered by caller). */
  totalAmount: number
  /** Source entries that contributed to this net, for breakdown display. */
  breakdown: SettlementEntry[]
}

/**
 * Aggregate all game-engine settlement entries into net per-player-pair amounts.
 *
 * - Collects SettlementEntry[] from every active engine (skins, nassau, press, stableford).
 * - Groups entries by canonical pair key (sorted player IDs).
 * - Nets opposing entries so each pair has exactly one directional total.
 * - Returns pairs sorted by totalAmount descending (largest debt first).
 * - Pairs with a net of $0 are omitted (all square).
 *
 * stableford entries carry amount=0, so they appear only in breakdown text.
 */
export function aggregateSettlement(
  state: SideGameComputedState,
  config: SideGameConfig,
  playerIds: string[],
): NetAmount[] {
  const allEntries: SettlementEntry[] = []

  if (state.skins) {
    allEntries.push(...getSkinsSettlement(state.skins))
  }

  if (state.nassau) {
    allEntries.push(...getNassauSettlement(state.nassau, playerIds))
  }

  if (state.press && state.nassau) {
    allEntries.push(
      ...getPressSettlement(state.press, {
        front: config.nassauStakeFront ?? 1,
        back: config.nassauStakeBack ?? 1,
        overall: config.nassauStakeOverall ?? 1,
      }),
    )
  }

  if (state.stableford) {
    allEntries.push(...getStablefordSettlement(state.stableford))
  }

  // Group by canonical pair key: sort([from, to]).join('|')
  // net value is in the canonical direction (first id → second id):
  //   positive → first id owes second id
  //   negative → second id owes first id
  const pairMap = new Map<string, { first: string; second: string; net: number; breakdown: SettlementEntry[] }>()

  for (const entry of allEntries) {
    const [first, second] = [entry.fromPlayerId, entry.toPlayerId].sort()
    const key = `${first}|${second}`

    // Signed delta in first→second direction
    const delta = entry.fromPlayerId === first ? entry.amount : -entry.amount

    const existing = pairMap.get(key)
    if (existing) {
      existing.net += delta
      existing.breakdown.push(entry)
    } else {
      pairMap.set(key, { first, second, net: delta, breakdown: [entry] })
    }
  }

  const results: NetAmount[] = []

  for (const { first, second, net, breakdown } of pairMap.values()) {
    const rounded = Math.round(net * 100) / 100

    // Skip all-square pairs
    if (Math.abs(rounded) < 0.005) continue

    if (rounded > 0) {
      // first owes second
      results.push({ fromPlayerId: first, toPlayerId: second, totalAmount: rounded, breakdown })
    } else {
      // second owes first
      results.push({ fromPlayerId: second, toPlayerId: first, totalAmount: Math.round(-net * 100) / 100, breakdown })
    }
  }

  // Sort: largest amount first
  results.sort((a, b) => b.totalAmount - a.totalAmount)

  return results
}
