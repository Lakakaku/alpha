/**
 * Database Types - Auto-generated from Supabase migrations
 * 
 * Generated on: 2025-09-20T15:39:58.587Z
 * 
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Run 'npm run generate:types' to regenerate
 */

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
} as const/**
 * Database Types - Auto-generated from Supabase migrations
 * 
 * Generated on: 2025-09-20T15:39:58.587Z
 * 
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Run 'npm run generate:types' to regenerate
 */

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