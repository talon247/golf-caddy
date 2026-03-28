// Auto-generated types for the Golf Caddy Supabase schema (THEA-75, THEA-79, THEA-88, THEA-105)
// Run `npx supabase gen types typescript` to regenerate after schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type RoundStatus = 'active' | 'completed' | 'abandoned'
export type GroupRoundDbStatus = 'waiting' | 'active' | 'completed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          home_course: string | null
          handicap_index: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string
          home_course?: string | null
          handicap_index?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          home_course?: string | null
          handicap_index?: number | null
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
          created_at?: string
          updated_at?: string
        }
        Update: {
          par?: number
          putts?: number
          fairway_hit?: boolean | null
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
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: GroupRoundDbStatus
          course_name?: string | null
          hole_count?: number | null
          pars?: number[] | null
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
          joined_at: string
        }
        Insert: {
          id?: string
          group_round_id: string
          player_name: string
          presence_key?: string | null
          joined_at?: string
        }
        Update: {
          player_name?: string
          presence_key?: string | null
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
    }
    Enums: {
      round_status: RoundStatus
      group_round_status: GroupRoundDbStatus
    }
  }
}
