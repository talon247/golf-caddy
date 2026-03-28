// THEA-205: Persist side-game results and settlement history on round completion.
// Called from the SettlementScreen component after a group round ends.

import { supabase } from '../supabase'
import { useToastStore } from '../../store/toastStore'
import type { NetAmount } from './settlement'

export type SideGameResultGameType =
  | 'skins'
  | 'nassau_front'
  | 'nassau_back'
  | 'nassau_overall'
  | 'press'
  | 'stableford'

export interface SideGameResult {
  gameType: SideGameResultGameType
  /** group_round_players.id — nullable for ties with no single winner */
  winnerPlayerId: string | null
  /** group_round_players.id — nullable when not applicable */
  loserPlayerId: string | null
  amountOwed: number
  /** 1-based inclusive hole range, e.g. { lower: 1, upper: 9 } for front 9 */
  holeRange?: { lower: number; upper: number }
  /** Optional extra data: carry count, press sub-id, stableford points, etc. */
  metadata?: Record<string, unknown>
}

/**
 * Persist per-game results to `side_game_results`.
 * One row per resolved game segment (skin, nassau leg, press, stableford).
 * On error: shows a toast and does not throw — data is already visible in-round.
 */
export async function persistSideGameResults(
  groupRoundId: string,
  results: SideGameResult[],
): Promise<void> {
  if (results.length === 0) return

  const rows = results.map((r) => ({
    group_round_id: groupRoundId,
    game_type: r.gameType,
    winner_player_id: r.winnerPlayerId ?? null,
    loser_player_id: r.loserPlayerId ?? null,
    amount_owed: r.amountOwed,
    // int4range format expected by PostgREST: "[lower,upper]"
    hole_range: r.holeRange ? `[${r.holeRange.lower},${r.holeRange.upper}]` : null,
    metadata: r.metadata ?? null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('side_game_results').insert(rows)
  if (error) {
    useToastStore.getState().addToast('Could not save game results — they will still show in the round summary.')
  }
}

/**
 * Persist net settlement amounts between authenticated users to `settlement_history`.
 *
 * - Accepts the already-netted `NetAmount[]` from `aggregateSettlement()`.
 * - `playerUserIdMap` maps `group_round_players.id` → `auth.users.id`.
 * - Pairs where either player is a guest (null userId) are silently skipped.
 * - Uses upsert on (round_id, from_user_id, to_user_id) to be idempotent.
 * - On error: shows a toast and does not throw.
 */
export async function persistSettlementHistory(
  roundId: string,
  netAmounts: NetAmount[],
  playerUserIdMap: Record<string, string | null | undefined>,
): Promise<void> {
  const rows = netAmounts
    .map((net) => ({
      fromUserId: playerUserIdMap[net.fromPlayerId] ?? null,
      toUserId: playerUserIdMap[net.toPlayerId] ?? null,
      netAmount: net.totalAmount,
    }))
    .filter(
      (row): row is { fromUserId: string; toUserId: string; netAmount: number } =>
        row.fromUserId != null && row.toUserId != null,
    )
    .map((row) => ({
      round_id: roundId,
      from_user_id: row.fromUserId,
      to_user_id: row.toUserId,
      net_amount: row.netAmount,
    }))

  if (rows.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('settlement_history')
    .upsert(rows, { onConflict: 'round_id,from_user_id,to_user_id' })

  if (error) {
    useToastStore.getState().addToast('Could not save settlement history — results are still visible in-round.')
  }
}
