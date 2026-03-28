import { create } from 'zustand'
import type { Friend, FriendRequest, FriendSearchResult, FriendRequestAction } from '../types'
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  searchUsers,
} from '../lib/friends'

interface FriendsStore {
  friends: Friend[]
  pendingRequests: FriendRequest[]  // Incoming requests I haven't responded to
  sentRequests: FriendRequest[]     // Outgoing requests (not yet implemented in RPC, kept for future)

  loading: boolean
  error: string | null

  // Actions
  loadFriends: () => Promise<void>
  loadPendingRequests: () => Promise<void>
  sendRequest: (username: string) => Promise<void>
  respondRequest: (friendshipId: string, action: FriendRequestAction) => Promise<void>
  removeFriend: (friendshipId: string) => Promise<void>
  searchUsers: (query: string) => Promise<FriendSearchResult[]>
  clearError: () => void
}

export const useFriendsStore = create<FriendsStore>((set) => ({
  friends: [],
  pendingRequests: [],
  sentRequests: [],
  loading: false,
  error: null,

  loadFriends: async () => {
    set({ loading: true, error: null })
    try {
      const friends = await getFriends()
      set({ friends, loading: false })
    } catch (err) {
      set({ loading: false, error: (err as Error).message ?? 'Failed to load friends' })
    }
  },

  loadPendingRequests: async () => {
    try {
      const pendingRequests = await getPendingRequests()
      set({ pendingRequests })
    } catch {
      // Non-fatal: silently ignore if RPCs not yet deployed
    }
  },

  sendRequest: async (username: string) => {
    set({ error: null })
    try {
      await sendFriendRequest(username)
    } catch (err) {
      const message = (err as Error).message ?? 'Failed to send friend request'
      set({ error: message })
      throw err
    }
  },

  respondRequest: async (friendshipId: string, action: FriendRequestAction) => {
    set({ error: null })
    try {
      await respondFriendRequest(friendshipId, action)
      // Optimistically remove from pending list
      set(state => ({
        pendingRequests: state.pendingRequests.filter(r => r.friendshipId !== friendshipId),
      }))
    } catch (err) {
      set({ error: (err as Error).message ?? 'Failed to respond to request' })
      throw err
    }
  },

  removeFriend: async (friendshipId: string) => {
    set({ error: null })
    try {
      await removeFriend(friendshipId)
      set(state => ({
        friends: state.friends.filter(f => f.friendshipId !== friendshipId),
      }))
    } catch (err) {
      set({ error: (err as Error).message ?? 'Failed to remove friend' })
      throw err
    }
  },

  searchUsers: async (query: string) => {
    try {
      return await searchUsers(query)
    } catch {
      return []
    }
  },

  clearError: () => set({ error: null }),
}))
