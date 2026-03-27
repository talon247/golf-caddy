import { create } from 'zustand'

interface AppState {
  currentRoundId: string | null
  setCurrentRoundId: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentRoundId: null,
  setCurrentRoundId: (id) => set({ currentRoundId: id }),
}))
