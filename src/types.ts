export interface Club {
  id: string
  name: string
  order: number
}

export interface Shot {
  clubId: string
  timestamp: number
}

export interface Hole {
  number: number
  par: number
  shots: Shot[]
  putts?: number
  fairwayHit?: boolean
}

export interface CourseHole {
  number: number
  par: number
  strokeIndex?: number
}

export interface Course {
  id: string
  name: string
  holes: CourseHole[]
  createdAt: string
}

export interface Round {
  id: string
  courseName: string
  courseId?: string
  tees: string
  teeSet?: string
  courseRating?: number
  slopeRating?: number
  playerName: string
  holeCount: 9 | 18
  startedAt: number
  completedAt?: number
  holes: Hole[]
}

export interface AppState {
  clubBag: Club[]
  rounds: Round[]
  activeRoundId?: string
}

// ── Multiplayer / Group Round ──────────────────────────────────────────────

/** Combined status covering both host flow and DB states */
export type GroupRoundStatus = 'idle' | 'creating' | 'waiting' | 'starting' | 'active' | 'completed' | 'error'

export interface GroupRoundPlayer {
  id: string
  // Host flow (presence-based)
  playerName?: string
  presenceKey?: string
  // Join flow (DB-based)
  groupRoundId?: string
  userId?: string | null
  displayName?: string
  roundId?: string | null
  joinedAt: number | string
}

export interface GroupRound {
  id: string
  roomCode: string
  // Host flow
  hostName?: string
  players?: GroupRoundPlayer[]
  // Join flow
  hostUserId?: string | null
  expiresAt?: string
  status: GroupRoundStatus
  createdAt: number | string
}

export interface ScoreDelta {
  playerId: string
  playerName: string
  holeNumber: number
  strokes: number
  putts: number
  par: number
  timestamp: string
}

export interface PlayerScore {
  playerId: string
  displayName: string
  currentHole: number
  totalStrokes: number
  totalPar: number
  scoreToPar: number
  isOnline: boolean
  lastSyncedAt: string
  holes: Record<number, { strokes: number; putts: number; par: number }>
}

export type JoinError = 'not_found' | 'expired' | 'full' | 'network'

export interface JoinGroupRoundResult {
  success: true
  groupRoundId: string
  playerId: string
  roomCode: string
}

export interface JoinGroupRoundError {
  success: false
  error: JoinError
  message: string
}
