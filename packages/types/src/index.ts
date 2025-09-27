// Shared TypeScript type definitions for Vocilia platform
// Generated from data model specifications

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enums
export type UserRole = 'business_account' | 'admin_account'
export type SubscriptionStatus = 'active' | 'inactive' | 'suspended'
export type PermissionCategory = 'business' | 'customer' | 'admin'

// QR Verification System enums
export type VerificationSessionStatus = 'pending' | 'completed' | 'expired' | 'failed'
export type ValidationStatus = 'valid' | 'out_of_tolerance' | 'invalid'
export type PhoneValidationStatus = 'valid' | 'invalid_format' | 'not_swedish'
export type FraudDetectionType = 'rate_limit' | 'invalid_qr' | 'suspicious_pattern' | 'duplicate_attempt'
export type FraudActionTaken = 'none' | 'warning' | 'block' | 'flag_for_review'

// Core entity interfaces
export interface UserProfile {
  id: string // UUID linking to auth.users.id
  role: UserRole
  business_id: string | null // UUID foreign key to businesses
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

export interface Business {
  id: string // UUID primary key
  name: string
  organization_number: string | null
  contact_email: string | null
  phone_number: string | null
  address: Json | null // JSONB address information
  subscription_status: SubscriptionStatus
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

export interface Store {
  id: string // UUID primary key
  business_id: string // UUID foreign key to businesses
  name: string
  address: Json | null // JSONB address information
  store_code: string | null
  qr_code_data: string | null
  active: boolean
  // QR verification extensions
  current_qr_version: number | null
  qr_generation_date: string | null // ISO timestamp
  verification_enabled: boolean
  fraud_detection_threshold: number | null
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

// QR Verification System entities
export interface VerificationSession {
  id: string // UUID primary key
  store_id: string // UUID foreign key to stores
  qr_version: number
  scan_timestamp: string // ISO timestamp
  session_token: string // Secure session identifier
  status: VerificationSessionStatus
  ip_address: string | null
  user_agent: string | null
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

export interface CustomerVerification {
  id: string // UUID primary key
  session_id: string // UUID foreign key to verification_sessions
  transaction_time: string // Time format (HH:MM)
  transaction_amount: number // Decimal
  phone_number_e164: string // E.164 format (+46XXXXXXXXX)
  phone_number_national: string // National format (070-XXX XX XX)
  time_validation_status: ValidationStatus
  amount_validation_status: ValidationStatus
  phone_validation_status: PhoneValidationStatus
  tolerance_check_time_diff: number | null // Minutes difference
  tolerance_check_amount_diff: number | null // SEK difference
  submitted_at: string // ISO timestamp
  verified_at: string | null // ISO timestamp
}

export interface FraudDetectionLog {
  id: string // UUID primary key
  session_id: string | null // UUID foreign key to verification_sessions
  detection_type: FraudDetectionType
  risk_score: number // 1-100
  ip_address: string | null
  user_agent: string | null
  detection_details: Json | null // JSONB fraud indicators
  action_taken: FraudActionTaken
  detected_at: string // ISO timestamp
}

export interface Permission {
  id: string // UUID primary key
  name: string // Unique permission identifier
  description: string
  category: PermissionCategory
  created_at: string // ISO timestamp
}

export interface UserPermission {
  id: string // UUID primary key
  user_id: string // UUID foreign key to user_profiles
  permission: string // Foreign key to permissions.name
  granted_by: string // UUID foreign key to user_profiles
  granted_at: string // ISO timestamp
  expires_at: string | null // ISO timestamp, nullable
}

export interface ApiKey {
  id: string // UUID primary key
  name: string
  key_hash: string // Hashed API key value
  business_id: string | null // UUID foreign key to businesses
  permissions: string[] // Array of permission names
  last_used_at: string | null // ISO timestamp
  expires_at: string // ISO timestamp
  active: boolean
  created_by: string // UUID foreign key to user_profiles
  created_at: string // ISO timestamp
}

// Database table types (for type-safe database operations)
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<UserProfile, 'id' | 'created_at'>> & {
          updated_at?: string
        }
      }
      businesses: {
        Row: Business
        Insert: Omit<Business, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Business, 'id' | 'created_at'>> & {
          updated_at?: string
        }
      }
      stores: {
        Row: Store
        Insert: Omit<Store, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Store, 'id' | 'created_at'>> & {
          updated_at?: string
        }
      }
      permissions: {
        Row: Permission
        Insert: Omit<Permission, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<Permission, 'id' | 'created_at'>>
      }
      user_permissions: {
        Row: UserPermission
        Insert: Omit<UserPermission, 'id' | 'granted_at'> & {
          id?: string
          granted_at?: string
        }
        Update: Partial<Omit<UserPermission, 'id' | 'granted_at'>>
      }
      api_keys: {
        Row: ApiKey
        Insert: Omit<ApiKey, 'id' | 'created_at' | 'last_used_at'> & {
          id?: string
          created_at?: string
          last_used_at?: string
        }
        Update: Partial<Omit<ApiKey, 'id' | 'created_at'>> & {
          last_used_at?: string
        }
      }
      verification_sessions: {
        Row: VerificationSession
        Insert: Omit<VerificationSession, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<VerificationSession, 'id' | 'created_at'>> & {
          updated_at?: string
        }
      }
      customer_verifications: {
        Row: CustomerVerification
        Insert: Omit<CustomerVerification, 'id' | 'submitted_at'> & {
          id?: string
          submitted_at?: string
        }
        Update: Partial<Omit<CustomerVerification, 'id' | 'submitted_at'>>
      }
      fraud_detection_logs: {
        Row: FraudDetectionLog
        Insert: Omit<FraudDetectionLog, 'id' | 'detected_at'> & {
          id?: string
          detected_at?: string
        }
        Update: Partial<Omit<FraudDetectionLog, 'id' | 'detected_at'>>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      subscription_status: SubscriptionStatus
      permission_category: PermissionCategory
      verification_session_status: VerificationSessionStatus
      validation_status: ValidationStatus
      phone_validation_status: PhoneValidationStatus
      fraud_detection_type: FraudDetectionType
      fraud_action_taken: FraudActionTaken
    }
  }
}

// API request/response types
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: UserProfile
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface RefreshRequest {
  refresh_token: string
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface ProfileUpdateRequest {
  full_name?: string
  avatar_url?: string
}

export interface BusinessCreateRequest {
  name: string
  organization_number?: string
  contact_email?: string
  phone_number?: string
  address?: Json
}

export interface BusinessUpdateRequest {
  name?: string
  organization_number?: string
  contact_email?: string
  phone_number?: string
  address?: Json
  subscription_status?: SubscriptionStatus
}

export interface StoreCreateRequest {
  name: string
  address?: Json
  store_code?: string
}

export interface StoreUpdateRequest {
  name?: string
  address?: Json
  store_code?: string
  active?: boolean
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  version: string
}

export interface DetailedHealthStatus extends HealthStatus {
  checks: {
    database: {
      status: 'up' | 'down'
      response_time_ms: number
    }
    auth: {
      status: 'up' | 'down'
      response_time_ms: number
    }
    external_services: {
      status: 'up' | 'down' | 'partial'
      details: Record<string, { status: 'up' | 'down'; response_time_ms: number }>
    }
  }
}

// Error response types
export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
  timestamp: string
  path: string
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    current_page: number
    total_pages: number
    total_count: number
    page_size: number
    has_next: boolean
    has_previous: boolean
  }
}

// Permission constants
export const PERMISSIONS = {
  BUSINESS_READ: 'business.read',
  BUSINESS_WRITE: 'business.write',
  BUSINESS_DELETE: 'business.delete',
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_WRITE: 'customers.write',
  FEEDBACK_READ: 'feedback.read',
  FEEDBACK_MODERATE: 'feedback.moderate',
  ADMIN_USERS: 'admin.users',
  ADMIN_BUSINESSES: 'admin.businesses',
  ADMIN_SYSTEM: 'admin.system',
} as const

export type PermissionName = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// Utility types for strict type checking
export type NonEmptyString<T extends string> = T extends '' ? never : T
export type ValidEmail<T extends string> = T extends `${string}@${string}.${string}` ? T : never
export type ValidUUID<T extends string> = T extends `${string}-${string}-${string}-${string}-${string}` ? T : never

// Authentication context types
export interface AuthUser {
  id: string
  email: string
  role: UserRole
  business_id: string | null
  permissions: string[]
}

export interface AuthContext {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  updateProfile: (updates: ProfileUpdateRequest) => Promise<void>
}

// Route parameter types
export interface BusinessRouteParams {
  businessId: string
}

export interface StoreRouteParams {
  storeId: string
}

export interface BusinessStoreRouteParams {
  businessId: string
  storeId?: string
}

// QR Verification API types
export interface QRVerificationRequest {
  ip_address: string
  user_agent: string
}

export interface QRVerificationResponse {
  success: boolean
  session_token: string
  store_info: {
    store_id: string
    store_name: string
    business_name: string
    logo_url?: string
  }
  fraud_warning: boolean
}

export interface VerificationSubmissionRequest {
  transaction_time: string // HH:MM format
  transaction_amount: number
  phone_number: string // User input format
}

export interface ValidationResult {
  status: ValidationStatus | PhoneValidationStatus
  difference_minutes?: number
  difference_sek?: number
  tolerance_range?: string
  e164_format?: string
  national_format?: string
}

export interface VerificationSubmissionResponse {
  success: boolean
  verification_id: string
  validation_results: {
    time_validation: ValidationResult
    amount_validation: ValidationResult
    phone_validation: ValidationResult
    overall_valid: boolean
  }
  next_steps: string
}

export interface SessionDetailsResponse {
  session_id: string
  store_info: {
    store_id: string
    store_name: string
    business_name: string
    logo_url?: string
  }
  status: VerificationSessionStatus
  qr_version: number
  created_at: string
  expires_at: string
}

export interface QRVerificationRouteParams {
  storeId: string
}

export interface SessionRouteParams {
  sessionToken: string
}

// Admin Dashboard API types
export interface VerificationStatsResponse {
  success: boolean
  store_id: string
  period: {
    days: number
    start_date: string
    end_date: string
  }
  statistics: {
    total_sessions: number
    completed_verifications: number
    success_rate: number
    fraud_detections: number
    average_completion_time_seconds: number
    most_common_failure_reasons: string[]
    hourly_distribution: Array<{ hour: number; count: number }>
    daily_trend: Array<{ date: string; successful: number; failed: number }>
  }
}

export interface VerificationDetailsResponse {
  success: boolean
  store_id: string
  pagination: {
    limit: number
    offset: number
    total: number
    has_more: boolean
  }
  filters: {
    status?: string
    start_date?: string
    end_date?: string
  }
  verifications: Array<{
    verification_id: string
    session_token: string
    phone_number: string
    transaction_amount: number
    transaction_time: string
    status: string
    validation_results: any
    created_at: string
    completed_at?: string
    ip_address: string
    user_agent: string
    fraud_score?: number
  }>
}
// Auto-generated database types
export * from './database';

// Calls types
export * from './calls';

// Custom Questions types
export * from './questions';

// Feedback Analysis types
export * from './feedback-analysis';

// AI Assistant types
export * from './ai-assistant';

// PWA and Offline types
export * from './pwa';
export * from './offline';

// Customer Support types
export * from './support';

// Admin Dashboard types
export * from './admin';

// AI Call System types
export * from './ai-call-system';

// Payment types
export * from './payment';

// Testing and Test Management types
export * from './testing';
export * from './test-management';
