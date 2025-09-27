export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          business_id: string
          created_at: string | null
          id: string
          message: string | null
          notification_type: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          business_id: string
          created_at?: string | null
          id?: string
          message?: string | null
          notification_type: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          business_id?: string
          created_at?: string | null
          id?: string
          message?: string | null
          notification_type?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      business_sessions: {
        Row: {
          created_at: string | null
          current_store_id: string | null
          expires_at: string
          id: string
          ip_address: unknown | null
          last_activity: string | null
          session_token: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_store_id?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown | null
          last_activity?: string | null
          session_token?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_store_id?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          last_activity?: string | null
          session_token?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_sessions_current_store_id_fkey"
            columns: ["current_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      business_stores: {
        Row: {
          business_id: string
          created_at: string | null
          created_by: string | null
          id: string
          permissions: Json
          role: string | null
          store_id: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          permissions?: Json
          role?: string | null
          store_id: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          permissions?: Json
          role?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          phone: string | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      context_window: {
        Row: {
          ai_configuration: Json | null
          context_score: number | null
          custom_questions: Json | null
          fraud_detection_settings: Json | null
          id: string
          last_updated: string | null
          store_id: string
          store_profile: Json | null
        }
        Insert: {
          ai_configuration?: Json | null
          context_score?: number | null
          custom_questions?: Json | null
          fraud_detection_settings?: Json | null
          id?: string
          last_updated?: string | null
          store_id: string
          store_profile?: Json | null
        }
        Update: {
          ai_configuration?: Json | null
          context_score?: number | null
          custom_questions?: Json | null
          fraud_detection_settings?: Json | null
          id?: string
          last_updated?: string | null
          store_id?: string
          store_profile?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "context_window_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_questions: {
        Row: {
          active_days_of_week: number[] | null
          active_end_date: string | null
          active_hours_end: string | null
          active_hours_start: string | null
          active_start_date: string | null
          business_id: string
          category_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          formatting_options: Json | null
          frequency_current: number
          frequency_reset_at: string | null
          frequency_target: number
          frequency_window: string
          id: string
          is_active: boolean
          priority: string
          question_text: string
          question_type: string
          status: string
          store_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_days_of_week?: number[] | null
          active_end_date?: string | null
          active_hours_end?: string | null
          active_hours_start?: string | null
          active_start_date?: string | null
          business_id: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          formatting_options?: Json | null
          frequency_current?: number
          frequency_reset_at?: string | null
          frequency_target: number
          frequency_window?: string
          id?: string
          is_active?: boolean
          priority?: string
          question_text: string
          question_type?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_days_of_week?: number[] | null
          active_end_date?: string | null
          active_hours_end?: string | null
          active_hours_start?: string | null
          active_start_date?: string | null
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          formatting_options?: Json | null
          frequency_current?: number
          frequency_reset_at?: string | null
          frequency_target?: number
          frequency_window?: string
          id?: string
          is_active?: boolean
          priority?: string
          question_text?: string
          question_type?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_questions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "question_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_questions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_sessions: {
        Row: {
          call_completed_at: string | null
          call_started_at: string | null
          created_at: string | null
          customer_phone_hash: string
          feedback_summary: Json | null
          id: string
          quality_grade: number | null
          reward_percentage: number | null
          status: Database["public"]["Enums"]["feedback_status"] | null
          store_id: string
          transaction_id: string
        }
        Insert: {
          call_completed_at?: string | null
          call_started_at?: string | null
          created_at?: string | null
          customer_phone_hash: string
          feedback_summary?: Json | null
          id?: string
          quality_grade?: number | null
          reward_percentage?: number | null
          status?: Database["public"]["Enums"]["feedback_status"] | null
          store_id: string
          transaction_id: string
        }
        Update: {
          call_completed_at?: string | null
          call_started_at?: string | null
          created_at?: string | null
          customer_phone_hash?: string
          feedback_summary?: Json | null
          id?: string
          quality_grade?: number | null
          reward_percentage?: number | null
          status?: Database["public"]["Enums"]["feedback_status"] | null
          store_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_sessions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_analytics_summary: {
        Row: {
          avg_rating: number | null
          avg_response_time_seconds: number | null
          business_id: string
          calculated_at: string
          id: string
          period_end: string
          period_start: string
          period_type: string
          presentations_count: number
          question_id: string
          response_rate: number | null
          responses_count: number
          skips_count: number
          store_id: string | null
        }
        Insert: {
          avg_rating?: number | null
          avg_response_time_seconds?: number | null
          business_id: string
          calculated_at?: string
          id?: string
          period_end: string
          period_start: string
          period_type: string
          presentations_count?: number
          question_id: string
          response_rate?: number | null
          responses_count?: number
          skips_count?: number
          store_id?: string | null
        }
        Update: {
          avg_rating?: number | null
          avg_response_time_seconds?: number | null
          business_id?: string
          calculated_at?: string
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          presentations_count?: number
          question_id?: string
          response_rate?: number | null
          responses_count?: number
          skips_count?: number
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_analytics_summary_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_analytics_summary_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "custom_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_analytics_summary_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      question_categories: {
        Row: {
          business_id: string
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      question_responses: {
        Row: {
          business_id: string
          customer_session_id: string | null
          id: string
          presented_at: string
          question_id: string
          responded_at: string | null
          response_rating: number | null
          response_text: string | null
          response_value: Json | null
          store_id: string | null
          trigger_context: Json | null
          was_answered: boolean
          was_skipped: boolean
        }
        Insert: {
          business_id: string
          customer_session_id?: string | null
          id?: string
          presented_at?: string
          question_id: string
          responded_at?: string | null
          response_rating?: number | null
          response_text?: string | null
          response_value?: Json | null
          store_id?: string | null
          trigger_context?: Json | null
          was_answered?: boolean
          was_skipped?: boolean
        }
        Update: {
          business_id?: string
          customer_session_id?: string | null
          id?: string
          presented_at?: string
          question_id?: string
          responded_at?: string | null
          response_rating?: number | null
          response_text?: string | null
          response_value?: Json | null
          store_id?: string | null
          trigger_context?: Json | null
          was_answered?: boolean
          was_skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "question_responses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "custom_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_responses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      question_triggers: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          operator: string
          question_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          operator?: string
          question_id: string
          trigger_config: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          operator?: string
          question_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_triggers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "custom_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          location_address: string | null
          name: string
          qr_code_data: string
          store_profile: Json | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_address?: string | null
          name: string
          qr_code_data: string
          store_profile?: Json | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_address?: string | null
          name?: string
          qr_code_data?: string
          store_profile?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          actual_amount: number | null
          actual_time: string | null
          created_at: string | null
          customer_amount_range: unknown
          customer_time_range: unknown
          id: string
          is_verified: boolean | null
          store_id: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          actual_amount?: number | null
          actual_time?: string | null
          created_at?: string | null
          customer_amount_range: unknown
          customer_time_range: unknown
          id?: string
          is_verified?: boolean | null
          store_id: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          actual_amount?: number | null
          actual_time?: string | null
          created_at?: string | null
          customer_amount_range?: unknown
          customer_time_range?: unknown
          id?: string
          is_verified?: boolean | null
          store_id?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_accounts: {
        Row: {
          business_id: string | null
          created_at: string | null
          email: string
          id: string
          last_login: string | null
          permissions: Json | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          last_login?: string | null
          permissions?: Json | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          last_login?: string | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_record: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          status:
            | Database["public"]["Enums"]["weekly_verification_status"]
            | null
          submitted_at: string | null
          transaction_summary: Json | null
          verified_at: string | null
          week_identifier: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          status?:
            | Database["public"]["Enums"]["weekly_verification_status"]
            | null
          submitted_at?: string | null
          transaction_summary?: Json | null
          verified_at?: string | null
          week_identifier: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          status?:
            | Database["public"]["Enums"]["weekly_verification_status"]
            | null
          submitted_at?: string | null
          transaction_summary?: Json | null
          verified_at?: string | null
          week_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_record_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_context_score: {
        Args: {
          ai_config_data: Json
          custom_questions_data: Json
          fraud_settings_data: Json
          store_profile_data: Json
        }
        Returns: number
      }
      create_amount_tolerance: {
        Args: { customer_amount: number }
        Returns: unknown
      }
      create_time_tolerance: {
        Args: { customer_time: string }
        Returns: unknown
      }
      gbt_bit_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bool_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bool_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bpchar_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bytea_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_cash_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_cash_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_date_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_date_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_enum_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_enum_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float4_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float4_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float8_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float8_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_inet_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int2_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int2_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int4_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int4_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int8_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int8_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_intv_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_intv_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_intv_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad8_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad8_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_numeric_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_oid_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_oid_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_text_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_time_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_time_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_timetz_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_ts_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_ts_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_tstz_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_uuid_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_uuid_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_var_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_var_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey_var_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey_var_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey16_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey16_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey2_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey2_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey32_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey32_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey4_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey4_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey8_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey8_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      get_table_columns: {
        Args: { table_name_param: string }
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          foreign_column: string
          foreign_table: string
          is_foreign_key: boolean
          is_nullable: string
          is_primary_key: boolean
        }[]
      }
    }
    Enums: {
      feedback_status: "initiated" | "in_progress" | "completed" | "failed"
      user_role: "admin" | "business_owner" | "business_staff"
      verification_status: "pending" | "verified" | "rejected"
      weekly_verification_status: "pending" | "submitted" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      feedback_status: ["initiated", "in_progress", "completed", "failed"],
      user_role: ["admin", "business_owner", "business_staff"],
      verification_status: ["pending", "verified", "rejected"],
      weekly_verification_status: ["pending", "submitted", "completed"],
    },
  },
} as const
