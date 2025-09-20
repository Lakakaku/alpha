import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

interface AdminNotificationData {
  type: 'business_registration' | 'business_approved' | 'business_rejected' | 'system_alert';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  targetAdminIds?: string[]; // If specified, only notify these admins
}

interface BusinessRegistrationMetadata {
  business_account_id: string;
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
  business_type: string;
  estimated_monthly_customers: number;
  registration_timestamp: string;
}

interface ApprovalWorkflowMetadata {
  business_account_id: string;
  business_name: string;
  admin_id: string;
  admin_email: string;
  action: 'approved' | 'rejected';
  notes?: string;
  approval_timestamp: string;
}

export class AdminNotificationService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );
  }

  /**
   * Sends notification about new business registration to all eligible admins
   */
  async notifyNewBusinessRegistration(
    businessAccountId: string,
    businessData: Partial<BusinessRegistrationMetadata>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const notificationData: AdminNotificationData = {
        type: 'business_registration',
        title: 'New Business Registration',
        message: `New business "${businessData.business_name}" registered by ${businessData.contact_person}. Review required.`,
        priority: 'medium',
        metadata: {
          business_account_id: businessAccountId,
          business_name: businessData.business_name,
          contact_person: businessData.contact_person,
          email: businessData.email,
          business_type: businessData.business_type,
          estimated_monthly_customers: businessData.estimated_monthly_customers,
          registration_timestamp: new Date().toISOString(),
          action_required: true,
          admin_url: `/admin/business-approvals?highlight=${businessAccountId}`
        }
      };

      // Get all active admins with business verification permissions
      const eligibleAdmins = await this.getEligibleAdmins('verify_business_accounts');

      // Send notifications to all eligible admins
      const results = await Promise.allSettled(
        eligibleAdmins.map(admin => 
          this.createAdminNotification(admin.user_id, notificationData)
        )
      );

      // Check if any notifications failed
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error(`Failed to send ${failures.length} admin notifications:`, failures);
      }

      // Send email notifications to admins
      await this.sendEmailNotifications(eligibleAdmins, notificationData);

      // Send real-time notifications via WebSocket/Server-Sent Events
      await this.sendRealtimeNotifications(eligibleAdmins, notificationData);

      return { success: true };
    } catch (error) {
      console.error('Failed to notify admins of new business registration:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Sends notification about business approval/rejection decision
   */
  async notifyApprovalDecision(
    businessAccountId: string,
    approvalData: ApprovalWorkflowMetadata
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const isApproved = approvalData.action === 'approved';
      
      const notificationData: AdminNotificationData = {
        type: isApproved ? 'business_approved' : 'business_rejected',
        title: `Business ${isApproved ? 'Approved' : 'Rejected'}`,
        message: `Business "${approvalData.business_name}" has been ${approvalData.action} by ${approvalData.admin_email}.`,
        priority: 'low',
        metadata: {
          business_account_id: businessAccountId,
          business_name: approvalData.business_name,
          approving_admin_id: approvalData.admin_id,
          approving_admin_email: approvalData.admin_email,
          action: approvalData.action,
          notes: approvalData.notes,
          approval_timestamp: approvalData.approval_timestamp,
          action_required: false
        }
      };

      // Notify all admins about the decision (for audit trail)
      const allAdmins = await this.getAllActiveAdmins();
      
      const results = await Promise.allSettled(
        allAdmins.map(admin => 
          this.createAdminNotification(admin.user_id, notificationData)
        )
      );

      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error(`Failed to send ${failures.length} approval notifications:`, failures);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to notify admins of approval decision:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Sends system alert to all admins
   */
  async sendSystemAlert(
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const notificationData: AdminNotificationData = {
        type: 'system_alert',
        title,
        message,
        priority,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          source: 'system'
        }
      };

      const allAdmins = await this.getAllActiveAdmins();
      
      const results = await Promise.allSettled(
        allAdmins.map(admin => 
          this.createAdminNotification(admin.user_id, notificationData)
        )
      );

      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error(`Failed to send ${failures.length} system alerts:`, failures);
      }

      // For urgent alerts, also send emails
      if (priority === 'urgent') {
        await this.sendEmailNotifications(allAdmins, notificationData);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to send system alert:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Creates a notification record in the database
   */
  private async createAdminNotification(
    adminUserId: string,
    notificationData: AdminNotificationData
  ): Promise<void> {
    const { error } = await this.supabase
      .from('admin_notifications')
      .insert({
        admin_user_id: adminUserId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority,
        metadata: notificationData.metadata,
        read: false,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to create admin notification: ${error.message}`);
    }
  }

  /**
   * Gets all admins with specific permissions
   */
  private async getEligibleAdmins(permission: string) {
    const { data: admins, error } = await this.supabase
      .from('admin_users')
      .select(`
        user_id,
        email,
        role,
        permissions,
        auth_users!inner (
          email,
          email_confirmed_at
        )
      `)
      .eq('active', true)
      .not('auth_users.email_confirmed_at', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch eligible admins: ${error.message}`);
    }

    // Filter admins who have the required permission
    return (admins || []).filter(admin => 
      admin.role === 'super_admin' || 
      admin.permissions?.includes(permission)
    );
  }

  /**
   * Gets all active admin users
   */
  private async getAllActiveAdmins() {
    const { data: admins, error } = await this.supabase
      .from('admin_users')
      .select(`
        user_id,
        email,
        role,
        auth_users!inner (
          email,
          email_confirmed_at
        )
      `)
      .eq('active', true)
      .not('auth_users.email_confirmed_at', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch active admins: ${error.message}`);
    }

    return admins || [];
  }

  /**
   * Sends email notifications to admins
   */
  private async sendEmailNotifications(
    admins: any[],
    notificationData: AdminNotificationData
  ): Promise<void> {
    try {
      const emailPromises = admins.map(async (admin) => {
        const emailData = {
          to_email: admin.auth_users.email,
          template_name: this.getEmailTemplate(notificationData.type),
          template_data: {
            admin_name: admin.email.split('@')[0], // Simple name extraction
            title: notificationData.title,
            message: notificationData.message,
            priority: notificationData.priority,
            metadata: notificationData.metadata,
            admin_dashboard_url: `${config.app.adminUrl}/dashboard`,
            timestamp: new Date().toLocaleString()
          },
          priority: notificationData.priority === 'urgent' ? 'high' : 'normal'
        };

        // Queue email for sending
        const { error } = await this.supabase
          .from('email_queue')
          .insert({
            to_email: emailData.to_email,
            template_name: emailData.template_name,
            template_data: emailData.template_data,
            priority: emailData.priority,
            status: 'pending',
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error(`Failed to queue email for ${admin.auth_users.email}:`, error);
        }
      });

      await Promise.allSettled(emailPromises);
    } catch (error) {
      console.error('Failed to send email notifications:', error);
    }
  }

  /**
   * Sends real-time notifications via WebSocket/Server-Sent Events
   */
  private async sendRealtimeNotifications(
    admins: any[],
    notificationData: AdminNotificationData
  ): Promise<void> {
    try {
      // Use Supabase Realtime to send notifications
      const channel = this.supabase.channel('admin-notifications');
      
      await channel.send({
        type: 'broadcast',
        event: 'new_notification',
        payload: {
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          priority: notificationData.priority,
          metadata: notificationData.metadata,
          timestamp: new Date().toISOString(),
          target_admins: admins.map(admin => admin.user_id)
        }
      });

      // Also trigger database change for real-time subscriptions
      const { error } = await this.supabase
        .from('admin_notification_broadcasts')
        .insert({
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          priority: notificationData.priority,
          metadata: notificationData.metadata,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to create realtime notification broadcast:', error);
      }
    } catch (error) {
      console.error('Failed to send realtime notifications:', error);
    }
  }

  /**
   * Gets appropriate email template for notification type
   */
  private getEmailTemplate(type: string): string {
    const templates = {
      'business_registration': 'admin_new_business_registration',
      'business_approved': 'admin_business_approved',
      'business_rejected': 'admin_business_rejected',
      'system_alert': 'admin_system_alert'
    };

    return templates[type] || 'admin_generic_notification';
  }

  /**
   * Marks notifications as read for a specific admin
   */
  async markNotificationsRead(
    adminUserId: string,
    notificationIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('admin_notifications')
        .update({ 
          read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('admin_user_id', adminUserId)
        .in('id', notificationIds);

      if (error) {
        return { 
          success: false, 
          error: `Failed to mark notifications as read: ${error.message}` 
        };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Gets unread notification count for an admin
   */
  async getUnreadCount(adminUserId: string): Promise<{ count: number; error?: string }> {
    try {
      const { count, error } = await this.supabase
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('admin_user_id', adminUserId)
        .eq('read', false);

      if (error) {
        return { count: 0, error: error.message };
      }

      return { count: count || 0 };
    } catch (error) {
      return { 
        count: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Gets paginated notifications for an admin
   */
  async getNotifications(
    adminUserId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: string;
    } = {}
  ): Promise<{ notifications: any[]; total: number; error?: string }> {
    try {
      const { 
        limit = 20, 
        offset = 0, 
        unreadOnly = false, 
        type 
      } = options;

      let query = this.supabase
        .from('admin_notifications')
        .select('*', { count: 'exact' })
        .eq('admin_user_id', adminUserId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.eq('read', false);
      }

      if (type) {
        query = query.eq('type', type);
      }

      const { data: notifications, count, error } = await query;

      if (error) {
        return { 
          notifications: [], 
          total: 0, 
          error: error.message 
        };
      }

      return { 
        notifications: notifications || [], 
        total: count || 0 
      };
    } catch (error) {
      return { 
        notifications: [], 
        total: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const adminNotificationService = new AdminNotificationService();