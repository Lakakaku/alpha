import { Router } from 'express';
import { z } from 'zod';
import type { 
  CommunicationNotification,
  NotificationType,
  NotificationStatus,
  CommunicationChannel,
  RecipientType
} from '@vocilia/types';
import { 
  CommunicationNotificationModel,
  CommunicationLogModel 
} from '@vocilia/database';
import { NotificationProcessorService } from '../../services/communication/notification-processor.js';

const router = Router();
const notificationProcessor = new NotificationProcessorService();

// Validation schemas
const createNotificationSchema = z.object({
  recipient_type: z.enum(['customer', 'business']),
  recipient_id: z.string().uuid(),
  notification_type: z.enum([
    'reward_earned',
    'payment_confirmation', 
    'verification_request',
    'support_ticket_created',
    'payment_overdue',
    'weekly_summary',
    'fraud_alert',
    'payment_failed',
    'verification_failed',
    'system_maintenance',
    'support_message_received',
    'support_ticket_updated'
  ]),
  channel: z.enum(['sms', 'email']),
  recipient_phone: z.string().optional(),
  recipient_email: z.string().email().optional(),
  template_data: z.record(z.any()).optional(),
  language: z.enum(['sv', 'en']).default('sv'),
  scheduled_at: z.string().datetime().optional()
});

const updateNotificationSchema = z.object({
  status: z.enum(['pending', 'sent', 'delivered', 'failed', 'cancelled']).optional(),
  scheduled_at: z.string().datetime().optional()
});

const batchNotificationSchema = z.object({
  notifications: z.array(createNotificationSchema),
  schedule_batch_at: z.string().datetime().optional()
});

const notificationFiltersSchema = z.object({
  recipient_type: z.enum(['customer', 'business']).optional(),
  notification_type: z.string().optional(),
  status: z.enum(['pending', 'sent', 'delivered', 'failed', 'cancelled']).optional(),
  channel: z.enum(['sms', 'email']).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

/**
 * POST /api/admin/notifications
 * Create a new notification
 */
router.post('/', async (req, res) => {
  try {
    const validatedData = createNotificationSchema.parse(req.body);

    // Validate recipient contact info based on channel
    if (validatedData.channel === 'sms' && !validatedData.recipient_phone) {
      return res.status(400).json({
        error: 'recipient_phone is required for SMS notifications'
      });
    }

    if (validatedData.channel === 'email' && !validatedData.recipient_email) {
      return res.status(400).json({
        error: 'recipient_email is required for email notifications'
      });
    }

    const notification = await CommunicationNotificationModel.create(validatedData);

    res.status(201).json({
      success: true,
      data: notification
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to create notification:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/notifications/batch
 * Create multiple notifications in batch
 */
router.post('/batch', async (req, res) => {
  try {
    const validatedData = batchNotificationSchema.parse(req.body);

    const createdNotifications = [];
    const errors = [];

    for (let i = 0; i < validatedData.notifications.length; i++) {
      try {
        const notification = await CommunicationNotificationModel.create(validatedData.notifications[i]);
        createdNotifications.push(notification);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        created: createdNotifications.length,
        failed: errors.length,
        notifications: createdNotifications,
        errors
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to create batch notifications:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/notifications
 * Get notifications with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const filters = notificationFiltersSchema.parse(req.query);

    const notifications = await CommunicationNotificationModel.getWithFilters({
      recipient_type: filters.recipient_type as RecipientType,
      notification_type: filters.notification_type as NotificationType,
      status: filters.status as NotificationStatus,
      channel: filters.channel as CommunicationChannel,
      date_from: filters.date_from,
      date_to: filters.date_to,
      page: filters.page,
      limit: filters.limit
    });

    const total = await CommunicationNotificationModel.getCountWithFilters({
      recipient_type: filters.recipient_type as RecipientType,
      notification_type: filters.notification_type as NotificationType,
      status: filters.status as NotificationStatus,
      channel: filters.channel as CommunicationChannel,
      date_from: filters.date_from,
      date_to: filters.date_to
    });

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit)
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to get notifications:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/notifications/:id
 * Get notification by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await CommunicationNotificationModel.getById(id);
    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Failed to get notification:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/admin/notifications/:id
 * Update notification
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateNotificationSchema.parse(req.body);

    const notification = await CommunicationNotificationModel.getById(id);
    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found'
      });
    }

    let updatedNotification;
    if (validatedData.status) {
      updatedNotification = await CommunicationNotificationModel.updateStatus(id, validatedData.status);
    } else if (validatedData.scheduled_at) {
      updatedNotification = await CommunicationNotificationModel.updateScheduledAt(id, validatedData.scheduled_at);
    } else {
      return res.status(400).json({
        error: 'No valid update fields provided'
      });
    }

    res.json({
      success: true,
      data: updatedNotification
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to update notification:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/admin/notifications/:id
 * Cancel notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await CommunicationNotificationModel.getById(id);
    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found'
      });
    }

    if (notification.status === 'sent' || notification.status === 'delivered') {
      return res.status(400).json({
        error: 'Cannot cancel notification that has already been sent'
      });
    }

    const cancelledNotification = await CommunicationNotificationModel.updateStatus(id, 'cancelled');

    res.json({
      success: true,
      data: cancelledNotification
    });

  } catch (error) {
    console.error('Failed to cancel notification:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/notifications/process
 * Trigger manual notification processing
 */
router.post('/process', async (req, res) => {
  try {
    await notificationProcessor.processPendingNotifications();

    res.json({
      success: true,
      message: 'Notification processing triggered'
    });

  } catch (error) {
    console.error('Failed to process notifications:', error);
    res.status(500).json({
      error: 'Failed to process notifications'
    });
  }
});

/**
 * POST /api/admin/notifications/retry
 * Trigger retry processing
 */
router.post('/retry', async (req, res) => {
  try {
    await notificationProcessor.processRetrySchedules();

    res.json({
      success: true,
      message: 'Retry processing triggered'
    });

  } catch (error) {
    console.error('Failed to process retries:', error);
    res.status(500).json({
      error: 'Failed to process retries'
    });
  }
});

/**
 * GET /api/admin/notifications/stats
 * Get notification statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    const stats = await CommunicationNotificationModel.getNotificationStats(days);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Failed to get notification stats:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/notifications/:id/logs
 * Get delivery logs for notification
 */
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await CommunicationNotificationModel.getById(id);
    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found'
      });
    }

    const logs = await CommunicationLogModel.getByNotificationId(id);

    res.json({
      success: true,
      data: {
        notification,
        logs
      }
    });

  } catch (error) {
    console.error('Failed to get notification logs:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/notifications/recipient/:type/:id
 * Get notifications for specific recipient
 */
router.get('/recipient/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!['customer', 'business'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid recipient type'
      });
    }

    const notifications = await CommunicationNotificationModel.getByRecipient(
      type as RecipientType, 
      id,
      page,
      limit
    );

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('Failed to get recipient notifications:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/notifications/failed
 * Get failed notifications requiring attention
 */
router.get('/failed', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const notifications = await CommunicationNotificationModel.getFailedNotifications(page, limit);

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('Failed to get failed notifications:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;