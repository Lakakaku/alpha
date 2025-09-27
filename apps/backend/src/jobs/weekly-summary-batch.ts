import * as cron from 'node-cron';
import { supabase } from '@vocilia/database';
import { 
  CommunicationNotifications,
  CommunicationTemplates,
  CommunicationLogs
} from '@vocilia/database';
import { SMSProvider } from '../services/communication/sms-provider';
import { TemplateRenderer } from '../services/communication/template-renderer';
import { NotificationProcessor } from '../services/communication/notification-processor';

// Job configuration
interface WeeklySummaryConfig {
  enabled: boolean;
  schedule: string;
  batchSize: number;
  processingTimeoutMs: number;
  summaryDays: number; // Number of days to include in summary
  minTransactionsForSummary: number;
}

interface WeeklySummaryStats {
  customersProcessed: number;
  summariesSent: number;
  summariesSkipped: number;
  summariesFailed: number;
  totalRewards: number;
  totalTransactions: number;
  startTime: Date;
  endTime?: Date;
  errors: string[];
}

interface CustomerSummary {
  phone: string;
  customer_id: string;
  customer_name?: string;
  total_rewards: number;
  total_transactions: number;
  stores_visited: number;
  weekly_period: string;
  language: string;
  rewards_breakdown: {
    store_name: string;
    store_id: string;
    transaction_count: number;
    total_reward: number;
    avg_quality_score: number;
  }[];
  top_store: {
    name: string;
    reward_amount: number;
    visit_count: number;
  };
}

class WeeklySummaryBatchJob {
  private config: WeeklySummaryConfig;
  private isRunning: boolean = false;
  private jobId: string | null = null;
  private smsProvider: SMSProvider;
  private templateRenderer: TemplateRenderer;
  private notificationProcessor: NotificationProcessor;
  private lastProcessedAt: Date;

  constructor() {
    this.config = {
      enabled: process.env.WEEKLY_SUMMARY_ENABLED === 'true',
      schedule: process.env.WEEKLY_SUMMARY_SCHEDULE || '0 9 * * 0', // Sundays at 9:00 AM
      batchSize: parseInt(process.env.WEEKLY_SUMMARY_BATCH_SIZE || '100'),
      processingTimeoutMs: parseInt(process.env.WEEKLY_SUMMARY_TIMEOUT_MS || '1800000'), // 30 minutes
      summaryDays: parseInt(process.env.WEEKLY_SUMMARY_DAYS || '7'), // Last 7 days
      minTransactionsForSummary: parseInt(process.env.MIN_TRANSACTIONS_FOR_SUMMARY || '1')
    };

    this.smsProvider = new SMSProvider();
    this.templateRenderer = new TemplateRenderer();
    this.notificationProcessor = new NotificationProcessor();
    this.lastProcessedAt = new Date();
  }

  /**
   * Start the weekly summary batch job
   */
  public start(): void {
    if (!this.config.enabled) {
      console.log('Weekly summary batch job is disabled');
      return;
    }

    console.log(`Starting weekly summary batch job with schedule: ${this.config.schedule}`);

    cron.schedule(this.config.schedule, async () => {
      if (this.isRunning) {
        console.log('Weekly summary batch job already running, skipping...');
        return;
      }

      try {
        await this.processWeeklySummaries();
      } catch (error) {
        console.error('Weekly summary batch job error:', error);
        await this.logError('weekly_summary_job_error', error);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Stockholm'
    });

    console.log('Weekly summary batch job started successfully');
  }

  /**
   * Stop the weekly summary batch job
   */
  public stop(): void {
    console.log('Stopping weekly summary batch job...');
    cron.destroy();
  }

  /**
   * Process weekly summaries for all eligible customers
   */
  private async processWeeklySummaries(): Promise<void> {
    this.isRunning = true;
    this.jobId = `weekly_summary_${Date.now()}`;
    
    const stats: WeeklySummaryStats = {
      customersProcessed: 0,
      summariesSent: 0,
      summariesSkipped: 0,
      summariesFailed: 0,
      totalRewards: 0,
      totalTransactions: 0,
      startTime: new Date(),
      errors: []
    };

    try {
      console.log(`[${this.jobId}] Starting weekly summary batch processing`);

      // Calculate date range for weekly summary
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (this.config.summaryDays * 24 * 60 * 60 * 1000));
      const weeklyPeriod = `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;

      console.log(`[${this.jobId}] Processing summaries for period: ${weeklyPeriod}`);

      // Get customer summaries
      const customerSummaries = await this.getCustomerSummaries(startDate, endDate);
      
      if (customerSummaries.length === 0) {
        console.log(`[${this.jobId}] No customers eligible for weekly summary`);
        return;
      }

      console.log(`[${this.jobId}] Processing ${customerSummaries.length} customer summaries`);

      // Process summaries in batches
      for (let i = 0; i < customerSummaries.length; i += this.config.batchSize) {
        const batch = customerSummaries.slice(i, i + this.config.batchSize);
        const batchStats = await this.processSummaryBatch(batch, weeklyPeriod);
        
        stats.customersProcessed += batchStats.customersProcessed;
        stats.summariesSent += batchStats.summariesSent;
        stats.summariesSkipped += batchStats.summariesSkipped;
        stats.summariesFailed += batchStats.summariesFailed;
        stats.totalRewards += batchStats.totalRewards;
        stats.totalTransactions += batchStats.totalTransactions;
        stats.errors.push(...batchStats.errors);
      }

      stats.endTime = new Date();
      
      console.log(`[${this.jobId}] Weekly summary batch complete:`, {
        customersProcessed: stats.customersProcessed,
        summariesSent: stats.summariesSent,
        summariesSkipped: stats.summariesSkipped,
        summariesFailed: stats.summariesFailed,
        totalRewards: stats.totalRewards,
        totalTransactions: stats.totalTransactions,
        duration: stats.endTime.getTime() - stats.startTime.getTime()
      });

      // Log batch completion stats
      await this.logBatchStats(stats, weeklyPeriod);

    } catch (error) {
      console.error(`[${this.jobId}] Weekly summary batch error:`, error);
      stats.errors.push(error.message);
      await this.logError('weekly_summary_batch_error', error);
    } finally {
      this.isRunning = false;
      this.lastProcessedAt = new Date();
    }
  }

  /**
   * Get customer summaries for the specified date range
   */
  private async getCustomerSummaries(startDate: Date, endDate: Date): Promise<CustomerSummary[]> {
    // Query to get customer transaction summaries
    const { data: summaryData, error } = await supabase
      .rpc('get_weekly_customer_summaries', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        min_transactions: this.config.minTransactionsForSummary
      });

    if (error) {
      throw new Error(`Failed to get customer summaries: ${error.message}`);
    }

    if (!summaryData || summaryData.length === 0) {
      return [];
    }

    // Transform database response to CustomerSummary format
    const summaries: CustomerSummary[] = [];
    
    for (const data of summaryData) {
      // Get customer preferences for language and SMS settings
      const { data: preferences } = await supabase
        .from('communication_preferences')
        .select('language, sms_enabled, frequency')
        .eq('phone', data.phone)
        .single();

      // Skip if SMS disabled or weekly frequency not selected
      if (preferences && (!preferences.sms_enabled || preferences.frequency === 'immediate')) {
        continue;
      }

      // Get store breakdown for this customer
      const { data: storeBreakdown } = await supabase
        .rpc('get_customer_store_breakdown', {
          customer_phone: data.phone,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        });

      const summary: CustomerSummary = {
        phone: data.phone,
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        total_rewards: parseFloat(data.total_rewards || '0'),
        total_transactions: parseInt(data.total_transactions || '0'),
        stores_visited: parseInt(data.stores_visited || '0'),
        weekly_period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        language: preferences?.language || 'sv',
        rewards_breakdown: storeBreakdown || [],
        top_store: this.findTopStore(storeBreakdown || [])
      };

      summaries.push(summary);
    }

    return summaries;
  }

  /**
   * Find the top store by reward amount
   */
  private findTopStore(breakdown: any[]): { name: string; reward_amount: number; visit_count: number } {
    if (!breakdown || breakdown.length === 0) {
      return { name: 'N/A', reward_amount: 0, visit_count: 0 };
    }

    const topStore = breakdown.reduce((max, store) => 
      (store.total_reward > max.total_reward) ? store : max
    );

    return {
      name: topStore.store_name,
      reward_amount: parseFloat(topStore.total_reward || '0'),
      visit_count: parseInt(topStore.transaction_count || '0')
    };
  }

  /**
   * Process a batch of customer summaries
   */
  private async processSummaryBatch(batch: CustomerSummary[], weeklyPeriod: string): Promise<WeeklySummaryStats> {
    const stats: WeeklySummaryStats = {
      customersProcessed: 0,
      summariesSent: 0,
      summariesSkipped: 0,
      summariesFailed: 0,
      totalRewards: 0,
      totalTransactions: 0,
      startTime: new Date(),
      errors: []
    };

    for (const summary of batch) {
      try {
        stats.customersProcessed++;
        stats.totalRewards += summary.total_rewards;
        stats.totalTransactions += summary.total_transactions;

        // Check if customer should receive summary
        if (await this.shouldSkipSummary(summary)) {
          stats.summariesSkipped++;
          continue;
        }

        // Get appropriate template
        const template = await this.getWeeklySummaryTemplate(summary.language);
        if (!template) {
          stats.summariesSkipped++;
          await this.logSummary(summary.customer_id, 'template_not_found', {
            language: summary.language,
            reason: 'No weekly summary template found'
          });
          continue;
        }

        // Render summary content
        const content = await this.renderSummaryContent(template, summary);

        // Send SMS summary
        const smsResult = await this.smsProvider.sendSMS({
          phone: summary.phone,
          message: content,
          priority: 'normal',
          metadata: {
            type: 'weekly_summary',
            weekly_period: weeklyPeriod,
            customer_id: summary.customer_id
          }
        });

        if (smsResult.success) {
          stats.summariesSent++;
          
          // Create notification record
          await this.createSummaryNotification(summary, template.id, smsResult.messageId, content);
          
          // Log successful summary
          await this.logSummary(summary.customer_id, 'summary_sent', {
            sms_id: smsResult.messageId,
            content_length: content.length,
            total_rewards: summary.total_rewards,
            total_transactions: summary.total_transactions,
            stores_visited: summary.stores_visited
          });
        } else {
          stats.summariesFailed++;
          await this.logSummary(summary.customer_id, 'summary_failed', {
            error: smsResult.error,
            phone: summary.phone
          });
        }

      } catch (error) {
        stats.summariesFailed++;
        stats.errors.push(`Customer ${summary.customer_id}: ${error.message}`);
        await this.logSummary(summary.customer_id, 'summary_error', {
          error: error.message,
          phone: summary.phone
        });
      }
    }

    return stats;
  }

  /**
   * Check if summary should be skipped for customer
   */
  private async shouldSkipSummary(summary: CustomerSummary): Promise<boolean> {
    // Skip if no transactions
    if (summary.total_transactions < this.config.minTransactionsForSummary) {
      return true;
    }

    // Skip if no rewards earned
    if (summary.total_rewards <= 0) {
      return true;
    }

    // Check if customer already received summary this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week
    weekStart.setHours(0, 0, 0, 0);

    const { data: existingSummary } = await supabase
      .from('communication_notifications')
      .select('id')
      .eq('phone', summary.phone)
      .eq('notification_type', 'weekly_summary')
      .gte('created_at', weekStart.toISOString())
      .single();

    if (existingSummary) {
      return true; // Already sent this week
    }

    return false;
  }

  /**
   * Get weekly summary template
   */
  private async getWeeklySummaryTemplate(language: string): Promise<any> {
    const { data: template, error } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('notification_type', 'weekly_summary')
      .eq('language', language)
      .eq('channel', 'sms')
      .eq('is_active', true)
      .single();

    if (error || !template) {
      // Fallback to Swedish if language-specific template not found
      if (language !== 'sv') {
        return await this.getWeeklySummaryTemplate('sv');
      }
      return null;
    }

    return template;
  }

  /**
   * Render summary content with customer data
   */
  private async renderSummaryContent(template: any, summary: CustomerSummary): Promise<string> {
    const variables = {
      customer_name: summary.customer_name || 'Kund',
      total_rewards: summary.total_rewards.toFixed(2),
      total_transactions: summary.total_transactions,
      stores_visited: summary.stores_visited,
      weekly_period: summary.weekly_period,
      top_store_name: summary.top_store.name,
      top_store_reward: summary.top_store.reward_amount.toFixed(2),
      top_store_visits: summary.top_store.visit_count,
      currency: 'SEK',
      week_start: summary.weekly_period.split(' to ')[0],
      week_end: summary.weekly_period.split(' to ')[1]
    };

    return await this.templateRenderer.render(template.content, variables);
  }

  /**
   * Create notification record for summary
   */
  private async createSummaryNotification(
    summary: CustomerSummary, 
    templateId: string, 
    messageId: string, 
    content: string
  ): Promise<void> {
    await supabase
      .from('communication_notifications')
      .insert({
        phone: summary.phone,
        recipient_type: 'customer',
        recipient_id: summary.customer_id,
        notification_type: 'weekly_summary',
        channel: 'sms',
        template_id: templateId,
        status: 'sent',
        external_id: messageId,
        variables: {
          total_rewards: summary.total_rewards,
          total_transactions: summary.total_transactions,
          stores_visited: summary.stores_visited,
          weekly_period: summary.weekly_period,
          top_store: summary.top_store
        },
        content: content,
        sent_at: new Date().toISOString(),
        scheduled_at: new Date().toISOString()
      });
  }

  /**
   * Log summary processing event
   */
  private async logSummary(customerId: string, logType: string, metadata: any): Promise<void> {
    try {
      await supabase
        .from('communication_logs')
        .insert({
          log_type: logType,
          channel: 'sms',
          content: JSON.stringify({
            customer_id: customerId,
            ...metadata
          }),
          metadata: {
            job_id: this.jobId,
            processor: 'weekly-summary-batch-job',
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to log summary event:', error);
    }
  }

  /**
   * Log batch processing statistics
   */
  private async logBatchStats(stats: WeeklySummaryStats, weeklyPeriod: string): Promise<void> {
    try {
      await supabase
        .from('communication_logs')
        .insert({
          log_type: 'weekly_summary_batch_complete',
          channel: 'system',
          content: JSON.stringify({
            job_id: this.jobId,
            weekly_period: weeklyPeriod,
            customers_processed: stats.customersProcessed,
            summaries_sent: stats.summariesSent,
            summaries_skipped: stats.summariesSkipped,
            summaries_failed: stats.summariesFailed,
            total_rewards: stats.totalRewards,
            total_transactions: stats.totalTransactions,
            duration_ms: stats.endTime ? stats.endTime.getTime() - stats.startTime.getTime() : null,
            errors: stats.errors
          }),
          metadata: {
            batch_size: this.config.batchSize,
            summary_days: this.config.summaryDays,
            min_transactions: this.config.minTransactionsForSummary,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to log batch stats:', error);
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
            processor: 'weekly-summary-batch-job',
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
      nextRun: this.getNextRunTime()
    };
  }

  /**
   * Calculate next Sunday 9 AM run time
   */
  private getNextRunTime(): Date {
    const now = new Date();
    const nextSunday = new Date(now);
    
    // Calculate days until next Sunday
    const daysUntilSunday = (7 - now.getDay()) % 7;
    if (daysUntilSunday === 0 && now.getHours() >= 9) {
      // If it's Sunday and past 9 AM, schedule for next Sunday
      nextSunday.setDate(now.getDate() + 7);
    } else {
      nextSunday.setDate(now.getDate() + daysUntilSunday);
    }
    
    nextSunday.setHours(9, 0, 0, 0);
    return nextSunday;
  }

  /**
   * Manual trigger for weekly summary batch
   */
  public async triggerManualBatch(daysBack: number = 7): Promise<boolean> {
    if (this.isRunning) {
      console.log('Weekly summary batch already running');
      return false;
    }

    try {
      console.log(`Manually triggering weekly summary batch for last ${daysBack} days`);
      
      // Temporarily override config for manual run
      const originalDays = this.config.summaryDays;
      this.config.summaryDays = daysBack;
      
      await this.processWeeklySummaries();
      
      // Restore original config
      this.config.summaryDays = originalDays;
      
      return true;
    } catch (error) {
      console.error('Failed to trigger manual weekly summary batch:', error);
      return false;
    }
  }
}

// Create and export the job instance
export const weeklySummaryBatchJob = new WeeklySummaryBatchJob();

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
  weeklySummaryBatchJob.start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping weekly summary batch job...');
  weeklySummaryBatchJob.stop();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping weekly summary batch job...');
  weeklySummaryBatchJob.stop();
});