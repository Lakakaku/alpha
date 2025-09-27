import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@vocilia/types';
/**
 * Supabase Client Manager - Singleton pattern for managing Supabase client instances
 */
export declare class SupabaseClientManager {
    private static instance;
    private client;
    private config;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(config?: {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
    }): SupabaseClientManager;
    /**
     * Get the Supabase client instance
     */
    getClient(): SupabaseClient<Database>;
    /**
     * Get configuration details
     */
    getConfig(): {
        supabaseUrl: string;
        hasAnonKey: boolean;
        environment: string;
    };
    /**
     * Reset the client instance (useful for testing)
     */
    reset(): void;
}
/**
 * Default supabase client instance
 * Uses the singleton pattern to ensure consistent client across the application
 */
export declare const supabase: SupabaseClient<Database, "public", "public", never, {
    PostgrestVersion: "12";
}>;
//# sourceMappingURL=supabase.d.ts.map