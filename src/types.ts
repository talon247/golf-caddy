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

export type GroupRoundStatus = 'waiting' | 'active' | 'completed'

export interface GroupRound {
  id: string
  roomCode: string
  hostUserId: string | null
  status: GroupRoundStatus
  expiresAt: string
  createdAt: string
}

export interface GroupRoundPlayer {
  id: string
  groupRoundId: string
  userId: string | null
  displayName: string
  roundId: string | null
  joinedAt: string
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
