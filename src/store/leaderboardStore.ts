import { create } from 'zustand'
import type { PlayerScore, ScoreDelta } from '../types'
import { applyScoreDelta } from '../utils/scoring'

interface LeaderboardState {
  players: PlayerScore[]
  isLoading: boolean
  updateScore: (delta: ScoreDelta) => void
  setOffline: (playerId: string, offline: boolean) => void
  setPlayers: (players: PlayerScore[]) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useLeaderboardStore = create<LeaderboardState>((set) => ({
  players: [],
  isLoading: false,

  updateScore: (delta) =>
    set((state) => {
      const existing = state.players.find((p) => p.playerId === delta.playerId)
      const updated = applyScoreDelta(existing, delta)
      return {
        players: existing
          ? state.players.map((p) => (p.playerId === delta.playerId ? updated : p))
          : [...state.players, updated],
      }
    }),

  setOffline: (playerId, offline) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.playerId === playerId ? { ...p, isOnline: !offline } : p,
      ),
    })),

  setPlayers: (players) => set({ players }),

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () => set({ players: [], isLoading: false }),
}))
