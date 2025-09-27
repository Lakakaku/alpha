import Handlebars from 'handlebars';
import type { 
  CommunicationNotification,
  CommunicationTemplate,
  NotificationStatus,
  SMSMessage,
  NotificationType,
  RecipientType
} from '@vocilia/types';
import { 
  CommunicationNotificationModel,
  CommunicationTemplateModel,
  CommunicationRetryScheduleModel,
  CommunicationLogModel 
} from '@vocilia/database';
import { SMSProviderService } from './sms-provider.js';

export class NotificationProcessorService {
  private smsProvider: SMSProviderService;
  private templateCache: Map<string, CompiledTemplate> = new Map();

  constructor() {
    this.smsProvider = new SMSProviderService();
    this.registerHandlebarsHelpers();
  }

  /**
   * Process pending notifications in batch
   */
  async processPendingNotifications(): Promise<void> {
    try {
      console.log('Starting notification processing batch...');
      
      // Get pending notifications
      const pendingNotifications = await CommunicationNotificationModel.getPendingNotifications(
        parseInt(process.env.NOTIFICATION_BATCH_SIZE || '50')
      );

      if (pendingNotifications.length === 0) {
        console.log('No pending notifications to process');
        return;
      }

      console.log(`Processing ${pendingNotifications.length} notifications`);

      // Process in parallel batches to respect rate limits
      const batchSize = 10;
      for (let i = 0; i < pendingNotifications.length; i += batchSize) {
        const batch = pendingNotifications.slice(i, i + batchSize);
        await Promise.all(batch.map(notification => this.processNotification(notification)));
        
        // Brief pause between batches
        if (i + batchSize < pendingNotifications.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('Notification processing batch completed');

    } catch (error) {
      console.error('Notification processing failed:', error);
      throw error;
    }
  }

  /**
   * Process a single notification
   */
  async processNotification(notification: CommunicationNotification): Promise<void> {
    try {
      // Check if we're in quiet hours for non-urgent notifications
      if (this.smsProvider.isQuietHours() && !this.isUrgentNotification(notification.notification_type)) {
        await this.scheduleForLater(notification);
        return;
      }

      // Update status to sending
      await CommunicationNotificationModel.updateStatus(notification.id, 'sent');

      // Get and render template
      const template = await this.getTemplate(
        notification.notification_type, 
        notification.channel,
        notification.language || 'sv'
      );

      const renderedContent = await this.renderTemplate(template, notification.template_data || {});

      // Send notification based on channel
      let deliveryResult;
      switch (notification.channel) {
        case 'sms':
          deliveryResult = await this.sendSMS(notification, renderedContent);
          break;
        case 'email':
          // Email delivery would be implemented here
          throw new Error('Email delivery not yet implemented');
        default:
          throw new Error(`Unsupported channel: ${notification.channel}`);
      }

      // Update status based on delivery result
      const finalStatus: NotificationStatus = deliveryResult.success ? 'delivered' : 'failed';
      await CommunicationNotificationModel.updateStatus(notification.id, finalStatus);

      // Log the delivery attempt
      await CommunicationLogModel.create({
        notification_id: notification.id,
        channel: notification.channel,
        recipient_phone: notification.recipient_phone,
        content: renderedContent,
        status: finalStatus,
        provider_response: JSON.stringify(deliveryResult),
        cost_amount: deliveryResult.cost || 0,
        segments_count: deliveryResult.segments || 1
      });

      // Schedule retry if failed and retries available
      if (!deliveryResult.success && notification.retry_count < 3) {
        await this.scheduleRetry(notification, deliveryResult.error);
      }

    } catch (error) {
      console.error(`Failed to process notification ${notification.id}:`, error);
      
      // Mark as failed and schedule retry if possible
      await CommunicationNotificationModel.updateStatus(notification.id, 'failed');
      
      if (notification.retry_count < 3) {
        await this.scheduleRetry(notification, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(notification: CommunicationNotification, content: string): Promise<any> {
    if (!notification.recipient_phone) {
      throw new Error('No recipient phone number provided');
    }

    const smsMessage: SMSMessage = {
      to: this.smsProvider.normalizePhoneNumber(notification.recipient_phone),
      body: content,
      notificationId: notification.id
    };

    return await this.smsProvider.sendSMS(smsMessage);
  }

  /**
   * Get template by type, channel and language
   */
  private async getTemplate(
    type: NotificationType, 
    channel: string, 
    language: string
  ): Promise<CommunicationTemplate> {
    const cacheKey = `${type}-${channel}-${language}`;
    
    if (this.templateCache.has(cacheKey)) {
      const cached = this.templateCache.get(cacheKey)!;
      return cached.template;
    }

    const template = await CommunicationTemplateModel.getByTypeAndChannel(type, channel, language);
    if (!template) {
      throw new Error(`No template found for ${type} ${channel} ${language}`);
    }

    // Compile and cache template
    const compiled = Handlebars.compile(template.content);
    this.templateCache.set(cacheKey, { template, compiled });

    return template;
  }

  /**
   * Render template with data
   */
  private async renderTemplate(template: CommunicationTemplate, data: Record<string, any>): Promise<string> {
    const cacheKey = `${template.notification_type}-${template.channel}-${template.language}`;
    let compiled = this.templateCache.get(cacheKey)?.compiled;

    if (!compiled) {
      compiled = Handlebars.compile(template.content);
      this.templateCache.set(cacheKey, { template, compiled });
    }

    // Add common template variables
    const templateData = {
      ...data,
      today: new Date().toLocaleDateString('sv-SE'),
      time: new Date().toLocaleTimeString('sv-SE'),
      company_name: 'Vocilia',
      support_phone: process.env.SUPPORT_PHONE_NUMBER || '+46 8 123 456',
      support_email: process.env.SUPPORT_EMAIL || 'support@vocilia.se'
    };

    return compiled(templateData);
  }

  /**
   * Schedule notification for later (during quiet hours)
   */
  private async scheduleForLater(notification: CommunicationNotification): Promise<void> {
    const nextMorning = new Date();
    nextMorning.setHours(8, 0, 0, 0); // 08:00 next day
    
    if (nextMorning <= new Date()) {
      nextMorning.setDate(nextMorning.getDate() + 1);
    }

    await CommunicationNotificationModel.updateScheduledAt(notification.id, nextMorning.toISOString());
    console.log(`Notification ${notification.id} scheduled for ${nextMorning.toISOString()}`);
  }

  /**
   * Schedule retry for failed notification
   */
  private async scheduleRetry(notification: CommunicationNotification, reason?: string): Promise<void> {
    const nextAttempt = notification.retry_count + 1;
    const nextRetryTime = CommunicationRetryScheduleModel.calculateNextRetryTime(nextAttempt);

    await CommunicationRetryScheduleModel.scheduleRetry(
      notification.id,
      nextAttempt,
      nextRetryTime.toISOString(),
      reason
    );

    await CommunicationNotificationModel.incrementRetryCount(notification.id);
    
    console.log(`Retry ${nextAttempt} scheduled for notification ${notification.id} at ${nextRetryTime.toISOString()}`);
  }

  /**
   * Check if notification type is urgent (can be sent during quiet hours)
   */
  private isUrgentNotification(type: NotificationType): boolean {
    const urgentTypes: NotificationType[] = [
      'fraud_alert',
      'payment_failed',
      'verification_failed',
      'system_maintenance'
    ];
    
    return urgentTypes.includes(type);
  }

  /**
   * Process retry schedules
   */
  async processRetrySchedules(): Promise<void> {
    try {
      const pendingRetries = await CommunicationRetryScheduleModel.getPendingRetries();
      
      console.log(`Processing ${pendingRetries.length} retry schedules`);

      for (const retry of pendingRetries) {
        try {
          // Get the original notification
          const notification = await CommunicationNotificationModel.getById(retry.notification_id);
          if (!notification) {
            await CommunicationRetryScheduleModel.updateStatus(retry.id, 'failed', new Date().toISOString(), 'Notification not found');
            continue;
          }

          // Process the notification
          await this.processNotification(notification);
          
          // Mark retry as completed
          await CommunicationRetryScheduleModel.updateStatus(retry.id, 'completed', new Date().toISOString());

        } catch (error) {
          console.error(`Retry ${retry.id} failed:`, error);
          await CommunicationRetryScheduleModel.updateStatus(
            retry.id, 
            'failed', 
            new Date().toISOString(),
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

    } catch (error) {
      console.error('Retry processing failed:', error);
      throw error;
    }
  }

  /**
   * Register custom Handlebars helpers for templates
   */
  private registerHandlebarsHelpers(): void {
    // Currency formatter
    Handlebars.registerHelper('currency', function(amount: number) {
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK'
      }).format(amount);
    });

    // Date formatter
    Handlebars.registerHelper('date', function(date: string | Date, format?: string) {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (format === 'short') {
        return d.toLocaleDateString('sv-SE');
      }
      return d.toLocaleDateString('sv-SE', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    });

    // Conditional helper
    Handlebars.registerHelper('if_eq', function(a: any, b: any, options: any) {
      return a === b ? options.fn(this) : options.inverse(this);
    });

    // Upper case helper
    Handlebars.registerHelper('upper', function(str: string) {
      return str ? str.toUpperCase() : '';
    });
  }

  /**
   * Clear template cache (useful for development/testing)
   */
  clearTemplateCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(days: number = 7): Promise<{
    processed: number;
    successful: number;
    failed: number;
    pending: number;
    retry_rate: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // This would query actual statistics from the database
    // For now returning mock structure
    return {
      processed: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      retry_rate: 0
    };
  }
}

interface CompiledTemplate {
  template: CommunicationTemplate;
  compiled: HandlebarsTemplateDelegate;
}