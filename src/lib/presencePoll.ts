// THEA-146: Polling fallback for presence when Realtime is unavailable
import { supabase } from './supabase'
import type { FriendRoundInfo } from '../types'

const DEFAULT_INTERVAL_MS = 30_000

let _timer: ReturnType<typeof setInterval> | null = null

interface PollRow {
  friend_user_id: string
  display_name: string
  group_round_id: string
  room_code: string
  course_name: string | null
  player_count: number
}

/**
 * Start polling `get_friends_in_rounds` RPC every `intervalMs` milliseconds.
 * Calls `onUpdate` with the latest list of friends in active group rounds.
 * Polls immediately on call, then on interval.
 */
export function startPresencePolling(
  onUpdate: (friends: FriendRoundInfo[]) => void,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): void {
  stopPresencePolling()

  const poll = async () => {
    try {
      const { data, error } = await supabase.rpc('get_friends_in_rounds')
      if (error || !Array.isArray(data)) return

      const friends: FriendRoundInfo[] = (data as unknown as PollRow[]).map((row) => ({
        userId: row.friend_user_id,
        displayName: row.display_name,
        groupRoundId: row.group_round_id,
        roomCode: row.room_code,
        courseName: row.course_name ?? undefined,
        playerCount: row.player_count,
        maxPlayers: 4,
      }))

      onUpdate(friends)
    } catch {
      // Network or parse error — silently skip, retry on next interval
    }
  }

  void poll()
  _timer = setInterval(() => { void poll() }, intervalMs)
}

/**
 * Stop the polling interval.
 */
export function stopPresencePolling(): void {
  if (_timer !== null) {
    clearInterval(_timer)
    _timer = null
  }
}
