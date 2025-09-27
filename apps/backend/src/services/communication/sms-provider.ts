import twilio from 'twilio';
import type { 
  SMSDeliveryResult, 
  SMSMessage, 
  SMSWebhookPayload,
  NotificationStatus 
} from '@vocilia/types';
import { CommunicationNotificationModel } from '@vocilia/database';

export class SMSProviderService {
  private twilioClient: twilio.Twilio;
  private fromNumber: string;
  private webhookUrl: string;

  constructor() {
    if (!process.env.TWILIO_SMS_ACCOUNT_SID || !process.env.TWILIO_SMS_AUTH_TOKEN) {
      throw new Error('Twilio SMS credentials not configured');
    }

    this.twilioClient = twilio(
      process.env.TWILIO_SMS_ACCOUNT_SID,
      process.env.TWILIO_SMS_AUTH_TOKEN
    );

    this.fromNumber = process.env.TWILIO_SMS_PHONE_NUMBER || '';
    this.webhookUrl = process.env.TWILIO_SMS_WEBHOOK_URL || '';

    if (!this.fromNumber) {
      throw new Error('Twilio SMS phone number not configured');
    }
  }

  /**
   * Send SMS message via Twilio
   */
  async sendSMS(message: SMSMessage): Promise<SMSDeliveryResult> {
    try {
      // Validate phone number format
      if (!this.isValidPhoneNumber(message.to)) {
        throw new Error(`Invalid phone number format: ${message.to}`);
      }

      // Check message length
      if (message.body.length > 1600) {
        throw new Error(`Message too long: ${message.body.length} characters (max 1600)`);
      }

      // Send via Twilio
      const twilioMessage = await this.twilioClient.messages.create({
        body: message.body,
        from: this.fromNumber,
        to: message.to,
        statusCallback: this.webhookUrl ? `${this.webhookUrl}?notificationId=${message.notificationId}` : undefined
      });

      return {
        success: true,
        messageId: twilioMessage.sid,
        status: this.mapTwilioStatus(twilioMessage.status),
        cost: twilioMessage.price ? parseFloat(twilioMessage.price) : undefined,
        segments: twilioMessage.numSegments ? parseInt(twilioMessage.numSegments) : 1
      };

    } catch (error) {
      console.error('SMS sending failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMS error',
        status: 'failed'
      };
    }
  }

  /**
   * Send batch SMS messages with rate limiting
   */
  async sendBatchSMS(messages: SMSMessage[]): Promise<SMSDeliveryResult[]> {
    const results: SMSDeliveryResult[] = [];
    const rateLimit = parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE || '30');
    const delayMs = Math.ceil(60000 / rateLimit); // Delay between messages

    for (const message of messages) {
      const result = await this.sendSMS(message);
      results.push(result);

      // Rate limiting delay (except for last message)
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Handle Twilio delivery status webhooks
   */
  async handleDeliveryWebhook(payload: SMSWebhookPayload): Promise<void> {
    try {
      const { MessageSid, MessageStatus, notificationId } = payload;

      if (!notificationId) {
        console.warn('Webhook received without notification ID:', MessageSid);
        return;
      }

      const status = this.mapTwilioStatus(MessageStatus);
      
      // Update notification status in database
      await CommunicationNotificationModel.updateStatus(notificationId, status);

      // Log delivery event
      console.log(`SMS delivery update: ${MessageSid} -> ${status} (notification: ${notificationId})`);

    } catch (error) {
      console.error('Webhook processing failed:', error);
      throw error;
    }
  }

  /**
   * Get SMS delivery status from Twilio
   */
  async getDeliveryStatus(messageId: string): Promise<NotificationStatus> {
    try {
      const message = await this.twilioClient.messages(messageId).fetch();
      return this.mapTwilioStatus(message.status);
    } catch (error) {
      console.error('Failed to fetch delivery status:', error);
      return 'failed';
    }
  }

  /**
   * Validate phone number format (Swedish format expected)
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Swedish phone number formats: +46XXXXXXXXX or 46XXXXXXXXX or 0XXXXXXXXX
    const swedishPhoneRegex = /^(\+46|46|0)[1-9]\d{8,9}$/;
    return swedishPhoneRegex.test(phoneNumber.replace(/\s|-/g, ''));
  }

  /**
   * Normalize phone number to international format
   */
  normalizePhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\s|-/g, '');
    
    if (cleaned.startsWith('+46')) {
      return cleaned;
    } else if (cleaned.startsWith('46')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      return `+46${cleaned.substring(1)}`;
    }
    
    return cleaned;
  }

  /**
   * Map Twilio message status to our notification status
   */
  private mapTwilioStatus(twilioStatus: string): NotificationStatus {
    switch (twilioStatus.toLowerCase()) {
      case 'accepted':
      case 'queued':
      case 'sending':
        return 'sent';
      case 'sent':
      case 'delivered':
        return 'delivered';
      case 'failed':
      case 'undelivered':
        return 'failed';
      case 'receiving':
      case 'received':
        return 'delivered';
      default:
        return 'pending';
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  isQuietHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    
    const quietStart = parseInt(process.env.NOTIFICATION_QUIET_HOURS_START?.split(':')[0] || '22');
    const quietEnd = parseInt(process.env.NOTIFICATION_QUIET_HOURS_END?.split(':')[0] || '8');
    
    if (quietStart > quietEnd) {
      // Quiet hours span midnight (e.g., 22:00 to 08:00)
      return hour >= quietStart || hour < quietEnd;
    } else {
      // Quiet hours within same day
      return hour >= quietStart && hour < quietEnd;
    }
  }

  /**
   * Get SMS sending statistics
   */
  async getSMSStats(days: number = 7): Promise<{
    sent: number;
    delivered: number;
    failed: number;
    total_cost: number;
    delivery_rate: number;
  }> {
    // This would typically query Twilio's API for usage statistics
    // For now, we'll return mock data - implement based on Twilio usage API
    return {
      sent: 0,
      delivered: 0,
      failed: 0,
      total_cost: 0,
      delivery_rate: 0
    };
  }

  /**
   * Validate SMS content for compliance
   */
  validateSMSContent(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check length
    if (content.length > 1600) {
      errors.push(`Message too long: ${content.length} characters (max 1600)`);
    }

    // Check for required opt-out text (Swedish regulation)
    const hasOptOut = /(?:svara stopp|stop|avbryt)/i.test(content);
    if (!hasOptOut && content.length > 160) {
      errors.push('Long SMS messages must include opt-out instructions (STOPP, STOP, AVBRYT)');
    }

    // Check for suspicious content
    const suspiciousPatterns = [
      /kreditkort|bankkort/i, // Credit/bank card
      /lösenord|pin.?kod/i,   // Password/PIN
      /klicka här|click here/i // Click here
    ];

    suspiciousPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        errors.push('Message contains potentially suspicious content');
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}