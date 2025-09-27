import { Database } from '@vocilia/database';
import { BackupRecord, BackupStatus, BackupType } from '@vocilia/types';

interface BackupConfiguration {
  type: BackupType;
  schedule: string; // cron expression
  retentionDays: number;
  compressionLevel: number;
  encryption: boolean;
  destination: string;
}

interface BackupVerificationResult {
  backupId: string;
  isValid: boolean;
  size: number;
  checksum: string;
  errors: string[];
  verifiedAt: Date;
}

interface BackupRestoreOptions {
  targetEnvironment: 'staging' | 'production';
  pointInTime?: Date;
  tables?: string[];
  dryRun?: boolean;
}

export class BackupService {
  private database: Database;
  private configurations: Map<string, BackupConfiguration>;
  private verificationInterval: NodeJS.Timer | null = null;

  constructor(database: Database) {
    this.database = database;
    this.configurations = new Map();
    this.initializeDefaultConfigurations();
  }

  /**
   * Start backup verification monitoring
   */
  public startVerificationMonitoring(intervalMs: number = 3600000): void { // 1 hour
    if (this.verificationInterval) {
      this.stopVerificationMonitoring();
    }

    this.verificationInterval = setInterval(async () => {
      await this.verifyRecentBackups();
    }, intervalMs);

    console.log(`Backup verification monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop backup verification monitoring
   */
  public stopVerificationMonitoring(): void {
    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
      this.verificationInterval = null;
      console.log('Backup verification monitoring stopped');
    }
  }

  /**
   * Create a new backup
   */
  public async createBackup(
    type: BackupType,
    options?: {
      description?: string;
      tables?: string[];
      compression?: boolean;
      encryption?: boolean;
    }
  ): Promise<BackupRecord> {
    const backupId = this.generateBackupId(type);
    const startTime = new Date();

    try {
      // Record backup start
      const backupRecord: Partial<BackupRecord> = {
        backup_id: backupId,
        backup_type: type,
        status: 'in_progress',
        started_at: startTime.toISOString(),
        description: options?.description || `${type} backup`,
        metadata: {
          tables: options?.tables,
          compression: options?.compression ?? true,
          encryption: options?.encryption ?? true,
          version: '1.0.0'
        }
      };

      const { data: inserted } = await this.database
        .from('backup_records')
        .insert(backupRecord)
        .select()
        .single();

      // Perform the actual backup
      const backupResult = await this.performBackup(type, backupId, options);

      // Update backup record with completion
      const { data: updated } = await this.database
        .from('backup_records')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          file_size: backupResult.size,
          file_path: backupResult.path,
          checksum: backupResult.checksum,
          metadata: {
            ...backupRecord.metadata,
            duration_ms: Date.now() - startTime.getTime(),
            compressed_size: backupResult.compressedSize
          }
        })
        .eq('backup_id', backupId)
        .select()
        .single();

      console.log(`Backup ${backupId} completed successfully`);
      return updated;

    } catch (error) {
      // Update backup record with failure
      await this.database
        .from('backup_records')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            error_details: error instanceof Error ? error.stack : 'Unknown error',
            duration_ms: Date.now() - startTime.getTime()
          }
        })
        .eq('backup_id', backupId);

      console.error(`Backup ${backupId} failed:`, error);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  public async verifyBackup(backupId: string): Promise<BackupVerificationResult> {
    const backup = await this.getBackupRecord(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    const result: BackupVerificationResult = {
      backupId,
      isValid: false,
      size: 0,
      checksum: '',
      errors: [],
      verifiedAt: new Date()
    };

    try {
      // Check file exists and get size
      const fileStats = await this.getFileStats(backup.file_path);
      if (!fileStats) {
        result.errors.push('Backup file not found');
        return result;
      }

      result.size = fileStats.size;

      // Verify file size matches record
      if (backup.file_size && fileStats.size !== backup.file_size) {
        result.errors.push(`File size mismatch: expected ${backup.file_size}, got ${fileStats.size}`);
      }

      // Verify checksum
      const calculatedChecksum = await this.calculateChecksum(backup.file_path);
      result.checksum = calculatedChecksum;

      if (backup.checksum && calculatedChecksum !== backup.checksum) {
        result.errors.push(`Checksum mismatch: expected ${backup.checksum}, got ${calculatedChecksum}`);
      }

      // Try to read backup metadata
      const metadata = await this.readBackupMetadata(backup.file_path);
      if (!metadata) {
        result.errors.push('Unable to read backup metadata');
      }

      // Verify backup can be opened/decompressed
      if (backup.metadata?.compression) {
        const canDecompress = await this.testDecompression(backup.file_path);
        if (!canDecompress) {
          result.errors.push('Backup file cannot be decompressed');
        }
      }

      result.isValid = result.errors.length === 0;

      // Update verification record
      await this.recordVerificationResult(result);

      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Verification failed');
      await this.recordVerificationResult(result);
      return result;
    }
  }

  /**
   * List backups with filtering options
   */
  public async listBackups(options?: {
    type?: BackupType;
    status?: BackupStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    backups: BackupRecord[];
    total: number;
    hasMore: boolean;
  }> {
    let query = this.database
      .from('backup_records')
      .select('*', { count: 'exact' });

    if (options?.type) {
      query = query.eq('backup_type', options.type);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.startDate) {
      query = query.gte('started_at', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('started_at', options.endDate.toISOString());
    }

    query = query.order('started_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options?.limit || 50) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to list backups: ${error.message}`);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const hasMore = count ? (offset + limit) < count : false;

    return {
      backups: data || [],
      total: count || 0,
      hasMore
    };
  }

  /**
   * Delete old backups based on retention policy
   */
  public async cleanupOldBackups(): Promise<{
    deleted: number;
    freed_bytes: number;
    errors: string[];
  }> {
    const result = {
      deleted: 0,
      freed_bytes: 0,
      errors: []
    };

    for (const [configId, config] of this.configurations) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

        const oldBackups = await this.database
          .from('backup_records')
          .select('*')
          .eq('backup_type', config.type)
          .lt('started_at', cutoffDate.toISOString())
          .eq('status', 'completed');

        if (!oldBackups.data) continue;

        for (const backup of oldBackups.data) {
          try {
            // Delete backup file
            await this.deleteBackupFile(backup.file_path);
            result.freed_bytes += backup.file_size || 0;

            // Mark as deleted in database
            await this.database
              .from('backup_records')
              .update({
                status: 'deleted',
                deleted_at: new Date().toISOString()
              })
              .eq('backup_id', backup.backup_id);

            result.deleted++;
            console.log(`Deleted old backup: ${backup.backup_id}`);

          } catch (error) {
            const errorMsg = `Failed to delete backup ${backup.backup_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            console.error(errorMsg);
          }
        }

      } catch (error) {
        const errorMsg = `Failed to cleanup backups for ${configId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return result;
  }

  /**
   * Restore from backup
   */
  public async restoreBackup(
    backupId: string,
    options: BackupRestoreOptions
  ): Promise<{
    success: boolean;
    restored_tables: string[];
    errors: string[];
    duration_ms: number;
  }> {
    const startTime = Date.now();
    const result = {
      success: false,
      restored_tables: [],
      errors: [],
      duration_ms: 0
    };

    try {
      const backup = await this.getBackupRecord(backupId);
      if (!backup) {
        result.errors.push(`Backup ${backupId} not found`);
        return result;
      }

      if (backup.status !== 'completed') {
        result.errors.push(`Cannot restore from backup with status: ${backup.status}`);
        return result;
      }

      // Verify backup before restore
      const verification = await this.verifyBackup(backupId);
      if (!verification.isValid) {
        result.errors.push(`Backup verification failed: ${verification.errors.join(', ')}`);
        return result;
      }

      // Perform dry run if requested
      if (options.dryRun) {
        result.restored_tables = await this.simulateRestore(backup, options);
        result.success = true;
        return result;
      }

      // Perform actual restore
      result.restored_tables = await this.performRestore(backup, options);
      result.success = true;

      console.log(`Backup ${backupId} restored successfully to ${options.targetEnvironment}`);

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Restore failed');
      console.error(`Backup restore failed:`, error);
    } finally {
      result.duration_ms = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Get backup statistics
   */
  public async getBackupStatistics(days: number = 30): Promise<{
    total_backups: number;
    successful_backups: number;
    failed_backups: number;
    total_size_bytes: number;
    average_duration_ms: number;
    success_rate: number;
    types: Record<BackupType, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: backups } = await this.database
      .from('backup_records')
      .select('*')
      .gte('started_at', since.toISOString());

    if (!backups || backups.length === 0) {
      return {
        total_backups: 0,
        successful_backups: 0,
        failed_backups: 0,
        total_size_bytes: 0,
        average_duration_ms: 0,
        success_rate: 0,
        types: {} as Record<BackupType, number>
      };
    }

    const successful = backups.filter(b => b.status === 'completed');
    const failed = backups.filter(b => b.status === 'failed');
    const totalSize = successful.reduce((sum, b) => sum + (b.file_size || 0), 0);
    const totalDuration = successful.reduce((sum, b) => {
      const duration = b.metadata?.duration_ms || 0;
      return sum + duration;
    }, 0);

    const types = backups.reduce((acc, backup) => {
      acc[backup.backup_type] = (acc[backup.backup_type] || 0) + 1;
      return acc;
    }, {} as Record<BackupType, number>);

    return {
      total_backups: backups.length,
      successful_backups: successful.length,
      failed_backups: failed.length,
      total_size_bytes: totalSize,
      average_duration_ms: successful.length > 0 ? totalDuration / successful.length : 0,
      success_rate: backups.length > 0 ? (successful.length / backups.length) * 100 : 0,
      types
    };
  }

  private initializeDefaultConfigurations(): void {
    this.configurations.set('daily-full', {
      type: 'full',
      schedule: '0 2 * * *', // Daily at 2 AM
      retentionDays: 7,
      compressionLevel: 6,
      encryption: true,
      destination: 's3://vocilia-backups/daily'
    });

    this.configurations.set('weekly-full', {
      type: 'full',
      schedule: '0 1 * * 0', // Weekly on Sunday at 1 AM
      retentionDays: 30,
      compressionLevel: 9,
      encryption: true,
      destination: 's3://vocilia-backups/weekly'
    });

    this.configurations.set('incremental', {
      type: 'incremental',
      schedule: '0 */6 * * *', // Every 6 hours
      retentionDays: 3,
      compressionLevel: 3,
      encryption: true,
      destination: 's3://vocilia-backups/incremental'
    });
  }

  private generateBackupId(type: BackupType): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}-${timestamp}-${random}`;
  }

  private async performBackup(
    type: BackupType,
    backupId: string,
    options?: any
  ): Promise<{
    size: number;
    path: string;
    checksum: string;
    compressedSize: number;
  }> {
    // Simulate backup creation
    const size = Math.floor(Math.random() * 1000000000) + 100000000; // 100MB - 1GB
    const compressedSize = Math.floor(size * 0.7); // 70% compression
    const path = `/backups/${backupId}.backup`;
    const checksum = this.generateChecksum(backupId + Date.now().toString());

    // In a real implementation, this would:
    // 1. Connect to Supabase and export data
    // 2. Compress the backup if requested
    // 3. Encrypt the backup if requested
    // 4. Upload to storage destination
    // 5. Calculate actual checksum

    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate backup time

    return { size, path, checksum, compressedSize };
  }

  private async getBackupRecord(backupId: string): Promise<BackupRecord | null> {
    const { data } = await this.database
      .from('backup_records')
      .select('*')
      .eq('backup_id', backupId)
      .single();

    return data || null;
  }

  private async getFileStats(filePath: string): Promise<{ size: number } | null> {
    // Simulate file stat check
    return { size: Math.floor(Math.random() * 1000000000) + 100000000 };
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    // Simulate checksum calculation
    return this.generateChecksum(filePath + Date.now().toString());
  }

  private generateChecksum(input: string): string {
    // Simple hash function for simulation
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private async readBackupMetadata(filePath: string): Promise<any> {
    // Simulate metadata reading
    return {
      version: '1.0.0',
      created: new Date().toISOString(),
      tables: ['users', 'stores', 'feedback_sessions']
    };
  }

  private async testDecompression(filePath: string): Promise<boolean> {
    // Simulate decompression test
    return Math.random() > 0.1; // 90% success rate
  }

  private async recordVerificationResult(result: BackupVerificationResult): Promise<void> {
    // In a real implementation, this would store verification results
    console.log(`Backup verification result for ${result.backupId}: ${result.isValid ? 'PASS' : 'FAIL'}`);
  }

  private async verifyRecentBackups(): Promise<void> {
    const recent = await this.listBackups({
      status: 'completed',
      limit: 10
    });

    for (const backup of recent.backups) {
      if (!backup.last_verified_at || 
          new Date(backup.last_verified_at).getTime() < Date.now() - 86400000) { // 24 hours
        await this.verifyBackup(backup.backup_id);
      }
    }
  }

  private async deleteBackupFile(filePath: string): Promise<void> {
    // Simulate file deletion
    console.log(`Deleting backup file: ${filePath}`);
  }

  private async simulateRestore(backup: BackupRecord, options: BackupRestoreOptions): Promise<string[]> {
    // Simulate dry run restore
    return options.tables || ['users', 'stores', 'feedback_sessions'];
  }

  private async performRestore(backup: BackupRecord, options: BackupRestoreOptions): Promise<string[]> {
    // Simulate actual restore
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate restore time
    return options.tables || ['users', 'stores', 'feedback_sessions'];
  }
}