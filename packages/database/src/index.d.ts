/**
 * @fileoverview Alpha Database Package - Main Entry Point
 * @description Comprehensive database layer for the Alpha customer feedback system
 * providing type-safe, RLS-compliant database operations with real-time capabilities.
 */
export * from './types';
export { SupabaseClientManager } from './client/supabase';
export { testDatabaseConnection, formatDatabaseError, isDatabaseError, isConnectionError, isPermissionError, isValidationError, dbLogger, type ConnectionTestResult, type DatabaseError, type FormattedDatabaseError } from './client/utils';
export { BusinessQueries } from './queries/business';
export { StoreQueries } from './queries/store';
export { UserAccountQueries } from './queries/user-account';
export { ContextWindowQueries } from './queries/context-window';
export { TransactionQueries } from './queries/transaction';
export { FeedbackSessionQueries } from './queries/feedback-session';
export { VerificationRecordQueries } from './queries/verification-record';
export { PaymentBatchQueries } from './payment/payment-batch';
export { PaymentTransactionQueries } from './payment/payment-transaction';
export { RewardCalculationQueries } from './payment/reward-calculation';
export { PaymentFailureQueries } from './payment/payment-failure';
export { ReconciliationReportQueries } from './payment/reconciliation-report';
export { BusinessInvoiceQueries } from './payment/business-invoice';
export { WeeklyVerificationCycleModel } from './verification/weekly-verification-cycles';
export { VerificationDatabaseModel } from './verification/verification-databases';
export { VerificationRecordModel } from './verification/verification-records';
export { PaymentInvoiceModel } from './verification/payment-invoices';
export { CustomerRewardBatchModel } from './verification/customer-reward-batches';
export { createBusinessQueries } from './queries/business';
export { createStoreQueries } from './queries/store';
export { createUserAccountQueries } from './queries/user-account';
export { createContextWindowQueries } from './queries/context-window';
export { createTransactionQueries } from './queries/transaction';
export { createFeedbackSessionQueries } from './queries/feedback-session';
export { createVerificationRecordQueries } from './queries/verification-record';
export { AuthHelper, createAuthHelper, type JWTClaims, type AuthTokenValidation } from './auth/auth-helper';
export { RealtimeSubscriptionManager, createRealtimeSubscriptionManager, type TableName, type RealtimeEventType, type SubscriptionConfig, type SubscriptionCallback, type ErrorCallback, type SubscriptionOptions } from './realtime/subscription-manager';
export { MigrationRunner, createMigrationRunner, type MigrationFile, type MigrationResult, type MigrationStatus, type RollbackResult } from './migrations/migration-runner';
export * from './monitoring';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types/index';
import { BusinessQueries } from './queries/business';
import { StoreQueries } from './queries/store';
import { UserAccountQueries } from './queries/user-account';
import { ContextWindowQueries } from './queries/context-window';
import { TransactionQueries } from './queries/transaction';
import { FeedbackSessionQueries } from './queries/feedback-session';
import { VerificationRecordQueries } from './queries/verification-record';
import { PaymentBatchQueries } from './payment/payment-batch';
import { PaymentTransactionQueries } from './payment/payment-transaction';
import { RewardCalculationQueries } from './payment/reward-calculation';
import { PaymentFailureQueries } from './payment/payment-failure';
import { ReconciliationReportQueries } from './payment/reconciliation-report';
import { BusinessInvoiceQueries } from './payment/business-invoice';
import { WeeklyVerificationCycleModel } from './verification/weekly-verification-cycles';
import { VerificationDatabaseModel } from './verification/verification-databases';
import { VerificationRecordModel } from './verification/verification-records';
import { PaymentInvoiceModel } from './verification/payment-invoices';
import { CustomerRewardBatchModel } from './verification/customer-reward-batches';
import { AuthHelper } from './auth/auth-helper';
import { RealtimeSubscriptionManager } from './realtime/subscription-manager';
import { MigrationRunner } from './migrations/migration-runner';
/**
 * Database Operations Bundle
 * Provides all query classes initialized with the same client instance
 */
export interface DatabaseOperations {
    business: BusinessQueries;
    store: StoreQueries;
    userAccount: UserAccountQueries;
    contextWindow: ContextWindowQueries;
    transaction: TransactionQueries;
    feedbackSession: FeedbackSessionQueries;
    verificationRecord: VerificationRecordQueries;
    paymentBatch: PaymentBatchQueries;
    paymentTransaction: PaymentTransactionQueries;
    rewardCalculation: RewardCalculationQueries;
    paymentFailure: PaymentFailureQueries;
    reconciliationReport: ReconciliationReportQueries;
    businessInvoice: BusinessInvoiceQueries;
    weeklyVerificationCycle: typeof WeeklyVerificationCycleModel;
    verificationDatabase: typeof VerificationDatabaseModel;
    verificationRecordModel: typeof VerificationRecordModel;
    paymentInvoice: typeof PaymentInvoiceModel;
    customerRewardBatch: typeof CustomerRewardBatchModel;
    auth: AuthHelper;
    realtime: RealtimeSubscriptionManager;
    migration: MigrationRunner;
    client: SupabaseClient<Database>;
}
/**
 * Creates a complete database operations bundle with all query classes
 * initialized using the provided Supabase client
 */
export declare function createDatabaseOperations(client: SupabaseClient<Database>, migrationsPath?: string): DatabaseOperations;
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
export declare function createDatabaseClientFactory(config?: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
}): DatabaseClientFactory;
/**
 * Default database instance using environment configuration
 * Provides immediate access to all database operations
 */
export declare const database: DatabaseClientFactory;
export type { SupabaseClient } from '@supabase/supabase-js';
export type { User } from '@supabase/supabase-js';
export declare const PACKAGE_INFO: {
    readonly name: "@alpha/database";
    readonly version: "1.0.0";
    readonly description: "Type-safe database layer for Alpha customer feedback system";
    readonly author: "Alpha Development Team";
    readonly license: "MIT";
    readonly features: readonly ["Type-safe database operations", "Row Level Security (RLS) compliance", "Real-time subscriptions with business isolation", "Automatic migration management", "Performance optimized queries", "Comprehensive error handling", "JWT-based authentication integration", "Multi-tenant business isolation", "Transaction tolerance matching", "Context completeness scoring"];
    readonly compatibleWith: {
        readonly supabase: "^2.39.0";
        readonly typescript: "^5.0.0";
        readonly node: ">=18.0.0";
    };
};
//# sourceMappingURL=index.d.ts.map