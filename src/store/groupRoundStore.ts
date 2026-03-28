import { create } from 'zustand'
import type { GroupRound, GroupRoundPlayer } from '../types'

interface GroupRoundStore {
  groupRound: GroupRound | null
  currentPlayer: GroupRoundPlayer | null
  players: GroupRoundPlayer[]

  setGroupRound: (groupRound: GroupRound) => void
  setCurrentPlayer: (player: GroupRoundPlayer) => void
  setPlayers: (players: GroupRoundPlayer[]) => void
  clearGroupRound: () => void
}

export const useGroupRoundStore = create<GroupRoundStore>((set) => ({
  groupRound: null,
  currentPlayer: null,
  players: [],

  setGroupRound: (groupRound) => set({ groupRound }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setPlayers: (players) => set({ players }),
  clearGroupRound: () => set({ groupRound: null, currentPlayer: null, players: [] }),
}))
