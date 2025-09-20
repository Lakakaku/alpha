import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loggingService } from '../services/loggingService';

export interface DatabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  enableRealtime?: boolean;
  enableRLS?: boolean;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingConnections: number;
}

class DatabaseConnectionManager {
  private clients: Map<string, SupabaseClient> = new Map();
  private config: DatabaseConfig;
  private connectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingConnections: 0,
    errors: 0,
    lastError: null as string | null,
  };

  constructor() {
    this.config = this.loadConfig();
    this.initializeConnections();
    this.setupHealthChecks();
  }

  private loadConfig(): DatabaseConfig {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }

    return {
      url,
      anonKey,
      serviceRoleKey,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '300000'), // 5 minutes
      connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000'), // 10 seconds
      enableRealtime: process.env.DB_ENABLE_REALTIME !== 'false',
      enableRLS: process.env.DB_ENABLE_RLS !== 'false',
    };
  }

  private initializeConnections(): void {
    try {
      // Create main client (with anon key)
      const mainClient = createClient(this.config.url, this.config.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false, // Server-side, don't persist sessions
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
        global: {
          headers: {
            'X-Client-Info': 'vocilia-backend/1.0.0',
          },
        },
      });

      this.clients.set('main', mainClient);
      this.connectionStats.totalConnections++;

      // Create service role client if available (for admin operations)
      if (this.config.serviceRoleKey) {
        const serviceClient = createClient(this.config.url, this.config.serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          global: {
            headers: {
              'X-Client-Info': 'vocilia-backend-service/1.0.0',
            },
          },
        });

        this.clients.set('service', serviceClient);
        this.connectionStats.totalConnections++;
      }

      loggingService.info('Database connections initialized', {
        totalConnections: this.connectionStats.totalConnections,
        hasServiceRole: !!this.config.serviceRoleKey,
      });
    } catch (error) {
      this.connectionStats.errors++;
      this.connectionStats.lastError = error instanceof Error ? error.message : 'Unknown error';
      loggingService.error('Failed to initialize database connections', error as Error);
      throw error;
    }
  }

  private setupHealthChecks(): void {
    // Periodic health check every 30 seconds
    setInterval(async () => {
      await this.performHealthCheck();
    }, 30000);

    // Connection timeout cleanup every 5 minutes
    setInterval(() => {
      this.cleanupIdleConnections();
    }, 300000);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const client = this.getClient('main');
      const startTime = Date.now();

      // Simple health check query
      const { error } = await client
        .from('user_profiles')
        .select('count')
        .limit(1)
        .single();

      const responseTime = Date.now() - startTime;

      if (error && error.code !== 'PGRST116') {
        this.connectionStats.errors++;
        this.connectionStats.lastError = error.message;
        loggingService.logHealthCheckFailed('database', new Error(error.message));
      } else {
        // Reset error count on successful health check
        if (this.connectionStats.errors > 0) {
          loggingService.info('Database health check recovered', {
            responseTime,
            previousErrors: this.connectionStats.errors,
          });
          this.connectionStats.errors = 0;
          this.connectionStats.lastError = null;
        }

        // Log slow queries
        if (responseTime > 1000) {
          loggingService.logSlowQuery('health_check', responseTime);
        }
      }
    } catch (error) {
      this.connectionStats.errors++;
      this.connectionStats.lastError = error instanceof Error ? error.message : 'Unknown error';
      loggingService.logHealthCheckFailed('database', error as Error);
    }
  }

  private cleanupIdleConnections(): void {
    // In a real connection pool, this would clean up idle connections
    // For Supabase client, we'll just log the cleanup attempt
    loggingService.debug('Database connection cleanup performed', {
      totalConnections: this.connectionStats.totalConnections,
      errors: this.connectionStats.errors,
    });
  }

  public getClient(type: 'main' | 'service' = 'main'): SupabaseClient {
    const client = this.clients.get(type);
    
    if (!client) {
      if (type === 'service') {
        // Fallback to main client if service role not available
        const mainClient = this.clients.get('main');
        if (!mainClient) {
          throw new Error('No database client available');
        }
        loggingService.warn('Service role client not available, using main client');
        return mainClient;
      }
      throw new Error(`Database client '${type}' not found`);
    }

    this.connectionStats.activeConnections++;
    
    // Simulate connection tracking (in real implementation, you'd track actual usage)
    setTimeout(() => {
      this.connectionStats.activeConnections = Math.max(0, this.connectionStats.activeConnections - 1);
      this.connectionStats.idleConnections++;
    }, 1000);

    return client;
  }

  public getConnectionStats(): ConnectionPoolStats {
    return {
      totalConnections: this.connectionStats.totalConnections,
      idleConnections: this.connectionStats.idleConnections,
      activeConnections: this.connectionStats.activeConnections,
      waitingConnections: this.connectionStats.waitingConnections,
    };
  }

  public async testConnection(): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient('main');
      
      const { error } = await client
        .from('user_profiles')
        .select('count')
        .limit(1)
        .single();

      const responseTime = Date.now() - startTime;

      if (error && error.code !== 'PGRST116') {
        return {
          success: false,
          responseTime,
          error: error.message,
        };
      }

      return {
        success: true,
        responseTime,
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async executeWithRetry<T>(
    operation: (client: SupabaseClient) => Promise<T>,
    maxRetries: number = 3,
    clientType: 'main' | 'service' = 'main'
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = this.getClient(clientType);
        return await operation(client);
      } catch (error) {
        lastError = error as Error;
        
        loggingService.warn(`Database operation failed (attempt ${attempt}/${maxRetries})`, {
          error: lastError.message,
          attempt,
          maxRetries,
        });

        // Don't retry on certain errors
        if (error instanceof Error && error.message.includes('permission denied')) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Database operation failed after retries');
  }

  public getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  public async shutdown(): Promise<void> {
    loggingService.info('Shutting down database connections');
    
    // Clear clients
    this.clients.clear();
    this.connectionStats.totalConnections = 0;
    this.connectionStats.activeConnections = 0;
    this.connectionStats.idleConnections = 0;
    
    loggingService.info('Database connections closed');
  }
}

// Singleton instance
export const databaseManager = new DatabaseConnectionManager();

// Export convenience functions
export function getMainClient(): SupabaseClient {
  return databaseManager.getClient('main');
}

export function getServiceClient(): SupabaseClient {
  return databaseManager.getClient('service');
}

export function getDatabaseStats(): ConnectionPoolStats {
  return databaseManager.getConnectionStats();
}

export async function testDatabaseConnection(): Promise<{
  success: boolean;
  responseTime: number;
  error?: string;
}> {
  return databaseManager.testConnection();
}

export async function executeWithRetry<T>(
  operation: (client: SupabaseClient) => Promise<T>,
  maxRetries?: number,
  clientType?: 'main' | 'service'
): Promise<T> {
  return databaseManager.executeWithRetry(operation, maxRetries, clientType);
}

// Export the default client (for backward compatibility)
export const supabase = getMainClient();