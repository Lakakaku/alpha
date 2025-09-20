import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from '../types/index.js';

// Error types
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

export async function testDatabaseConnection(
  client: SupabaseClient<Database>
): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const { error } = await client
      .from('businesses')
      .select('count')
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error && error.code !== 'PGRST116') {
      return {
        isConnected: false,
        latencyMs,
        error: `Database connection failed: ${error.message}`,
        timestamp
      };
    }

    return {
      isConnected: true,
      latencyMs,
      error: null,
      timestamp
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      isConnected: false,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown connection error',
      timestamp
    };
  }
}

export async function performHealthCheck(
  client: SupabaseClient<Database>
): Promise<DatabaseHealthCheck> {
  const connectionTest = await testDatabaseConnection(client);

  if (!connectionTest.isConnected) {
    return {
      connection: connectionTest,
      tablesAccessible: false,
      rlsEnabled: false,
      functionsAvailable: false,
      error: connectionTest.error
    };
  }

  try {
    const tablesAccessible = await checkTablesAccessible(client);
    const rlsEnabled = await checkRLSEnabled(client);
    const functionsAvailable = await checkFunctionsAvailable(client);

    return {
      connection: connectionTest,
      tablesAccessible,
      rlsEnabled,
      functionsAvailable,
      error: null
    };
  } catch (error) {
    return {
      connection: connectionTest,
      tablesAccessible: false,
      rlsEnabled: false,
      functionsAvailable: false,
      error: error instanceof Error ? error.message : 'Health check failed'
    };
  }
}

async function checkTablesAccessible(client: SupabaseClient<Database>): Promise<boolean> {
  const requiredTables = [
    'businesses',
    'user_accounts',
    'stores',
    'context_window',
    'transactions',
    'feedback_sessions',
    'verification_record'
  ];

  try {
    const { data, error } = await client
      .rpc('get_table_names')
      .select();

    if (error) {
      const { data: fallbackData, error: fallbackError } = await client
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', requiredTables);

      return !fallbackError && fallbackData && fallbackData.length === requiredTables.length;
    }

    return data && data.length >= requiredTables.length;
  } catch {
    return false;
  }
}

async function checkRLSEnabled(client: SupabaseClient<Database>): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('pg_class')
      .select('relname, relrowsecurity')
      .eq('relkind', 'r')
      .eq('relnamespace', 'public');

    if (error) return false;

    const rlsTables = data?.filter(table => table.relrowsecurity) || [];
    return rlsTables.length >= 7;
  } catch {
    return false;
  }
}

async function checkFunctionsAvailable(client: SupabaseClient<Database>): Promise<boolean> {
  const requiredFunctions = [
    'create_time_tolerance',
    'create_amount_tolerance',
    'calculate_context_score'
  ];

  try {
    for (const funcName of requiredFunctions) {
      const { error } = await client.rpc(funcName, {});
      if (error && !error.message.includes('missing required argument')) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function formatDatabaseError(error: PostgrestError): DatabaseError {
  return {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || 'An unknown database error occurred',
    details: error.details || undefined,
    hint: error.hint || undefined
  };
}

export function createValidationError(
  field: string,
  message: string,
  value: any
): ValidationError {
  return {
    field,
    message,
    value
  };
}

export function isConnectionError(error: PostgrestError): boolean {
  const connectionErrorCodes = [
    'PGRST000',
    'PGRST001',
    'PGRST002',
    'PGRST003',
    'connection_failure',
    'timeout'
  ];

  return connectionErrorCodes.includes(error.code || '') ||
    error.message?.toLowerCase().includes('connection') ||
    error.message?.toLowerCase().includes('timeout') ||
    false;
}

export function isAuthenticationError(error: PostgrestError): boolean {
  const authErrorCodes = [
    'PGRST301',
    'PGRST302',
    'invalid_jwt',
    'jwt_expired'
  ];

  return authErrorCodes.includes(error.code || '') ||
    error.message?.toLowerCase().includes('jwt') ||
    error.message?.toLowerCase().includes('authentication') ||
    error.message?.toLowerCase().includes('unauthorized') ||
    false;
}

export function isPermissionError(error: PostgrestError): boolean {
  const permissionErrorCodes = [
    'PGRST301',
    'insufficient_privilege',
    'permission_denied'
  ];

  return permissionErrorCodes.includes(error.code || '') ||
    error.message?.toLowerCase().includes('permission') ||
    error.message?.toLowerCase().includes('privilege') ||
    error.message?.toLowerCase().includes('access denied') ||
    false;
}

export function shouldRetryOperation(error: PostgrestError): boolean {
  if (isAuthenticationError(error) || isPermissionError(error)) {
    return false;
  }

  const retryableErrorCodes = [
    'PGRST000',
    'connection_failure',
    'timeout',
    'server_error'
  ];

  return retryableErrorCodes.includes(error.code || '') ||
    error.message?.toLowerCase().includes('timeout') ||
    error.message?.toLowerCase().includes('network') ||
    false;
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as PostgrestError;
        if (!shouldRetryOperation(pgError)) {
          throw lastError;
        }
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}

export function createDatabaseLogger(prefix: string = '[Database]') {
  return {
    info: (message: string, data?: any) => {
      console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
    },
    warn: (message: string, error?: any) => {
      console.warn(`${prefix} WARNING: ${message}`, error);
    },
    error: (message: string, error?: any) => {
      console.error(`${prefix} ERROR: ${message}`, error);
    },
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`${prefix} DEBUG: ${message}`, data);
      }
    }
  };
}

export const dbLogger = createDatabaseLogger();

// Type guards
export function isDatabaseError(error: any): error is DatabaseError {
  return error && typeof error === 'object' && 'code' in error && 'message' in error;
}

export function isValidationError(error: any): error is ValidationError {
  return isDatabaseError(error) && ('field' in error || 'constraint' in error);
}