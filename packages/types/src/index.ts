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
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
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
// Auto-generated database types
export * from './database';
