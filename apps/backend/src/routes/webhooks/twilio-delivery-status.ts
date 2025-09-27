import { Router, Request, Response } from 'express';
import { supabase } from '@vocilia/database';
import { 
  CommunicationNotifications,
  CommunicationLogs
} from '@vocilia/database';
import { webhookAuth } from '../../middleware/communication-auth';
import { validateTwilioWebhook } from '../../middleware/communication-validation';
import { webhookRateLimit } from '../../middleware/communication-rate-limiter';
import crypto from 'crypto';

const router = Router();

// Types for Twilio webhook data
interface TwilioDeliveryStatus {
  MessageSid: string;
  MessageStatus: 'queued' | 'failed' | 'sent' | 'delivered' | 'undelivered' | 'receiving' | 'received';
  To: string;
  From: string;
  Body?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  AccountSid: string;
  SmsSid?: string;
  SmsStatus?: string;
  ApiVersion?: string;
  MessagePrice?: string;
  MessagePriceUnit?: string;
  Uri?: string;
}

interface DeliveryUpdateResult {
  success: boolean;
  notificationId?: string;
  previousStatus?: string;
  newStatus?: string;
  error?: string;
}

/**
 * Verify Twilio webhook signature
 */
const verifyTwilioSignature = (req: Request): boolean => {
  try {
    const twilioSignature = req.headers['x-twilio-signature'] as string;
    const authToken = process.env.TWILIO_SMS_AUTH_TOKEN;
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    if (!twilioSignature || !authToken) {
      return false;
    }

    // Create expected signature
    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(url + JSON.stringify(req.body))
      .digest('base64');

    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(twilioSignature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (error) {
    console.error('Error verifying Twilio signature:', error);
    return false;
  }
};

/**
 * Map Twilio status to our notification status
 */
const mapTwilioStatus = (twilioStatus: string): string => {
  switch (twilioStatus.toLowerCase()) {
    case 'queued':
    case 'sending':
      return 'pending';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'failed':
    case 'undelivered':
      return 'failed';
    case 'received':
      return 'received';
    default:
      return 'unknown';
  }
};

/**
 * Main webhook handler for Twilio delivery status updates
 */
router.post('/delivery-status', 
  webhookRateLimit,
  validateTwilioWebhook,
  async (req: Request, res: Response) => {
    const webhookId = `twilio_${Date.now()}`;
    
    try {
      console.log(`[${webhookId}] Received Twilio delivery status webhook`);

      // Verify webhook signature in production
      if (process.env.NODE_ENV === 'production' && !verifyTwilioSignature(req)) {
        console.error(`[${webhookId}] Invalid Twilio webhook signature`);
        return res.status(401).json({
          error: 'Invalid webhook signature',
          code: 'INVALID_SIGNATURE'
        });
      }

      const deliveryData = req.body as TwilioDeliveryStatus;
      
      console.log(`[${webhookId}] Processing delivery status:`, {
        messageSid: deliveryData.MessageSid,
        status: deliveryData.MessageStatus,
        to: deliveryData.To,
        errorCode: deliveryData.ErrorCode
      });

      // Process the delivery status update
      const result = await processDeliveryStatusUpdate(deliveryData, webhookId);

      if (result.success) {
        console.log(`[${webhookId}] Delivery status processed successfully:`, {
          notificationId: result.notificationId,
          previousStatus: result.previousStatus,
          newStatus: result.newStatus
        });

        // Log successful webhook processing
        await logWebhookEvent(webhookId, 'delivery_status_processed', {
          message_sid: deliveryData.MessageSid,
          notification_id: result.notificationId,
          status_change: `${result.previousStatus} -> ${result.newStatus}`,
          phone: deliveryData.To
        });

        return res.status(200).json({
          success: true,
          message: 'Delivery status processed successfully',
          notificationId: result.notificationId
        });
      } else {
        console.error(`[${webhookId}] Failed to process delivery status:`, result.error);
        
        // Log webhook processing failure
        await logWebhookEvent(webhookId, 'delivery_status_failed', {
          message_sid: deliveryData.MessageSid,
          error: result.error,
          phone: deliveryData.To
        });

        return res.status(422).json({
          error: 'Failed to process delivery status',
          code: 'PROCESSING_FAILED',
          details: result.error
        });
      }

    } catch (error) {
      console.error(`[${webhookId}] Webhook processing error:`, error);
      
      // Log webhook error
      await logWebhookEvent(webhookId, 'webhook_error', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });

      return res.status(500).json({
        error: 'Internal webhook processing error',
        code: 'WEBHOOK_ERROR'
      });
    }
  }
);

/**
 * Process delivery status update
 */
async function processDeliveryStatusUpdate(
  deliveryData: TwilioDeliveryStatus, 
  webhookId: string
): Promise<DeliveryUpdateResult> {
  try {
    // Find notification by external message ID
    const { data: notification, error: findError } = await supabase
      .from('communication_notifications')
      .select('id, status, phone, notification_type, retry_count')
      .eq('external_id', deliveryData.MessageSid)
      .single();

    if (findError || !notification) {
      return {
        success: false,
        error: `Notification not found for message ID: ${deliveryData.MessageSid}`
      };
    }

    const previousStatus = notification.status;
    const newStatus = mapTwilioStatus(deliveryData.MessageStatus);

    // Only update if status actually changed
    if (previousStatus === newStatus) {
      return {
        success: true,
        notificationId: notification.id,
        previousStatus,
        newStatus,
        error: 'Status unchanged'
      };
    }

    // Prepare update data
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Add delivery timestamp for delivered status
    if (newStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    // Add error information for failed status
    if (newStatus === 'failed' && deliveryData.ErrorCode) {
      updateData.error_message = `Twilio Error ${deliveryData.ErrorCode}: ${deliveryData.ErrorMessage || 'Unknown error'}`;
    }

    // Update notification status
    const { error: updateError } = await supabase
      .from('communication_notifications')
      .update(updateData)
      .eq('id', notification.id);

    if (updateError) {
      throw new Error(`Failed to update notification: ${updateError.message}`);
    }

    // Handle failed delivery - schedule retry if applicable
    if (newStatus === 'failed') {
      await handleFailedDelivery(notification, deliveryData, webhookId);
    }

    // Update retry schedules if this was a retry attempt
    if (notification.retry_count > 0) {
      await updateRetryScheduleStatus(notification.id, newStatus, deliveryData.MessageSid);
    }

    // Log delivery status change
    await logDeliveryStatusChange(notification.id, {
      previous_status: previousStatus,
      new_status: newStatus,
      message_sid: deliveryData.MessageSid,
      twilio_status: deliveryData.MessageStatus,
      error_code: deliveryData.ErrorCode,
      error_message: deliveryData.ErrorMessage,
      webhook_id: webhookId
    });

    return {
      success: true,
      notificationId: notification.id,
      previousStatus,
      newStatus
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle failed delivery
 */
async function handleFailedDelivery(
  notification: any, 
  deliveryData: TwilioDeliveryStatus, 
  webhookId: string
): Promise<void> {
  try {
    const maxRetries = parseInt(process.env.NOTIFICATION_MAX_RETRIES || '3');
    
    // Check if we should schedule a retry
    if (notification.retry_count < maxRetries) {
      // Calculate retry delay based on error code
      const retryDelayMs = calculateRetryDelay(deliveryData.ErrorCode, notification.retry_count);
      const retryAt = new Date(Date.now() + retryDelayMs);

      // Create retry schedule
      await supabase
        .from('communication_retry_schedules')
        .insert({
          notification_id: notification.id,
          attempt_number: notification.retry_count + 1,
          scheduled_at: retryAt.toISOString(),
          reason: `Twilio delivery failed: ${deliveryData.ErrorCode} - ${deliveryData.ErrorMessage}`,
          retry_type: 'automatic'
        });

      // Update notification for retry
      await supabase
        .from('communication_notifications')
        .update({
          status: 'pending',
          retry_count: notification.retry_count + 1,
          scheduled_at: retryAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', notification.id);

      console.log(`[${webhookId}] Scheduled retry for notification ${notification.id} at ${retryAt.toISOString()}`);
    } else {
      console.log(`[${webhookId}] Max retries exceeded for notification ${notification.id}`);
    }

    // Log failed delivery
    await logDeliveryFailure(notification.id, {
      twilio_error_code: deliveryData.ErrorCode,
      twilio_error_message: deliveryData.ErrorMessage,
      retry_count: notification.retry_count,
      max_retries_exceeded: notification.retry_count >= maxRetries,
      webhook_id: webhookId
    });

  } catch (error) {
    console.error(`[${webhookId}] Error handling failed delivery:`, error);
  }
}

/**
 * Calculate retry delay based on error code and attempt number
 */
function calculateRetryDelay(errorCode: string | undefined, retryCount: number): number {
  const baseDelayMs = 300000; // 5 minutes
  
  // Different delays based on error type
  switch (errorCode) {
    case '30001': // Queue overflow
    case '30002': // Account suspended
    case '30003': // Unreachable destination handset
      return baseDelayMs * Math.pow(2, retryCount); // Exponential backoff
    
    case '30004': // Message blocked
    case '30005': // Unknown destination handset
    case '30006': // Landline or unreachable carrier
      return baseDelayMs * 6; // Longer delay for carrier issues
    
    case '30007': // Carrier violation
    case '30008': // Unknown error
      return baseDelayMs * 4; // Medium delay for unknown issues
    
    default:
      return baseDelayMs * Math.pow(1.5, retryCount); // Standard exponential backoff
  }
}

/**
 * Update retry schedule status
 */
async function updateRetryScheduleStatus(
  notificationId: string, 
  status: string, 
  messageSid: string
): Promise<void> {
  try {
    const scheduleStatus = status === 'delivered' || status === 'sent' ? 'successful' : 
                          status === 'failed' ? 'failed' : 'pending';

    await supabase
      .from('communication_retry_schedules')
      .update({
        status: scheduleStatus,
        completed_at: new Date().toISOString(),
        external_id: messageSid,
        updated_at: new Date().toISOString()
      })
      .eq('notification_id', notificationId)
      .eq('status', 'processing');

  } catch (error) {
    console.error('Error updating retry schedule status:', error);
  }
}

/**
 * Log delivery status change
 */
async function logDeliveryStatusChange(notificationId: string, metadata: any): Promise<void> {
  try {
    await supabase
      .from('communication_logs')
      .insert({
        notification_id: notificationId,
        log_type: 'delivery_status_change',
        channel: 'sms',
        content: JSON.stringify(metadata),
        metadata: {
          source: 'twilio_webhook',
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error('Failed to log delivery status change:', error);
  }
}

/**
 * Log delivery failure
 */
async function logDeliveryFailure(notificationId: string, metadata: any): Promise<void> {
  try {
    await supabase
      .from('communication_logs')
      .insert({
        notification_id: notificationId,
        log_type: 'delivery_failure',
        channel: 'sms',
        content: JSON.stringify(metadata),
        metadata: {
          source: 'twilio_webhook',
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error('Failed to log delivery failure:', error);
  }
}

/**
 * Log webhook event
 */
async function logWebhookEvent(webhookId: string, eventType: string, metadata: any): Promise<void> {
  try {
    await supabase
      .from('communication_logs')
      .insert({
        log_type: eventType,
        channel: 'webhook',
        content: JSON.stringify({
          webhook_id: webhookId,
          ...metadata
        }),
        metadata: {
          source: 'twilio_webhook',
          webhook_id: webhookId,
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error('Failed to log webhook event:', error);
  }
}

/**
 * Health check endpoint for webhook
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'twilio-delivery-webhook',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * Webhook test endpoint (development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test', async (req: Request, res: Response) => {
    try {
      const testData: TwilioDeliveryStatus = {
        MessageSid: req.body.MessageSid || 'SM_test_' + Date.now(),
        MessageStatus: req.body.MessageStatus || 'delivered',
        To: req.body.To || '+46701234567',
        From: process.env.TWILIO_SMS_PHONE_NUMBER || '+46700000000',
        AccountSid: process.env.TWILIO_SMS_ACCOUNT_SID || 'AC_test',
        ...req.body
      };

      const webhookId = `test_${Date.now()}`;
      const result = await processDeliveryStatusUpdate(testData, webhookId);

      res.status(200).json({
        success: true,
        message: 'Test webhook processed',
        result,
        testData
      });

    } catch (error) {
      res.status(500).json({
        error: 'Test webhook failed',
        message: error.message
      });
    }
  });
}

export default router;