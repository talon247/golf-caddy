import { create } from 'zustand'
import type { GroupRound, GroupRoundPlayer, GroupRoundStatus, SideGameConfig } from '../types'

interface GroupRoundStore {
  groupRound: GroupRound | null
  // Host flow state
  status: GroupRoundStatus
  error: string | null
  // Join flow state
  currentPlayer: GroupRoundPlayer | null
  players: GroupRoundPlayer[]
  sideGameConfig: SideGameConfig | null
  /** True once the first score is entered — side game config becomes read-only */
  sideGameConfigLocked: boolean
  /** Set when this group round is played within a tournament/league context */
  tournamentId: string | null
  tournamentName: string | null

  setGroupRound: (round: GroupRound) => void
  setSideGameConfig: (config: SideGameConfig | null) => void
  lockSideGameConfig: () => void
  setStatus: (status: GroupRoundStatus) => void
  setError: (error: string | null) => void
  // Host flow: add/remove single player from presence; setPlayers syncs all at once
  addPlayer: (player: GroupRoundPlayer) => void
  removePlayer: (presenceKey: string) => void
  // Updates both groupRound.players (host display) and top-level players (join lobby)
  setPlayers: (players: GroupRoundPlayer[]) => void
  // Join flow
  setCurrentPlayer: (player: GroupRoundPlayer) => void
  setTournamentContext: (tournamentId: string | null, tournamentName: string | null) => void
  clearGroupRound: () => void
  reset: () => void
}

export const useGroupRoundStore = create<GroupRoundStore>((set) => ({
  groupRound: null,
  status: 'idle',
  error: null,
  currentPlayer: null,
  players: [],
  sideGameConfig: null,
  sideGameConfigLocked: false,
  tournamentId: null,
  tournamentName: null,

  setGroupRound: (round) => set({ groupRound: round, status: 'waiting', error: null }),

  setSideGameConfig: (config) => set({ sideGameConfig: config, sideGameConfigLocked: config?.locked ?? false }),

  lockSideGameConfig: () => set((state) => ({
    sideGameConfigLocked: true,
    sideGameConfig: state.sideGameConfig ? { ...state.sideGameConfig, locked: true } : null,
  })),

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

  setTournamentContext: (tournamentId, tournamentName) => set({ tournamentId, tournamentName }),

  clearGroupRound: () => set({ groupRound: null, currentPlayer: null, players: [], status: 'idle', error: null, sideGameConfig: null, sideGameConfigLocked: false, tournamentId: null, tournamentName: null }),

  reset: () => set({ groupRound: null, status: 'idle', error: null, currentPlayer: null, players: [], sideGameConfig: null, sideGameConfigLocked: false, tournamentId: null, tournamentName: null }),
}))
