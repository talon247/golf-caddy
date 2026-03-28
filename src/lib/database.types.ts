// Auto-generated types for the Golf Caddy Supabase schema (THEA-75, THEA-79, THEA-88, THEA-105, THEA-113, THEA-115, THEA-122, THEA-132, THEA-144)
// Run `npx supabase gen types typescript` to regenerate after schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type RoundStatus = 'active' | 'completed' | 'abandoned'
export type GroupRoundDbStatus = 'waiting' | 'active' | 'completed'
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked'

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
          status: GroupRoundDbStatus
          course_name: string | null
          hole_count: number | null
          pars: number[] | null
          course_rating: number | null
          slope_rating: number | null
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_code: string
          host_name: string
          status?: GroupRoundDbStatus
          course_name?: string | null
          hole_count?: number | null
          pars?: number[] | null
          course_rating?: number | null
          slope_rating?: number | null
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
          updated_at?: string
        }
        Relationships: []
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
    }
    Enums: {
      round_status: RoundStatus
      group_round_status: GroupRoundDbStatus
      friendship_status: FriendshipStatus
    }
  }
}
