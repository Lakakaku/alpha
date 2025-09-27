import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/index.js';
export interface MigrationFile {
    id: string;
    name: string;
    path: string;
    content: string;
    checksum: string;
    appliedAt?: string;
}
export interface MigrationResult {
    success: boolean;
    migration: MigrationFile;
    error?: string;
    executionTime?: number;
}
export interface MigrationStatus {
    id: string;
    name: string;
    appliedAt: string;
    checksum: string;
    executionTime: number;
}
export interface RollbackResult {
    success: boolean;
    rolledBackMigrations: string[];
    error?: string;
}
export declare class MigrationRunner {
    private client;
    private migrationsPath;
    private migrationsTable;
    constructor(client: SupabaseClient<Database>, migrationsPath?: string);
    initializeMigrationsTable(): Promise<void>;
    loadMigrationFiles(): Promise<MigrationFile[]>;
    getAppliedMigrations(): Promise<MigrationStatus[]>;
    getPendingMigrations(): Promise<MigrationFile[]>;
    runMigration(migration: MigrationFile): Promise<MigrationResult>;
    runPendingMigrations(): Promise<MigrationResult[]>;
    rollbackMigration(migrationId: string): Promise<RollbackResult>;
    validateMigrations(): Promise<{
        isValid: boolean;
        issues: string[];
    }>;
    deploySchema(schemaPath: string): Promise<MigrationResult>;
    private isMigrationApplied;
    private executeMigrationSQL;
    private recordMigration;
    private rollbackSingleMigration;
    private extractMigrationId;
    private isValidMigrationId;
    private calculateChecksum;
    getMigrationHistory(): Promise<MigrationStatus[]>;
    getMigrationInfo(migrationId: string): Promise<MigrationStatus | null>;
    resetMigrations(): Promise<void>;
    checkDatabaseConnection(): Promise<boolean>;
}
export declare function createMigrationRunner(client: SupabaseClient<Database>, migrationsPath?: string): MigrationRunner;
//# sourceMappingURL=migration-runner.d.ts.map