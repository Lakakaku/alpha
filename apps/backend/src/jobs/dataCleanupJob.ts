import cron from 'node-cron';
import { supabase } from '../../../../packages/database/src/client/supabase';
import { sessionManager } from '../services/calls/sessionManager';

interface CleanupStats {
  feedbackCallSessions: number;
  conversationTranscripts: number;
  qualityAssessments: number;
  callQualityMetrics: number;
  fraudDetectionResults: number;
  redisSessionsCleared: number;
  totalRecordsRemoved: number;
  startTime: string;
  endTime: string;
  duration: number;
}

class DataCleanupJob {
  private isRunning = false;
  private cronJob: any = null;
  private readonly RETENTION_DAYS = 90;

  constructor() {
    this.setupCronJob();
  }

  // Setup cron job to run daily at 2 AM
  private setupCronJob(): void {
    // Run every day at 2:00 AM
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      console.log('Starting scheduled 90-day data cleanup job');
      await this.runCleanup();
    }, {
      scheduled: true,
      timezone: 'Europe/Stockholm' // Swedish timezone
    });

    console.log('Data cleanup job scheduled to run daily at 2:00 AM (Stockholm time)');
  }

  // Main cleanup execution method
  async runCleanup(): Promise<CleanupStats> {
    if (this.isRunning) {
      console.log('Cleanup job already running, skipping...');
      throw new Error('Cleanup job already in progress');
    }

    this.isRunning = true;
    const startTime = new Date().toISOString();
    console.log(`Starting 90-day data cleanup at ${startTime}`);

    const stats: CleanupStats = {
      feedbackCallSessions: 0,
      conversationTranscripts: 0,
      qualityAssessments: 0,
      callQualityMetrics: 0,
      fraudDetectionResults: 0,
      redisSessionsCleared: 0,
      totalRecordsRemoved: 0,
      startTime,
      endTime: '',
      duration: 0
    };

    try {
      const cutoffDate = this.getCutoffDate();
      console.log(`Cleaning up records older than ${cutoffDate}`);

      // Clean up expired Redis sessions first
      stats.redisSessionsCleared = await this.cleanupRedisSession();

      // Clean up database records in dependency order
      stats.fraudDetectionResults = await this.cleanupFraudDetectionResults(cutoffDate);
      stats.callQualityMetrics = await this.cleanupCallQualityMetrics(cutoffDate);
      stats.qualityAssessments = await this.cleanupQualityAssessments(cutoffDate);
      stats.conversationTranscripts = await this.cleanupConversationTranscripts(cutoffDate);
      stats.feedbackCallSessions = await this.cleanupFeedbackCallSessions(cutoffDate);

      // Calculate totals
      stats.totalRecordsRemoved = 
        stats.feedbackCallSessions +
        stats.conversationTranscripts +
        stats.qualityAssessments +
        stats.callQualityMetrics +
        stats.fraudDetectionResults;

      const endTime = new Date().toISOString();
      stats.endTime = endTime;
      stats.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      // Log cleanup completion
      await this.logCleanupCompletion(stats);

      console.log('90-day data cleanup completed:', stats);
      return stats;

    } catch (error) {
      console.error('Data cleanup job failed:', error);
      
      // Log cleanup failure
      await this.logCleanupFailure(error as Error, startTime);
      throw error;
      
    } finally {
      this.isRunning = false;
    }
  }

  // Get cutoff date for data retention (90 days ago)
  private getCutoffDate(): string {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);
    return cutoffDate.toISOString();
  }

  // Clean up expired Redis sessions
  private async cleanupRedisSession(): Promise<number> {
    try {
      return await sessionManager.cleanupExpiredSessions();
    } catch (error) {
      console.error('Redis session cleanup failed:', error);
      return 0;
    }
  }

  // Clean up feedback call sessions (main table)
  private async cleanupFeedbackCallSessions(cutoffDate: string): Promise<number> {
    const { data, error } = await supabase
      .from('feedback_call_sessions')
      .delete()
      .lt('expires_at', cutoffDate)
      .select('id');

    if (error) {
      console.error('Failed to cleanup feedback call sessions:', error);
      return 0;
    }

    const count = data?.length || 0;
    console.log(`Cleaned up ${count} expired feedback call sessions`);
    return count;
  }

  // Clean up conversation transcripts
  private async cleanupConversationTranscripts(cutoffDate: string): Promise<number> {
    // Clean up transcripts for sessions that no longer exist or are expired
    const { data, error } = await supabase
      .from('conversation_transcripts')
      .delete()
      .lt('created_at', cutoffDate)
      .select('id');

    if (error) {
      console.error('Failed to cleanup conversation transcripts:', error);
      return 0;
    }

    const count = data?.length || 0;
    console.log(`Cleaned up ${count} expired conversation transcripts`);
    return count;
  }

  // Clean up quality assessments
  private async cleanupQualityAssessments(cutoffDate: string): Promise<number> {
    const { data, error } = await supabase
      .from('quality_assessments')
      .delete()
      .lt('created_at', cutoffDate)
      .select('id');

    if (error) {
      console.error('Failed to cleanup quality assessments:', error);
      return 0;
    }

    const count = data?.length || 0;
    console.log(`Cleaned up ${count} expired quality assessments`);
    return count;
  }

  // Clean up call quality metrics
  private async cleanupCallQualityMetrics(cutoffDate: string): Promise<number> {
    // Keep metrics for system monitoring but clean up old data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data, error } = await supabase
      .from('call_quality_metrics')
      .delete()
      .lt('measured_at', sixMonthsAgo.toISOString())
      .select('id');

    if (error) {
      console.error('Failed to cleanup call quality metrics:', error);
      return 0;
    }

    const count = data?.length || 0;
    console.log(`Cleaned up ${count} old call quality metrics (6+ months)`);
    return count;
  }

  // Clean up fraud detection results
  private async cleanupFraudDetectionResults(cutoffDate: string): Promise<number> {
    // Keep fraud data longer for compliance - clean after 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data, error } = await supabase
      .from('fraud_detection_results')
      .delete()
      .lt('created_at', oneYearAgo.toISOString())
      .select('id');

    if (error) {
      console.error('Failed to cleanup fraud detection results:', error);
      return 0;
    }

    const count = data?.length || 0;
    console.log(`Cleaned up ${count} old fraud detection results (1+ years)`);
    return count;
  }

  // Log successful cleanup completion
  private async logCleanupCompletion(stats: CleanupStats): Promise<void> {
    try {
      await supabase
        .from('cleanup_logs')
        .insert({
          job_type: '90_day_cleanup',
          status: 'completed',
          records_removed: stats.totalRecordsRemoved,
          duration_ms: stats.duration,
          details: {
            breakdown: {
              feedbackCallSessions: stats.feedbackCallSessions,
              conversationTranscripts: stats.conversationTranscripts,
              qualityAssessments: stats.qualityAssessments,
              callQualityMetrics: stats.callQualityMetrics,
              fraudDetectionResults: stats.fraudDetectionResults,
              redisSessionsCleared: stats.redisSessionsCleared
            },
            timing: {
              startTime: stats.startTime,
              endTime: stats.endTime,
              durationMs: stats.duration
            }
          },
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log cleanup completion:', error);
    }
  }

  // Log cleanup failure
  private async logCleanupFailure(error: Error, startTime: string): Promise<void> {
    try {
      await supabase
        .from('cleanup_logs')
        .insert({
          job_type: '90_day_cleanup',
          status: 'failed',
          records_removed: 0,
          duration_ms: Date.now() - new Date(startTime).getTime(),
          details: {
            error: {
              message: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString()
            }
          },
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Failed to log cleanup failure:', logError);
    }
  }

  // Manual cleanup trigger (for admin use)
  async runManualCleanup(): Promise<CleanupStats> {
    console.log('Running manual data cleanup');
    return await this.runCleanup();
  }

  // Get cleanup status
  getStatus(): { 
    running: boolean; 
    nextRun: string | null;
    lastRun: string | null;
  } {
    return {
      running: this.isRunning,
      nextRun: this.cronJob?.nextDate()?.toISOString() || null,
      lastRun: null // Would need to track this separately
    };
  }

  // Stop the cron job
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('Data cleanup cron job stopped');
    }
  }

  // Start the cron job
  start(): void {
    if (this.cronJob) {
      this.cronJob.start();
      console.log('Data cleanup cron job started');
    }
  }

  // Get recent cleanup history
  async getCleanupHistory(limit: number = 10): Promise<any[]> {
    const { data, error } = await supabase
      .from('cleanup_logs')
      .select('*')
      .eq('job_type', '90_day_cleanup')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch cleanup history:', error);
      return [];
    }

    return data || [];
  }
}

// Export singleton instance
export const dataCleanupJob = new DataCleanupJob();