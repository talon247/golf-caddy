import type { AppState, Club, Course, Hole } from './types'

// Persisted state extends AppState with sync data
export interface PersistedState extends AppState {
  syncStatus?: Record<string, 'local' | 'synced' | 'pending' | 'error'>
}

// ── Group Round Recovery ───────────────────────────────────────────────────

const GRP_RECOVERY_KEY = 'golf-caddy-group-round'

export interface GroupRoundRecovery {
  groupRoundId: string
  roomCode: string
  playerId?: string
  playerName?: string
}

export function loadGroupRoundRecovery(): GroupRoundRecovery | null {
  try {
    const raw = localStorage.getItem(GRP_RECOVERY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GroupRoundRecovery>
    if (typeof parsed.groupRoundId !== 'string' || typeof parsed.roomCode !== 'string') return null
    return {
      groupRoundId: parsed.groupRoundId,
      roomCode: parsed.roomCode,
      playerId: typeof parsed.playerId === 'string' ? parsed.playerId : undefined,
      playerName: typeof parsed.playerName === 'string' ? parsed.playerName : undefined,
    }
  } catch {
    return null
  }
}

export function saveGroupRoundRecovery(data: GroupRoundRecovery): void {
  try {
    localStorage.setItem(GRP_RECOVERY_KEY, JSON.stringify(data))
  } catch {
    // Storage unavailable — silently ignore
  }
}

export function clearGroupRoundRecovery(): void {
  try {
    localStorage.removeItem(GRP_RECOVERY_KEY)
  } catch {
    // Storage unavailable — silently ignore
  }
}

const STORAGE_KEY = 'golf-caddy-state'

export const DEFAULT_CLUBS: Club[] = [
  'Driver', '3W', '5W', '4i', '5i', '6i', '7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW', 'Putter',
].map((name, i) => ({ id: `default-${i}`, name, order: i }))

const DEFAULT_PARS_9: number[] = [4, 4, 3, 4, 5, 3, 4, 4, 5]
const DEFAULT_PARS_18: number[] = [...DEFAULT_PARS_9, ...DEFAULT_PARS_9]

export function buildHoles(holeCount: 9 | 18): Hole[] {
  const pars = holeCount === 9 ? DEFAULT_PARS_9 : DEFAULT_PARS_18
  return pars.map((par, i) => ({ number: i + 1, par, shots: [] }))
}

function defaultState(): AppState {
  return {
    clubBag: DEFAULT_CLUBS.map(c => ({ ...c })),
    rounds: [],
    activeRoundId: undefined,
  }
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      clubBag: Array.isArray(parsed.clubBag) ? parsed.clubBag : DEFAULT_CLUBS.map(c => ({ ...c })),
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds : [],
      activeRoundId: typeof parsed.activeRoundId === 'string' ? parsed.activeRoundId : undefined,
      syncStatus: parsed.syncStatus && typeof parsed.syncStatus === 'object' ? parsed.syncStatus : {},
    }
  } catch {
    return defaultState()
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — silently ignore
  }
}

const COURSES_KEY = 'golf-caddy-courses'

export function loadCourses(): Course[] {
  try {
    const raw = localStorage.getItem(COURSES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Course[]) : []
  } catch {
    return []
  }
}

export function saveCourses(courses: Course[]): void {
  try {
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses))
  } catch {
    // Storage unavailable — silently ignore
  }
}
