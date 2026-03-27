// Auto-generated types for the Golf Caddy Supabase schema (THEA-75)
// Run `npx supabase gen types typescript` to regenerate after schema changes.

export type RoundStatus = 'active' | 'completed' | 'abandoned'

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
      }
      rounds: {
        Row: {
          id: string
          user_id: string
          course_id: string | null
          course_name: string
          tees: string | null
          player_name: string
          hole_count: 9 | 18
          status: RoundStatus
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
          player_name: string
          hole_count: 9 | 18
          status?: RoundStatus
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
          player_name?: string
          hole_count?: 9 | 18
          status?: RoundStatus
          completed_at?: string | null
          deleted_at?: string | null
          updated_at?: string
        }
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
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      round_status: RoundStatus
    }
  }
}
