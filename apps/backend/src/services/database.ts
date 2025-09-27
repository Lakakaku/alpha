import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types';
import { loggingService } from './loggingService';

export interface DatabaseConnectionConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  maxConnections: number;
  connectionTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  enableLogging: boolean;
}

export interface DatabaseConnectionStats {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  lastConnectionTime: Date | null;
  lastError: string | null;
}

/**
 * Centralized database connection service for QR verification system
 * Provides connection pooling, error handling, and retry logic
 */
class DatabaseService {
  private client: SupabaseClient<Database> | null = null;
  private serviceClient: SupabaseClient<Database> | null = null;
  private config: DatabaseConnectionConfig;
  private stats: DatabaseConnectionStats;
  private isInitialized = false;

  constructor() {
    this.config = this.loadConfiguration();
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      lastConnectionTime: null,
      lastError: null
    };
  }

  /**
   * Load database configuration from environment variables
   */
  private loadConfiguration(): DatabaseConnectionConfig {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY');
    }

    return {
      url,
      anonKey,
      serviceRoleKey,
      maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
      connectionTimeoutMs: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || '10000'),
      retryAttempts: parseInt(process.env.DATABASE_RETRY_ATTEMPTS || '3'),
      retryDelayMs: parseInt(process.env.DATABASE_RETRY_DELAY_MS || '1000'),
      enableLogging: process.env.DATABASE_ENABLE_LOGGING !== 'false'
    };
  }

  /**
   * Initialize database connections
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create main client for regular operations
      this.client = createClient<Database>(this.config.url, this.config.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false
        },
        global: {
          headers: {
            'X-Client-Info': 'vocilia-qr-verification/1.0.0'
          }
        }
      });

      // Create service role client for administrative operations
      if (this.config.serviceRoleKey) {
        this.serviceClient = createClient<Database>(this.config.url, this.config.serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          },
          global: {
            headers: {
              'X-Client-Info': 'vocilia-qr-verification-service/1.0.0'
            }
          }
        });
      }

      // Test connection
      await this.testConnection();

      this.stats.totalConnections = this.serviceClient ? 2 : 1;
      this.stats.lastConnectionTime = new Date();
      this.isInitialized = true;

      if (this.config.enableLogging) {
        loggingService.info('Database service initialized successfully', {
          hasServiceRole: !!this.config.serviceRoleKey,
          totalConnections: this.stats.totalConnections
        });
      }
    } catch (error) {
      this.stats.failedConnections++;
      this.stats.lastError = error instanceof Error ? error.message : 'Unknown initialization error';
      
      if (this.config.enableLogging) {
        loggingService.error('Database service initialization failed', error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Get main database client (for authenticated operations)
   */
  public getClient(): SupabaseClient<Database> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Database service not initialized. Call initialize() first.');
    }

    this.stats.activeConnections++;
    return this.client;
  }

  /**
   * Get service role client (for administrative operations)
   */
  public getServiceClient(): SupabaseClient<Database> {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized. Call initialize() first.');
    }

    if (!this.serviceClient) {
      if (this.config.enableLogging) {
        loggingService.warn('Service role client not available, falling back to main client');
      }
      return this.getClient();
    }

    this.stats.activeConnections++;
    return this.serviceClient;
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<void> {
    const client = this.client || this.getClient();
    
    try {
      const { error } = await client
        .from('businesses')
        .select('id')
        .limit(1)
        .single();

      // PGRST116 is "no rows returned" which is fine for connection test
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Database connection test failed: ${error.message}`);
      }
    } catch (error) {
      this.stats.failedConnections++;
      this.stats.lastError = error instanceof Error ? error.message : 'Connection test failed';
      throw error;
    }
  }

  /**
   * Execute database operation with retry logic
   */
  public async executeWithRetry<T>(
    operation: (client: SupabaseClient<Database>) => Promise<T>,
    useServiceRole = false
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const client = useServiceRole ? this.getServiceClient() : this.getClient();
        const result = await operation(client);
        
        // Reset error on successful operation
        if (this.stats.lastError && attempt > 1) {
          this.stats.lastError = null;
          if (this.config.enableLogging) {
            loggingService.info(`Database operation succeeded after ${attempt} attempts`);
          }
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        this.stats.failedConnections++;
        this.stats.lastError = lastError.message;

        if (this.config.enableLogging) {
          loggingService.warn(`Database operation failed (attempt ${attempt}/${this.config.retryAttempts})`, {
            error: lastError.message,
            attempt
          });
        }

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          break;
        }

        // Wait before retry (with exponential backoff)
        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await this.delay(Math.min(delay, 10000)); // Cap at 10 seconds
        }
      }
    }

    throw lastError || new Error('Database operation failed after retries');
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      'permission denied',
      'authentication failed',
      'invalid input syntax',
      'violates foreign key constraint',
      'violates unique constraint',
      'violates check constraint'
    ];

    return nonRetryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get connection statistics
   */
  public getStats(): DatabaseConnectionStats {
    return { ...this.stats };
  }

  /**
   * Get database configuration (without sensitive data)
   */
  public getConfig(): Omit<DatabaseConnectionConfig, 'anonKey' | 'serviceRoleKey'> {
    return {
      url: this.config.url,
      maxConnections: this.config.maxConnections,
      connectionTimeoutMs: this.config.connectionTimeoutMs,
      retryAttempts: this.config.retryAttempts,
      retryDelayMs: this.config.retryDelayMs,
      enableLogging: this.config.enableLogging
    };
  }

  /**
   * Health check for monitoring
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTimeMs: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await this.testConnection();
      
      return {
        status: 'healthy',
        responseTimeMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.config.enableLogging) {
      loggingService.info('Shutting down database service');
    }

    this.client = null;
    this.serviceClient = null;
    this.isInitialized = false;
    
    // Reset stats
    this.stats.activeConnections = 0;
    this.stats.totalConnections = 0;
  }
}

// Singleton instance
export const databaseService = new DatabaseService();

// Convenience functions for backward compatibility
export async function initializeDatabase(): Promise<void> {
  return databaseService.initialize();
}

export function getDatabaseClient(): SupabaseClient<Database> {
  return databaseService.getClient();
}

export function getServiceDatabaseClient(): SupabaseClient<Database> {
  return databaseService.getServiceClient();
}

export async function executeWithRetry<T>(
  operation: (client: SupabaseClient<Database>) => Promise<T>,
  useServiceRole = false
): Promise<T> {
  return databaseService.executeWithRetry(operation, useServiceRole);
}

export async function testDatabaseConnection(): Promise<void> {
  return databaseService.testConnection();
}

export function getDatabaseStats(): DatabaseConnectionStats {
  return databaseService.getStats();
}

export async function databaseHealthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTimeMs: number;
  error?: string;
}> {
  return databaseService.healthCheck();
}

// Initialize on module load (can be disabled with environment variable)
if (process.env.DATABASE_AUTO_INITIALIZE !== 'false') {
  databaseService.initialize().catch(error => {
    console.error('Failed to auto-initialize database service:', error);
    process.exit(1);
  });
}