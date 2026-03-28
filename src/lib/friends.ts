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
    friendshipId: row.friendshipId as string,
    friendUserId: row.friendUserId as string,
    displayName: row.displayName as string,
    username: row.username as string,
    handicapIndex: (row.handicapIndex as number | null) ?? null,
  }))
}

export async function getPendingRequests(): Promise<FriendRequest[]> {
  // Incoming pending requests (addressee = me, status = pending)
  const { data, error } = await supabase.rpc('get_friends', { p_status: 'pending' })
  if (error) throw error
  if (!Array.isArray(data)) return []
  return (data as Array<Record<string, unknown>>)
    // Only show incoming requests (where current user is the addressee)
    .filter(row => row.isIncoming === true)
    .map(row => ({
      friendshipId: row.friendshipId as string,
      userId: row.friendUserId as string,
      displayName: row.displayName as string,
      username: row.username as string,
      createdAt: (row.createdAt as string) ?? '',
    }))
}

// ── Send / respond / remove ────────────────────────────────────────────────

export async function sendFriendRequest(addresseeUsername: string): Promise<void> {
  const { data, error } = await supabase.rpc('send_friend_request', {
    p_addressee_username: addresseeUsername,
  })
  if (error) throw error
  const result = data as { success: boolean; error?: string } | null
  if (!result?.success) {
    const code = result?.error ?? 'unknown_error'
    const messages: Record<string, string> = {
      unauthenticated: 'You must be signed in to send friend requests.',
      user_not_found: 'User not found.',
      self_request: 'You cannot add yourself.',
      requests_disabled: 'That user is not accepting friend requests.',
      already_exists: 'Friend request already sent or you are already friends.',
    }
    throw new Error(messages[code] ?? `Failed to send friend request (${code})`)
  }
}

export async function respondFriendRequest(
  friendshipId: string,
  action: FriendRequestAction,
): Promise<void> {
  const { data, error } = await supabase.rpc('respond_friend_request', {
    p_friendship_id: friendshipId,
    p_action: action,
  })
  if (error) throw error
  const result = data as { success: boolean; error?: string } | null
  if (!result?.success) {
    const code = result?.error ?? 'unknown_error'
    const messages: Record<string, string> = {
      unauthenticated: 'You must be signed in to respond to friend requests.',
      invalid_action: 'Invalid action.',
      not_found: 'Friend request not found. It may have been withdrawn.',
      not_addressee: 'You can only respond to requests sent to you.',
      already_responded: 'This request has already been responded to.',
    }
    throw new Error(messages[code] ?? `Failed to respond to friend request (${code})`)
  }
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const { data, error } = await supabase.rpc('remove_friend', {
    p_friendship_id: friendshipId,
  })
  if (error) throw error
  const result = data as { success: boolean; error?: string } | null
  if (!result?.success) {
    throw new Error(result?.error ?? 'Failed to remove friend')
  }
}

// ── Search ─────────────────────────────────────────────────────────────────

export async function searchUsers(query: string): Promise<FriendSearchResult[]> {
  const { data, error } = await supabase.rpc('search_users', { p_query: query })
  if (error) throw error
  if (!Array.isArray(data)) {
    const result = data as { success?: boolean; error?: string } | null
    if (result?.error) throw new Error(result.error)
    return []
  }
  return (data as Array<Record<string, unknown>>).map(row => ({
    userId: row.userId as string,
    displayName: row.displayName as string,
    username: row.username as string,
    isFriend: row.isFriend as boolean,
    hasPendingRequest: row.hasPendingRequest as boolean,
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
