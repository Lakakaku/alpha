"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = exports.SupabaseClientManager = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
/**
 * Supabase Client Manager - Singleton pattern for managing Supabase client instances
 */
class SupabaseClientManager {
    static instance;
    client = null;
    config;
    constructor(config) {
        this.config = {
            supabaseUrl: config?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
            supabaseAnonKey: config?.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
        };
        if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
            throw new Error('Supabase URL and anonymous key are required');
        }
    }
    /**
     * Get the singleton instance
     */
    static getInstance(config) {
        if (!SupabaseClientManager.instance) {
            SupabaseClientManager.instance = new SupabaseClientManager(config);
        }
        return SupabaseClientManager.instance;
    }
    /**
     * Get the Supabase client instance
     */
    getClient() {
        if (!this.client) {
            this.client = (0, supabase_js_1.createClient)(this.config.supabaseUrl, this.config.supabaseAnonKey, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                }
            });
        }
        return this.client;
    }
    /**
     * Get configuration details
     */
    getConfig() {
        return {
            supabaseUrl: this.config.supabaseUrl,
            hasAnonKey: !!this.config.supabaseAnonKey,
            environment: process.env.NODE_ENV ?? 'development'
        };
    }
    /**
     * Reset the client instance (useful for testing)
     */
    reset() {
        this.client = null;
        SupabaseClientManager.instance = null;
    }
}
exports.SupabaseClientManager = SupabaseClientManager;
/**
 * Default supabase client instance
 * Uses the singleton pattern to ensure consistent client across the application
 */
exports.supabase = SupabaseClientManager.getInstance().getClient();
//# sourceMappingURL=supabase.js.map