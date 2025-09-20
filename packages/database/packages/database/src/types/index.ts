// TypeScript Database Types
// Project: Vocilia Customer Feedback System
// Generated: 2025-09-18
// Dependencies: Supabase client library

// Database enums
export type UserRole = 'admin' | 'business_owner' | 'business_staff';
export type FeedbackStatus = 'initiated' | 'in_progress' | 'completed' | 'failed';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type WeeklyVerificationStatus = 'pending' | 'submitted' | 'completed';

// Core entity interfaces

export interface Business {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserAccount {
  id: string;
  business_id: string | null; // null for admin users
  email: string;
  role: UserRole;
  permissions: Record<string, any>;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  business_id: string;
  name: string;
  location_address: string | null;
  qr_code_data: string;
  store_profile: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContextWindow {
  id: string;
  store_id: string;
  store_profile: Record<string, any>;
  custom_questions: CustomQuestion[];
  ai_configuration: Record<string, any>;
  fraud_detection_settings: Record<string, any>;
  context_score: number; // 0-100
  last_updated: string;
}

export interface Transaction {
  id: string;
  store_id: string;
  customer_time_range: string; // PostgreSQL tsrange
  customer_amount_range: string; // PostgreSQL numrange
  actual_amount: number | null;
  actual_time: string | null;
  verification_status: VerificationStatus;
  is_verified: boolean;
  created_at: string;
}

export interface FeedbackSession {
  id: string;
  store_id: string;
  transaction_id: string;
  customer_phone_hash: string;
  status: FeedbackStatus;
  quality_grade: number | null; // 1-10
  reward_percentage: number | null; // 2.0-15.0
  feedback_summary: Record<string, any>;
  call_started_at: string | null;
  call_completed_at: string | null;
  created_at: string;
}

export interface VerificationRecord {
  id: string;
  business_id: string;
  week_identifier: string; // Format: YYYY-WNN
  status: WeeklyVerificationStatus;
  transaction_summary: Record<string, any>;
  submitted_at: string | null;
  verified_at: string | null;
  created_at: string;
}

// Supabase relationship types with joins

export interface BusinessWithStores extends Business {
  stores: Store[];
}

export interface BusinessWithUsers extends Business {
  user_accounts: UserAccount[];
}

export interface StoreWithContext extends Store {
  context_window: ContextWindow | null;
}

export interface StoreWithFeedback extends Store {
  feedback_sessions: FeedbackSession[];
}

export interface FeedbackSessionWithTransaction extends FeedbackSession {
  transaction: Transaction;
}

export interface FeedbackSessionWithStore extends FeedbackSession {
  store: Store;
}

export interface TransactionWithFeedback extends Transaction {
  feedback_session: FeedbackSession | null;
}

export interface VerificationRecordWithBusiness extends VerificationRecord {
  business: Business;
}

// Custom question types for context window
export interface CustomQuestion {
  id: string;
  text: string;
  frequency: number; // Every Nth customer (1-100)
  category: QuestionCategory;
  priority: QuestionPriority;
  department_tags: string[];
  active_period?: {
    start_date: string;
    end_date: string;
  };
  triggers?: QuestionTrigger[];
}

export type QuestionCategory =
  | 'product_feedback'
  | 'service_quality'
  | 'store_environment'
  | 'specific_campaigns'
  | 'problem_identification';

export type QuestionPriority = 'high' | 'medium' | 'low';

export interface QuestionTrigger {
  type: 'purchase_based' | 'time_based' | 'amount_based';
  condition: string;
  value: string | number;
}

// Store profile types for context window
export interface StoreProfile {
  store_type: {
    category: string;
    subcategory: string;
  };
  size: {
    square_footage: number;
    departments: number;
  };
  operating_hours: {
    [day: string]: {
      open: string;
      close: string;
    } | null;
  };
  location: {
    address: string;
    parking_available: boolean;
    accessibility_features: string[];
  };
  personnel: {
    staff_count: number;
    departments: Record<string, number>;
    key_personnel: {
      role: string;
      name: string;
    }[];
    customer_service_points: string[];
  };
  layout: {
    departments: Record<string, {
      location: string;
      size: string;
    }>;
    recent_changes: {
      date: string;
      description: string;
    }[];
    navigation_flow: string;
  };
  inventory: {
    product_categories: string[];
    special_services: string[];
    payment_methods: string[];
    loyalty_programs: string[];
  };
}

// AI configuration types
export interface AIConfiguration {
  conversation_style: 'friendly' | 'professional' | 'casual';
  language_preferences: {
    primary: 'swedish';
    formality_level: 'formal' | 'informal';
  };
  call_duration_target: {
    min_seconds: number;
    max_seconds: number;
  };
  question_selection: {
    max_questions_per_call: number;
    priority_weighting: Record<QuestionPriority, number>;
  };
  fraud_detection: {
    sensitivity_level: 'low' | 'medium' | 'high';
    red_flag_keywords: string[];
    verification_thresholds: {
      min_response_length: number;
      coherence_threshold: number;
    };
  };
}

// Database operation types

// Insert types (exclude auto-generated fields)
export type BusinessInsert = Omit<Business, 'id' | 'created_at' | 'updated_at'>;
export type UserAccountInsert = Omit<UserAccount, 'id' | 'created_at' | 'updated_at'>;
export type StoreInsert = Omit<Store, 'id' | 'created_at' | 'updated_at'>;
export type ContextWindowInsert = Omit<ContextWindow, 'id' | 'last_updated'>;
export type TransactionInsert = Omit<Transaction, 'id' | 'created_at'>;
export type FeedbackSessionInsert = Omit<FeedbackSession, 'id' | 'created_at'>;
export type VerificationRecordInsert = Omit<VerificationRecord, 'id' | 'created_at'>;

// Update types (exclude immutable fields)
export type BusinessUpdate = Partial<Omit<Business, 'id' | 'created_at'>>;
export type UserAccountUpdate = Partial<Omit<UserAccount, 'id' | 'created_at'>>;
export type StoreUpdate = Partial<Omit<Store, 'id' | 'business_id' | 'created_at'>>;
export type ContextWindowUpdate = Partial<Omit<ContextWindow, 'id' | 'store_id'>>;
export type TransactionUpdate = Partial<Omit<Transaction, 'id' | 'store_id' | 'created_at'>>;
export type FeedbackSessionUpdate = Partial<Omit<FeedbackSession, 'id' | 'store_id' | 'transaction_id' | 'created_at'>>;
export type VerificationRecordUpdate = Partial<Omit<VerificationRecord, 'id' | 'business_id' | 'week_identifier' | 'created_at'>>;

// Query filter types
export interface BusinessFilters {
  name?: string;
  email?: string;
  created_after?: string;
  created_before?: string;
}

export interface StoreFilters {
  business_id?: string;
  name?: string;
  is_active?: boolean;
  location_address?: string;
}

export interface FeedbackSessionFilters {
  store_id?: string;
  status?: FeedbackStatus;
  quality_grade_min?: number;
  quality_grade_max?: number;
  created_after?: string;
  created_before?: string;
}

export interface TransactionFilters {
  store_id?: string;
  verification_status?: VerificationStatus;
  is_verified?: boolean;
  created_after?: string;
  created_before?: string;
}

// Transaction verification helpers
export interface TransactionToleranceInput {
  customer_time: string; // ISO timestamp
  customer_amount: number;
}

export interface TransactionVerificationResult {
  transaction_id: string;
  is_match: boolean;
  time_difference_minutes: number;
  amount_difference_sek: number;
  confidence_score: number; // 0-1
}

// Weekly verification types
export interface WeeklyVerificationData {
  week_identifier: string;
  business_id: string;
  transactions: {
    transaction_id: string;
    customer_time_range: string;
    customer_amount_range: string;
    feedback_quality_grade: number | null;
    reward_percentage: number | null;
  }[];
  total_feedback_sessions: number;
  total_rewards_sek: number;
}

export interface WeeklyVerificationSubmission {
  verification_record_id: string;
  verified_transactions: {
    transaction_id: string;
    is_legitimate: boolean;
    pos_match_found: boolean;
    actual_amount?: number;
    actual_time?: string;
    notes?: string;
  }[];
  business_signature: string;
  submitted_at: string;
}

// Real-time subscription types
export interface RealtimePayload<T = any> {
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  schema: string;
  table: string;
}

export type FeedbackSessionRealtimePayload = RealtimePayload<FeedbackSession>;
export type TransactionRealtimePayload = RealtimePayload<Transaction>;
export type VerificationRecordRealtimePayload = RealtimePayload<VerificationRecord>;

// Error types
export interface DatabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  order_by?: string;
  order_direction?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

// Authentication context types
export interface AuthContext {
  user_id: string;
  business_id: string | null;
  role: UserRole;
  permissions: string[];
  email: string;
}

export interface RLSContext {
  business_id: string | null;
  role: UserRole;
  user_id: string;
}

// Supabase Database type for schema inference
export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: Business;
        Insert: BusinessInsert;
        Update: BusinessUpdate;
      };
      user_accounts: {
        Row: UserAccount;
        Insert: UserAccountInsert;
        Update: UserAccountUpdate;
      };
      stores: {
        Row: Store;
        Insert: StoreInsert;
        Update: StoreUpdate;
      };
      context_window: {
        Row: ContextWindow;
        Insert: ContextWindowInsert;
        Update: ContextWindowUpdate;
      };
      transactions: {
        Row: Transaction;
        Insert: TransactionInsert;
        Update: TransactionUpdate;
      };
      feedback_sessions: {
        Row: FeedbackSession;
        Insert: FeedbackSessionInsert;
        Update: FeedbackSessionUpdate;
      };
      verification_record: {
        Row: VerificationRecord;
        Insert: VerificationRecordInsert;
        Update: VerificationRecordUpdate;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_time_tolerance: {
        Args: { customer_time: string };
        Returns: string;
      };
      create_amount_tolerance: {
        Args: { customer_amount: number };
        Returns: string;
      };
      calculate_context_score: {
        Args: {
          store_profile_data: any;
          custom_questions_data: any;
          ai_config_data: any;
          fraud_settings_data: any;
        };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      feedback_status: FeedbackStatus;
      verification_status: VerificationStatus;
      weekly_verification_status: WeeklyVerificationStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}