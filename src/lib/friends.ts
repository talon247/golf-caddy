/**
 * friends.ts — API wrapper around Supabase RPCs for the friends system.
 * RPCs are defined in THEA-162 (schema + migrations).
 * All calls are stubbed to fail gracefully if RPCs don't exist yet.
 */
import { supabase } from './supabase'
import type { Friend, FriendRequest, FriendSearchResult, FriendRequestAction } from '../types'

// ── Friend list ────────────────────────────────────────────────────────────

export async function getFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('get_friends', { p_status: 'accepted' })
  if (error) throw error
  if (!Array.isArray(data)) return []
  return (data as Array<Record<string, unknown>>).map(row => ({
    friendshipId: row.friendship_id as string,
    friendUserId: row.friend_user_id as string,
    displayName: row.display_name as string,
    username: row.username as string,
    handicapIndex: (row.handicap_index as number | null) ?? null,
  }))
}

export async function getPendingRequests(): Promise<FriendRequest[]> {
  // Incoming pending requests (addressee = me, status = pending)
  const { data, error } = await supabase.rpc('get_friends', { p_status: 'pending' })
  if (error) throw error
  if (!Array.isArray(data)) return []
  return (data as Array<Record<string, unknown>>).map(row => ({
    friendshipId: row.friendship_id as string,
    userId: row.friend_user_id as string,
    displayName: row.display_name as string,
    username: row.username as string,
    createdAt: row.created_at as string,
  }))
}

// ── Send / respond / remove ────────────────────────────────────────────────

export async function sendFriendRequest(addresseeUsername: string): Promise<void> {
  const { error } = await supabase.rpc('send_friend_request', {
    p_addressee_username: addresseeUsername,
  })
  if (error) throw error
}

export async function respondFriendRequest(
  friendshipId: string,
  action: FriendRequestAction,
): Promise<void> {
  const { error } = await supabase.rpc('respond_friend_request', {
    p_friendship_id: friendshipId,
    p_action: action,
  })
  if (error) throw error
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_friend', {
    p_friendship_id: friendshipId,
  })
  if (error) throw error
}

// ── Search ─────────────────────────────────────────────────────────────────

export async function searchUsers(query: string): Promise<FriendSearchResult[]> {
  const { data, error } = await supabase.rpc('search_users', { p_query: query })
  if (error) throw error
  if (!Array.isArray(data)) return []
  return (data as Array<Record<string, unknown>>).map(row => ({
    userId: row.user_id as string,
    displayName: row.display_name as string,
    username: row.username as string,
    isFriend: row.is_friend as boolean,
    hasPendingRequest: row.has_pending_request as boolean,
  }))
}

// ── Username ───────────────────────────────────────────────────────────────

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_username_available', {
    p_username: username,
  })
  if (error) throw error
  return (data as { available: boolean })?.available ?? false
}

export async function setUsername(userId: string, username: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', userId)
  if (error) throw error
}
