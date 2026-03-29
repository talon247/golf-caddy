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
  penalties?: number
  fairwayHit?: boolean
  gir?: boolean
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
  scoreDifferential?: number | null
  isLocked?: boolean
}

export interface AppState {
  clubBag: Club[]
  rounds: Round[]
  activeRoundId?: string
}

// ── Auth / Sync ───────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  displayName: string
  username?: string | null
  homeCourse?: string
  handicapIndex?: number | null
}

// ── Friends ────────────────────────────────────────────────────────────────

export interface Friend {
  friendshipId: string
  friendUserId: string
  displayName: string
  username: string
  handicapIndex?: number | null
}

export interface FriendRequest {
  friendshipId: string
  userId: string
  displayName: string
  username: string
  createdAt: string
}

export interface FriendSearchResult {
  userId: string
  displayName: string
  username: string
  isFriend: boolean
  hasPendingRequest: boolean
}

export type FriendRequestAction = 'accepted' | 'declined' | 'blocked'

export interface SyncQueueItem {
  roundId: string
  queuedAt: number
  retries: number
  nextRetryAt?: number
}

export type SyncStatusValue = 'local' | 'synced' | 'pending' | 'error'

export interface SyncedRound extends Round {
  userId?: string
  syncStatus: SyncStatusValue
  remoteId?: string
}

// ── Side Games ────────────────────────────────────────────────────────────

export type SideGameType = 'skins' | 'nassau' | 'press' | 'stableford'

export interface SideGameConfig {
  sideGamesEnabled: boolean
  gameTypes: SideGameType[]
  stakePerSkin: number | null
  nassauStakeFront: number | null
  nassauStakeBack: number | null
  nassauStakeOverall: number | null
  pressEnabled: boolean
  pressTriggerThreshold: number
  /** Set to true once the first score is entered — config becomes read-only */
  locked?: boolean
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

// ── Friends & Presence ────────────────────────────────────────────────────

export interface PresenceState {
  userId: string
  displayName: string
  status: 'online' | 'in_round'
  groupRoundId?: string
  roomCode?: string
  courseName?: string
  currentHole?: number
  playerCount?: number
  maxPlayers: number
  joinable: boolean
  updatedAt: string
  /** Set to true once side game config is received/ready for this player */
  side_game_ready?: boolean
}

export interface FriendRoundInfo {
  userId: string
  displayName: string
  groupRoundId: string
  roomCode: string
  courseName?: string
  currentHole?: number
  playerCount: number
  maxPlayers: number
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

// ── Side Games ────────────────────────────────────────────────────────────────

// ── Tournament Mode ───────────────────────────────────────────────────────────

export type TournamentType = 'league' | 'event'
export type TournamentStatus = 'draft' | 'active' | 'completed' | 'archived'
export type TournamentMemberRole = 'commissioner' | 'host' | 'member' | 'player'
export type TournamentFormat = 'stroke' | 'stableford' | 'match'

export interface TournamentEvent {
  id: string
  name: string
  type: TournamentType
  status: TournamentStatus
  creator_id: string
  created_at: string
  config: TournamentEventConfig | null
}

export interface TournamentEventConfig {
  tournament_id: string
  start_date: string | null
  end_date: string | null
  format: TournamentFormat | null
  field_size: number | null
  course_id: string | null
}

export interface TournamentMember {
  id: string
  tournament_id: string
  user_id: string | null
  role: TournamentMemberRole
  guest_name: string | null
  joined_at: string
  display_name: string
}

export interface TournamentStanding {
  tournament_id: string
  user_id: string
  rank: number
  rounds_played: number
  updated_at: string
  display_name: string
  score_to_par: number | null
  holes_completed: number | null
}

export interface TournamentRound {
  id: string
  tournament_id: string
  group_round_id: string | null
  round_id: string | null
  player_id: string
  counted_at: string | null
  voided_at: string | null
  display_name: string
  status: 'not_started' | 'in_progress' | 'completed'
  total_strokes: number | null
  score_to_par: number | null
  holes_completed: number | null
  hole_scores: Record<number, { strokes: number; par: number }> | null
}

// ── League Mode ───────────────────────────────────────────────────────────────

export interface LeagueConfig {
  tournament_id: string
  start_date: string | null
  end_date: string | null
  format: TournamentFormat | null
  points_per_win: number | null
  points_per_top3: number | null
  season_name: string | null
}

export interface LeagueStanding extends TournamentStanding {
  previous_rank: number | null
  points: number | null
}

/** Aggregated view of a round played within a league (one row = one group/solo round) */
export interface LeagueRoundGroup {
  key: string
  group_round_id: string | null
  played_at: string | null
  course_name: string | null
  voided: boolean
  players: Array<{
    id: string
    display_name: string
    score_to_par: number | null
    total_strokes: number | null
  }>
}
