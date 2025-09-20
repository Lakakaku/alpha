/**
 * @fileoverview Alpha Database Package - Main Entry Point
 * @description Comprehensive database layer for the Alpha customer feedback system
 * providing type-safe, RLS-compliant database operations with real-time capabilities.
 */

// =============================================================================
// Type Definitions and Interfaces
// =============================================================================

export * from './types/index.js';

// =============================================================================
// Database Client and Configuration
// =============================================================================

export { SupabaseClientManager } from './client/supabase.js';
export {
  testDatabaseConnection,
  formatDatabaseError,
  isDatabaseError,
  isConnectionError,
  isPermissionError,
  isValidationError,
  dbLogger,
  type ConnectionTestResult,
  type DatabaseError,
  type FormattedDatabaseError
} from './client/utils.js';

// =============================================================================
// Query Classes - Entity Operations
// =============================================================================

export { BusinessQueries } from './queries/business.js';
export { StoreQueries } from './queries/store.js';
export { UserAccountQueries } from './queries/user-account.js';
export { ContextWindowQueries } from './queries/context-window.js';
export { TransactionQueries } from './queries/transaction.js';
export { FeedbackSessionQueries } from './queries/feedback-session.js';
export { VerificationRecordQueries } from './queries/verification-record.js';

// =============================================================================
// Query Factory Functions
// =============================================================================

export { createBusinessQueries } from './queries/business.js';
export { createStoreQueries } from './queries/store.js';
export { createUserAccountQueries } from './queries/user-account.js';
export { createContextWindowQueries } from './queries/context-window.js';
export { createTransactionQueries } from './queries/transaction.js';
export { createFeedbackSessionQueries } from './queries/feedback-session.js';
export { createVerificationRecordQueries } from './queries/verification-record.js';

// =============================================================================
// Authentication and Authorization
// =============================================================================

export {
  AuthHelper,
  createAuthHelper,
  type JWTClaims,
  type AuthTokenValidation
} from './auth/auth-helper.js';

// =============================================================================
// Real-time Subscriptions
// =============================================================================

export {
  RealtimeSubscriptionManager,
  createRealtimeSubscriptionManager,
  type TableName,
  type RealtimeEventType,
  type SubscriptionConfig,
  type SubscriptionCallback,
  type ErrorCallback,
  type SubscriptionOptions
} from './realtime/subscription-manager.js';

// =============================================================================
// Migration and Schema Management
// =============================================================================

export {
  MigrationRunner,
  createMigrationRunner,
  type MigrationFile,
  type MigrationResult,
  type MigrationStatus,
  type RollbackResult
} from './migrations/migration-runner.js';

// =============================================================================
// Convenience Factory Functions
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types/index.js';
import { BusinessQueries } from './queries/business.js';
import { StoreQueries } from './queries/store.js';
import { UserAccountQueries } from './queries/user-account.js';
import { ContextWindowQueries } from './queries/context-window.js';
import { TransactionQueries } from './queries/transaction.js';
import { FeedbackSessionQueries } from './queries/feedback-session.js';
import { VerificationRecordQueries } from './queries/verification-record.js';
import { AuthHelper } from './auth/auth-helper.js';
import { RealtimeSubscriptionManager } from './realtime/subscription-manager.js';
import { MigrationRunner } from './migrations/migration-runner.js';

/**
 * Database Operations Bundle
 * Provides all query classes initialized with the same client instance
 */
export interface DatabaseOperations {
  // Query classes
  business: BusinessQueries;
  store: StoreQueries;
  userAccount: UserAccountQueries;
  contextWindow: ContextWindowQueries;
  transaction: TransactionQueries;
  feedbackSession: FeedbackSessionQueries;
  verificationRecord: VerificationRecordQueries;

  // Utility classes
  auth: AuthHelper;
  realtime: RealtimeSubscriptionManager;
  migration: MigrationRunner;

  // Raw client access
  client: SupabaseClient<Database>;
}

/**
 * Creates a complete database operations bundle with all query classes
 * initialized using the provided Supabase client
 */
export function createDatabaseOperations(
  client: SupabaseClient<Database>,
  migrationsPath?: string
): DatabaseOperations {
  return {
    // Query classes
    business: new BusinessQueries(client),
    store: new StoreQueries(client),
    userAccount: new UserAccountQueries(client),
    contextWindow: new ContextWindowQueries(client),
    transaction: new TransactionQueries(client),
    feedbackSession: new FeedbackSessionQueries(client),
    verificationRecord: new VerificationRecordQueries(client),

    // Utility classes
    auth: new AuthHelper(client),
    realtime: new RealtimeSubscriptionManager(client),
    migration: new MigrationRunner(client, migrationsPath),

    // Raw client access
    client
  };
}

/**
 * Database Client Factory
 * Provides a simplified interface for creating database clients and operations
 */
export interface DatabaseClientFactory {
  /**
   * Create a new Supabase client instance
   */
  createClient(): SupabaseClient<Database>;

  /**
   * Create database operations bundle
   */
  createOperations(migrationsPath?: string): DatabaseOperations;

  /**
   * Test database connectivity
   */
  testConnection(): Promise<boolean>;

  /**
   * Get client configuration
   */
  getConfig(): {
    supabaseUrl: string;
    hasAnonKey: boolean;
    environment: string;
  };
}

/**
 * Creates a database client factory with automatic client management
 */
export function createDatabaseClientFactory(config?: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}): DatabaseClientFactory {
  const { SupabaseClientManager } = require('./client/supabase.js');
  const clientManager = SupabaseClientManager.getInstance(config);

  return {
    createClient() {
      return clientManager.getClient();
    },

    createOperations(migrationsPath?: string) {
      const client = clientManager.getClient();
      return createDatabaseOperations(client, migrationsPath);
    },

    async testConnection() {
      const client = clientManager.getClient();
      const { testDatabaseConnection } = await import('./client/utils.js');
      const result = await testDatabaseConnection(client);
      return result.isConnected;
    },

    getConfig() {
      return clientManager.getConfig();
    }
  };
}

// =============================================================================
// Default Export for Simple Usage
// =============================================================================

/**
 * Default database instance using environment configuration
 * Provides immediate access to all database operations
 */
export const database = createDatabaseClientFactory();

// =============================================================================
// Re-exports for Convenience
// =============================================================================

// Common Supabase types that consumers might need
export type { SupabaseClient } from '@supabase/supabase-js';
export type { User } from '@supabase/supabase-js';

// =============================================================================
// Package Metadata
// =============================================================================

export const PACKAGE_INFO = {
  name: '@alpha/database',
  version: '1.0.0',
  description: 'Type-safe database layer for Alpha customer feedback system',
  author: 'Alpha Development Team',
  license: 'MIT',
  features: [
    'Type-safe database operations',
    'Row Level Security (RLS) compliance',
    'Real-time subscriptions with business isolation',
    'Automatic migration management',
    'Performance optimized queries',
    'Comprehensive error handling',
    'JWT-based authentication integration',
    'Multi-tenant business isolation',
    'Transaction tolerance matching',
    'Context completeness scoring'
  ],
  compatibleWith: {
    supabase: '^2.39.0',
    typescript: '^5.0.0',
    node: '>=18.0.0'
  }
} as const;