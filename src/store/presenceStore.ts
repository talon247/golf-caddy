// THEA-146: Presence store — online friends, friends-in-rounds derived list
import { create } from 'zustand'
import type { PresenceState, FriendRoundInfo } from '../types'
import {
  setupPresenceChannel,
  trackPresence,
  teardownPresenceChannel,
} from '../lib/presence'

interface PresenceStoreState {
  /** Friends who are currently online (keyed by userId). Excludes self. */
  onlineFriends: Map<string, PresenceState>
  /** Derived: friends in an active, joinable group round. */
  friendsInRounds: FriendRoundInfo[]

  // Internal — not for external consumption
  _allPresence: Map<string, PresenceState>
  _friendIds: Set<string>
  _myUserId: string | null
}

interface PresenceStoreActions {
  /**
   * Join the global presence channel and start tracking.
   * If `presenceVisible` is false, skips joining (privacy mode).
   */
  initPresence: (userId: string, displayName: string, presenceVisible: boolean) => void
  /**
   * Update the current user's tracked presence payload.
   * Called when starting/ending a group round.
   */
  updateMyPresence: (patch: Partial<PresenceState>) => Promise<void>
  /**
   * Supply the current user's accepted friend IDs.
   * Called by the friends system after loading friends.
   * Triggers a re-derive of onlineFriends and friendsInRounds.
   */
  setFriendIds: (ids: string[]) => void
  /** Unsubscribe and reset presence state (called on sign-out). */
  teardown: () => void
}

type PresenceStore = PresenceStoreState & PresenceStoreActions

function deriveFromPresence(
  allPresence: Map<string, PresenceState>,
  friendIds: Set<string>,
  myUserId: string | null,
): { onlineFriends: Map<string, PresenceState>; friendsInRounds: FriendRoundInfo[] } {
  const onlineFriends = new Map<string, PresenceState>()
  const friendsInRounds: FriendRoundInfo[] = []

  for (const [userId, state] of allPresence.entries()) {
    if (userId === myUserId) continue
    if (!friendIds.has(userId)) continue

    onlineFriends.set(userId, state)

    if (
      state.status === 'in_round' &&
      state.joinable &&
      state.groupRoundId &&
      state.roomCode
    ) {
      friendsInRounds.push({
        userId,
        displayName: state.displayName,
        groupRoundId: state.groupRoundId,
        roomCode: state.roomCode,
        courseName: state.courseName,
        currentHole: state.currentHole,
        playerCount: state.playerCount ?? 1,
        maxPlayers: state.maxPlayers,
      })
    }
  }

  return { onlineFriends, friendsInRounds }
}

export const usePresenceStore = create<PresenceStore>((set, get) => ({
  onlineFriends: new Map(),
  friendsInRounds: [],
  _allPresence: new Map(),
  _friendIds: new Set(),
  _myUserId: null,

  initPresence: (userId, displayName, presenceVisible) => {
    if (!presenceVisible) return

    set({ _myUserId: userId })

    setupPresenceChannel(
      userId,
      { displayName, status: 'online', joinable: false, maxPlayers: 4 },
      (allPresence) => {
        const { _friendIds, _myUserId } = get()
        const { onlineFriends, friendsInRounds } = deriveFromPresence(
          allPresence,
          _friendIds,
          _myUserId,
        )
        set({ _allPresence: allPresence, onlineFriends, friendsInRounds })
      },
    )
  },

  updateMyPresence: async (patch) => {
    await trackPresence(patch)
  },

  setFriendIds: (ids) => {
    const _friendIds = new Set(ids)
    const { _allPresence, _myUserId } = get()
    const { onlineFriends, friendsInRounds } = deriveFromPresence(
      _allPresence,
      _friendIds,
      _myUserId,
    )
    set({ _friendIds, onlineFriends, friendsInRounds })
  },

  teardown: () => {
    teardownPresenceChannel()
    set({
      onlineFriends: new Map(),
      friendsInRounds: [],
      _allPresence: new Map(),
      _friendIds: new Set(),
      _myUserId: null,
    })
  },
}))
