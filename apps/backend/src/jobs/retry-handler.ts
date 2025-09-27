import * as cron from 'node-cron';
import { supabase } from '@vocilia/database';
import { 
  CommunicationNotifications,
  CommunicationRetrySchedules,
  CommunicationLogs
} from '@vocilia/database';
import { SMSProvider } from '../services/communication/sms-provider';
import { TemplateRenderer } from '../services/communication/template-renderer';

// Job configuration
interface RetryJobConfig {
  enabled: boolean;
  schedule: string;
  batchSize: number;
  maxRetryAge: number; // Maximum age of retry in hours
  processingTimeoutMs: number;
  maxConcurrentRetries: number;
}

interface RetryStats {
  processed: number;
  successful: number;
  failed: number;
  abandoned: number;
  startTime: Date;
  endTime?: Date;
  errors: string[];
}

interface RetryJob {
  id: string;
  notification_id: string;
  phone: string;
  content: string;
  template_id: string;
  attempt_number: number;
  scheduled_at: Date;
  reason: string;
  retry_type: 'automatic' | 'manual';
  original_error: string;
}

class RetryHandlerJob {
  private config: RetryJobConfig;
  private isRunning: boolean = false;
  private jobId: string | null = null;
  private smsProvider: SMSProvider;
  private templateRenderer: TemplateRenderer;
  private lastProcessedAt: Date;

  constructor() {
    this.config = {
      enabled: process.env.RETRY_HANDLER_ENABLED === 'true',
      schedule: process.env.RETRY_HANDLER_SCHEDULE || '*/2 * * * *', // Every 2 minutes
      batchSize: parseInt(process.env.RETRY_BATCH_SIZE || '25'),
      maxRetryAge: parseInt(process.env.MAX_RETRY_AGE_HOURS || '24'), // 24 hours
      processingTimeoutMs: parseInt(process.env.RETRY_PROCESSING_TIMEOUT_MS || '180000'), // 3 minutes
      maxConcurrentRetries: parseInt(process.env.MAX_CONCURRENT_RETRIES || '10')
    };

    this.smsProvider = new SMSProvider();
    this.templateRenderer = new TemplateRenderer();
    this.lastProcessedAt = new Date();
  }

  /**
   * Start the retry handler cron job
   */
  public start(): void {
    if (!this.config.enabled) {
      console.log('Retry handler job is disabled');
      return;
    }

    console.log(`Starting retry handler job with schedule: ${this.config.schedule}`);

    cron.schedule(this.config.schedule, async () => {
      if (this.isRunning) {
        console.log('Retry handler job already running, skipping...');
        return;
      }

      try {
        await this.processRetries();
      } catch (error) {
        console.error('Retry handler job error:', error);
        await this.logError('retry_job_execution_error', error);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Stockholm'
    });

    console.log('Retry handler job started successfully');
  }

  /**
   * Stop the retry handler job
   */
  public stop(): void {
    console.log('Stopping retry handler job...');
    cron.destroy();
  }

  /**
   * Process pending retries
   */
  private async processRetries(): Promise<void> {
    this.isRunning = true;
    this.jobId = `retry_job_${Date.now()}`;
    
    const stats: RetryStats = {
      processed: 0,
      successful: 0,
      failed: 0,
      abandoned: 0,
      startTime: new Date(),
      errors: []
    };

    try {
      console.log(`[${this.jobId}] Starting retry processing batch`);

      // Get pending retries to process
      const retries = await this.getPendingRetries();
      
      if (retries.length === 0) {
        console.log(`[${this.jobId}] No pending retries to process`);
        return;
      }

      console.log(`[${this.jobId}] Processing ${retries.length} retries`);

      // Clean up old abandoned retries first
      await this.cleanupAbandonedRetries();

      // Process retries in batches
      for (let i = 0; i < retries.length; i += this.config.batchSize) {
        const batch = retries.slice(i, i + this.config.batchSize);
        const batchStats = await this.processBatch(batch, this.jobId);
        
        stats.processed += batchStats.processed;
        stats.successful += batchStats.successful;
        stats.failed += batchStats.failed;
        stats.abandoned += batchStats.abandoned;
        stats.errors.push(...batchStats.errors);
      }

      stats.endTime = new Date();
      
      console.log(`[${this.jobId}] Retry processing complete:`, {
        processed: stats.processed,
        successful: stats.successful,
        failed: stats.failed,
        abandoned: stats.abandoned,
        duration: stats.endTime.getTime() - stats.startTime.getTime()
      });

      // Log processing stats
      await this.logRetryStats(stats);

    } catch (error) {
      console.error(`[${this.jobId}] Retry processing error:`, error);
      stats.errors.push(error.message);
      await this.logError('retry_batch_processing_error', error);
    } finally {
      this.isRunning = false;
      this.lastProcessedAt = new Date();
    }
  }

  /**
   * Get pending retries from database
   */
  private async getPendingRetries(): Promise<RetryJob[]> {
    const maxRetryAge = new Date(Date.now() - (this.config.maxRetryAge * 60 * 60 * 1000));

    const { data: retries, error } = await supabase
      .from('communication_retry_schedules')
      .select(`
        id,
        notification_id,
        attempt_number,
        scheduled_at,
        reason,
        retry_type,
        communication_notifications!inner(
          id,
          phone,
          template_id,
          variables,
          status,
          error_message,
          retry_count,
          communication_templates!inner(
            id,
            content,
            name,
            language
          )
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .gte('created_at', maxRetryAge.toISOString())
      .eq('communication_notifications.status', 'pending')
      .order('scheduled_at', { ascending: true })
      .limit(this.config.batchSize * 2);

    if (error) {
      throw new Error(`Failed to fetch pending retries: ${error.message}`);
    }

    if (!retries || retries.length === 0) {
      return [];
    }

    // Map to retry job format
    return retries.map(retry => ({
      id: retry.id,
      notification_id: retry.notification_id,
      phone: retry.communication_notifications.phone,
      content: retry.communication_notifications.communication_templates.content,
      template_id: retry.communication_notifications.template_id,
      attempt_number: retry.attempt_number,
      scheduled_at: new Date(retry.scheduled_at),
      reason: retry.reason,
      retry_type: retry.retry_type,
      original_error: retry.communication_notifications.error_message || 'Unknown error'
    }));
  }

  /**
   * Process a batch of retries
   */
  private async processBatch(batch: RetryJob[], jobId: string): Promise<RetryStats> {
    const stats: RetryStats = {
      processed: 0,
      successful: 0,
      failed: 0,
      abandoned: 0,
      startTime: new Date(),
      errors: []
    };

    for (const retry of batch) {
      try {
        stats.processed++;

        // Mark retry as processing
        await this.markRetryProcessing(retry.id);

        // Check if notification still exists and is valid for retry
        const isValid = await this.validateRetryEligibility(retry);
        if (!isValid) {
          stats.abandoned++;
          await this.markRetryAbandoned(retry.id, 'notification_no_longer_eligible');
          continue;
        }

        // Render notification content with latest variables
        const renderedContent = await this.renderRetryContent(retry);
        
        // Attempt SMS retry with enhanced error handling
        const smsResult = await this.attemptSMSRetry(retry, renderedContent);

        if (smsResult.success) {
          stats.successful++;
          await this.markRetrySuccessful(retry, smsResult.messageId);
          
          // Update original notification status
          await this.markNotificationSent(retry.notification_id, smsResult.messageId);
          
          // Log successful retry
          await this.logRetry(retry.id, 'retry_successful', {
            sms_id: smsResult.messageId,
            attempt_number: retry.attempt_number,
            content_length: renderedContent.length,
            job_id: jobId,
            original_error: retry.original_error
          });
        } else {
          stats.failed++;
          await this.handleRetryFailure(retry, smsResult.error);
        }

      } catch (error) {
        stats.failed++;
        stats.errors.push(`Retry ${retry.id}: ${error.message}`);
        await this.handleRetryFailure(retry, error.message);
      }
    }

    return stats;
  }

  /**
   * Validate if retry is still eligible
   */
  private async validateRetryEligibility(retry: RetryJob): Promise<boolean> {
    // Check if original notification still exists and is in pending state
    const { data: notification, error } = await supabase
      .from('communication_notifications')
      .select('id, status, retry_count')
      .eq('id', retry.notification_id)
      .single();

    if (error || !notification) {
      return false;
    }

    // Only retry if notification is still pending
    if (notification.status !== 'pending') {
      return false;
    }

    // Check if retry count hasn't exceeded maximum
    const maxRetries = parseInt(process.env.NOTIFICATION_MAX_RETRIES || '3');
    if (notification.retry_count >= maxRetries) {
      return false;
    }

    // Check if user hasn't opted out of SMS
    const { data: preferences } = await supabase
      .from('communication_preferences')
      .select('sms_enabled')
      .eq('phone', retry.phone)
      .single();

    if (preferences && !preferences.sms_enabled) {
      return false;
    }

    return true;
  }

  /**
   * Render retry content with latest variables
   */
  private async renderRetryContent(retry: RetryJob): Promise<string> {
    // Get latest notification variables (they might have been updated)
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('variables')
      .eq('id', retry.notification_id)
      .single();

    const variables = notification?.variables || {};

    // Render template with variables
    return await this.templateRenderer.render(retry.content, variables);
  }

  /**
   * Attempt SMS retry with enhanced error handling
   */
  private async attemptSMSRetry(retry: RetryJob, content: string): Promise<any> {
    try {
      // Add retry context to SMS metadata
      const smsResult = await this.smsProvider.sendSMS({
        phone: retry.phone,
        message: content,
        priority: 'normal',
        metadata: {
          is_retry: true,
          attempt_number: retry.attempt_number,
          original_error: retry.original_error,
          retry_id: retry.id
        }
      });

      return smsResult;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark retry as processing
   */
  private async markRetryProcessing(retryId: string): Promise<void> {
    await supabase
      .from('communication_retry_schedules')
      .update({
        status: 'processing',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', retryId);
  }

  /**
   * Mark retry as successful
   */
  private async markRetrySuccessful(retry: RetryJob, messageId: string): Promise<void> {
    await supabase
      .from('communication_retry_schedules')
      .update({
        status: 'successful',
        completed_at: new Date().toISOString(),
        external_id: messageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', retry.id);
  }

  /**
   * Mark retry as abandoned
   */
  private async markRetryAbandoned(retryId: string, reason: string): Promise<void> {
    await supabase
      .from('communication_retry_schedules')
      .update({
        status: 'abandoned',
        completed_at: new Date().toISOString(),
        failure_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', retryId);
  }

  /**
   * Mark original notification as sent
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
   * Handle retry failure
   */
  private async handleRetryFailure(retry: RetryJob, error: string): Promise<void> {
    const maxRetries = parseInt(process.env.NOTIFICATION_MAX_RETRIES || '3');
    
    // Mark current retry as failed
    await supabase
      .from('communication_retry_schedules')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        failure_reason: error,
        updated_at: new Date().toISOString()
      })
      .eq('id', retry.id);

    // Check if we should schedule another retry
    if (retry.attempt_number < maxRetries) {
      const nextRetryAt = this.calculateNextRetryTime(retry.attempt_number + 1);
      
      // Create next retry schedule
      await supabase
        .from('communication_retry_schedules')
        .insert({
          notification_id: retry.notification_id,
          attempt_number: retry.attempt_number + 1,
          scheduled_at: nextRetryAt.toISOString(),
          reason: `Previous retry failed: ${error}`,
          retry_type: 'automatic'
        });

      // Update notification retry count
      await supabase
        .from('communication_notifications')
        .update({
          retry_count: retry.attempt_number + 1,
          error_message: error,
          updated_at: new Date().toISOString()
        })
        .eq('id', retry.notification_id);

      // Log retry rescheduling
      await this.logRetry(retry.id, 'retry_rescheduled', {
        error,
        attempt_number: retry.attempt_number,
        next_attempt: retry.attempt_number + 1,
        next_retry_at: nextRetryAt.toISOString()
      });
    } else {
      // Mark original notification as permanently failed
      await supabase
        .from('communication_notifications')
        .update({
          status: 'failed',
          error_message: `Max retries exceeded. Last error: ${error}`,
          retry_count: retry.attempt_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', retry.notification_id);

      // Log permanent failure
      await this.logRetry(retry.id, 'retry_permanently_failed', {
        error,
        attempt_number: retry.attempt_number,
        max_retries: maxRetries
      });
    }
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetryTime(attemptNumber: number): Date {
    const baseDelayMs = 300000; // 5 minutes
    const delayMs = baseDelayMs * Math.pow(2, attemptNumber - 1); // Exponential backoff
    const maxDelayMs = 3600000; // 1 hour maximum
    
    return new Date(Date.now() + Math.min(delayMs, maxDelayMs));
  }

  /**
   * Clean up old abandoned retries
   */
  private async cleanupAbandonedRetries(): Promise<void> {
    const cutoffDate = new Date(Date.now() - (this.config.maxRetryAge * 60 * 60 * 1000));

    try {
      // Mark old pending retries as abandoned
      const { data: oldRetries, error } = await supabase
        .from('communication_retry_schedules')
        .update({
          status: 'abandoned',
          completed_at: new Date().toISOString(),
          failure_reason: 'Retry too old, automatically abandoned',
          updated_at: new Date().toISOString()
        })
        .eq('status', 'pending')
        .lt('created_at', cutoffDate.toISOString())
        .select('id, notification_id');

      if (oldRetries && oldRetries.length > 0) {
        console.log(`[${this.jobId}] Cleaned up ${oldRetries.length} abandoned retries`);
        
        // Log cleanup
        await this.logRetry('cleanup', 'abandoned_retries_cleaned', {
          count: oldRetries.length,
          cutoff_date: cutoffDate.toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to cleanup abandoned retries:', error);
    }
  }

  /**
   * Log retry processing event
   */
  private async logRetry(retryId: string, logType: string, metadata: any): Promise<void> {
    try {
      await supabase
        .from('communication_logs')
        .insert({
          retry_schedule_id: retryId === 'cleanup' ? null : retryId,
          log_type: logType,
          channel: 'sms',
          content: JSON.stringify(metadata),
          metadata: {
            job_id: this.jobId,
            processor: 'retry-handler-job',
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to log retry event:', error);
    }
  }

  /**
   * Log retry processing statistics
   */
  private async logRetryStats(stats: RetryStats): Promise<void> {
    try {
      await supabase
        .from('communication_logs')
        .insert({
          log_type: 'retry_batch_processing_complete',
          channel: 'system',
          content: JSON.stringify({
            job_id: this.jobId,
            processed: stats.processed,
            successful: stats.successful,
            failed: stats.failed,
            abandoned: stats.abandoned,
            duration_ms: stats.endTime ? stats.endTime.getTime() - stats.startTime.getTime() : null,
            errors: stats.errors
          }),
          metadata: {
            batch_size: this.config.batchSize,
            max_retry_age_hours: this.config.maxRetryAge,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to log retry stats:', error);
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
            processor: 'retry-handler-job',
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
      config: this.config
    };
  }

  /**
   * Manual retry trigger for specific notification
   */
  public async triggerManualRetry(notificationId: string, reason: string = 'Manual retry triggered'): Promise<boolean> {
    try {
      // Check if notification exists and is eligible for retry
      const { data: notification, error } = await supabase
        .from('communication_notifications')
        .select('id, status, retry_count, phone')
        .eq('id', notificationId)
        .single();

      if (error || !notification) {
        throw new Error('Notification not found');
      }

      if (notification.status !== 'pending' && notification.status !== 'failed') {
        throw new Error('Notification is not eligible for retry');
      }

      const maxRetries = parseInt(process.env.NOTIFICATION_MAX_RETRIES || '3');
      if (notification.retry_count >= maxRetries) {
        throw new Error('Maximum retry attempts exceeded');
      }

      // Create manual retry schedule
      await supabase
        .from('communication_retry_schedules')
        .insert({
          notification_id: notificationId,
          attempt_number: notification.retry_count + 1,
          scheduled_at: new Date().toISOString(), // Immediate
          reason,
          retry_type: 'manual'
        });

      // Reset notification to pending if it was failed
      if (notification.status === 'failed') {
        await supabase
          .from('communication_notifications')
          .update({
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', notificationId);
      }

      return true;
    } catch (error) {
      console.error('Failed to trigger manual retry:', error);
      return false;
    }
  }
}

// Create and export the job instance
export const retryHandlerJob = new RetryHandlerJob();

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
  retryHandlerJob.start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping retry handler job...');
  retryHandlerJob.stop();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping retry handler job...');
  retryHandlerJob.stop();
});