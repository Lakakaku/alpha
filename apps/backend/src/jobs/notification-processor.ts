import * as cron from 'node-cron';
import { supabase } from '@vocilia/database';
import { 
  CommunicationNotifications,
  CommunicationTemplates,
  CommunicationLogs,
  CommunicationRetrySchedules
} from '@vocilia/database';
import { SMSProvider } from '../services/communication/sms-provider';
import { TemplateRenderer } from '../services/communication/template-renderer';
import { NotificationProcessor } from '../services/communication/notification-processor';

// Job configuration
interface JobConfig {
  enabled: boolean;
  schedule: string;
  batchSize: number;
  processingTimeoutMs: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  maxRetries: number;
}

interface ProcessingStats {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
  errors: string[];
}

interface NotificationJob {
  id: string;
  notification_id: string;
  phone: string;
  content: string;
  template_id: string;
  priority: 'low' | 'normal' | 'high';
  scheduled_at: Date;
  retry_count: number;
}

class NotificationProcessorJob {
  private config: JobConfig;
  private isRunning: boolean = false;
  private jobId: string | null = null;
  private smsProvider: SMSProvider;
  private templateRenderer: TemplateRenderer;
  private notificationProcessor: NotificationProcessor;
  private lastProcessedAt: Date;

  constructor() {
    this.config = {
      enabled: process.env.NOTIFICATION_PROCESSOR_ENABLED === 'true',
      schedule: process.env.NOTIFICATION_PROCESSOR_SCHEDULE || '*/30 * * * * *', // Every 30 seconds
      batchSize: parseInt(process.env.NOTIFICATION_BATCH_SIZE || '50'),
      processingTimeoutMs: parseInt(process.env.NOTIFICATION_PROCESSING_TIMEOUT_MS || '300000'), // 5 minutes
      quietHoursStart: process.env.NOTIFICATION_QUIET_HOURS_START || '22:00',
      quietHoursEnd: process.env.NOTIFICATION_QUIET_HOURS_END || '08:00',
      maxRetries: parseInt(process.env.NOTIFICATION_MAX_RETRIES || '3')
    };

    this.smsProvider = new SMSProvider();
    this.templateRenderer = new TemplateRenderer();
    this.notificationProcessor = new NotificationProcessor();
    this.lastProcessedAt = new Date();
  }

  /**
   * Start the notification processor cron job
   */
  public start(): void {
    if (!this.config.enabled) {
      console.log('Notification processor job is disabled');
      return;
    }

    console.log(`Starting notification processor job with schedule: ${this.config.schedule}`);

    cron.schedule(this.config.schedule, async () => {
      if (this.isRunning) {
        console.log('Notification processor job already running, skipping...');
        return;
      }

      try {
        await this.processNotifications();
      } catch (error) {
        console.error('Notification processor job error:', error);
        await this.logError('job_execution_error', error);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Stockholm'
    });

    console.log('Notification processor job started successfully');
  }

  /**
   * Stop the notification processor job
   */
  public stop(): void {
    console.log('Stopping notification processor job...');
    cron.destroy();
  }

  /**
   * Process pending notifications
   */
  private async processNotifications(): Promise<void> {
    this.isRunning = true;
    this.jobId = `notification_job_${Date.now()}`;
    
    const stats: ProcessingStats = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      startTime: new Date(),
      errors: []
    };

    try {
      console.log(`[${this.jobId}] Starting notification processing batch`);

      // Check if we're in quiet hours
      if (this.isQuietHours()) {
        console.log(`[${this.jobId}] In quiet hours, skipping non-urgent notifications`);
      }

      // Get pending notifications to process
      const notifications = await this.getPendingNotifications();
      
      if (notifications.length === 0) {
        console.log(`[${this.jobId}] No pending notifications to process`);
        return;
      }

      console.log(`[${this.jobId}] Processing ${notifications.length} notifications`);

      // Process notifications in batches
      for (let i = 0; i < notifications.length; i += this.config.batchSize) {
        const batch = notifications.slice(i, i + this.config.batchSize);
        const batchStats = await this.processBatch(batch, this.jobId);
        
        stats.processed += batchStats.processed;
        stats.sent += batchStats.sent;
        stats.failed += batchStats.failed;
        stats.skipped += batchStats.skipped;
        stats.errors.push(...batchStats.errors);
      }

      stats.endTime = new Date();
      
      console.log(`[${this.jobId}] Batch processing complete:`, {
        processed: stats.processed,
        sent: stats.sent,
        failed: stats.failed,
        skipped: stats.skipped,
        duration: stats.endTime.getTime() - stats.startTime.getTime()
      });

      // Log processing stats
      await this.logProcessingStats(stats);

    } catch (error) {
      console.error(`[${this.jobId}] Notification processing error:`, error);
      stats.errors.push(error.message);
      await this.logError('batch_processing_error', error);
    } finally {
      this.isRunning = false;
      this.lastProcessedAt = new Date();
    }
  }

  /**
   * Get pending notifications from database
   */
  private async getPendingNotifications(): Promise<NotificationJob[]> {
    const isQuietTime = this.isQuietHours();
    
    // Build query conditions
    let query = supabase
      .from('communication_notifications')
      .select(`
        id,
        phone,
        template_id,
        variables,
        priority,
        scheduled_at,
        retry_count,
        communication_templates!inner(
          id,
          content,
          name,
          language
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .lt('retry_count', this.config.maxRetries)
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(this.config.batchSize * 2); // Get extra to account for filtering

    // During quiet hours, only process high priority notifications
    if (isQuietTime) {
      query = query.eq('priority', 'high');
    }

    const { data: notifications, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch pending notifications: ${error.message}`);
    }

    if (!notifications || notifications.length === 0) {
      return [];
    }

    // Map to job format
    return notifications.map(notification => ({
      id: notification.id,
      notification_id: notification.id,
      phone: notification.phone,
      content: notification.communication_templates.content,
      template_id: notification.template_id,
      priority: notification.priority,
      scheduled_at: new Date(notification.scheduled_at),
      retry_count: notification.retry_count
    }));
  }

  /**
   * Process a batch of notifications
   */
  private async processBatch(batch: NotificationJob[], jobId: string): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      startTime: new Date(),
      errors: []
    };

    for (const job of batch) {
      try {
        stats.processed++;

        // Check if notification should be skipped
        if (await this.shouldSkipNotification(job)) {
          stats.skipped++;
          await this.markNotificationSkipped(job.notification_id, 'quiet_hours_or_preferences');
          continue;
        }

        // Render notification content
        const renderedContent = await this.renderNotificationContent(job);
        
        // Send SMS
        const smsResult = await this.smsProvider.sendSMS({
          phone: job.phone,
          message: renderedContent,
          priority: job.priority
        });

        if (smsResult.success) {
          stats.sent++;
          await this.markNotificationSent(job.notification_id, smsResult.messageId);
          
          // Log successful delivery
          await this.logNotification(job.notification_id, 'sent', {
            sms_id: smsResult.messageId,
            content_length: renderedContent.length,
            job_id: jobId
          });
        } else {
          stats.failed++;
          await this.handleNotificationFailure(job, smsResult.error);
        }

      } catch (error) {
        stats.failed++;
        stats.errors.push(`Notification ${job.notification_id}: ${error.message}`);
        await this.handleNotificationFailure(job, error.message);
      }
    }

    return stats;
  }

  /**
   * Check if notification should be skipped
   */
  private async shouldSkipNotification(job: NotificationJob): Promise<boolean> {
    // Skip low priority notifications during quiet hours
    if (this.isQuietHours() && job.priority === 'low') {
      return true;
    }

    // Check user communication preferences
    const { data: preferences } = await supabase
      .from('communication_preferences')
      .select('sms_enabled, quiet_hours_start, quiet_hours_end')
      .eq('phone', job.phone)
      .single();

    if (preferences && !preferences.sms_enabled) {
      return true;
    }

    // Check user-specific quiet hours
    if (preferences?.quiet_hours_start && preferences?.quiet_hours_end) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (this.isTimeInRange(currentTime, preferences.quiet_hours_start, preferences.quiet_hours_end)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Render notification content with variables
   */
  private async renderNotificationContent(job: NotificationJob): Promise<string> {
    // Get notification variables
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('variables')
      .eq('id', job.notification_id)
      .single();

    const variables = notification?.variables || {};

    // Render template with variables
    return await this.templateRenderer.render(job.content, variables);
  }

  /**
   * Mark notification as sent
   */
  private async markNotificationSent(notificationId: string, messageId: string): Promise<void> {
    await supabase
      .from('communication_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        external_id: messageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId);
  }

  /**
   * Mark notification as skipped
   */
  private async markNotificationSkipped(notificationId: string, reason: string): Promise<void> {
    await supabase
      .from('communication_notifications')
      .update({
        status: 'skipped',
        error_message: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId);
  }

  /**
   * Handle notification failure
   */
  private async handleNotificationFailure(job: NotificationJob, error: string): Promise<void> {
    const retryCount = job.retry_count + 1;
    
    if (retryCount >= this.config.maxRetries) {
      // Mark as failed after max retries
      await supabase
        .from('communication_notifications')
        .update({
          status: 'failed',
          error_message: error,
          retry_count: retryCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.notification_id);
        
      // Log failure
      await this.logNotification(job.notification_id, 'failed', {
        error,
        retry_count: retryCount,
        max_retries_exceeded: true
      });
    } else {
      // Schedule retry
      const retryAt = this.calculateRetryTime(retryCount);
      
      await supabase
        .from('communication_notifications')
        .update({
          status: 'pending',
          error_message: error,
          retry_count: retryCount,
          scheduled_at: retryAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', job.notification_id);

      // Create retry schedule entry
      await supabase
        .from('communication_retry_schedules')
        .insert({
          notification_id: job.notification_id,
          attempt_number: retryCount,
          scheduled_at: retryAt.toISOString(),
          reason: error,
          retry_type: 'automatic'
        });

      // Log retry scheduling
      await this.logNotification(job.notification_id, 'retry_scheduled', {
        error,
        retry_count: retryCount,
        retry_at: retryAt.toISOString()
      });
    }
  }

  /**
   * Calculate retry time with exponential backoff
   */
  private calculateRetryTime(retryCount: number): Date {
    const baseDelayMs = 60000; // 1 minute
    const delayMs = baseDelayMs * Math.pow(2, retryCount - 1); // Exponential backoff
    return new Date(Date.now() + delayMs);
  }

  /**
   * Check if current time is in quiet hours
   */
  private isQuietHours(): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return this.isTimeInRange(currentTime, this.config.quietHoursStart, this.config.quietHoursEnd);
  }

  /**
   * Check if time is within a range (handles overnight ranges)
   */
  private isTimeInRange(time: string, start: string, end: string): boolean {
    if (start <= end) {
      // Same day range
      return time >= start && time <= end;
    } else {
      // Overnight range
      return time >= start || time <= end;
    }
  }

  /**
   * Log notification processing event
   */
  private async logNotification(notificationId: string, logType: string, metadata: any): Promise<void> {
    try {
      await supabase
        .from('communication_logs')
        .insert({
          notification_id: notificationId,
          log_type: logType,
          channel: 'sms',
          content: JSON.stringify(metadata),
          metadata: {
            job_id: this.jobId,
            processor: 'notification-processor-job',
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to log notification event:', error);
    }
  }

  /**
   * Log processing statistics
   */
  private async logProcessingStats(stats: ProcessingStats): Promise<void> {
    try {
      await supabase
        .from('communication_logs')
        .insert({
          log_type: 'batch_processing_complete',
          channel: 'system',
          content: JSON.stringify({
            job_id: this.jobId,
            processed: stats.processed,
            sent: stats.sent,
            failed: stats.failed,
            skipped: stats.skipped,
            duration_ms: stats.endTime ? stats.endTime.getTime() - stats.startTime.getTime() : null,
            errors: stats.errors
          }),
          metadata: {
            batch_size: this.config.batchSize,
            quiet_hours: this.isQuietHours(),
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to log processing stats:', error);
    }
  }

  /**
   * Log error
   */
  private async logError(errorType: string, error: any): Promise<void> {
    try {
      await supabase
        .from('communication_logs')
        .insert({
          log_type: errorType,
          channel: 'system',
          content: JSON.stringify({
            error: error.message || error,
            stack: error.stack,
            job_id: this.jobId
          }),
          metadata: {
            processor: 'notification-processor-job',
            timestamp: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Get job status information
   */
  public getStatus(): any {
    return {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      schedule: this.config.schedule,
      lastProcessedAt: this.lastProcessedAt,
      config: this.config,
      isQuietHours: this.isQuietHours()
    };
  }
}

// Create and export the job instance
export const notificationProcessorJob = new NotificationProcessorJob();

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
  notificationProcessorJob.start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping notification processor job...');
  notificationProcessorJob.stop();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping notification processor job...');
  notificationProcessorJob.stop();
});