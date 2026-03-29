import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export interface FriendRivalry {
  userId: string
  displayName: string
  username: string | null
  roundsPlayed: number
  /** Positive = this friend owes the current user; negative = current user owes them */
  netBalance: number
  rounds: RivalryRound[]
}

export interface RivalryRound {
  roundId: string
  courseName: string | null
  date: string
  /** Positive = current user won money; negative = current user paid */
  netAmount: number
}

interface SettlementRow {
  id: string
  round_id: string
  from_user_id: string
  to_user_id: string
  net_amount: number
  settled_at: string
  round: { course_name: string | null; created_at: string } | null
}

/**
 * Fetches all settlement history for the given user and aggregates per-friend rivalry data.
 * Returns rivalries sorted by absolute net balance descending.
 */
export async function fetchSettlementHistory(userId: string): Promise<FriendRivalry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('settlement_history')
    .select('*, round:group_rounds(course_name, created_at)')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('settled_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return []

  const rows = data as SettlementRow[]

  // Collect unique friend IDs
  const friendIds = new Set<string>()
  for (const row of rows) {
    const friendId = row.from_user_id === userId ? row.to_user_id : row.from_user_id
    friendIds.add(friendId)
  }

  // Fetch profiles for all friends
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (supabase as any)
    .from('profiles')
    .select('id, display_name, username')
    .in('id', Array.from(friendIds))

  const profileMap = new Map<string, { display_name: string; username: string | null }>()
  for (const p of (profiles ?? []) as Array<{ id: string; display_name: string; username: string | null }>) {
    profileMap.set(p.id, { display_name: p.display_name, username: p.username })
  }

  // Aggregate per friend
  const rivalryMap = new Map<string, FriendRivalry>()
  for (const row of rows) {
    const isFromUser = row.from_user_id === userId
    const friendId = isFromUser ? row.to_user_id : row.from_user_id
    // Convention: from_user_id owes to_user_id net_amount
    // If current user is from_user → they paid → negative for them
    // If current user is to_user → they received → positive for them
    const myNetAmount = isFromUser ? -row.net_amount : row.net_amount

    if (!rivalryMap.has(friendId)) {
      const profile = profileMap.get(friendId)
      rivalryMap.set(friendId, {
        userId: friendId,
        displayName: profile?.display_name ?? 'Unknown Player',
        username: profile?.username ?? null,
        roundsPlayed: 0,
        netBalance: 0,
        rounds: [],
      })
    }

    const rivalry = rivalryMap.get(friendId)!
    rivalry.roundsPlayed++
    rivalry.netBalance += myNetAmount
    rivalry.rounds.push({
      roundId: row.round_id,
      courseName: row.round?.course_name ?? null,
      date: row.settled_at,
      netAmount: myNetAmount,
    })
  }

  return Array.from(rivalryMap.values()).sort(
    (a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance),
  )
}

export type WagerOutcome = 'won' | 'lost' | 'push'

export interface WagerRecord {
  id: string
  date: string
  courseName: string | null
  gameType: string
  outcome: WagerOutcome
  amount: number
}

interface SideGameResultRow {
  id: string
  group_round_id: string
  game_type: string
  winner_player_id: string | null
  loser_player_id: string | null
  amount_owed: number
  created_at: string
  group_round: { course_name: string | null; created_at: string } | null
}

export async function fetchWagerHistory(userId: string): Promise<WagerRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('side_game_results')
    .select('id, group_round_id, game_type, winner_player_id, loser_player_id, amount_owed, created_at, group_round:group_rounds(course_name, created_at)')
    .or(`winner_player_id.eq.${userId},loser_player_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return []

  return (data as SideGameResultRow[]).map(row => {
    const isPush =
      (row.winner_player_id === null && row.loser_player_id === null) ||
      row.amount_owed === 0

    let outcome: WagerOutcome
    if (isPush) {
      outcome = 'push'
    } else if (row.winner_player_id === userId) {
      outcome = 'won'
    } else {
      outcome = 'lost'
    }

    return {
      id: row.id,
      date: row.group_round?.created_at ?? row.created_at,
      courseName: row.group_round?.course_name ?? null,
      gameType: row.game_type,
      outcome,
      amount: row.amount_owed,
    }
  })
}

export function useWagerHistory(userId: string | null) {
  const [wagers, setWagers] = useState<WagerRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchWagerHistory(userId)
      .then(records => {
        if (!cancelled) setWagers(records)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load wager history')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId])

  const netTotal = wagers.reduce((sum, w) => {
    if (w.outcome === 'won') return sum + w.amount
    if (w.outcome === 'lost') return sum - w.amount
    return sum
  }, 0)

  return { wagers, loading, error, netTotal }
}
