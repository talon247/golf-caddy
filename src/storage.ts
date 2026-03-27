import type { AppState, Club } from './types'

const STORAGE_KEY = 'golf-caddy-state'

export const DEFAULT_CLUBS: Club[] = [
  'Driver', '3W', '5W', '4i', '5i', '6i', '7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW', 'Putter',
].map((name, i) => ({ id: `default-${i}`, name, order: i }))

function defaultState(): AppState {
  return {
    clubBag: DEFAULT_CLUBS.map(c => ({ ...c })),
    rounds: [],
    activeRoundId: undefined,
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      clubBag: Array.isArray(parsed.clubBag) ? parsed.clubBag : DEFAULT_CLUBS.map(c => ({ ...c })),
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : [],
      activeRoundId: typeof parsed.activeRoundId === 'string' ? parsed.activeRoundId : undefined,
    }
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — silently ignore
  }
}
