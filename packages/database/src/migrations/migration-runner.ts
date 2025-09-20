import { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import type { Database } from '../types/index.js';
import { dbLogger } from '../client/utils.js';

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

export class MigrationRunner {
  private migrationsTable = 'schema_migrations';

  constructor(
    private client: SupabaseClient<Database>,
    private migrationsPath: string = './migrations'
  ) {}

  async initializeMigrationsTable(): Promise<void> {
    try {
      dbLogger.info('Initializing migrations table');

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

        dbLogger.warn('exec_sql function not available, using raw query');
        const { error: rawError } = await this.client
          .from('information_schema.tables' as any)
          .select('*')
          .limit(1);

        if (rawError) {
          dbLogger.warn('Cannot verify migrations table, assuming it exists or will be created manually');
        }
      }

      dbLogger.info('Migrations table initialized');
    } catch (error) {
      dbLogger.error('Failed to initialize migrations table', error);
      throw new Error('Failed to initialize migrations table');
    }
  }

  async loadMigrationFiles(): Promise<MigrationFile[]> {
    try {
      dbLogger.debug('Loading migration files from path', { path: this.migrationsPath });

      if (!existsSync(this.migrationsPath)) {
        dbLogger.warn('Migrations directory does not exist', { path: this.migrationsPath });
        return [];
      }

      const fs = await import('fs');
      const files = fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      const migrations: MigrationFile[] = [];

      for (const file of files) {
        const filePath = join(this.migrationsPath, file);
        const content = readFileSync(filePath, 'utf8');
        const checksum = await this.calculateChecksum(content);

        const migration: MigrationFile = {
          id: this.extractMigrationId(file),
          name: basename(file, '.sql'),
          path: filePath,
          content,
          checksum
        };

        migrations.push(migration);
      }

      dbLogger.debug('Loaded migration files', { count: migrations.length });
      return migrations;
    } catch (error) {
      dbLogger.error('Failed to load migration files', error);
      throw new Error('Failed to load migration files');
    }
  }

  async getAppliedMigrations(): Promise<MigrationStatus[]> {
    try {
      const { data: migrations, error } = await this.client
        .from(this.migrationsTable as any)
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
    } catch (error) {
      dbLogger.error('Failed to get applied migrations', error);
      throw new Error('Failed to get applied migrations');
    }
  }

  async getPendingMigrations(): Promise<MigrationFile[]> {
    try {
      const allMigrations = await this.loadMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedIds = new Set(appliedMigrations.map(m => m.id));

      return allMigrations.filter(migration => !appliedIds.has(migration.id));
    } catch (error) {
      dbLogger.error('Failed to get pending migrations', error);
      throw new Error('Failed to get pending migrations');
    }
  }

  async runMigration(migration: MigrationFile): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      dbLogger.info('Running migration', { id: migration.id, name: migration.name });

      const existingMigration = await this.isMigrationApplied(migration.id);
      if (existingMigration) {
        if (existingMigration.checksum !== migration.checksum) {
          throw new Error(`Migration checksum mismatch for ${migration.id}. Migration may have been modified after being applied.`);
        }

        dbLogger.info('Migration already applied', { id: migration.id });
        return {
          success: true,
          migration,
          executionTime: 0
        };
      }

      await this.executeMigrationSQL(migration.content);

      const executionTime = Date.now() - startTime;

      await this.recordMigration(migration, executionTime);

      dbLogger.info('Migration completed successfully', {
        id: migration.id,
        executionTime
      });

      return {
        success: true,
        migration,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      dbLogger.error('Migration failed', {
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

  async runPendingMigrations(): Promise<MigrationResult[]> {
    try {
      await this.initializeMigrationsTable();

      const pendingMigrations = await this.getPendingMigrations();

      if (pendingMigrations.length === 0) {
        dbLogger.info('No pending migrations found');
        return [];
      }

      dbLogger.info('Running pending migrations', { count: pendingMigrations.length });

      const results: MigrationResult[] = [];

      for (const migration of pendingMigrations) {
        const result = await this.runMigration(migration);
        results.push(result);

        if (!result.success) {
          dbLogger.error('Migration failed, stopping execution', {
            failedMigration: migration.id,
            error: result.error
          });
          break;
        }
      }

      const successfulMigrations = results.filter(r => r.success).length;
      const failedMigrations = results.filter(r => !r.success).length;

      dbLogger.info('Migration batch completed', {
        successful: successfulMigrations,
        failed: failedMigrations,
        total: results.length
      });

      return results;
    } catch (error) {
      dbLogger.error('Failed to run pending migrations', error);
      throw new Error('Failed to run pending migrations');
    }
  }

  async rollbackMigration(migrationId: string): Promise<RollbackResult> {
    try {
      dbLogger.info('Rolling back migration', { migrationId });

      const appliedMigrations = await this.getAppliedMigrations();
      const targetMigration = appliedMigrations.find(m => m.id === migrationId);

      if (!targetMigration) {
        throw new Error(`Migration ${migrationId} is not applied`);
      }

      const migrationsToRollback = appliedMigrations
        .filter(m => m.appliedAt >= targetMigration.appliedAt)
        .reverse();

      dbLogger.info('Rolling back migrations', {
        count: migrationsToRollback.length,
        migrations: migrationsToRollback.map(m => m.id)
      });

      const rolledBackMigrations: string[] = [];

      for (const migration of migrationsToRollback) {
        try {
          await this.rollbackSingleMigration(migration.id);
          rolledBackMigrations.push(migration.id);

          dbLogger.info('Migration rolled back', { id: migration.id });
        } catch (error) {
          dbLogger.error('Failed to rollback migration', {
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
    } catch (error) {
      dbLogger.error('Failed to rollback migration', error);
      return {
        success: false,
        rolledBackMigrations: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async validateMigrations(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    try {
      const issues: string[] = [];

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
    } catch (error) {
      return {
        isValid: false,
        issues: [`Failed to validate migrations: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async deploySchema(schemaPath: string): Promise<MigrationResult> {
    try {
      dbLogger.info('Deploying schema', { schemaPath });

      if (!existsSync(schemaPath)) {
        throw new Error(`Schema file not found: ${schemaPath}`);
      }

      const schemaContent = readFileSync(schemaPath, 'utf8');
      const checksum = await this.calculateChecksum(schemaContent);

      const schemaMigration: MigrationFile = {
        id: '000_initial_schema',
        name: 'initial_schema',
        path: schemaPath,
        content: schemaContent,
        checksum
      };

      return await this.runMigration(schemaMigration);
    } catch (error) {
      dbLogger.error('Failed to deploy schema', error);
      throw new Error('Failed to deploy schema');
    }
  }

  private async isMigrationApplied(migrationId: string): Promise<MigrationStatus | null> {
    try {
      const { data: migration, error } = await this.client
        .from(this.migrationsTable as any)
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
    } catch (error) {
      dbLogger.error('Failed to check if migration is applied', error);
      return null;
    }
  }

  private async executeMigrationSQL(sql: string): Promise<void> {
    try {
      const { error } = await this.client.rpc('exec_sql', { sql });

      if (error) {
        if (error.message.includes('does not exist')) {
          dbLogger.warn('exec_sql function not available, attempting raw execution');
          throw new Error('Migration execution function not available. Please ensure schema supports migrations.');
        }
        throw error;
      }
    } catch (error) {
      dbLogger.error('Failed to execute migration SQL', error);
      throw error;
    }
  }

  private async recordMigration(migration: MigrationFile, executionTime: number): Promise<void> {
    try {
      const { error } = await this.client
        .from(this.migrationsTable as any)
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
    } catch (error) {
      dbLogger.error('Failed to record migration', error);
      throw error;
    }
  }

  private async rollbackSingleMigration(migrationId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from(this.migrationsTable as any)
        .delete()
        .eq('id', migrationId);

      if (error) {
        throw error;
      }
    } catch (error) {
      dbLogger.error('Failed to rollback single migration', error);
      throw error;
    }
  }

  private extractMigrationId(filename: string): string {
    const match = filename.match(/^(\d{3,}_\w+)\.sql$/);
    return match ? match[1] : basename(filename, '.sql');
  }

  private isValidMigrationId(id: string): boolean {
    return /^\d{3,}_\w+$/.test(id);
  }

  private async calculateChecksum(content: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async getMigrationHistory(): Promise<MigrationStatus[]> {
    return await this.getAppliedMigrations();
  }

  async getMigrationInfo(migrationId: string): Promise<MigrationStatus | null> {
    return await this.isMigrationApplied(migrationId);
  }

  async resetMigrations(): Promise<void> {
    try {
      dbLogger.warn('Resetting all migrations - this will remove migration history');

      const { error } = await this.client
        .from(this.migrationsTable as any)
        .delete()
        .neq('id', '');

      if (error) {
        throw error;
      }

      dbLogger.info('All migration records removed');
    } catch (error) {
      dbLogger.error('Failed to reset migrations', error);
      throw new Error('Failed to reset migrations');
    }
  }

  async checkDatabaseConnection(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('information_schema.tables')
        .select('count')
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }
}

export function createMigrationRunner(
  client: SupabaseClient<Database>,
  migrationsPath?: string
): MigrationRunner {
  return new MigrationRunner(client, migrationsPath);
}