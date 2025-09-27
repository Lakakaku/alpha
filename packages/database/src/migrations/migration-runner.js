"use strict";
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
exports.MigrationRunner = void 0;
exports.createMigrationRunner = createMigrationRunner;
const fs_1 = require("fs");
const path_1 = require("path");
const utils_js_1 = require("../client/utils.js");
class MigrationRunner {
    client;
    migrationsPath;
    migrationsTable = 'schema_migrations';
    constructor(client, migrationsPath = './migrations') {
        this.client = client;
        this.migrationsPath = migrationsPath;
    }
    async initializeMigrationsTable() {
        try {
            utils_js_1.dbLogger.info('Initializing migrations table');
            const createMigrationsTableSQL = `
        CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          applied_at TIMESTAMPTZ DEFAULT NOW(),
          execution_time_ms INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
        ON ${this.migrationsTable} (applied_at);
      `;
            const { error } = await this.client.rpc('exec_sql', {
                sql: createMigrationsTableSQL
            });
            if (error) {
                if (!error.message.includes('does not exist')) {
                    throw error;
                }
                utils_js_1.dbLogger.warn('exec_sql function not available, using raw query');
                const { error: rawError } = await this.client
                    .from('information_schema.tables')
                    .select('*')
                    .limit(1);
                if (rawError) {
                    utils_js_1.dbLogger.warn('Cannot verify migrations table, assuming it exists or will be created manually');
                }
            }
            utils_js_1.dbLogger.info('Migrations table initialized');
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to initialize migrations table', error);
            throw new Error('Failed to initialize migrations table');
        }
    }
    async loadMigrationFiles() {
        try {
            utils_js_1.dbLogger.debug('Loading migration files from path', { path: this.migrationsPath });
            if (!(0, fs_1.existsSync)(this.migrationsPath)) {
                utils_js_1.dbLogger.warn('Migrations directory does not exist', { path: this.migrationsPath });
                return [];
            }
            const fs = await Promise.resolve().then(() => __importStar(require('fs')));
            const files = fs.readdirSync(this.migrationsPath)
                .filter(file => file.endsWith('.sql'))
                .sort();
            const migrations = [];
            for (const file of files) {
                const filePath = (0, path_1.join)(this.migrationsPath, file);
                const content = (0, fs_1.readFileSync)(filePath, 'utf8');
                const checksum = await this.calculateChecksum(content);
                const migration = {
                    id: this.extractMigrationId(file),
                    name: (0, path_1.basename)(file, '.sql'),
                    path: filePath,
                    content,
                    checksum
                };
                migrations.push(migration);
            }
            utils_js_1.dbLogger.debug('Loaded migration files', { count: migrations.length });
            return migrations;
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to load migration files', error);
            throw new Error('Failed to load migration files');
        }
    }
    async getAppliedMigrations() {
        try {
            const { data: migrations, error } = await this.client
                .from(this.migrationsTable)
                .select('*')
                .order('applied_at', { ascending: true });
            if (error) {
                if (error.code === 'PGRST116') {
                    return [];
                }
                throw error;
            }
            return (migrations || []).map(m => ({
                id: m.id,
                name: m.name,
                appliedAt: m.applied_at,
                checksum: m.checksum,
                executionTime: m.execution_time_ms || 0
            }));
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to get applied migrations', error);
            throw new Error('Failed to get applied migrations');
        }
    }
    async getPendingMigrations() {
        try {
            const allMigrations = await this.loadMigrationFiles();
            const appliedMigrations = await this.getAppliedMigrations();
            const appliedIds = new Set(appliedMigrations.map(m => m.id));
            return allMigrations.filter(migration => !appliedIds.has(migration.id));
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to get pending migrations', error);
            throw new Error('Failed to get pending migrations');
        }
    }
    async runMigration(migration) {
        const startTime = Date.now();
        try {
            utils_js_1.dbLogger.info('Running migration', { id: migration.id, name: migration.name });
            const existingMigration = await this.isMigrationApplied(migration.id);
            if (existingMigration) {
                if (existingMigration.checksum !== migration.checksum) {
                    throw new Error(`Migration checksum mismatch for ${migration.id}. Migration may have been modified after being applied.`);
                }
                utils_js_1.dbLogger.info('Migration already applied', { id: migration.id });
                return {
                    success: true,
                    migration,
                    executionTime: 0
                };
            }
            await this.executeMigrationSQL(migration.content);
            const executionTime = Date.now() - startTime;
            await this.recordMigration(migration, executionTime);
            utils_js_1.dbLogger.info('Migration completed successfully', {
                id: migration.id,
                executionTime
            });
            return {
                success: true,
                migration,
                executionTime
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            utils_js_1.dbLogger.error('Migration failed', {
                id: migration.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime
            });
            return {
                success: false,
                migration,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime
            };
        }
    }
    async runPendingMigrations() {
        try {
            await this.initializeMigrationsTable();
            const pendingMigrations = await this.getPendingMigrations();
            if (pendingMigrations.length === 0) {
                utils_js_1.dbLogger.info('No pending migrations found');
                return [];
            }
            utils_js_1.dbLogger.info('Running pending migrations', { count: pendingMigrations.length });
            const results = [];
            for (const migration of pendingMigrations) {
                const result = await this.runMigration(migration);
                results.push(result);
                if (!result.success) {
                    utils_js_1.dbLogger.error('Migration failed, stopping execution', {
                        failedMigration: migration.id,
                        error: result.error
                    });
                    break;
                }
            }
            const successfulMigrations = results.filter(r => r.success).length;
            const failedMigrations = results.filter(r => !r.success).length;
            utils_js_1.dbLogger.info('Migration batch completed', {
                successful: successfulMigrations,
                failed: failedMigrations,
                total: results.length
            });
            return results;
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to run pending migrations', error);
            throw new Error('Failed to run pending migrations');
        }
    }
    async rollbackMigration(migrationId) {
        try {
            utils_js_1.dbLogger.info('Rolling back migration', { migrationId });
            const appliedMigrations = await this.getAppliedMigrations();
            const targetMigration = appliedMigrations.find(m => m.id === migrationId);
            if (!targetMigration) {
                throw new Error(`Migration ${migrationId} is not applied`);
            }
            const migrationsToRollback = appliedMigrations
                .filter(m => m.appliedAt >= targetMigration.appliedAt)
                .reverse();
            utils_js_1.dbLogger.info('Rolling back migrations', {
                count: migrationsToRollback.length,
                migrations: migrationsToRollback.map(m => m.id)
            });
            const rolledBackMigrations = [];
            for (const migration of migrationsToRollback) {
                try {
                    await this.rollbackSingleMigration(migration.id);
                    rolledBackMigrations.push(migration.id);
                    utils_js_1.dbLogger.info('Migration rolled back', { id: migration.id });
                }
                catch (error) {
                    utils_js_1.dbLogger.error('Failed to rollback migration', {
                        id: migration.id,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    return {
                        success: false,
                        rolledBackMigrations,
                        error: `Failed to rollback migration ${migration.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
                    };
                }
            }
            return {
                success: true,
                rolledBackMigrations
            };
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to rollback migration', error);
            return {
                success: false,
                rolledBackMigrations: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async validateMigrations() {
        try {
            const issues = [];
            const appliedMigrations = await this.getAppliedMigrations();
            const migrationFiles = await this.loadMigrationFiles();
            for (const applied of appliedMigrations) {
                const file = migrationFiles.find(f => f.id === applied.id);
                if (!file) {
                    issues.push(`Applied migration ${applied.id} has no corresponding file`);
                    continue;
                }
                if (file.checksum !== applied.checksum) {
                    issues.push(`Migration ${applied.id} has checksum mismatch (file modified after application)`);
                }
            }
            for (const file of migrationFiles) {
                const applied = appliedMigrations.find(a => a.id === file.id);
                if (!applied) {
                    continue;
                }
                if (!this.isValidMigrationId(file.id)) {
                    issues.push(`Migration ${file.id} has invalid ID format`);
                }
            }
            const migrationIds = migrationFiles.map(f => f.id).sort();
            for (let i = 1; i < migrationIds.length; i++) {
                if (migrationIds[i] <= migrationIds[i - 1]) {
                    issues.push(`Migration ordering issue: ${migrationIds[i]} should come after ${migrationIds[i - 1]}`);
                }
            }
            return {
                isValid: issues.length === 0,
                issues
            };
        }
        catch (error) {
            return {
                isValid: false,
                issues: [`Failed to validate migrations: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
        }
    }
    async deploySchema(schemaPath) {
        try {
            utils_js_1.dbLogger.info('Deploying schema', { schemaPath });
            if (!(0, fs_1.existsSync)(schemaPath)) {
                throw new Error(`Schema file not found: ${schemaPath}`);
            }
            const schemaContent = (0, fs_1.readFileSync)(schemaPath, 'utf8');
            const checksum = await this.calculateChecksum(schemaContent);
            const schemaMigration = {
                id: '000_initial_schema',
                name: 'initial_schema',
                path: schemaPath,
                content: schemaContent,
                checksum
            };
            return await this.runMigration(schemaMigration);
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to deploy schema', error);
            throw new Error('Failed to deploy schema');
        }
    }
    async isMigrationApplied(migrationId) {
        try {
            const { data: migration, error } = await this.client
                .from(this.migrationsTable)
                .select('*')
                .eq('id', migrationId)
                .maybeSingle();
            if (error) {
                throw error;
            }
            return migration ? {
                id: migration.id,
                name: migration.name,
                appliedAt: migration.applied_at,
                checksum: migration.checksum,
                executionTime: migration.execution_time_ms || 0
            } : null;
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to check if migration is applied', error);
            return null;
        }
    }
    async executeMigrationSQL(sql) {
        try {
            const { error } = await this.client.rpc('exec_sql', { sql });
            if (error) {
                if (error.message.includes('does not exist')) {
                    utils_js_1.dbLogger.warn('exec_sql function not available, attempting raw execution');
                    throw new Error('Migration execution function not available. Please ensure schema supports migrations.');
                }
                throw error;
            }
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to execute migration SQL', error);
            throw error;
        }
    }
    async recordMigration(migration, executionTime) {
        try {
            const { error } = await this.client
                .from(this.migrationsTable)
                .insert({
                id: migration.id,
                name: migration.name,
                checksum: migration.checksum,
                execution_time_ms: executionTime,
                applied_at: new Date().toISOString()
            });
            if (error) {
                throw error;
            }
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to record migration', error);
            throw error;
        }
    }
    async rollbackSingleMigration(migrationId) {
        try {
            const { error } = await this.client
                .from(this.migrationsTable)
                .delete()
                .eq('id', migrationId);
            if (error) {
                throw error;
            }
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to rollback single migration', error);
            throw error;
        }
    }
    extractMigrationId(filename) {
        const match = filename.match(/^(\d{3,}_\w+)\.sql$/);
        return match ? match[1] : (0, path_1.basename)(filename, '.sql');
    }
    isValidMigrationId(id) {
        return /^\d{3,}_\w+$/.test(id);
    }
    async calculateChecksum(content) {
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    async getMigrationHistory() {
        return await this.getAppliedMigrations();
    }
    async getMigrationInfo(migrationId) {
        return await this.isMigrationApplied(migrationId);
    }
    async resetMigrations() {
        try {
            utils_js_1.dbLogger.warn('Resetting all migrations - this will remove migration history');
            const { error } = await this.client
                .from(this.migrationsTable)
                .delete()
                .neq('id', '');
            if (error) {
                throw error;
            }
            utils_js_1.dbLogger.info('All migration records removed');
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to reset migrations', error);
            throw new Error('Failed to reset migrations');
        }
    }
    async checkDatabaseConnection() {
        try {
            const { error } = await this.client
                .from('information_schema.tables')
                .select('count')
                .limit(1);
            return !error;
        }
        catch {
            return false;
        }
    }
}
exports.MigrationRunner = MigrationRunner;
function createMigrationRunner(client, migrationsPath) {
    return new MigrationRunner(client, migrationsPath);
}
//# sourceMappingURL=migration-runner.js.map