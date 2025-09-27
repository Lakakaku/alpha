import { createClient } from '@supabase/supabase-js';
import { NotificationService } from '../services/verification/notificationService';

interface NotificationReminderJob {
  id: string;
  type: 'verification_deadline' | 'payment_overdue' | 'verification_available';
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

interface VerificationDatabase {
  id: string;
  store_id: string;
  business_id: string;
  store_name: string;
  business_name: string;
  business_email: string;
  deadline_at: string;
  status: string;
  transaction_count: number;
}

interface PaymentInvoice {
  id: string;
  business_id: string;
  business_name: string;
  business_email: string;
  total_amount: number;
  due_date: string;
  status: string;
}

export class NotificationReminderJobProcessor {
  private supabase;
  private notificationService: NotificationService;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.notificationService = new NotificationService();
  }

  async processVerificationDeadlineReminders(): Promise<void> {
    console.log('Processing verification deadline reminders...');

    try {
      // Get verification databases with deadlines approaching (1-2 days)
      const upcomingDeadlines = await this.getUpcomingVerificationDeadlines();

      for (const database of upcomingDeadlines) {
        const daysUntilDeadline = this.getDaysUntilDeadline(database.deadline_at);
        
        try {
          if (daysUntilDeadline === 2) {
            // 2-day reminder
            await this.notificationService.sendVerificationDeadlineReminder(
              database.business_email,
              database.business_name,
              database.store_name,
              database.deadline_at,
              database.id,
              '2-day'
            );
            console.log(`Sent 2-day deadline reminder for database ${database.id}`);
          } else if (daysUntilDeadline === 1) {
            // 1-day reminder
            await this.notificationService.sendVerificationDeadlineReminder(
              database.business_email,
              database.business_name,
              database.store_name,
              database.deadline_at,
              database.id,
              '1-day'
            );
            console.log(`Sent 1-day deadline reminder for database ${database.id}`);
          } else if (daysUntilDeadline === 0) {
            // Final reminder (due today)
            await this.notificationService.sendVerificationDeadlineReminder(
              database.business_email,
              database.business_name,
              database.store_name,
              database.deadline_at,
              database.id,
              'final'
            );
            console.log(`Sent final deadline reminder for database ${database.id}`);
          }

          // Log the notification
          await this.logNotification(database.id, 'verification_deadline', `${daysUntilDeadline}-day reminder`);

        } catch (error) {
          console.error(`Failed to send deadline reminder for database ${database.id}:`, error);
          await this.logNotification(database.id, 'verification_deadline', 'failed', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // Process expired verifications
      await this.processExpiredVerifications();

    } catch (error) {
      console.error('Error processing verification deadline reminders:', error);
      throw error;
    }
  }

  async processPaymentOverdueReminders(): Promise<void> {
    console.log('Processing payment overdue reminders...');

    try {
      // Get overdue payment invoices
      const overdueInvoices = await this.getOverduePaymentInvoices();

      for (const invoice of overdueInvoices) {
        const daysOverdue = this.getDaysOverdue(invoice.due_date);
        
        try {
          if (daysOverdue === 1 || daysOverdue === 7 || daysOverdue === 14) {
            // Send overdue reminders at 1, 7, and 14 days
            await this.notificationService.sendPaymentOverdueReminder(
              invoice.business_email,
              invoice.business_name,
              invoice.total_amount,
              invoice.due_date,
              invoice.id,
              daysOverdue
            );
            console.log(`Sent ${daysOverdue}-day overdue reminder for invoice ${invoice.id}`);
          }

          // Update invoice status to overdue if not already
          if (invoice.status === 'pending') {
            await this.updateInvoiceStatus(invoice.id, 'overdue');
          }

          // Log the notification
          await this.logNotification(invoice.id, 'payment_overdue', `${daysOverdue} days overdue`);

        } catch (error) {
          console.error(`Failed to send overdue reminder for invoice ${invoice.id}:`, error);
          await this.logNotification(invoice.id, 'payment_overdue', 'failed', error instanceof Error ? error.message : 'Unknown error');
        }
      }

    } catch (error) {
      console.error('Error processing payment overdue reminders:', error);
      throw error;
    }
  }

  async processWeeklyDigestNotifications(): Promise<void> {
    console.log('Processing weekly digest notifications...');

    try {
      // Get businesses with pending verifications
      const businessSummaries = await this.getBusinessVerificationSummaries();

      for (const summary of businessSummaries) {
        try {
          await this.notificationService.sendWeeklyVerificationDigest(
            summary.business_email,
            summary.business_name,
            summary.pending_verifications,
            summary.upcoming_deadlines,
            summary.overdue_payments
          );
          console.log(`Sent weekly digest to ${summary.business_name}`);

        } catch (error) {
          console.error(`Failed to send weekly digest to ${summary.business_name}:`, error);
        }
      }

    } catch (error) {
      console.error('Error processing weekly digest notifications:', error);
      throw error;
    }
  }

  private async getUpcomingVerificationDeadlines(): Promise<VerificationDatabase[]> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    const { data, error } = await this.supabase
      .from('verification_databases')
      .select(`
        id,
        store_id,
        business_id,
        deadline_at,
        status,
        transaction_count,
        stores:store_id(name),
        businesses:business_id(name, contact_email)
      `)
      .in('status', ['ready', 'downloaded'])
      .gte('deadline_at', now.toISOString())
      .lte('deadline_at', threeDaysFromNow.toISOString());

    if (error) {
      throw new Error(`Failed to get upcoming verification deadlines: ${error.message}`);
    }

    return (data || []).map(item => ({
      id: item.id,
      store_id: item.store_id,
      business_id: item.business_id,
      store_name: item.stores?.name || 'Unknown Store',
      business_name: item.businesses?.name || 'Unknown Business',
      business_email: item.businesses?.contact_email || '',
      deadline_at: item.deadline_at,
      status: item.status,
      transaction_count: item.transaction_count
    }));
  }

  private async getOverduePaymentInvoices(): Promise<PaymentInvoice[]> {
    const now = new Date();

    const { data, error } = await this.supabase
      .from('payment_invoices')
      .select(`
        id,
        business_id,
        total_amount,
        due_date,
        status,
        businesses:business_id(name, contact_email)
      `)
      .in('status', ['pending', 'overdue'])
      .lt('due_date', now.toISOString());

    if (error) {
      throw new Error(`Failed to get overdue payment invoices: ${error.message}`);
    }

    return (data || []).map(item => ({
      id: item.id,
      business_id: item.business_id,
      business_name: item.businesses?.name || 'Unknown Business',
      business_email: item.businesses?.contact_email || '',
      total_amount: item.total_amount,
      due_date: item.due_date,
      status: item.status
    }));
  }

  private async getBusinessVerificationSummaries(): Promise<Array<{
    business_id: string;
    business_name: string;
    business_email: string;
    pending_verifications: number;
    upcoming_deadlines: number;
    overdue_payments: number;
  }>> {
    // This would typically be a more complex query joining multiple tables
    // For now, we'll implement a simplified version
    const { data, error } = await this.supabase
      .from('businesses')
      .select(`
        id,
        name,
        contact_email
      `)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to get business summaries: ${error.message}`);
    }

    const summaries = [];
    for (const business of data || []) {
      const pendingVerifications = await this.getBusinessPendingVerifications(business.id);
      const upcomingDeadlines = await this.getBusinessUpcomingDeadlines(business.id);
      const overduePayments = await this.getBusinessOverduePayments(business.id);

      if (pendingVerifications > 0 || upcomingDeadlines > 0 || overduePayments > 0) {
        summaries.push({
          business_id: business.id,
          business_name: business.name,
          business_email: business.contact_email,
          pending_verifications: pendingVerifications,
          upcoming_deadlines: upcomingDeadlines,
          overdue_payments: overduePayments
        });
      }
    }

    return summaries;
  }

  private async getBusinessPendingVerifications(businessId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('verification_databases')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .in('status', ['ready', 'downloaded']);

    if (error) {
      console.error(`Failed to get pending verifications for business ${businessId}:`, error);
      return 0;
    }

    return count || 0;
  }

  private async getBusinessUpcomingDeadlines(businessId: string): Promise<number> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    const { count, error } = await this.supabase
      .from('verification_databases')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .in('status', ['ready', 'downloaded'])
      .gte('deadline_at', now.toISOString())
      .lte('deadline_at', threeDaysFromNow.toISOString());

    if (error) {
      console.error(`Failed to get upcoming deadlines for business ${businessId}:`, error);
      return 0;
    }

    return count || 0;
  }

  private async getBusinessOverduePayments(businessId: string): Promise<number> {
    const now = new Date();

    const { count, error } = await this.supabase
      .from('payment_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .in('status', ['pending', 'overdue'])
      .lt('due_date', now.toISOString());

    if (error) {
      console.error(`Failed to get overdue payments for business ${businessId}:`, error);
      return 0;
    }

    return count || 0;
  }

  private async processExpiredVerifications(): Promise<void> {
    const now = new Date();

    const { data, error } = await this.supabase
      .from('verification_databases')
      .update({ status: 'expired' })
      .in('status', ['ready', 'downloaded'])
      .lt('deadline_at', now.toISOString())
      .select('id, store_id, business_id');

    if (error) {
      console.error('Failed to update expired verifications:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log(`Marked ${data.length} verification databases as expired`);
      
      // Log expired verifications for audit trail
      for (const database of data) {
        await this.logNotification(database.id, 'verification_deadline', 'expired');
      }
    }
  }

  private async updateInvoiceStatus(invoiceId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('payment_invoices')
      .update({ status })
      .eq('id', invoiceId);

    if (error) {
      console.error(`Failed to update invoice ${invoiceId} status to ${status}:`, error);
    }
  }

  private async logNotification(
    entityId: string, 
    type: string, 
    status: string, 
    error?: string
  ): Promise<void> {
    const { error: logError } = await this.supabase
      .from('notification_logs')
      .insert({
        entity_id: entityId,
        notification_type: type,
        status,
        error_message: error,
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Failed to log notification:', logError);
    }
  }

  private getDaysUntilDeadline(deadlineAt: string): number {
    const deadline = new Date(deadlineAt);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getDaysOverdue(dueDate: string): number {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = now.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Main job entry points (to be called by scheduler)
  async runVerificationDeadlineJob(): Promise<void> {
    console.log('Starting verification deadline reminder job...');
    await this.processVerificationDeadlineReminders();
    console.log('Verification deadline reminder job completed');
  }

  async runPaymentOverdueJob(): Promise<void> {
    console.log('Starting payment overdue reminder job...');
    await this.processPaymentOverdueReminders();
    console.log('Payment overdue reminder job completed');
  }

  async runWeeklyDigestJob(): Promise<void> {
    console.log('Starting weekly digest job...');
    await this.processWeeklyDigestNotifications();
    console.log('Weekly digest job completed');
  }
}

// Export singleton instance
export const notificationReminderProcessor = new NotificationReminderJobProcessor();