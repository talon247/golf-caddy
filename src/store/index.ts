export { useCourseStore } from './courseStore'
export { useGroupRoundStore } from './groupRoundStore'

import { create } from 'zustand'
import type { Club, Round, Shot, UserProfile, SyncQueueItem } from '../types'
import { loadState, saveState, addAbandonedRoundId, type PersistedState } from '../storage'
import { useGroupRoundStore } from './groupRoundStore'
import { useLeaderboardStore } from './leaderboardStore'
import { computeAGS, computeScoreDifferential } from '../lib/handicap/calculator'
import { calcTotalStrokes } from '../utils/scoring'
import { syncRoundToSupabase, acquireSyncLock, releaseSyncLock, abandonRoundInSupabase, deleteRoundInSupabase, lockGroupRoundRounds, markGroupRoundCompleted } from '../lib/sync'
import { computeSideGameState } from '../hooks/useSideGameState'
import { buildSideGameResults, persistSideGameResults, persistSettlementHistory } from '../lib/sideGames/persist'
import { aggregateSettlement } from '../lib/sideGames/settlement'
import { addToQueue, getQueue, processSyncQueue } from '../lib/syncQueue'
import { useToastStore } from './toastStore'

interface StoreState {
  clubBag: Club[]
  rounds: Round[]
  activeRoundId: string | undefined

  // Auth state (NOT persisted)
  userId: string | null
  profile: UserProfile | null
  isAuthenticated: boolean // derived: userId !== null

  // Sync state
  syncStatus: Record<string, 'local' | 'synced' | 'pending' | 'error'>
  syncQueue: SyncQueueItem[]

  // Cache invalidation counter — increments on completeRound so useRounds refetches
  roundsVersion: number

  // Auth actions
  setUserId: (userId: string | null) => void
  setProfile: (profile: UserProfile | null) => void
  setAuthState: (userId: string | null, profile: UserProfile | null) => void
  reconcileSyncOnAuth: (userId: string) => void

  // Sync actions
  markRoundSynced: (roundId: string) => void
  markRoundPending: (roundId: string) => void
  markRoundError: (roundId: string) => void
  queueSync: (item: SyncQueueItem) => void
  dequeueSync: (roundId: string) => void

  // Club bag actions
  addClub: (name: string) => string
  removeClub: (id: string) => void
  updateClubName: (id: string, name: string) => void
  moveClubUp: (id: string) => void
  moveClubDown: (id: string) => void
  loadTemplate: (names: string[]) => void

  // Round actions
  setActiveRoundId: (id: string | undefined) => void
  addRound: (round: Round) => void
  updateRound: (round: Round) => void
  addShot: (roundId: string, holeNumber: number, shot: Shot) => void
  removeLastShot: (roundId: string, holeNumber: number) => void
  removeShot: (roundId: string, holeNumber: number, shotIndex: number) => void
  setHolePar: (roundId: string, holeNumber: number, par: number) => void
  setPutts: (roundId: string, holeNumber: number, putts: number) => void
  setPenalties: (roundId: string, holeNumber: number, penalties: number) => void
  setFairwayHit: (roundId: string, holeNumber: number, hit: boolean) => void
  completeRound: (roundId: string) => void
  deleteRound: (roundId: string) => void
  abandonRound: (roundId: string) => void
}

const initial = loadState()
const initialSyncStatus: Record<string, 'local' | 'synced' | 'pending' | 'error'> =
  initial.syncStatus ?? {}

// Reconcile: rounds present in the persistent sync queue must show as 'pending',
// not 'local'. This fixes the case where the app crashed mid-sync (syncStatus
// was lost / never written) while the queue entry survived in localStorage.
const queuedRoundIds = getQueue().map(i => i.roundId)
let queueReconciled = false
for (const roundId of queuedRoundIds) {
  if (initialSyncStatus[roundId] !== 'synced') {
    initialSyncStatus[roundId] = 'pending'
    queueReconciled = true
  }
}
if (queueReconciled) {
  saveState({ ...initial, syncStatus: initialSyncStatus })
}

function persist(state: Pick<StoreState, 'clubBag' | 'rounds' | 'activeRoundId' | 'syncStatus'>): void {
  const persistedState: PersistedState = {
    clubBag: state.clubBag,
    rounds: state.rounds,
    activeRoundId: state.activeRoundId,
    syncStatus: state.syncStatus,
  }
  saveState(persistedState)
}

export const useAppStore = create<StoreState>((set, get) => ({
  clubBag: initial.clubBag,
  rounds: initial.rounds,
  activeRoundId: initial.activeRoundId,

  // Auth (not persisted — start unauthenticated)
  userId: null,
  profile: null,
  isAuthenticated: false,

  // Sync (persisted)
  syncStatus: initialSyncStatus,
  syncQueue: [],

  // Cache invalidation
  roundsVersion: 0,

  // Auth actions
  setUserId: (userId) => {
    set({ userId, isAuthenticated: userId !== null })
  },

  setProfile: (profile) => {
    set({ profile })
  },

  setAuthState: (userId, profile) => {
    set({ userId, profile, isAuthenticated: userId !== null })
  },

  reconcileSyncOnAuth: (userId) => {
    const state = get()
    const updatedStatus = { ...state.syncStatus }
    let changed = false

    // Completed rounds with no syncStatus entry predate sync tracking — flag as 'local'
    for (const round of state.rounds) {
      if (round.completedAt !== undefined && updatedStatus[round.id] === undefined) {
        updatedStatus[round.id] = 'local'
        changed = true
      }
    }

    if (changed) {
      set({ syncStatus: updatedStatus })
      persist({ ...get(), syncStatus: updatedStatus })
    }

    // Kick off queue processing immediately if we're online
    if (navigator.onLine) {
      void processSyncQueue(userId)
    }
  },

  // Sync actions
  markRoundSynced: (roundId) => {
    const syncStatus = { ...get().syncStatus, [roundId]: 'synced' as const }
    set({ syncStatus })
    persist({ ...get(), syncStatus })
  },

  markRoundPending: (roundId) => {
    const syncStatus = { ...get().syncStatus, [roundId]: 'pending' as const }
    set({ syncStatus })
    persist({ ...get(), syncStatus })
  },

  markRoundError: (roundId) => {
    const syncStatus = { ...get().syncStatus, [roundId]: 'error' as const }
    set({ syncStatus })
    persist({ ...get(), syncStatus })
  },

  queueSync: (item) => {
    const existing = get().syncQueue.filter(i => i.roundId !== item.roundId)
    set({ syncQueue: [...existing, item] })
  },

  dequeueSync: (roundId) => {
    set({ syncQueue: get().syncQueue.filter(i => i.roundId !== roundId) })
  },

  addClub: (name) => {
    const id = crypto.randomUUID()
    const clubs = get().clubBag
    const newClub: Club = { id, name, order: clubs.length }
    const updated = [...clubs, newClub]
    set({ clubBag: updated })
    persist({ ...get(), clubBag: updated })
    return id
  },

  removeClub: (id) => {
    const clubs = get().clubBag
      .filter(c => c.id !== id)
      .map((c, i) => ({ ...c, order: i }))
    set({ clubBag: clubs })
    persist({ ...get(), clubBag: clubs })
  },

  updateClubName: (id, name) => {
    const clubs = get().clubBag.map(c => (c.id === id ? { ...c, name } : c))
    set({ clubBag: clubs })
    persist({ ...get(), clubBag: clubs })
  },

  moveClubUp: (id) => {
    const sorted = [...get().clubBag].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(c => c.id === id)
    if (idx <= 0) return
    const above = sorted[idx - 1]
    const current = sorted[idx]
    const clubs = sorted.map(c => {
      if (c.id === above.id) return { ...c, order: current.order }
      if (c.id === current.id) return { ...c, order: above.order }
      return c
    }).sort((a, b) => a.order - b.order)
    set({ clubBag: clubs })
    persist({ ...get(), clubBag: clubs })
  },

  loadTemplate: (names) => {
    const clubs: Club[] = names.map((name, i) => ({ id: crypto.randomUUID(), name, order: i }))
    set({ clubBag: clubs })
    persist({ ...get(), clubBag: clubs })
  },

  moveClubDown: (id) => {
    const sorted = [...get().clubBag].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(c => c.id === id)
    if (idx < 0 || idx >= sorted.length - 1) return
    const below = sorted[idx + 1]
    const current = sorted[idx]
    const clubs = sorted.map(c => {
      if (c.id === current.id) return { ...c, order: below.order }
      if (c.id === below.id) return { ...c, order: current.order }
      return c
    }).sort((a, b) => a.order - b.order)
    set({ clubBag: clubs })
    persist({ ...get(), clubBag: clubs })
  },

  setActiveRoundId: (id) => {
    set({ activeRoundId: id })
    persist({ ...get(), activeRoundId: id })
  },

  addRound: (round) => {
    const rounds = [round, ...get().rounds]
    set({ rounds })
    persist({ ...get(), rounds })
  },

  updateRound: (round) => {
    const rounds = get().rounds.map(r => (r.id === round.id ? round : r))
    set({ rounds })
    persist({ ...get(), rounds })
  },

  addShot: (roundId, holeNumber, shot) => {
    const rounds = get().rounds.map(r => {
      if (r.id !== roundId) return r
      return {
        ...r,
        holes: r.holes.map(h =>
          h.number === holeNumber ? { ...h, shots: [...h.shots, shot] } : h,
        ),
      }
    })
    set({ rounds })
    persist({ ...get(), rounds })
  },

  removeLastShot: (roundId, holeNumber) => {
    const rounds = get().rounds.map(r => {
      if (r.id !== roundId) return r
      return {
        ...r,
        holes: r.holes.map(h =>
          h.number === holeNumber
            ? { ...h, shots: h.shots.slice(0, -1) }
            : h,
        ),
      }
    })
    set({ rounds })
    persist({ ...get(), rounds })
  },

  removeShot: (roundId, holeNumber, shotIndex) => {
    const rounds = get().rounds.map(r => {
      if (r.id !== roundId) return r
      return {
        ...r,
        holes: r.holes.map(h =>
          h.number === holeNumber
            ? { ...h, shots: h.shots.filter((_, i) => i !== shotIndex) }
            : h,
        ),
      }
    })
    set({ rounds })
    persist({ ...get(), rounds })
  },

  setHolePar: (roundId, holeNumber, par) => {
    const rounds = get().rounds.map(r => {
      if (r.id !== roundId) return r
      return {
        ...r,
        holes: r.holes.map(h =>
          h.number === holeNumber ? { ...h, par } : h,
        ),
      }
    })
    set({ rounds })
    persist({ ...get(), rounds })
  },

  setPutts: (roundId, holeNumber, putts) => {
    const rounds = get().rounds.map(r => {
      if (r.id !== roundId) return r
      return {
        ...r,
        holes: r.holes.map(h =>
          h.number === holeNumber ? { ...h, putts } : h,
        ),
      }
    })
    set({ rounds })
    persist({ ...get(), rounds })
  },

  setPenalties: (roundId, holeNumber, penalties) => {
    const rounds = get().rounds.map(r => {
      if (r.id !== roundId) return r
      return {
        ...r,
        holes: r.holes.map(h =>
          h.number === holeNumber ? { ...h, penalties } : h,
        ),
      }
    })
    set({ rounds })
    persist({ ...get(), rounds })
  },

  setFairwayHit: (roundId, holeNumber, hit) => {
    const rounds = get().rounds.map(r => {
      if (r.id !== roundId) return r
      return {
        ...r,
        holes: r.holes.map(h =>
          h.number === holeNumber ? { ...h, fairwayHit: hit } : h,
        ),
      }
    })
    set({ rounds })
    persist({ ...get(), rounds })
  },

  completeRound: (roundId) => {
    const now = Date.now()
    const existing = get().rounds.find(r => r.id === roundId)

    // Compute handicap differential if we have rating/slope data
    let scoreDifferential: number | null = null
    if (existing && existing.courseRating !== undefined && existing.slopeRating !== undefined) {
      const bag = get().clubBag
      const putterIds = new Set(
        bag.filter(c => c.name.toLowerCase().includes('putter')).map(c => c.id),
      )
      const holeScores = existing.holes.map(
        h => calcTotalStrokes(h, putterIds),
      )
      const holePars = existing.holes.map(h => h.par)
      const ags = computeAGS(holeScores, holePars)
      scoreDifferential = computeScoreDifferential(ags, existing.courseRating, existing.slopeRating)
    }

    // Capture group round state BEFORE clearing (clearGroupRound wipes it)
    const groupState = useGroupRoundStore.getState()
    const hasSideGames = groupState.sideGameConfig?.sideGamesEnabled === true
    const groupRoundId = groupState.groupRound?.id

    // Capture side game data before stores are cleared
    const leaderboardPlayers = useLeaderboardStore.getState().players
    const capturedSideGameState = hasSideGames && groupState.sideGameConfig
      ? computeSideGameState(leaderboardPlayers, groupState.sideGameConfig)
      : null
    const capturedPlayerIds = leaderboardPlayers.map(p => p.playerId)
    const capturedSideGameResults = capturedSideGameState && groupState.sideGameConfig
      ? buildSideGameResults(capturedSideGameState, groupState.sideGameConfig, capturedPlayerIds)
      : []
    const capturedNetAmounts = capturedSideGameState && groupState.sideGameConfig
      ? aggregateSettlement(capturedSideGameState, groupState.sideGameConfig, capturedPlayerIds)
      : []
    // group_round_players.id → auth.users.id (null for guests)
    const capturedPlayerUserIdMap: Record<string, string | null | undefined> = {}
    for (const p of groupState.players) {
      capturedPlayerUserIdMap[p.id] = p.userId
    }

    const rounds = get().rounds.map(r =>
      r.id === roundId ? { ...r, completedAt: now, scoreDifferential, isLocked: hasSideGames && !!groupRoundId ? true : undefined } : r,
    )
    const activeRoundId = get().activeRoundId === roundId ? undefined : get().activeRoundId
    const roundsVersion = get().roundsVersion + 1
    set({ rounds, activeRoundId, roundsVersion })
    persist({ ...get(), rounds, activeRoundId })
    useGroupRoundStore.getState().clearGroupRound()
    useLeaderboardStore.getState().reset()

    // Fire-and-forget sync if authenticated
    const { isAuthenticated, userId } = get()
    if (isAuthenticated && userId) {
      const completedRound = get().rounds.find(r => r.id === roundId)
      if (completedRound && acquireSyncLock(roundId)) {
        get().markRoundPending(roundId) // persists syncStatus to localStorage before sync starts
        syncRoundToSupabase(completedRound, userId)
          .then(async result => {
            if (result.success) {
              get().markRoundSynced(roundId)
              if (hasSideGames && groupRoundId) {
                // Lock individual rounds, then mark group round completed (required by RLS),
                // then persist side game results and settlement history.
                await lockGroupRoundRounds(groupRoundId)
                await markGroupRoundCompleted(groupRoundId)
                await persistSideGameResults(groupRoundId, capturedSideGameResults)
                await persistSettlementHistory(roundId, capturedNetAmounts, capturedPlayerUserIdMap)
              }
            } else {
              get().markRoundError(roundId)
              addToQueue(roundId)
              useToastStore.getState().addToast('Sync failed — will retry when online')
            }
          })
          .catch(() => {
            get().markRoundError(roundId)
            addToQueue(roundId)
            useToastStore.getState().addToast('Sync failed — will retry when online')
          })
          .finally(() => {
            releaseSyncLock(roundId)
          })
      }
    }
    // If not authenticated, syncStatus stays 'local' (default)
  },

  deleteRound: (roundId) => {
    const state = get()
    const round = state.rounds.find(r => r.id === roundId)

    // Guard: locked rounds (tied to side bets) must not be deleted
    if (round?.isLocked) {
      useToastStore.getState().addToast('This round is locked and cannot be deleted')
      return
    }

    const wasSynced = state.syncStatus[roundId] === 'synced'
    // Cloud-only rounds (fetched from Supabase but not in local store) have no
    // syncStatus entry. Treat them as synced so the server delete fires.
    const isCloudOnly = !round && state.isAuthenticated

    // Remove from sync tracking (covers pending, error, local, synced)
    const syncStatus = { ...state.syncStatus }
    delete syncStatus[roundId]
    const syncQueue = state.syncQueue.filter(i => i.roundId !== roundId)

    const rounds = state.rounds.filter(r => r.id !== roundId)
    const activeRoundId = state.activeRoundId === roundId ? undefined : state.activeRoundId
    set({ rounds, activeRoundId, syncStatus, syncQueue })
    persist({ ...get(), rounds, activeRoundId, syncStatus })

    // Fire-and-forget soft-delete in Supabase for synced and cloud-only rounds
    if ((wasSynced || isCloudOnly) && state.isAuthenticated) {
      void deleteRoundInSupabase(roundId)
    }
  },

  abandonRound: (roundId) => {
    const rounds = get().rounds.filter(r => r.id !== roundId)
    const activeRoundId = get().activeRoundId === roundId ? undefined : get().activeRoundId
    set({ rounds, activeRoundId })
    persist({ ...get(), rounds, activeRoundId })
    useGroupRoundStore.getState().clearGroupRound()
    useLeaderboardStore.getState().reset()

    // Persist the abandoned ID locally so fetchActiveRound can't re-add it on
    // refresh even if the Supabase fire-and-forget hasn't propagated yet.
    addAbandonedRoundId(roundId)

    // Fire-and-forget: mark abandoned in Supabase so it won't reappear on refresh
    const { isAuthenticated, userId } = get()
    if (isAuthenticated && userId) {
      void abandonRoundInSupabase(roundId)
    }
  },
}))
