import * as cron from 'node-cron';
import { Database } from '@vocilia/database';
import { BackupService } from '../services/monitoring/backup-service';
import { AlertService } from '../services/monitoring/alert-service';

interface VerificationJob {
  name: string;
  schedule: string;
  task: () => Promise<void>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  isRunning: boolean;
  config: {
    maxAge: number; // Maximum age in hours before verification is required
    batchSize: number; // Number of backups to verify per run
    failureThreshold: number; // Number of failures before alerting
  };
}

interface VerificationResult {
  backupId: string;
  success: boolean;
  duration: number;
  errors: string[];
  verifiedAt: Date;
  fileSize: number;
  checksumValid: boolean;
}

interface VerificationSummary {
  totalVerified: number;
  successful: number;
  failed: number;
  duration: number;
  errors: string[];
  criticalFailures: string[];
}

export class BackupVerificationScheduler {
  private database: Database;
  private backupService: BackupService;
  private alertService: AlertService;
  private jobs: Map<string, VerificationJob> = new Map();
  private isInitialized = false;
  private verificationHistory: Map<string, VerificationResult[]> = new Map();

  constructor(
    database: Database,
    backupService: BackupService,
    alertService: AlertService
  ) {
    this.database = database;
    this.backupService = backupService;
    this.alertService = alertService;
  }

  /**
   * Initialize and start all backup verification jobs
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('Backup verification scheduler already initialized');
      return;
    }

    this.setupJobs();
    this.startJobs();
    this.isInitialized = true;

    console.log('Backup verification scheduler initialized');
  }

  /**
   * Stop all running verification jobs
   */
  public shutdown(): void {
    if (!this.isInitialized) {
      return;
    }

    for (const [jobName, job] of this.jobs) {
      if (job.enabled) {
        cron.destroy(jobName);
        console.log(`Stopped backup verification job: ${jobName}`);
      }
    }

    this.jobs.clear();
    this.isInitialized = false;
    console.log('Backup verification scheduler shut down');
  }

  /**
   * Get status of all verification jobs
   */
  public getJobStatus(): Array<{
    name: string;
    enabled: boolean;
    isRunning: boolean;
    lastRun?: Date;
    nextRun?: Date;
    schedule: string;
    config: any;
  }> {
    return Array.from(this.jobs.values()).map(job => ({
      name: job.name,
      enabled: job.enabled,
      isRunning: job.isRunning,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      schedule: job.schedule,
      config: job.config
    }));
  }

  /**
   * Manually trigger a specific verification job
   */
  public async runJob(jobName: string): Promise<VerificationSummary> {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Verification job ${jobName} not found`);
    }

    if (job.isRunning) {
      throw new Error(`Verification job ${jobName} is already running`);
    }

    console.log(`Manually running backup verification job: ${jobName}`);
    return await this.executeJob(job);
  }

  /**
   * Enable or disable a specific verification job
   */
  public setJobEnabled(jobName: string, enabled: boolean): void {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Verification job ${jobName} not found`);
    }

    if (job.enabled === enabled) {
      return;
    }

    job.enabled = enabled;

    if (enabled) {
      this.scheduleJob(jobName, job);
      console.log(`Enabled backup verification job: ${jobName}`);
    } else {
      cron.destroy(jobName);
      console.log(`Disabled backup verification job: ${jobName}`);
    }
  }

  /**
   * Get verification statistics
   */
  public async getVerificationStatistics(days: number = 7): Promise<{
    totalBackups: number;
    verifiedBackups: number;
    failedVerifications: number;
    verificationRate: number;
    averageVerificationTime: number;
    criticalFailures: number;
    oldestUnverifiedBackup?: {
      backupId: string;
      age: number;
      type: string;
    };
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get all backups in the time period
    const { data: allBackups } = await this.database
      .from('backup_records')
      .select('*')
      .gte('started_at', since.toISOString())
      .eq('status', 'completed');

    // Get verification records
    const { data: verifications } = await this.database
      .from('backup_verifications')
      .select('*')
      .gte('verified_at', since.toISOString());

    const totalBackups = allBackups?.length || 0;
    const verifiedBackups = verifications?.length || 0;
    const failedVerifications = verifications?.filter(v => !v.is_valid).length || 0;
    const verificationRate = totalBackups > 0 ? (verifiedBackups / totalBackups) * 100 : 0;

    // Calculate average verification time
    const totalVerificationTime = verifications?.reduce((sum, v) => 
      sum + (v.metadata?.duration_ms || 0), 0) || 0;
    const averageVerificationTime = verifiedBackups > 0 
      ? totalVerificationTime / verifiedBackups 
      : 0;

    // Count critical failures (checksum mismatches, file corruption, etc.)
    const criticalFailures = verifications?.filter(v => 
      v.errors?.some((error: string) => 
        error.includes('checksum') || 
        error.includes('corruption') || 
        error.includes('not found')
      )
    ).length || 0;

    // Find oldest unverified backup
    let oldestUnverifiedBackup;
    if (allBackups) {
      const verifiedBackupIds = new Set(verifications?.map(v => v.backup_id) || []);
      const unverifiedBackups = allBackups.filter(b => !verifiedBackupIds.has(b.backup_id));
      
      if (unverifiedBackups.length > 0) {
        const oldest = unverifiedBackups.reduce((oldest, current) => 
          new Date(current.started_at) < new Date(oldest.started_at) ? current : oldest
        );
        
        oldestUnverifiedBackup = {
          backupId: oldest.backup_id,
          age: Math.floor((Date.now() - new Date(oldest.started_at).getTime()) / (1000 * 60 * 60)), // hours
          type: oldest.backup_type
        };
      }
    }

    return {
      totalBackups,
      verifiedBackups,
      failedVerifications,
      verificationRate: Math.round(verificationRate * 100) / 100,
      averageVerificationTime: Math.round(averageVerificationTime),
      criticalFailures,
      oldestUnverifiedBackup
    };
  }

  /**
   * Get verification history for a specific backup
   */
  public getBackupVerificationHistory(backupId: string): VerificationResult[] {
    return this.verificationHistory.get(backupId) || [];
  }

  /**
   * Force verification of all recent backups
   */
  public async verifyAllRecentBackups(hours: number = 24): Promise<VerificationSummary> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const { data: recentBackups } = await this.database
      .from('backup_records')
      .select('*')
      .gte('started_at', since.toISOString())
      .eq('status', 'completed')
      .order('started_at', { ascending: false });

    if (!recentBackups || recentBackups.length === 0) {
      return {
        totalVerified: 0,
        successful: 0,
        failed: 0,
        duration: 0,
        errors: [],
        criticalFailures: []
      };
    }

    return await this.verifyBackupBatch(recentBackups.map(b => b.backup_id));
  }

  private setupJobs(): void {
    // Continuous verification - runs every 2 hours
    this.jobs.set('continuous-verification', {
      name: 'continuous-verification',
      schedule: '0 */2 * * *',
      task: () => this.verifyContinuousBackups(),
      enabled: true,
      isRunning: false,
      config: {
        maxAge: 24, // Verify backups older than 24 hours
        batchSize: 5, // Verify 5 backups per run
        failureThreshold: 3 // Alert after 3 consecutive failures
      }
    });

    // Daily comprehensive verification - runs daily at 3:00 AM
    this.jobs.set('daily-comprehensive', {
      name: 'daily-comprehensive',
      schedule: '0 3 * * *',
      task: () => this.verifyDailyBackups(),
      enabled: true,
      isRunning: false,
      config: {
        maxAge: 168, // Verify backups up to 7 days old
        batchSize: 20, // Verify up to 20 backups per run
        failureThreshold: 5 // Alert after 5 failures
      }
    });

    // Weekly deep verification - runs every Sunday at 4:00 AM
    this.jobs.set('weekly-deep', {
      name: 'weekly-deep',
      schedule: '0 4 * * 0',
      task: () => this.verifyWeeklyBackups(),
      enabled: true,
      isRunning: false,
      config: {
        maxAge: 720, // Verify backups up to 30 days old
        batchSize: 50, // Verify up to 50 backups per run
        failureThreshold: 10 // Alert after 10 failures
      }
    });

    // Critical backup verification - runs every hour
    this.jobs.set('critical-verification', {
      name: 'critical-verification',
      schedule: '30 * * * *',
      task: () => this.verifyCriticalBackups(),
      enabled: true,
      isRunning: false,
      config: {
        maxAge: 6, // Verify critical backups older than 6 hours
        batchSize: 10, // Verify up to 10 critical backups per run
        failureThreshold: 1 // Alert immediately on any failure
      }
    });

    // Cleanup verification records - runs daily at 5:00 AM
    this.jobs.set('cleanup-verifications', {
      name: 'cleanup-verifications',
      schedule: '0 5 * * *',
      task: () => this.cleanupVerificationRecords(),
      enabled: true,
      isRunning: false,
      config: {
        maxAge: 8760, // Keep verification records for 365 days
        batchSize: 100, // Clean up in batches of 100
        failureThreshold: 0 // No alerting for cleanup job
      }
    });
  }

  private startJobs(): void {
    for (const [jobName, job] of this.jobs) {
      if (job.enabled) {
        this.scheduleJob(jobName, job);
      }
    }
  }

  private scheduleJob(jobName: string, job: VerificationJob): void {
    cron.schedule(job.schedule, async () => {
      await this.executeJob(job);
    }, {
      name: jobName,
      scheduled: true,
      timezone: 'Europe/Stockholm'
    });

    // Calculate next run time
    job.nextRun = this.getNextRunTime(job.schedule);
    console.log(`Scheduled backup verification job: ${jobName} (next run: ${job.nextRun})`);
  }

  private async executeJob(job: VerificationJob): Promise<VerificationSummary> {
    if (job.isRunning) {
      console.log(`Verification job ${job.name} is already running, skipping execution`);
      return this.getEmptySummary();
    }

    job.isRunning = true;
    job.lastRun = new Date();

    try {
      console.log(`Starting backup verification job: ${job.name}`);
      const startTime = Date.now();
      
      const summary = await job.task();
      
      const duration = Date.now() - startTime;
      console.log(`Completed backup verification job: ${job.name} (${duration}ms)`);

      // Check for failures and send alerts if needed
      await this.checkForAlertsNeeded(job, summary);

      // Update next run time
      job.nextRun = this.getNextRunTime(job.schedule);

      return summary;

    } catch (error) {
      console.error(`Backup verification job ${job.name} failed:`, error);
      
      // Log the error
      await this.logJobError(job.name, error);
      
      // Send alert for job failure
      await this.sendJobFailureAlert(job.name, error);

      return this.getEmptySummary();
      
    } finally {
      job.isRunning = false;
    }
  }

  private async verifyContinuousBackups(): Promise<VerificationSummary> {
    const job = this.jobs.get('continuous-verification')!;
    return await this.verifyBackupsByAge(job.config.maxAge, job.config.batchSize);
  }

  private async verifyDailyBackups(): Promise<VerificationSummary> {
    const job = this.jobs.get('daily-comprehensive')!;
    return await this.verifyBackupsByAge(job.config.maxAge, job.config.batchSize);
  }

  private async verifyWeeklyBackups(): Promise<VerificationSummary> {
    const job = this.jobs.get('weekly-deep')!;
    return await this.verifyBackupsByAge(job.config.maxAge, job.config.batchSize);
  }

  private async verifyCriticalBackups(): Promise<VerificationSummary> {
    const job = this.jobs.get('critical-verification')!;
    
    // Get critical backups (full backups and recent backups)
    const since = new Date();
    since.setHours(since.getHours() - job.config.maxAge);

    const { data: criticalBackups } = await this.database
      .from('backup_records')
      .select('*')
      .or('backup_type.eq.full,backup_type.eq.weekly')
      .gte('started_at', since.toISOString())
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(job.config.batchSize);

    if (!criticalBackups || criticalBackups.length === 0) {
      return this.getEmptySummary();
    }

    return await this.verifyBackupBatch(criticalBackups.map(b => b.backup_id));
  }

  private async verifyBackupsByAge(maxAgeHours: number, batchSize: number): Promise<VerificationSummary> {
    const since = new Date();
    since.setHours(since.getHours() - maxAgeHours);

    // Get backups that haven't been verified recently or at all
    const { data: unverifiedBackups } = await this.database
      .from('backup_records')
      .select(`
        *,
        backup_verifications!left(verified_at, is_valid)
      `)
      .gte('started_at', since.toISOString())
      .eq('status', 'completed')
      .or('backup_verifications.verified_at.is.null,backup_verifications.verified_at.lt.' + 
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Not verified in last 24 hours
      .order('started_at', { ascending: true })
      .limit(batchSize);

    if (!unverifiedBackups || unverifiedBackups.length === 0) {
      return this.getEmptySummary();
    }

    return await this.verifyBackupBatch(unverifiedBackups.map(b => b.backup_id));
  }

  private async verifyBackupBatch(backupIds: string[]): Promise<VerificationSummary> {
    const summary: VerificationSummary = {
      totalVerified: 0,
      successful: 0,
      failed: 0,
      duration: 0,
      errors: [],
      criticalFailures: []
    };

    const startTime = Date.now();

    for (const backupId of backupIds) {
      try {
        const result = await this.verifyBackup(backupId);
        
        summary.totalVerified++;
        if (result.success) {
          summary.successful++;
        } else {
          summary.failed++;
          summary.errors.push(...result.errors);
          
          // Check for critical failures
          const hasCriticalFailure = result.errors.some(error =>
            error.includes('checksum') || 
            error.includes('corruption') || 
            error.includes('not found')
          );
          
          if (hasCriticalFailure) {
            summary.criticalFailures.push(backupId);
          }
        }

        // Store verification history
        this.addToVerificationHistory(backupId, result);

      } catch (error) {
        summary.failed++;
        const errorMsg = `Failed to verify backup ${backupId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        summary.errors.push(errorMsg);
        summary.criticalFailures.push(backupId);
      }
    }

    summary.duration = Date.now() - startTime;
    return summary;
  }

  private async verifyBackup(backupId: string): Promise<VerificationResult> {
    const startTime = Date.now();
    
    try {
      const verificationResult = await this.backupService.verifyBackup(backupId);
      
      const result: VerificationResult = {
        backupId,
        success: verificationResult.isValid,
        duration: Date.now() - startTime,
        errors: verificationResult.errors,
        verifiedAt: verificationResult.verifiedAt,
        fileSize: verificationResult.size,
        checksumValid: verificationResult.errors.every(e => !e.includes('checksum'))
      };

      // Store verification result in database
      await this.storeVerificationResult(result, verificationResult);

      return result;

    } catch (error) {
      const result: VerificationResult = {
        backupId,
        success: false,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown verification error'],
        verifiedAt: new Date(),
        fileSize: 0,
        checksumValid: false
      };

      await this.storeVerificationResult(result);
      return result;
    }
  }

  private async storeVerificationResult(
    result: VerificationResult,
    backupVerification?: any
  ): Promise<void> {
    await this.database
      .from('backup_verifications')
      .upsert({
        backup_id: result.backupId,
        is_valid: result.success,
        verified_at: result.verifiedAt.toISOString(),
        file_size: result.fileSize,
        checksum_valid: result.checksumValid,
        errors: result.errors,
        metadata: {
          duration_ms: result.duration,
          verification_timestamp: new Date().toISOString(),
          checksum: backupVerification?.checksum
        }
      }, {
        onConflict: 'backup_id'
      });
  }

  private addToVerificationHistory(backupId: string, result: VerificationResult): void {
    if (!this.verificationHistory.has(backupId)) {
      this.verificationHistory.set(backupId, []);
    }
    
    const history = this.verificationHistory.get(backupId)!;
    history.push(result);
    
    // Keep only last 10 verification results per backup
    if (history.length > 10) {
      history.shift();
    }
  }

  private async cleanupVerificationRecords(): Promise<VerificationSummary> {
    const job = this.jobs.get('cleanup-verifications')!;
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - job.config.maxAge);

    const { count: deletedCount } = await this.database
      .from('backup_verifications')
      .delete()
      .lt('verified_at', cutoffDate.toISOString());

    console.log(`Cleaned up ${deletedCount} old backup verification records`);

    return {
      totalVerified: deletedCount || 0,
      successful: deletedCount || 0,
      failed: 0,
      duration: 0,
      errors: [],
      criticalFailures: []
    };
  }

  private async checkForAlertsNeeded(job: VerificationJob, summary: VerificationSummary): Promise<void> {
    // Alert on critical failures
    if (summary.criticalFailures.length > 0) {
      await this.sendCriticalFailureAlert(job.name, summary.criticalFailures);
    }

    // Alert if failure threshold is exceeded
    if (summary.failed >= job.config.failureThreshold) {
      await this.sendFailureThresholdAlert(job.name, summary);
    }

    // Alert if verification rate is too low (less than 80% success)
    const successRate = summary.totalVerified > 0 ? (summary.successful / summary.totalVerified) * 100 : 100;
    if (successRate < 80 && summary.totalVerified >= 5) {
      await this.sendLowSuccessRateAlert(job.name, successRate, summary);
    }
  }

  private async sendCriticalFailureAlert(jobName: string, criticalFailures: string[]): Promise<void> {
    await this.alertService.triggerAlert(
      'backup-critical-failure',
      'backup-verification-scheduler',
      {
        job_name: jobName,
        critical_failures: criticalFailures,
        failure_count: criticalFailures.length,
        severity: 'critical'
      }
    );
  }

  private async sendFailureThresholdAlert(jobName: string, summary: VerificationSummary): Promise<void> {
    await this.alertService.triggerAlert(
      'backup-verification-threshold',
      'backup-verification-scheduler',
      {
        job_name: jobName,
        failed_count: summary.failed,
        total_count: summary.totalVerified,
        errors: summary.errors.slice(0, 5), // First 5 errors
        severity: 'warning'
      }
    );
  }

  private async sendLowSuccessRateAlert(
    jobName: string,
    successRate: number,
    summary: VerificationSummary
  ): Promise<void> {
    await this.alertService.triggerAlert(
      'backup-low-success-rate',
      'backup-verification-scheduler',
      {
        job_name: jobName,
        success_rate: successRate,
        successful: summary.successful,
        failed: summary.failed,
        total: summary.totalVerified,
        severity: 'warning'
      }
    );
  }

  private async sendJobFailureAlert(jobName: string, error: any): Promise<void> {
    await this.alertService.triggerAlert(
      'backup-verification-job-failure',
      'backup-verification-scheduler',
      {
        job_name: jobName,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
        severity: 'critical'
      }
    );
  }

  private async logJobError(jobName: string, error: any): Promise<void> {
    await this.database
      .from('monitoring_data')
      .insert({
        service_id: 'backup-verification-scheduler',
        metric_type: 'job_error',
        status: 'critical',
        timestamp: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          job_name: jobName,
          error_stack: error instanceof Error ? error.stack : undefined,
          error_type: 'backup_verification_job_failure'
        }
      });
  }

  private getEmptySummary(): VerificationSummary {
    return {
      totalVerified: 0,
      successful: 0,
      failed: 0,
      duration: 0,
      errors: [],
      criticalFailures: []
    };
  }

  private getNextRunTime(schedule: string): Date {
    // Simple next run calculation - in a real implementation, use a proper cron parser
    const now = new Date();
    const nextRun = new Date(now);
    
    // For simplicity, add appropriate time based on schedule pattern
    if (schedule.includes('*/2 * * *')) {
      nextRun.setHours(nextRun.getHours() + 2);
    } else if (schedule.includes('* * *')) {
      nextRun.setDate(nextRun.getDate() + 1);
    } else {
      nextRun.setHours(nextRun.getHours() + 1);
    }
    
    return nextRun;
  }
}