import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/index.js';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
    realtime?: {
      params?: {
        eventsPerSecond?: number;
      };
    };
    global?: {
      headers?: Record<string, string>;
    };
  };
}

interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
  environment: 'development' | 'test' | 'production';
}

class SupabaseClientManager {
  private static instance: SupabaseClientManager;
  private clientInstance: SupabaseClient<Database> | null = null;
  private serviceClientInstance: SupabaseClient<Database> | null = null;
  private config: EnvironmentConfig | null = null;

  private constructor() {}

  public static getInstance(): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager();
    }
    return SupabaseClientManager.instance;
  }

  public initialize(config: EnvironmentConfig): void {
    this.validateEnvironmentConfig(config);
    this.config = config;

    // Clear existing instances
    this.clientInstance = null;
    this.serviceClientInstance = null;
  }

  public getClient(): SupabaseClient<Database> {
    if (!this.config) {
      throw new Error('SupabaseClientManager not initialized. Call initialize() first.');
    }

    if (!this.clientInstance) {
      this.clientInstance = createClient<Database>(
        this.config.supabaseUrl,
        this.config.supabaseAnonKey,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: this.config.environment !== 'test',
            detectSessionInUrl: this.config.environment !== 'test',
          },
          realtime: {
            params: {
              eventsPerSecond: this.config.environment === 'production' ? 10 : 100,
            },
          },
          global: {
            headers: {
              'X-Client-Info': `@alpha/database@0.1.0`,
              'X-Environment': this.config.environment,
            },
          },
        }
      );
    }

    return this.clientInstance;
  }

  public getServiceClient(): SupabaseClient<Database> {
    if (!this.config) {
      throw new Error('SupabaseClientManager not initialized. Call initialize() first.');
    }

    if (!this.config.supabaseServiceRoleKey) {
      throw new Error('Service role key not provided. Service client unavailable.');
    }

    if (!this.serviceClientInstance) {
      this.serviceClientInstance = createClient<Database>(
        this.config.supabaseUrl,
        this.config.supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          global: {
            headers: {
              'X-Client-Info': `@alpha/database@0.1.0-service`,
              'X-Environment': this.config.environment,
            },
          },
        }
      );
    }

    return this.serviceClientInstance;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient();
      const { error } = await client.from('businesses').select('count').limit(1);

      if (error && error.code !== 'PGRST116') { // PGRST116 = relation does not exist (expected in tests)
        console.warn('Database connection test failed:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Database connection test failed:', error);
      return false;
    }
  }

  public getConfig(): EnvironmentConfig | null {
    return this.config;
  }

  private validateEnvironmentConfig(config: EnvironmentConfig): void {
    const { supabaseUrl, supabaseAnonKey, environment } = config;

    if (!supabaseUrl || typeof supabaseUrl !== 'string') {
      throw new Error('Invalid or missing SUPABASE_URL');
    }

    if (!supabaseAnonKey || typeof supabaseAnonKey !== 'string') {
      throw new Error('Invalid or missing SUPABASE_ANON_KEY');
    }

    if (!['development', 'test', 'production'].includes(environment)) {
      throw new Error('Environment must be one of: development, test, production');
    }

    // Validate URL format
    try {
      new URL(supabaseUrl);
    } catch {
      throw new Error('SUPABASE_URL must be a valid URL');
    }

    // Basic key format validation (JWT-like structure)
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(supabaseAnonKey)) {
      console.warn('SUPABASE_ANON_KEY does not appear to be a valid JWT token');
    }

    // Production environment validations
    if (environment === 'production') {
      if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
        throw new Error('Production environment cannot use localhost URLs');
      }

      if (!supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('supabase.com')) {
        console.warn('Production URL does not appear to be a Supabase hosted instance');
      }
    }
  }
}

// Auto-initialize from environment variables if available
export function createSupabaseClient(): SupabaseClient<Database> {
  const manager = SupabaseClientManager.getInstance();

  // Check if already initialized
  if (manager.getConfig()) {
    return manager.getClient();
  }

  // Initialize from environment
  const envConfig = getEnvironmentConfig();
  manager.initialize(envConfig);

  return manager.getClient();
}

export function createServiceClient(): SupabaseClient<Database> {
  const manager = SupabaseClientManager.getInstance();

  // Check if already initialized
  if (!manager.getConfig()) {
    const envConfig = getEnvironmentConfig();
    manager.initialize(envConfig);
  }

  return manager.getServiceClient();
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required');
  }

  if (!supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY environment variable is required');
  }

  // Map NODE_ENV to our environment types
  let environment: EnvironmentConfig['environment'];
  switch (nodeEnv) {
    case 'test':
      environment = 'test';
      break;
    case 'production':
      environment = 'production';
      break;
    default:
      environment = 'development';
      break;
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    environment,
  };
}

// Test helper for initializing with custom config
export function initializeSupabaseForTesting(config: EnvironmentConfig): void {
  const manager = SupabaseClientManager.getInstance();
  manager.initialize(config);
}

// Export the manager instance for advanced use cases
export const supabaseManager = SupabaseClientManager.getInstance();

// Default client instance
export const supabase = createSupabaseClient();

// Types for external use
export type { SupabaseConfig, EnvironmentConfig };
export type { SupabaseClient, Database };