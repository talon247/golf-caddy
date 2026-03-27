import { create } from 'zustand'
import type { Club, Round, Shot } from '../types'
import { loadState, saveState } from '../storage'

interface StoreState {
  clubBag: Club[]
  rounds: Round[]
  activeRoundId: string | undefined

  // Club bag actions
  addClub: (name: string) => string
  removeClub: (id: string) => void
  updateClubName: (id: string, name: string) => void
  moveClubUp: (id: string) => void
  moveClubDown: (id: string) => void

  // Round actions
  setActiveRoundId: (id: string | undefined) => void
  addRound: (round: Round) => void
  updateRound: (round: Round) => void
  addShot: (roundId: string, holeNumber: number, shot: Shot) => void
  removeLastShot: (roundId: string, holeNumber: number) => void
  setHolePar: (roundId: string, holeNumber: number, par: number) => void
  completeRound: (roundId: string) => void
  deleteRound: (roundId: string) => void
  abandonRound: (roundId: string) => void
}

const initial = loadState()

function persist(state: Pick<StoreState, 'clubBag' | 'rounds' | 'activeRoundId'>) {
  saveState({ clubBag: state.clubBag, rounds: state.rounds, activeRoundId: state.activeRoundId })
}

export const useAppStore = create<StoreState>((set, get) => ({
  clubBag: initial.clubBag,
  rounds: initial.rounds,
  activeRoundId: initial.activeRoundId,

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

  completeRound: (roundId) => {
    const rounds = get().rounds.map(r =>
      r.id === roundId ? { ...r, completedAt: Date.now() } : r,
    )
    const activeRoundId = get().activeRoundId === roundId ? undefined : get().activeRoundId
    set({ rounds, activeRoundId })
    persist({ ...get(), rounds, activeRoundId })
  },

  deleteRound: (roundId) => {
    const rounds = get().rounds.filter(r => r.id !== roundId)
    const activeRoundId = get().activeRoundId === roundId ? undefined : get().activeRoundId
    set({ rounds, activeRoundId })
    persist({ ...get(), rounds, activeRoundId })
  },

  abandonRound: (roundId) => {
    const rounds = get().rounds.filter(r => r.id !== roundId)
    const activeRoundId = get().activeRoundId === roundId ? undefined : get().activeRoundId
    set({ rounds, activeRoundId })
    persist({ ...get(), rounds, activeRoundId })
  },
}))
