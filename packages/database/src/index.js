"use strict";
/**
 * @fileoverview Alpha Database Package - Main Entry Point
 * @description Comprehensive database layer for the Alpha customer feedback system
 * providing type-safe, RLS-compliant database operations with real-time capabilities.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKAGE_INFO = exports.database = exports.createMigrationRunner = exports.MigrationRunner = exports.createRealtimeSubscriptionManager = exports.RealtimeSubscriptionManager = exports.createAuthHelper = exports.AuthHelper = exports.createVerificationRecordQueries = exports.createFeedbackSessionQueries = exports.createTransactionQueries = exports.createContextWindowQueries = exports.createUserAccountQueries = exports.createStoreQueries = exports.createBusinessQueries = exports.CustomerRewardBatchModel = exports.PaymentInvoiceModel = exports.VerificationRecordModel = exports.VerificationDatabaseModel = exports.WeeklyVerificationCycleModel = exports.BusinessInvoiceQueries = exports.ReconciliationReportQueries = exports.PaymentFailureQueries = exports.RewardCalculationQueries = exports.PaymentTransactionQueries = exports.PaymentBatchQueries = exports.VerificationRecordQueries = exports.FeedbackSessionQueries = exports.TransactionQueries = exports.ContextWindowQueries = exports.UserAccountQueries = exports.StoreQueries = exports.BusinessQueries = exports.dbLogger = exports.isValidationError = exports.isPermissionError = exports.isConnectionError = exports.isDatabaseError = exports.formatDatabaseError = exports.testDatabaseConnection = exports.SupabaseClientManager = void 0;
exports.createDatabaseOperations = createDatabaseOperations;
exports.createDatabaseClientFactory = createDatabaseClientFactory;
// =============================================================================
// Type Definitions and Interfaces
// =============================================================================
__exportStar(require("./types"), exports);
// =============================================================================
// Database Client and Configuration
// =============================================================================
var supabase_1 = require("./client/supabase");
Object.defineProperty(exports, "SupabaseClientManager", { enumerable: true, get: function () { return supabase_1.SupabaseClientManager; } });
var utils_1 = require("./client/utils");
Object.defineProperty(exports, "testDatabaseConnection", { enumerable: true, get: function () { return utils_1.testDatabaseConnection; } });
Object.defineProperty(exports, "formatDatabaseError", { enumerable: true, get: function () { return utils_1.formatDatabaseError; } });
Object.defineProperty(exports, "isDatabaseError", { enumerable: true, get: function () { return utils_1.isDatabaseError; } });
Object.defineProperty(exports, "isConnectionError", { enumerable: true, get: function () { return utils_1.isConnectionError; } });
Object.defineProperty(exports, "isPermissionError", { enumerable: true, get: function () { return utils_1.isPermissionError; } });
Object.defineProperty(exports, "isValidationError", { enumerable: true, get: function () { return utils_1.isValidationError; } });
Object.defineProperty(exports, "dbLogger", { enumerable: true, get: function () { return utils_1.dbLogger; } });
// =============================================================================
// Query Classes - Entity Operations
// =============================================================================
var business_1 = require("./queries/business");
Object.defineProperty(exports, "BusinessQueries", { enumerable: true, get: function () { return business_1.BusinessQueries; } });
var store_1 = require("./queries/store");
Object.defineProperty(exports, "StoreQueries", { enumerable: true, get: function () { return store_1.StoreQueries; } });
var user_account_1 = require("./queries/user-account");
Object.defineProperty(exports, "UserAccountQueries", { enumerable: true, get: function () { return user_account_1.UserAccountQueries; } });
var context_window_1 = require("./queries/context-window");
Object.defineProperty(exports, "ContextWindowQueries", { enumerable: true, get: function () { return context_window_1.ContextWindowQueries; } });
var transaction_1 = require("./queries/transaction");
Object.defineProperty(exports, "TransactionQueries", { enumerable: true, get: function () { return transaction_1.TransactionQueries; } });
var feedback_session_1 = require("./queries/feedback-session");
Object.defineProperty(exports, "FeedbackSessionQueries", { enumerable: true, get: function () { return feedback_session_1.FeedbackSessionQueries; } });
var verification_record_1 = require("./queries/verification-record");
Object.defineProperty(exports, "VerificationRecordQueries", { enumerable: true, get: function () { return verification_record_1.VerificationRecordQueries; } });
// =============================================================================
// Payment Models - Swish Payment Integration
// =============================================================================
var payment_batch_1 = require("./payment/payment-batch");
Object.defineProperty(exports, "PaymentBatchQueries", { enumerable: true, get: function () { return payment_batch_1.PaymentBatchQueries; } });
var payment_transaction_1 = require("./payment/payment-transaction");
Object.defineProperty(exports, "PaymentTransactionQueries", { enumerable: true, get: function () { return payment_transaction_1.PaymentTransactionQueries; } });
var reward_calculation_1 = require("./payment/reward-calculation");
Object.defineProperty(exports, "RewardCalculationQueries", { enumerable: true, get: function () { return reward_calculation_1.RewardCalculationQueries; } });
var payment_failure_1 = require("./payment/payment-failure");
Object.defineProperty(exports, "PaymentFailureQueries", { enumerable: true, get: function () { return payment_failure_1.PaymentFailureQueries; } });
var reconciliation_report_1 = require("./payment/reconciliation-report");
Object.defineProperty(exports, "ReconciliationReportQueries", { enumerable: true, get: function () { return reconciliation_report_1.ReconciliationReportQueries; } });
var business_invoice_1 = require("./payment/business-invoice");
Object.defineProperty(exports, "BusinessInvoiceQueries", { enumerable: true, get: function () { return business_invoice_1.BusinessInvoiceQueries; } });
// =============================================================================
// Verification Models - Weekly Verification Workflow
// =============================================================================
var weekly_verification_cycles_1 = require("./verification/weekly-verification-cycles");
Object.defineProperty(exports, "WeeklyVerificationCycleModel", { enumerable: true, get: function () { return weekly_verification_cycles_1.WeeklyVerificationCycleModel; } });
var verification_databases_1 = require("./verification/verification-databases");
Object.defineProperty(exports, "VerificationDatabaseModel", { enumerable: true, get: function () { return verification_databases_1.VerificationDatabaseModel; } });
var verification_records_1 = require("./verification/verification-records");
Object.defineProperty(exports, "VerificationRecordModel", { enumerable: true, get: function () { return verification_records_1.VerificationRecordModel; } });
var payment_invoices_1 = require("./verification/payment-invoices");
Object.defineProperty(exports, "PaymentInvoiceModel", { enumerable: true, get: function () { return payment_invoices_1.PaymentInvoiceModel; } });
var customer_reward_batches_1 = require("./verification/customer-reward-batches");
Object.defineProperty(exports, "CustomerRewardBatchModel", { enumerable: true, get: function () { return customer_reward_batches_1.CustomerRewardBatchModel; } });
// =============================================================================
// Query Factory Functions
// =============================================================================
var business_2 = require("./queries/business");
Object.defineProperty(exports, "createBusinessQueries", { enumerable: true, get: function () { return business_2.createBusinessQueries; } });
var store_2 = require("./queries/store");
Object.defineProperty(exports, "createStoreQueries", { enumerable: true, get: function () { return store_2.createStoreQueries; } });
var user_account_2 = require("./queries/user-account");
Object.defineProperty(exports, "createUserAccountQueries", { enumerable: true, get: function () { return user_account_2.createUserAccountQueries; } });
var context_window_2 = require("./queries/context-window");
Object.defineProperty(exports, "createContextWindowQueries", { enumerable: true, get: function () { return context_window_2.createContextWindowQueries; } });
var transaction_2 = require("./queries/transaction");
Object.defineProperty(exports, "createTransactionQueries", { enumerable: true, get: function () { return transaction_2.createTransactionQueries; } });
var feedback_session_2 = require("./queries/feedback-session");
Object.defineProperty(exports, "createFeedbackSessionQueries", { enumerable: true, get: function () { return feedback_session_2.createFeedbackSessionQueries; } });
var verification_record_2 = require("./queries/verification-record");
Object.defineProperty(exports, "createVerificationRecordQueries", { enumerable: true, get: function () { return verification_record_2.createVerificationRecordQueries; } });
// =============================================================================
// Authentication and Authorization
// =============================================================================
var auth_helper_1 = require("./auth/auth-helper");
Object.defineProperty(exports, "AuthHelper", { enumerable: true, get: function () { return auth_helper_1.AuthHelper; } });
Object.defineProperty(exports, "createAuthHelper", { enumerable: true, get: function () { return auth_helper_1.createAuthHelper; } });
// =============================================================================
// Real-time Subscriptions
// =============================================================================
var subscription_manager_1 = require("./realtime/subscription-manager");
Object.defineProperty(exports, "RealtimeSubscriptionManager", { enumerable: true, get: function () { return subscription_manager_1.RealtimeSubscriptionManager; } });
Object.defineProperty(exports, "createRealtimeSubscriptionManager", { enumerable: true, get: function () { return subscription_manager_1.createRealtimeSubscriptionManager; } });
// =============================================================================
// Migration and Schema Management
// =============================================================================
var migration_runner_1 = require("./migrations/migration-runner");
Object.defineProperty(exports, "MigrationRunner", { enumerable: true, get: function () { return migration_runner_1.MigrationRunner; } });
Object.defineProperty(exports, "createMigrationRunner", { enumerable: true, get: function () { return migration_runner_1.createMigrationRunner; } });
// =============================================================================
// Monitoring and Analytics Models
// =============================================================================
__exportStar(require("./monitoring"), exports);
const business_3 = require("./queries/business");
const store_3 = require("./queries/store");
const user_account_3 = require("./queries/user-account");
const context_window_3 = require("./queries/context-window");
const transaction_3 = require("./queries/transaction");
const feedback_session_3 = require("./queries/feedback-session");
const verification_record_3 = require("./queries/verification-record");
const payment_batch_2 = require("./payment/payment-batch");
const payment_transaction_2 = require("./payment/payment-transaction");
const reward_calculation_2 = require("./payment/reward-calculation");
const payment_failure_2 = require("./payment/payment-failure");
const reconciliation_report_2 = require("./payment/reconciliation-report");
const business_invoice_2 = require("./payment/business-invoice");
const weekly_verification_cycles_2 = require("./verification/weekly-verification-cycles");
const verification_databases_2 = require("./verification/verification-databases");
const verification_records_2 = require("./verification/verification-records");
const payment_invoices_2 = require("./verification/payment-invoices");
const customer_reward_batches_2 = require("./verification/customer-reward-batches");
const auth_helper_2 = require("./auth/auth-helper");
const subscription_manager_2 = require("./realtime/subscription-manager");
const migration_runner_2 = require("./migrations/migration-runner");
/**
 * Creates a complete database operations bundle with all query classes
 * initialized using the provided Supabase client
 */
function createDatabaseOperations(client, migrationsPath) {
    return {
        // Query classes
        business: new business_3.BusinessQueries(client),
        store: new store_3.StoreQueries(client),
        userAccount: new user_account_3.UserAccountQueries(client),
        contextWindow: new context_window_3.ContextWindowQueries(client),
        transaction: new transaction_3.TransactionQueries(client),
        feedbackSession: new feedback_session_3.FeedbackSessionQueries(client),
        verificationRecord: new verification_record_3.VerificationRecordQueries(client),
        // Payment models
        paymentBatch: new payment_batch_2.PaymentBatchQueries(client),
        paymentTransaction: new payment_transaction_2.PaymentTransactionQueries(client),
        rewardCalculation: new reward_calculation_2.RewardCalculationQueries(client),
        paymentFailure: new payment_failure_2.PaymentFailureQueries(client),
        reconciliationReport: new reconciliation_report_2.ReconciliationReportQueries(client),
        businessInvoice: new business_invoice_2.BusinessInvoiceQueries(client),
        // Verification models
        weeklyVerificationCycle: weekly_verification_cycles_2.WeeklyVerificationCycleModel,
        verificationDatabase: verification_databases_2.VerificationDatabaseModel,
        verificationRecordModel: verification_records_2.VerificationRecordModel,
        paymentInvoice: payment_invoices_2.PaymentInvoiceModel,
        customerRewardBatch: customer_reward_batches_2.CustomerRewardBatchModel,
        // Utility classes
        auth: new auth_helper_2.AuthHelper(client),
        realtime: new subscription_manager_2.RealtimeSubscriptionManager(client),
        migration: new migration_runner_2.MigrationRunner(client, migrationsPath),
        // Raw client access
        client
    };
}
/**
 * Creates a database client factory with automatic client management
 */
function createDatabaseClientFactory(config) {
    const { SupabaseClientManager } = require('./client/supabase');
    const clientManager = SupabaseClientManager.getInstance(config);
    return {
        createClient() {
            return clientManager.getClient();
        },
        createOperations(migrationsPath) {
            const client = clientManager.getClient();
            return createDatabaseOperations(client, migrationsPath);
        },
        async testConnection() {
            const client = clientManager.getClient();
            const { testDatabaseConnection } = await Promise.resolve().then(() => __importStar(require('./client/utils')));
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
exports.database = createDatabaseClientFactory();
// =============================================================================
// Package Metadata
// =============================================================================
exports.PACKAGE_INFO = {
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
};
//# sourceMappingURL=index.js.map