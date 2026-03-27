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
}

export interface Round {
  id: string
  courseName: string
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
