// Auto-generated types for the Golf Caddy Supabase schema (THEA-75, THEA-79, THEA-88, THEA-105, THEA-113, THEA-115, THEA-122, THEA-132, THEA-144, THEA-282, THEA-417, THEA-418, THEA-431, THEA-432)
// Run `npx supabase gen types typescript` to regenerate after schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type RoundStatus = 'active' | 'completed' | 'abandoned'
export type GroupRoundDbStatus = 'waiting' | 'active' | 'completed'
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked'
export type TournamentType = 'league' | 'event'
export type TournamentStatus = 'draft' | 'active' | 'completed' | 'archived'
export type TournamentMemberRole = 'commissioner' | 'host' | 'member' | 'player'
export type SeasonStatus = 'draft' | 'active' | 'completed' | 'archived'
export type SeasonGameType = 'skins' | 'nassau_front' | 'nassau_back' | 'nassau_overall'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          home_course: string | null
          handicap_index: number | null
          username: string | null
          presence_visible: boolean
          friend_requests_open: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string
          home_course?: string | null
          handicap_index?: number | null
          username?: string | null
          presence_visible?: boolean
          friend_requests_open?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          home_course?: string | null
          handicap_index?: number | null
          username?: string | null
          presence_visible?: boolean
          friend_requests_open?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      clubs: {
        Row: {
          id: string
          user_id: string
          name: string
          sort_order: number
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          sort_order?: number
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          sort_order?: number
          deleted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          id: string
          user_id: string
          name: string
          hole_count: 9 | 18
          par_per_hole: number[]
          course_rating: number | null
          slope_rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          hole_count: 9 | 18
          par_per_hole: number[]
          course_rating?: number | null
          slope_rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          hole_count?: 9 | 18
          par_per_hole?: number[]
          course_rating?: number | null
          slope_rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          id: string
          user_id: string
          course_id: string | null
          course_name: string
          tees: string | null
          tee_set: string | null
          player_name: string
          hole_count: 9 | 18
          status: RoundStatus
          course_rating: number | null
          slope_rating: number | null
          adjusted_gross_score: number | null
          score_differential: number | null
          is_locked: boolean
          started_at: string
          completed_at: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id?: string | null
          course_name: string
          tees?: string | null
          tee_set?: string | null
          player_name: string
          hole_count: 9 | 18
          status?: RoundStatus
          course_rating?: number | null
          slope_rating?: number | null
          adjusted_gross_score?: number | null
          score_differential?: number | null
          is_locked?: boolean
          started_at?: string
          completed_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          course_name?: string
          tees?: string | null
          tee_set?: string | null
          player_name?: string
          hole_count?: 9 | 18
          status?: RoundStatus
          course_rating?: number | null
          slope_rating?: number | null
          adjusted_gross_score?: number | null
          score_differential?: number | null
          is_locked?: boolean
          completed_at?: string | null
          deleted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      holes: {
        Row: {
          id: string
          round_id: string
          user_id: string
          hole_number: number
          par: number
          putts: number
          fairway_hit: boolean | null
          penalties: number
          gir: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          round_id: string
          user_id: string
          hole_number: number
          par: number
          putts?: number
          fairway_hit?: boolean | null
          penalties?: number
          gir?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          par?: number
          putts?: number
          fairway_hit?: boolean | null
          penalties?: number
          gir?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      shots: {
        Row: {
          id: string
          hole_id: string
          round_id: string
          user_id: string
          club_id: string | null
          club_name: string | null
          sequence: number
          is_putt: boolean
          created_at: string
        }
        Insert: {
          id?: string
          hole_id: string
          round_id: string
          user_id: string
          club_id?: string | null
          club_name?: string | null
          sequence: number
          is_putt?: boolean
          created_at?: string
        }
        Update: {
          club_id?: string | null
          club_name?: string | null
          is_putt?: boolean
        }
        Relationships: []
      }
      group_rounds: {
        Row: {
          id: string
          room_code: string
          host_name: string
          host_user_id: string | null
          status: GroupRoundDbStatus
          course_name: string | null
          hole_count: number | null
          pars: number[] | null
          course_rating: number | null
          slope_rating: number | null
          side_games_enabled: boolean
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_code: string
          host_name: string
          host_user_id?: string | null
          status?: GroupRoundDbStatus
          course_name?: string | null
          hole_count?: number | null
          pars?: number[] | null
          course_rating?: number | null
          slope_rating?: number | null
          side_games_enabled?: boolean
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: GroupRoundDbStatus
          course_name?: string | null
          hole_count?: number | null
          pars?: number[] | null
          course_rating?: number | null
          slope_rating?: number | null
          side_games_enabled?: boolean
          host_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      side_game_configs: {
        Row: {
          id: string
          group_round_id: string
          game_types: string[]
          stake_per_skin: number | null
          nassau_stake_front: number | null
          nassau_stake_back: number | null
          nassau_stake_overall: number | null
          press_enabled: boolean
          press_trigger_threshold: number
          created_at: string
        }
        Insert: {
          id?: string
          group_round_id: string
          game_types?: string[]
          stake_per_skin?: number | null
          nassau_stake_front?: number | null
          nassau_stake_back?: number | null
          nassau_stake_overall?: number | null
          press_enabled?: boolean
          press_trigger_threshold?: number
          created_at?: string
        }
        Update: {
          game_types?: string[]
          stake_per_skin?: number | null
          nassau_stake_front?: number | null
          nassau_stake_back?: number | null
          nassau_stake_overall?: number | null
          press_enabled?: boolean
          press_trigger_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: 'side_game_configs_group_round_id_fkey'
            columns: ['group_round_id']
            referencedRelation: 'group_rounds'
            referencedColumns: ['id']
          }
        ]
      }
      group_round_players: {
        Row: {
          id: string
          group_round_id: string
          player_name: string
          presence_key: string | null
          user_id: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          group_round_id: string
          player_name: string
          presence_key?: string | null
          user_id?: string | null
          joined_at?: string
        }
        Update: {
          player_name?: string
          presence_key?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      join_rate_limits: {
        Row: {
          session_key: string
          attempt_count: number
          window_start: string
        }
        Insert: {
          session_key: string
          attempt_count?: number
          window_start?: string
        }
        Update: {
          attempt_count?: number
          window_start?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          addressee_id: string
          status: FriendshipStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          addressee_id: string
          status?: FriendshipStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: FriendshipStatus
          updated_at?: string
        }
        Relationships: []
      }
      side_game_results: {
        Row: {
          id: string
          group_round_id: string
          game_type: string
          winner_player_id: string | null
          loser_player_id: string | null
          amount_owed: number
          hole_range: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          group_round_id: string
          game_type: string
          winner_player_id?: string | null
          loser_player_id?: string | null
          amount_owed: number
          hole_range?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          game_type?: string
          winner_player_id?: string | null
          loser_player_id?: string | null
          amount_owed?: number
          hole_range?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'side_game_results_group_round_id_fkey'
            columns: ['group_round_id']
            referencedRelation: 'group_rounds'
            referencedColumns: ['id']
          }
        ]
      }
      settlement_history: {
        Row: {
          id: string
          round_id: string
          from_user_id: string
          to_user_id: string
          net_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          round_id: string
          from_user_id: string
          to_user_id: string
          net_amount: number
          created_at?: string
        }
        Update: {
          net_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: 'settlement_history_round_id_fkey'
            columns: ['round_id']
            referencedRelation: 'rounds'
            referencedColumns: ['id']
          }
        ]
      }
      tournaments: {
        Row: {
          id: string
          type: TournamentType
          name: string
          creator_id: string
          status: TournamentStatus
          join_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type?: TournamentType
          name: string
          creator_id: string
          status?: TournamentStatus
          join_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          type?: TournamentType
          name?: string
          status?: TournamentStatus
          join_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tournament_config: {
        Row: {
          id: string
          tournament_id: string
          start_date: string | null
          end_date: string | null
          points_config: Json
          format: string | null
          field_size: number | null
          course_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          start_date?: string | null
          end_date?: string | null
          points_config?: Json
          format?: string | null
          field_size?: number | null
          course_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          start_date?: string | null
          end_date?: string | null
          points_config?: Json
          format?: string | null
          field_size?: number | null
          course_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_config_tournament_id_fkey'
            columns: ['tournament_id']
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_config_course_id_fkey'
            columns: ['course_id']
            referencedRelation: 'courses'
            referencedColumns: ['id']
          }
        ]
      }
      tournament_members: {
        Row: {
          id: string
          tournament_id: string
          user_id: string | null
          role: TournamentMemberRole
          guest_name: string | null
          joined_at: string
          removed_at: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          user_id?: string | null
          role?: TournamentMemberRole
          guest_name?: string | null
          joined_at?: string
          removed_at?: string | null
        }
        Update: {
          role?: TournamentMemberRole
          guest_name?: string | null
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_members_tournament_id_fkey'
            columns: ['tournament_id']
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          }
        ]
      }
      tournament_rounds: {
        Row: {
          id: string
          tournament_id: string
          group_round_id: string | null
          round_id: string | null
          player_id: string
          counted_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          group_round_id?: string | null
          round_id?: string | null
          player_id: string
          counted_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_rounds_tournament_id_fkey'
            columns: ['tournament_id']
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_rounds_group_round_id_fkey'
            columns: ['group_round_id']
            referencedRelation: 'group_rounds'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_rounds_round_id_fkey'
            columns: ['round_id']
            referencedRelation: 'rounds'
            referencedColumns: ['id']
          }
        ]
      }
      tournament_standings: {
        Row: {
          id: string
          tournament_id: string
          user_id: string | null
          guest_name: string | null
          points: number
          rank: number
          rounds_played: number
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          user_id?: string | null
          guest_name?: string | null
          points?: number
          rank?: number
          rounds_played?: number
          updated_at?: string
        }
        Update: {
          points?: number
          rank?: number
          rounds_played?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_standings_tournament_id_fkey'
            columns: ['tournament_id']
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          }
        ]
      }
      seasons: {
        Row: {
          id: string
          name: string
          creator_id: string
          status: SeasonStatus
          start_date: string | null
          end_date: string | null
          points_config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          creator_id: string
          status?: SeasonStatus
          start_date?: string | null
          end_date?: string | null
          points_config?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          status?: SeasonStatus
          start_date?: string | null
          end_date?: string | null
          points_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      season_members: {
        Row: {
          season_id: string
          user_id: string
          points_balance: number
          joined_at: string
          left_at: string | null
        }
        Insert: {
          season_id: string
          user_id: string
          points_balance?: number
          joined_at?: string
          left_at?: string | null
        }
        Update: {
          points_balance?: number
          left_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'season_members_season_id_fkey'
            columns: ['season_id']
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          }
        ]
      }
      season_transactions: {
        Row: {
          id: string
          season_id: string
          group_round_id: string | null
          payer_user_id: string
          payee_user_id: string
          points: number
          game_type: SeasonGameType
          created_at: string
        }
        Insert: {
          id?: string
          season_id: string
          group_round_id?: string | null
          payer_user_id: string
          payee_user_id: string
          points: number
          game_type: SeasonGameType
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: 'season_transactions_season_id_fkey'
            columns: ['season_id']
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'season_transactions_group_round_id_fkey'
            columns: ['group_round_id']
            referencedRelation: 'group_rounds'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      start_group_round: {
        Args: {
          p_group_round_id: string
          p_course_name: string
          p_hole_count: number
          p_pars: number[]
          p_course_rating?: number
          p_slope_rating?: number
        }
        Returns: Json
      }
      join_group_round: {
        Args: {
          p_room_code: string
          p_player_name: string
          p_session_key?: string
        }
        Returns: Json
      }
      get_group_round_lobby: {
        Args: {
          p_room_code: string
        }
        Returns: Json
      }
      check_username_available: {
        Args: {
          p_username: string
        }
        Returns: Json
      }
      send_friend_request: {
        Args: {
          p_addressee_username: string
        }
        Returns: Json
      }
      respond_friend_request: {
        Args: {
          p_friendship_id: string
          p_action: string
        }
        Returns: Json
      }
      get_friends: {
        Args: {
          p_status?: string
        }
        Returns: Json
      }
      search_users: {
        Args: {
          p_query: string
        }
        Returns: Json
      }
      remove_friend: {
        Args: {
          p_friendship_id: string
        }
        Returns: Json
      }
      get_friends_in_rounds: {
        Args: Record<string, never>
        Returns: Json
      }
      lock_rounds_for_group_round: {
        Args: {
          p_group_round_id: string
        }
        Returns: Json
      }
      detect_orphaned_rounds: {
        Args: {
          p_user_id: string
        }
        Returns: {
          round_id: string
          orphan_type: string
          detail: string
        }[]
      }
      recover_orphaned_rounds: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      create_tournament: {
        Args: {
          p_type: TournamentType
          p_name: string
          p_config?: Json
        }
        Returns: Json
      }
      join_tournament: {
        Args: {
          p_invite_code: string
          p_guest_name?: string | null
        }
        Returns: Json
      }
      update_tournament: {
        Args: {
          p_tournament_id: string
          p_name?: string | null
          p_config?: Json | null
          p_status?: TournamentStatus | null
        }
        Returns: Json
      }
      remove_tournament_member: {
        Args: {
          p_tournament_id: string
          p_target_user_id: string
        }
        Returns: Json
      }
      void_tournament_round: {
        Args: {
          p_tournament_round_id: string
          p_reason?: string | null
        }
        Returns: Json
      }
      lock_event_results: {
        Args: {
          p_tournament_id: string
        }
        Returns: Json
      }
      create_season: {
        Args: {
          p_name: string
          p_start_date?: string | null
          p_end_date?: string | null
          p_points_config?: Json | null
        }
        Returns: Json
      }
      join_season: {
        Args: {
          p_season_id: string
        }
        Returns: Json
      }
      leave_season: {
        Args: {
          p_season_id: string
        }
        Returns: Json
      }
      settle_season_points: {
        Args: {
          p_season_id: string
          p_group_round_id?: string | null
          p_settlements?: Json
        }
        Returns: Json
      }
      complete_season: {
        Args: {
          p_season_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      round_status: RoundStatus
      group_round_status: GroupRoundDbStatus
      friendship_status: FriendshipStatus
      tournament_type: TournamentType
      tournament_status: TournamentStatus
      tournament_member_role: TournamentMemberRole
      season_status: SeasonStatus
      season_game_type: SeasonGameType
    }
  }
}
