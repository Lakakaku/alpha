import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from '../types/index.js';
export interface DatabaseError {
    code: string;
    message: string;
    details?: any;
    hint?: string;
}
export interface ValidationError extends DatabaseError {
    field?: string;
    constraint?: string;
}
export type FormattedDatabaseError = DatabaseError;
export interface ConnectionTestResult {
    isConnected: boolean;
    latencyMs: number | null;
    error: string | null;
    timestamp: string;
}
export interface DatabaseHealthCheck {
    connection: ConnectionTestResult;
    tablesAccessible: boolean;
    rlsEnabled: boolean;
    functionsAvailable: boolean;
    error: string | null;
}
export declare function testDatabaseConnection(client: SupabaseClient<Database>): Promise<ConnectionTestResult>;
export declare function performHealthCheck(client: SupabaseClient<Database>): Promise<DatabaseHealthCheck>;
export declare function formatDatabaseError(error: PostgrestError): DatabaseError;
export declare function createValidationError(field: string, message: string, value: any): ValidationError;
export declare function isConnectionError(error: PostgrestError): boolean;
export declare function isAuthenticationError(error: PostgrestError): boolean;
export declare function isPermissionError(error: PostgrestError): boolean;
export declare function shouldRetryOperation(error: PostgrestError): boolean;
export declare function retryWithExponentialBackoff<T>(operation: () => Promise<T>, maxRetries?: number, baseDelayMs?: number): Promise<T>;
export declare function createDatabaseLogger(prefix?: string): {
    info: (message: string, data?: any) => void;
    warn: (message: string, error?: any) => void;
    error: (message: string, error?: any) => void;
    debug: (message: string, data?: any) => void;
};
export declare const dbLogger: {
    info: (message: string, data?: any) => void;
    warn: (message: string, error?: any) => void;
    error: (message: string, error?: any) => void;
    debug: (message: string, data?: any) => void;
};
export declare function isDatabaseError(error: any): error is DatabaseError;
export declare function isValidationError(error: any): error is ValidationError;
//# sourceMappingURL=utils.d.ts.map