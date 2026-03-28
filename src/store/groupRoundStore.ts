import { create } from 'zustand'
import type { GroupRound, GroupRoundPlayer, GroupRoundStatus } from '../types'

interface GroupRoundStore {
  groupRound: GroupRound | null
  status: GroupRoundStatus
  error: string | null

  setGroupRound: (round: GroupRound) => void
  setStatus: (status: GroupRoundStatus) => void
  setError: (error: string | null) => void
  addPlayer: (player: GroupRoundPlayer) => void
  removePlayer: (presenceKey: string) => void
  setPlayers: (players: GroupRoundPlayer[]) => void
  reset: () => void
}

export const useGroupRoundStore = create<GroupRoundStore>((set) => ({
  groupRound: null,
  status: 'idle',
  error: null,

  setGroupRound: (round) => set({ groupRound: round, status: 'waiting', error: null }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error, status: 'error' }),

  addPlayer: (player) =>
    set((state) => {
      if (!state.groupRound) return state
      const exists = state.groupRound.players.some(
        (p) => p.presenceKey === player.presenceKey,
      )
      if (exists) return state
      return {
        groupRound: {
          ...state.groupRound,
          players: [...state.groupRound.players, player],
        },
      }
    }),

  removePlayer: (presenceKey) =>
    set((state) => {
      if (!state.groupRound) return state
      return {
        groupRound: {
          ...state.groupRound,
          players: state.groupRound.players.filter(
            (p) => p.presenceKey !== presenceKey,
          ),
        },
      }
    }),

  setPlayers: (players) =>
    set((state) => {
      if (!state.groupRound) return state
      return { groupRound: { ...state.groupRound, players } }
    }),

  reset: () => set({ groupRound: null, status: 'idle', error: null }),
}))
