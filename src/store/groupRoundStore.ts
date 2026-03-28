import { create } from 'zustand'
import type { GroupRound, GroupRoundPlayer, GroupRoundStatus, PlayerScore } from '../types'

interface GroupRoundStore {
  groupRound: GroupRound | null
  // Host flow state
  status: GroupRoundStatus
  error: string | null
  // Join flow state
  currentPlayer: GroupRoundPlayer | null
  players: GroupRoundPlayer[]
  // Final standings after round_complete event
  finalStandings: PlayerScore[] | null

  setGroupRound: (round: GroupRound) => void
  setStatus: (status: GroupRoundStatus) => void
  setError: (error: string | null) => void
  // Host flow: add/remove single player from presence; setPlayers syncs all at once
  addPlayer: (player: GroupRoundPlayer) => void
  removePlayer: (presenceKey: string) => void
  // Updates both groupRound.players (host display) and top-level players (join lobby)
  setPlayers: (players: GroupRoundPlayer[]) => void
  // Join flow
  setCurrentPlayer: (player: GroupRoundPlayer) => void
  setFinalStandings: (standings: PlayerScore[]) => void
  clearGroupRound: () => void
  reset: () => void
}

export const useGroupRoundStore = create<GroupRoundStore>((set) => ({
  groupRound: null,
  status: 'idle',
  error: null,
  currentPlayer: null,
  players: [],
  finalStandings: null,

  setGroupRound: (round) => set({ groupRound: round, status: 'waiting', error: null }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error, status: 'error' }),

  addPlayer: (player) =>
    set((state) => {
      if (!state.groupRound) return state
      const exists = (state.groupRound.players ?? []).some(
        (p) => p.presenceKey === player.presenceKey,
      )
      if (exists) return state
      return {
        groupRound: {
          ...state.groupRound,
          players: [...(state.groupRound.players ?? []), player],
        },
      }
    }),

  removePlayer: (presenceKey) =>
    set((state) => {
      if (!state.groupRound) return state
      return {
        groupRound: {
          ...state.groupRound,
          players: (state.groupRound.players ?? []).filter(
            (p) => p.presenceKey !== presenceKey,
          ),
        },
      }
    }),

  // Updates both embedded groupRound.players (host flow) and top-level players (join lobby)
  setPlayers: (players) =>
    set((state) => ({
      players,
      groupRound: state.groupRound
        ? { ...state.groupRound, players }
        : state.groupRound,
    })),

  setCurrentPlayer: (player) => set({ currentPlayer: player }),

  setFinalStandings: (standings) => set({ finalStandings: standings, status: 'completed' }),

  clearGroupRound: () => set({ groupRound: null, currentPlayer: null, players: [], status: 'idle', error: null, finalStandings: null }),

  reset: () => set({ groupRound: null, status: 'idle', error: null, currentPlayer: null, players: [], finalStandings: null }),
}))
