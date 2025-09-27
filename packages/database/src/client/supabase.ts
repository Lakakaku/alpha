import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocilia/types'

/**
 * Supabase Client Manager - Singleton pattern for managing Supabase client instances
 */
export class SupabaseClientManager {
  private static instance: SupabaseClientManager
  private client: SupabaseClient<Database> | null = null
  private config: {
    supabaseUrl: string
    supabaseAnonKey: string
  }

  private constructor(config?: {
    supabaseUrl?: string
    supabaseAnonKey?: string
  }) {
    this.config = {
      supabaseUrl: config?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
      supabaseAnonKey: config?.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
    }

    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      throw new Error('Supabase URL and anonymous key are required')
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: {
    supabaseUrl?: string
    supabaseAnonKey?: string
  }): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager(config)
    }
    return SupabaseClientManager.instance
  }

  /**
   * Get the Supabase client instance
   */
  public getClient(): SupabaseClient<Database> {
    if (!this.client) {
      this.client = createClient<Database>(
        this.config.supabaseUrl,
        this.config.supabaseAnonKey,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          }
        }
      )
    }
    return this.client
  }

  /**
   * Get configuration details
   */
  public getConfig() {
    return {
      supabaseUrl: this.config.supabaseUrl,
      hasAnonKey: !!this.config.supabaseAnonKey,
      environment: process.env.NODE_ENV ?? 'development'
    }
  }

  /**
   * Reset the client instance (useful for testing)
   */
  public reset(): void {
    this.client = null
    SupabaseClientManager.instance = null as any
  }
}

/**
 * Default supabase client instance
 * Uses the singleton pattern to ensure consistent client across the application
 */
export const supabase = SupabaseClientManager.getInstance().getClient();