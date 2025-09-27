import { 
  WeeklyVerificationCycleModel, 
  VerificationDatabaseModel, 
  PaymentInvoiceModel 
} from '@vocilia/database';
import type { 
  WeeklyVerificationCycle, 
  VerificationDatabase, 
  PaymentInvoice 
} from '@vocilia/types/verification';

export interface NotificationTemplate {
  type: string;
  subject: string;
  body: string;
  variables: string[];
}

export interface NotificationRecipient {
  type: 'admin' | 'business' | 'customer';
  email?: string;
  phone?: string;
  businessId?: string;
  adminRole?: string;
}

export interface NotificationRequest {
  template: string;
  recipients: NotificationRecipient[];
  variables: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledFor?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt?: string;
}

export class NotificationService {
  private readonly emailApiUrl: string;
  private readonly smsApiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.emailApiUrl = process.env.EMAIL_API_URL || '';
    this.smsApiUrl = process.env.SMS_API_URL || '';
    this.apiKey = process.env.NOTIFICATION_API_KEY || '';
  }

  /**
   * Notify when new verification cycle is created
   */
  async notifyVerificationCycleCreated(cycle: WeeklyVerificationCycle): Promise<void> {
    const adminNotification: NotificationRequest = {
      template: 'verification_cycle_created',
      recipients: [{ type: 'admin', adminRole: 'verification_manager' }],
      variables: {
        cycle_id: cycle.id,
        start_date: cycle.start_date,
        end_date: cycle.end_date,
        status: cycle.status
      },
      priority: 'normal'
    };

    await this.sendNotification(adminNotification);
  }

  /**
   * Notify when databases are prepared for verification
   */
  async notifyDatabasesPrepared(cycleId: string): Promise<void> {
    const cycle = await WeeklyVerificationCycleModel.getById(cycleId);
    if (!cycle) return;

    const databases = await VerificationDatabaseModel.getByCycleId(cycleId);
    const businessIds = [...new Set(databases.map(db => db.business_id))];

    // Notify admins
    const adminNotification: NotificationRequest = {
      template: 'databases_prepared',
      recipients: [{ type: 'admin', adminRole: 'verification_manager' }],
      variables: {
        cycle_id: cycleId,
        database_count: databases.length,
        business_count: businessIds.length,
        total_transactions: databases.reduce((sum, db) => sum + db.transaction_count, 0)
      },
      priority: 'normal'
    };

    await this.sendNotification(adminNotification);

    // Notify each business
    for (const businessId of businessIds) {
      const businessDatabases = databases.filter(db => db.business_id === businessId);
      const deadline = businessDatabases[0]?.deadline_date;

      const businessNotification: NotificationRequest = {
        template: 'verification_ready',
        recipients: [{ type: 'business', businessId }],
        variables: {
          cycle_id: cycleId,
          database_count: businessDatabases.length,
          total_transactions: businessDatabases.reduce((sum, db) => sum + db.transaction_count, 0),
          deadline: deadline,
          business_id: businessId
        },
        priority: 'high'
      };

      await this.sendNotification(businessNotification);
    }
  }

  /**
   * Notify when verification deadline is approaching
   */
  async notifyDeadlineApproaching(databaseId: string): Promise<void> {
    const database = await VerificationDatabaseModel.getById(databaseId);
    if (!database) return;

    const cycle = await WeeklyVerificationCycleModel.getById(database.weekly_verification_cycle_id);
    if (!cycle) return;

    const notification: NotificationRequest = {
      template: 'deadline_approaching',
      recipients: [{ type: 'business', businessId: database.business_id }],
      variables: {
        database_id: database.id,
        cycle_id: cycle.id,
        deadline: database.deadline_date,
        transaction_count: database.transaction_count,
        hours_remaining: this.calculateHoursUntilDeadline(database.deadline_date)
      },
      priority: 'urgent'
    };

    await this.sendNotification(notification);
  }

  /**
   * Notify when verification deadline has passed
   */
  async notifyDeadlineExpired(databaseId: string): Promise<void> {
    const database = await VerificationDatabaseModel.getById(databaseId);
    if (!database) return;

    const cycle = await WeeklyVerificationCycleModel.getById(database.weekly_verification_cycle_id);
    if (!cycle) return;

    // Notify business
    const businessNotification: NotificationRequest = {
      template: 'deadline_expired',
      recipients: [{ type: 'business', businessId: database.business_id }],
      variables: {
        database_id: database.id,
        cycle_id: cycle.id,
        deadline: database.deadline_date,
        transaction_count: database.transaction_count
      },
      priority: 'urgent'
    };

    await this.sendNotification(businessNotification);

    // Notify admins
    const adminNotification: NotificationRequest = {
      template: 'business_deadline_expired',
      recipients: [{ type: 'admin', adminRole: 'verification_manager' }],
      variables: {
        business_id: database.business_id,
        database_id: database.id,
        cycle_id: cycle.id,
        deadline: database.deadline_date
      },
      priority: 'high'
    };

    await this.sendNotification(adminNotification);
  }

  /**
   * Notify when verification is submitted by business
   */
  async notifyVerificationSubmitted(databaseId: string): Promise<void> {
    const database = await VerificationDatabaseModel.getById(databaseId);
    if (!database) return;

    const cycle = await WeeklyVerificationCycleModel.getById(database.weekly_verification_cycle_id);
    if (!cycle) return;

    // Notify admins
    const adminNotification: NotificationRequest = {
      template: 'verification_submitted',
      recipients: [{ type: 'admin', adminRole: 'verification_processor' }],
      variables: {
        business_id: database.business_id,
        database_id: database.id,
        cycle_id: cycle.id,
        transaction_count: database.transaction_count,
        submitted_at: new Date().toISOString()
      },
      priority: 'normal'
    };

    await this.sendNotification(adminNotification);

    // Notify business (confirmation)
    const businessNotification: NotificationRequest = {
      template: 'verification_submitted_confirmation',
      recipients: [{ type: 'business', businessId: database.business_id }],
      variables: {
        database_id: database.id,
        cycle_id: cycle.id,
        submitted_at: new Date().toISOString()
      },
      priority: 'normal'
    };

    await this.sendNotification(businessNotification);
  }

  /**
   * Notify when payment invoices are generated
   */
  async notifyInvoicesGenerated(cycleId: string): Promise<void> {
    const cycle = await WeeklyVerificationCycleModel.getById(cycleId);
    if (!cycle) return;

    const invoices = await PaymentInvoiceModel.getByCycleId(cycleId);
    const businessIds = [...new Set(invoices.map(inv => inv.business_id))];

    // Notify admins
    const adminNotification: NotificationRequest = {
      template: 'invoices_generated',
      recipients: [{ type: 'admin', adminRole: 'payment_processor' }],
      variables: {
        cycle_id: cycleId,
        invoice_count: invoices.length,
        total_amount: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
        business_count: businessIds.length
      },
      priority: 'normal'
    };

    await this.sendNotification(adminNotification);

    // Notify each business with their invoices
    for (const businessId of businessIds) {
      const businessInvoices = invoices.filter(inv => inv.business_id === businessId);
      
      const businessNotification: NotificationRequest = {
        template: 'payment_invoices_ready',
        recipients: [{ type: 'business', businessId }],
        variables: {
          cycle_id: cycleId,
          invoice_count: businessInvoices.length,
          total_amount: businessInvoices.reduce((sum, inv) => sum + inv.total_amount, 0),
          due_date: businessInvoices[0]?.due_date
        },
        priority: 'high'
      };

      await this.sendNotification(businessNotification);
    }
  }

  /**
   * Notify when payment is completed
   */
  async notifyPaymentCompleted(invoice: PaymentInvoice): Promise<void> {
    // Notify business
    const businessNotification: NotificationRequest = {
      template: 'payment_completed',
      recipients: [{ type: 'business', businessId: invoice.business_id }],
      variables: {
        invoice_id: invoice.id,
        amount: invoice.total_amount,
        phone_number: invoice.phone_number,
        transaction_count: invoice.transaction_count,
        paid_at: invoice.paid_at
      },
      priority: 'normal'
    };

    await this.sendNotification(businessNotification);

    // Notify customer (if we have contact info)
    if (invoice.phone_number) {
      const customerNotification: NotificationRequest = {
        template: 'reward_processed',
        recipients: [{ type: 'customer', phone: invoice.phone_number }],
        variables: {
          reward_amount: invoice.total_amount,
          transaction_count: invoice.transaction_count,
          business_id: invoice.business_id
        },
        priority: 'normal'
      };

      await this.sendNotification(customerNotification);
    }
  }

  /**
   * Notify when payment fails
   */
  async notifyPaymentFailed(invoice: PaymentInvoice, errorMessage: string): Promise<void> {
    // Notify business
    const businessNotification: NotificationRequest = {
      template: 'payment_failed',
      recipients: [{ type: 'business', businessId: invoice.business_id }],
      variables: {
        invoice_id: invoice.id,
        amount: invoice.total_amount,
        error_message: errorMessage,
        retry_instructions: 'Please contact support to retry the payment'
      },
      priority: 'high'
    };

    await this.sendNotification(businessNotification);

    // Notify admins
    const adminNotification: NotificationRequest = {
      template: 'payment_failed_admin',
      recipients: [{ type: 'admin', adminRole: 'payment_processor' }],
      variables: {
        invoice_id: invoice.id,
        business_id: invoice.business_id,
        amount: invoice.total_amount,
        error_message: errorMessage
      },
      priority: 'high'
    };

    await this.sendNotification(adminNotification);
  }

  /**
   * Send bulk notifications for cycle completion
   */
  async notifyCycleCompleted(cycleId: string): Promise<void> {
    const cycle = await WeeklyVerificationCycleModel.getById(cycleId);
    if (!cycle) return;

    const invoices = await PaymentInvoiceModel.getByCycleId(cycleId);
    const paidInvoices = invoices.filter(inv => inv.payment_status === 'paid');
    
    const adminNotification: NotificationRequest = {
      template: 'cycle_completed',
      recipients: [{ type: 'admin', adminRole: 'verification_manager' }],
      variables: {
        cycle_id: cycleId,
        start_date: cycle.start_date,
        end_date: cycle.end_date,
        total_invoices: invoices.length,
        paid_invoices: paidInvoices.length,
        total_amount: paidInvoices.reduce((sum, inv) => sum + inv.total_amount, 0),
        completion_rate: Math.round((paidInvoices.length / invoices.length) * 100)
      },
      priority: 'normal'
    };

    await this.sendNotification(adminNotification);
  }

  /**
   * Send notification using configured provider
   */
  private async sendNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      // In development/test, just log the notification
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        console.log('Notification (mock):', {
          template: request.template,
          recipients: request.recipients,
          variables: request.variables,
          priority: request.priority
        });

        return {
          success: true,
          messageId: `mock-${Date.now()}`,
          deliveredAt: new Date().toISOString()
        };
      }

      // Production implementation would integrate with actual notification service
      // Example: SendGrid, Twilio, AWS SNS, etc.
      
      for (const recipient of request.recipients) {
        if (recipient.email) {
          await this.sendEmail(recipient.email, request);
        }
        
        if (recipient.phone) {
          await this.sendSMS(recipient.phone, request);
        }

        if (recipient.type === 'admin' || recipient.type === 'business') {
          await this.sendInAppNotification(recipient, request);
        }
      }

      return {
        success: true,
        messageId: `prod-${Date.now()}`,
        deliveredAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Notification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown notification error'
      };
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(email: string, request: NotificationRequest): Promise<void> {
    // Mock implementation - replace with actual email service
    console.log(`Email to ${email}:`, request.template);
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(phone: string, request: NotificationRequest): Promise<void> {
    // Mock implementation - replace with actual SMS service
    console.log(`SMS to ${phone}:`, request.template);
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    recipient: NotificationRecipient, 
    request: NotificationRequest
  ): Promise<void> {
    // Mock implementation - replace with actual in-app notification system
    console.log(`In-app notification for ${recipient.type}:`, request.template);
  }

  /**
   * Calculate hours until deadline
   */
  private calculateHoursUntilDeadline(deadline: string): number {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
  }

  /**
   * Schedule reminder notifications
   */
  async scheduleDeadlineReminders(databaseId: string): Promise<void> {
    const database = await VerificationDatabaseModel.getById(databaseId);
    if (!database) return;

    const deadline = new Date(database.deadline_date);
    const now = new Date();

    // Schedule 24-hour reminder
    const reminder24h = new Date(deadline.getTime() - (24 * 60 * 60 * 1000));
    if (reminder24h > now) {
      const notification: NotificationRequest = {
        template: 'deadline_reminder_24h',
        recipients: [{ type: 'business', businessId: database.business_id }],
        variables: {
          database_id: database.id,
          deadline: database.deadline_date,
          transaction_count: database.transaction_count
        },
        priority: 'high',
        scheduledFor: reminder24h.toISOString()
      };

      await this.scheduleNotification(notification);
    }

    // Schedule 2-hour reminder
    const reminder2h = new Date(deadline.getTime() - (2 * 60 * 60 * 1000));
    if (reminder2h > now) {
      const notification: NotificationRequest = {
        template: 'deadline_reminder_2h',
        recipients: [{ type: 'business', businessId: database.business_id }],
        variables: {
          database_id: database.id,
          deadline: database.deadline_date,
          transaction_count: database.transaction_count
        },
        priority: 'urgent',
        scheduledFor: reminder2h.toISOString()
      };

      await this.scheduleNotification(notification);
    }
  }

  /**
   * Schedule notification for future delivery
   */
  private async scheduleNotification(request: NotificationRequest): Promise<void> {
    // Mock implementation - in production, use a job queue like Bull or AWS SQS
    console.log('Scheduled notification:', {
      template: request.template,
      scheduledFor: request.scheduledFor,
      priority: request.priority
    });
  }
}