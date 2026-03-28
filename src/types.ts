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

export interface GroupRoundPlayer {
  id: string
  playerName: string
  presenceKey: string
  joinedAt: number
}

export type GroupRoundStatus = 'idle' | 'creating' | 'waiting' | 'starting' | 'error'

export interface GroupRound {
  id: string
  roomCode: string
  hostName: string
  players: GroupRoundPlayer[]
  status: GroupRoundStatus
  createdAt: number
}
