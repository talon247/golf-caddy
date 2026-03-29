import { supabase } from '../supabase'

export interface PostRoundSettlementPair {
  fromUserId: string
  toUserId: string
  fromDisplayName: string
  toDisplayName: string
  amount: number
}

/**
 * Fetches settlement data for a completed round from settlement_history.
 * Returns null if no data exists (round wasn't a group round with side games,
 * user is not authenticated, or data hasn't been persisted yet).
 */
export async function fetchRoundSettlement(
  roundId: string,
): Promise<PostRoundSettlementPair[] | null> {
  const { data, error } = await supabase
    .from('settlement_history')
    .select('from_user_id, to_user_id, net_amount')
    .eq('round_id', roundId)

  if (error || !data || data.length === 0) return null

  const userIds = new Set<string>()
  for (const row of data) {
    userIds.add(row.from_user_id)
    userIds.add(row.to_user_id)
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', Array.from(userIds))

  const nameMap = new Map<string, string>()
  for (const p of (profiles ?? []) as Array<{ id: string; display_name: string }>) {
    nameMap.set(p.id, p.display_name)
  }

  return data.map((row) => ({
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    fromDisplayName: nameMap.get(row.from_user_id) ?? 'Unknown',
    toDisplayName: nameMap.get(row.to_user_id) ?? 'Unknown',
    amount: row.net_amount,
  }))
}
