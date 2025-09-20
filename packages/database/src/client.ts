import { createClient, SupabaseClient, User } from '@supabase/supabase-js'
import type { Database, UserProfile, Business, Store, UserPermission, ApiKey } from '@vocilia/types'
import { testDatabaseConnection, performHealthCheck, formatDatabaseError, retryWithExponentialBackoff, dbLogger } from './client/utils.js'

export interface DatabaseConfig {
  url: string
  anonKey: string
  serviceRoleKey?: string
  enableLogging?: boolean
  retryAttempts?: number
  connectionTimeout?: number
}

export interface QueryOptions {
  retries?: number
  timeout?: number
  throwOnError?: boolean
}

export interface PaginationOptions {
  page?: number
  limit?: number
  offset?: number
}

export interface SortOptions {
  column: string
  ascending?: boolean
}

/**
 * Enhanced Supabase client with typed queries and additional utilities
 * Provides type-safe database operations for the Vocilia platform
 */
export class DatabaseClient {
  private client: SupabaseClient<Database>
  private config: DatabaseConfig
  private isConnected: boolean = false

  constructor(config: DatabaseConfig) {
    this.config = config
    this.client = createClient<Database>(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      global: {
        headers: {
          'x-application': 'vocilia-platform'
        }
      }
    })

    if (config.enableLogging) {
      dbLogger.info('Database client initialized', { url: config.url })
    }
  }

  /**
   * Get the underlying Supabase client for advanced operations
   */
  getClient(): SupabaseClient<Database> {
    return this.client
  }

  /**
   * Set authentication session for the client
   */
  async setAuth(accessToken: string, refreshToken?: string): Promise<void> {
    const { error } = await this.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || ''
    })

    if (error) {
      throw new Error(`Failed to set auth session: ${error.message}`)
    }
  }

  /**
   * Test database connectivity and perform health checks
   */
  async connect(): Promise<void> {
    try {
      const healthCheck = await performHealthCheck(this.client)
      
      if (!healthCheck.connection.isConnected) {
        throw new Error(`Database connection failed: ${healthCheck.error}`)
      }

      if (!healthCheck.tablesAccessible) {
        throw new Error('Required database tables are not accessible')
      }

      if (!healthCheck.rlsEnabled) {
        dbLogger.warn('Row Level Security is not enabled on all tables')
      }

      this.isConnected = true
      
      if (this.config.enableLogging) {
        dbLogger.info('Database connection established', {
          latency: healthCheck.connection.latencyMs,
          tables: healthCheck.tablesAccessible,
          rls: healthCheck.rlsEnabled,
          functions: healthCheck.functionsAvailable
        })
      }
    } catch (error) {
      this.isConnected = false
      dbLogger.error('Failed to connect to database', error)
      throw error
    }
  }

  /**
   * Check if the client is connected to the database
   */
  isHealthy(): boolean {
    return this.isConnected
  }

  // User Profile Operations
  async getUserProfile(userId: string, options: QueryOptions = {}): Promise<UserProfile | null> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows returned
        throw formatDatabaseError(error)
      }

      return data
    }, options)
  }

  async createUserProfile(profile: Database['public']['Tables']['user_profiles']['Insert']): Promise<UserProfile> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('user_profiles')
        .insert(profile)
        .select()
        .single()

      if (error) throw formatDatabaseError(error)
      return data
    })
  }

  async updateUserProfile(
    userId: string, 
    updates: Database['public']['Tables']['user_profiles']['Update']
  ): Promise<UserProfile> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw formatDatabaseError(error)
      return data
    })
  }

  // Business Operations
  async getBusiness(businessId: string, options: QueryOptions = {}): Promise<Business | null> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw formatDatabaseError(error)
      }

      return data
    }, options)
  }

  async getBusinesses(
    pagination: PaginationOptions = {},
    sort: SortOptions = { column: 'created_at', ascending: false }
  ): Promise<{ data: Business[], count: number }> {
    return this.executeQuery(async () => {
      const { page = 1, limit = 50, offset } = pagination
      const actualOffset = offset ?? (page - 1) * limit

      const query = this.client
        .from('businesses')
        .select('*', { count: 'exact' })
        .order(sort.column, { ascending: sort.ascending })
        .range(actualOffset, actualOffset + limit - 1)

      const { data, error, count } = await query

      if (error) throw formatDatabaseError(error)
      return { data: data || [], count: count || 0 }
    })
  }

  async createBusiness(business: Database['public']['Tables']['businesses']['Insert']): Promise<Business> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('businesses')
        .insert(business)
        .select()
        .single()

      if (error) throw formatDatabaseError(error)
      return data
    })
  }

  async updateBusiness(
    businessId: string,
    updates: Database['public']['Tables']['businesses']['Update']
  ): Promise<Business> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('businesses')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', businessId)
        .select()
        .single()

      if (error) throw formatDatabaseError(error)
      return data
    })
  }

  // Store Operations
  async getStore(storeId: string, options: QueryOptions = {}): Promise<Store | null> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw formatDatabaseError(error)
      }

      return data
    }, options)
  }

  async getStoresByBusiness(
    businessId: string,
    pagination: PaginationOptions = {},
    sort: SortOptions = { column: 'name', ascending: true }
  ): Promise<{ data: Store[], count: number }> {
    return this.executeQuery(async () => {
      const { page = 1, limit = 50, offset } = pagination
      const actualOffset = offset ?? (page - 1) * limit

      const query = this.client
        .from('stores')
        .select('*', { count: 'exact' })
        .eq('business_id', businessId)
        .order(sort.column, { ascending: sort.ascending })
        .range(actualOffset, actualOffset + limit - 1)

      const { data, error, count } = await query

      if (error) throw formatDatabaseError(error)
      return { data: data || [], count: count || 0 }
    })
  }

  async createStore(store: Database['public']['Tables']['stores']['Insert']): Promise<Store> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('stores')
        .insert(store)
        .select()
        .single()

      if (error) throw formatDatabaseError(error)
      return data
    })
  }

  async updateStore(
    storeId: string,
    updates: Database['public']['Tables']['stores']['Update']
  ): Promise<Store> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('stores')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', storeId)
        .select()
        .single()

      if (error) throw formatDatabaseError(error)
      return data
    })
  }

  // Permission Operations
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)

      if (error) throw formatDatabaseError(error)
      return data || []
    })
  }

  async grantPermission(permission: Database['public']['Tables']['user_permissions']['Insert']): Promise<UserPermission> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('user_permissions')
        .insert(permission)
        .select()
        .single()

      if (error) throw formatDatabaseError(error)
      return data
    })
  }

  async revokePermission(userId: string, permission: string): Promise<void> {
    return this.executeQuery(async () => {
      const { error } = await this.client
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('permission', permission)

      if (error) throw formatDatabaseError(error)
    })
  }

  // API Key Operations
  async getApiKey(keyId: string): Promise<ApiKey | null> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('api_keys')
        .select('*')
        .eq('id', keyId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw formatDatabaseError(error)
      }

      return data
    })
  }

  async createApiKey(apiKey: Database['public']['Tables']['api_keys']['Insert']): Promise<ApiKey> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client
        .from('api_keys')
        .insert(apiKey)
        .select()
        .single()

      if (error) throw formatDatabaseError(error)
      return data
    })
  }

  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    return this.executeQuery(async () => {
      const { error } = await this.client
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyId)

      if (error) throw formatDatabaseError(error)
    })
  }

  async deactivateApiKey(keyId: string): Promise<void> {
    return this.executeQuery(async () => {
      const { error } = await this.client
        .from('api_keys')
        .update({ active: false })
        .eq('id', keyId)

      if (error) throw formatDatabaseError(error)
    })
  }

  // Transaction Operations
  async executeTransaction<T>(operations: (client: SupabaseClient<Database>) => Promise<T>): Promise<T> {
    return this.executeQuery(async () => {
      // Note: Supabase doesn't support explicit transactions in the client
      // Each operation is automatically wrapped in a transaction
      // For complex multi-table operations, use RPC functions
      return await operations(this.client)
    })
  }

  // Utility Methods
  private async executeQuery<T>(
    operation: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const { 
      retries = this.config.retryAttempts || 3,
      throwOnError = true 
    } = options

    try {
      if (retries > 1) {
        return await retryWithExponentialBackoff(operation, retries)
      } else {
        return await operation()
      }
    } catch (error) {
      if (this.config.enableLogging) {
        dbLogger.error('Database query failed', error)
      }
      
      if (throwOnError) {
        throw error
      }
      
      return null as T
    }
  }

  /**
   * Close the database connection and cleanup resources
   */
  async disconnect(): Promise<void> {
    // Supabase client doesn't have explicit disconnect
    // Clear any auth sessions
    await this.client.auth.signOut()
    this.isConnected = false
    
    if (this.config.enableLogging) {
      dbLogger.info('Database client disconnected')
    }
  }
}

/**
 * Create a new database client instance
 */
export function createDatabaseClient(config: DatabaseConfig): DatabaseClient {
  return new DatabaseClient(config)
}

/**
 * Create a database client from environment variables
 */
export function createDatabaseClientFromEnv(): DatabaseClient {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY')
  }

  return new DatabaseClient({
    url,
    anonKey,
    serviceRoleKey,
    enableLogging: process.env.NODE_ENV === 'development',
    retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3'),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000')
  })
}

// Export utilities for convenience
export { testDatabaseConnection, performHealthCheck, formatDatabaseError } from './client/utils.js'
export type { ConnectionTestResult, DatabaseHealthCheck } from './client/utils.js'