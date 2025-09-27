export interface BackupRecord {
  backup_id: string;
  environment_id: string;
  backup_type: 'database' | 'files' | 'configuration' | 'full_system';
  backup_source: string;
  backup_destination: string;
  backup_size_bytes: number;
  compression_type: 'gzip' | 'bzip2' | 'none';
  encryption_enabled: boolean;
  encryption_algorithm?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
  started_at: Date;
  completed_at?: Date;
  expires_at: Date;
  retention_days: number;
  checksum: string;
  verification_status: 'pending' | 'verified' | 'corrupted' | 'failed';
  verification_at?: Date;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface BackupPolicy {
  policy_id: string;
  environment_id: string;
  backup_type: BackupRecord['backup_type'];
  schedule_cron: string;
  retention_days: number;
  compression_enabled: boolean;
  encryption_enabled: boolean;
  verification_enabled: boolean;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BackupMetrics {
  total_backups: number;
  successful_backups: number;
  failed_backups: number;
  success_rate_percent: number;
  total_size_bytes: number;
  average_backup_time_minutes: number;
  oldest_backup_age_days: number;
  latest_backup_age_hours: number;
}

export interface RestoreInfo {
  restore_id: string;
  backup_id: string;
  restore_type: 'full' | 'partial' | 'point_in_time';
  target_environment: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  initiated_by: string;
  initiated_at: Date;
  completed_at?: Date;
  error_message?: string;
}

export class BackupRecordsModel {
  private static readonly DEFAULT_RETENTION_DAYS = 30;
  private static readonly MAX_BACKUP_AGE_HOURS = 25; // Alert if no backup in 25 hours
  private static readonly VERIFICATION_INTERVAL_DAYS = 7;

  static validate(backup: Partial<BackupRecord>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!backup.backup_id) {
      errors.push('backup_id is required');
    }

    if (!backup.environment_id) {
      errors.push('environment_id is required');
    }

    if (!backup.backup_type || !['database', 'files', 'configuration', 'full_system'].includes(backup.backup_type)) {
      errors.push('backup_type must be database, files, configuration, or full_system');
    }

    if (!backup.backup_source) {
      errors.push('backup_source is required');
    }

    if (!backup.backup_destination) {
      errors.push('backup_destination is required');
    }

    if (!backup.compression_type || !['gzip', 'bzip2', 'none'].includes(backup.compression_type)) {
      errors.push('compression_type must be gzip, bzip2, or none');
    }

    if (!backup.status || !['pending', 'in_progress', 'completed', 'failed', 'expired'].includes(backup.status)) {
      errors.push('status must be pending, in_progress, completed, failed, or expired');
    }

    if (!backup.started_at) {
      errors.push('started_at is required');
    }

    if (!backup.expires_at) {
      errors.push('expires_at is required');
    }

    if (!backup.retention_days || backup.retention_days < 1) {
      errors.push('retention_days must be a positive number');
    }

    if (!backup.verification_status || !['pending', 'verified', 'corrupted', 'failed'].includes(backup.verification_status)) {
      errors.push('verification_status must be pending, verified, corrupted, or failed');
    }

    if (backup.encryption_enabled && !backup.encryption_algorithm) {
      errors.push('encryption_algorithm is required when encryption is enabled');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static calculateDuration(backup: BackupRecord): number | null {
    if (!backup.completed_at) return null;
    return backup.completed_at.getTime() - backup.started_at.getTime();
  }

  static isExpired(backup: BackupRecord): boolean {
    return new Date() > backup.expires_at;
  }

  static needsVerification(backup: BackupRecord): boolean {
    if (backup.status !== 'completed') return false;
    if (backup.verification_status === 'verified') {
      // Re-verify periodically
      const lastVerification = backup.verification_at || backup.completed_at;
      const daysSinceVerification = (Date.now() - lastVerification!.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceVerification >= this.VERIFICATION_INTERVAL_DAYS;
    }
    return backup.verification_status === 'pending' || backup.verification_status === 'failed';
  }

  static requiresAttention(backup: BackupRecord): boolean {
    if (backup.status === 'failed') return true;
    if (backup.verification_status === 'corrupted') return true;
    if (this.isExpired(backup) && backup.status === 'completed') return true;
    
    // Check if backup is taking too long (>2 hours)
    const maxDurationMs = 2 * 60 * 60 * 1000;
    const currentDuration = Date.now() - backup.started_at.getTime();
    
    return backup.status === 'in_progress' && currentDuration > maxDurationMs;
  }

  static calculateMetrics(backups: BackupRecord[], periodDays: number = 30): BackupMetrics {
    const cutoffDate = new Date(Date.now() - (periodDays * 24 * 60 * 60 * 1000));
    const periodBackups = backups.filter(b => b.created_at >= cutoffDate);

    const successful = periodBackups.filter(b => b.status === 'completed');
    const failed = periodBackups.filter(b => b.status === 'failed');
    
    const totalSize = successful.reduce((sum, b) => sum + b.backup_size_bytes, 0);
    
    const completedBackups = successful.filter(b => b.completed_at);
    const totalDuration = completedBackups.reduce((sum, b) => {
      const duration = this.calculateDuration(b);
      return sum + (duration || 0);
    }, 0);
    
    const avgBackupTime = completedBackups.length > 0 
      ? (totalDuration / completedBackups.length) / (1000 * 60) // Convert to minutes
      : 0;

    const sortedByDate = [...backups].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    const oldestBackup = sortedByDate[0];
    const latestBackup = sortedByDate[sortedByDate.length - 1];

    const oldestAge = oldestBackup 
      ? (Date.now() - oldestBackup.created_at.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    
    const latestAge = latestBackup
      ? (Date.now() - latestBackup.created_at.getTime()) / (1000 * 60 * 60)
      : 0;

    return {
      total_backups: periodBackups.length,
      successful_backups: successful.length,
      failed_backups: failed.length,
      success_rate_percent: periodBackups.length > 0 
        ? (successful.length / periodBackups.length) * 100 
        : 0,
      total_size_bytes: totalSize,
      average_backup_time_minutes: avgBackupTime,
      oldest_backup_age_days: oldestAge,
      latest_backup_age_hours: latestAge
    };
  }

  static getBackupHealth(backups: BackupRecord[]): 'healthy' | 'warning' | 'critical' {
    const metrics = this.calculateMetrics(backups, 7); // Last 7 days
    
    // Critical conditions
    if (metrics.success_rate_percent < 80) return 'critical';
    if (metrics.latest_backup_age_hours > this.MAX_BACKUP_AGE_HOURS) return 'critical';
    if (metrics.total_backups === 0) return 'critical';

    // Warning conditions
    if (metrics.success_rate_percent < 95) return 'warning';
    if (metrics.latest_backup_age_hours > 24) return 'warning';

    const corruptedBackups = backups.filter(b => b.verification_status === 'corrupted');
    if (corruptedBackups.length > 0) return 'warning';

    return 'healthy';
  }

  static createBackupRecord(
    environmentId: string,
    backupType: BackupRecord['backup_type'],
    source: string,
    destination: string,
    retentionDays: number = this.DEFAULT_RETENTION_DAYS
  ): BackupRecord {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (retentionDays * 24 * 60 * 60 * 1000));

    return {
      backup_id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      environment_id: environmentId,
      backup_type: backupType,
      backup_source: source,
      backup_destination: destination,
      backup_size_bytes: 0,
      compression_type: 'gzip',
      encryption_enabled: true,
      encryption_algorithm: 'AES-256-GCM',
      status: 'pending',
      started_at: now,
      expires_at: expiresAt,
      retention_days: retentionDays,
      checksum: '',
      verification_status: 'pending',
      created_at: now,
      updated_at: now
    };
  }

  static createPolicy(
    environmentId: string,
    backupType: BackupRecord['backup_type'],
    scheduleCron: string,
    retentionDays: number = this.DEFAULT_RETENTION_DAYS
  ): BackupPolicy {
    const now = new Date();

    return {
      policy_id: `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      environment_id: environmentId,
      backup_type: backupType,
      schedule_cron: scheduleCron,
      retention_days: retentionDays,
      compression_enabled: true,
      encryption_enabled: true,
      verification_enabled: true,
      enabled: true,
      created_at: now,
      updated_at: now
    };
  }

  static formatBackupSize(sizeBytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = sizeBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  static getNextBackupTime(policy: BackupPolicy): Date | null {
    // This would integrate with a cron parser library in practice
    // For now, return a simplified calculation
    const now = new Date();
    
    if (policy.schedule_cron === '0 0 * * *') { // Daily at midnight
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }

    if (policy.schedule_cron === '0 0 * * 0') { // Weekly on Sunday
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + (7 - now.getDay()));
      nextSunday.setHours(0, 0, 0, 0);
      return nextSunday;
    }

    return null;
  }
}