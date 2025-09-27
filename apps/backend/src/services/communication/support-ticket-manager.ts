import type { 
  SupportTicket,
  SupportTicketMessage,
  SupportTicketStatus,
  SupportTicketPriority,
  SupportChannel,
  RecipientType
} from '@vocilia/types';
import { 
  SupportTicketModel,
  SupportTicketMessageModel,
  CommunicationNotificationModel 
} from '@vocilia/database';

export class SupportTicketManagerService {
  /**
   * Create a new support ticket
   */
  async createTicket(ticketData: {
    customer_id?: string;
    business_id?: string;
    subject: string;
    description: string;
    priority?: SupportTicketPriority;
    channel: SupportChannel;
    contact_email?: string;
    contact_phone?: string;
    category?: string;
  }): Promise<SupportTicket> {
    try {
      // Determine priority if not provided
      const priority = ticketData.priority || this.determinePriority(ticketData.subject, ticketData.description);
      
      // Calculate SLA deadline based on priority and channel
      const slaDeadline = this.calculateSLADeadline(priority, ticketData.channel);

      // Create ticket
      const ticket = await SupportTicketModel.create({
        ...ticketData,
        priority,
        status: 'open',
        sla_deadline: slaDeadline.toISOString(),
        created_by: ticketData.customer_id || ticketData.business_id || 'system'
      });

      // Create initial message with description
      await SupportTicketMessageModel.create({
        ticket_id: ticket.id,
        sender_type: ticketData.customer_id ? 'customer' : 'business',
        sender_id: ticketData.customer_id || ticketData.business_id || 'anonymous',
        content: ticketData.description,
        is_internal: false
      });

      // Send confirmation notification
      await this.sendTicketCreatedNotification(ticket);

      // Auto-assign if enabled
      if (process.env.SUPPORT_AUTO_ASSIGNMENT_ENABLED === 'true') {
        await this.autoAssignTicket(ticket);
      }

      console.log(`Support ticket created: ${ticket.id} (priority: ${priority})`);
      return ticket;

    } catch (error) {
      console.error('Failed to create support ticket:', error);
      throw error;
    }
  }

  /**
   * Add message to support ticket
   */
  async addMessage(
    ticketId: string, 
    senderId: string, 
    senderType: 'customer' | 'business' | 'admin',
    content: string,
    isInternal: boolean = false,
    attachments?: string[]
  ): Promise<SupportTicketMessage> {
    try {
      const ticket = await SupportTicketModel.getById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Create message
      const message = await SupportTicketMessageModel.create({
        ticket_id: ticketId,
        sender_type: senderType,
        sender_id: senderId,
        content,
        is_internal: isInternal,
        attachments: attachments || []
      });

      // Update ticket status and last activity
      const newStatus = senderType === 'admin' ? 'in_progress' : 'awaiting_response';
      await SupportTicketModel.updateStatus(ticketId, newStatus);

      // Send notification to relevant parties (if not internal message)
      if (!isInternal) {
        await this.sendMessageNotification(ticket, message, senderType);
      }

      // Check if response is within SLA
      if (senderType === 'admin') {
        await this.checkSLACompliance(ticket, message);
      }

      return message;

    } catch (error) {
      console.error('Failed to add ticket message:', error);
      throw error;
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string, 
    status: SupportTicketStatus, 
    adminId: string,
    resolutionNotes?: string
  ): Promise<SupportTicket> {
    try {
      const ticket = await SupportTicketModel.getById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Update status
      const updatedTicket = await SupportTicketModel.updateStatus(ticketId, status, adminId);

      // Add status change message
      let statusMessage = `Ticket status changed to: ${status}`;
      if (resolutionNotes && status === 'resolved') {
        statusMessage += `\n\nResolution notes: ${resolutionNotes}`;
      }

      await SupportTicketMessageModel.create({
        ticket_id: ticketId,
        sender_type: 'admin',
        sender_id: adminId,
        content: statusMessage,
        is_internal: false
      });

      // Send status update notification
      await this.sendStatusUpdateNotification(updatedTicket, status);

      // Calculate resolution time for analytics
      if (status === 'resolved' || status === 'closed') {
        await this.trackResolutionMetrics(updatedTicket);
      }

      return updatedTicket;

    } catch (error) {
      console.error('Failed to update ticket status:', error);
      throw error;
    }
  }

  /**
   * Assign ticket to admin user
   */
  async assignTicket(ticketId: string, adminId: string, assignedBy: string): Promise<SupportTicket> {
    try {
      const ticket = await SupportTicketModel.assignTo(ticketId, adminId);

      // Add assignment message
      await SupportTicketMessageModel.create({
        ticket_id: ticketId,
        sender_type: 'admin',
        sender_id: assignedBy,
        content: `Ticket assigned to admin user`,
        is_internal: true
      });

      // Update status to in_progress
      await SupportTicketModel.updateStatus(ticketId, 'in_progress');

      console.log(`Ticket ${ticketId} assigned to ${adminId}`);
      return ticket;

    } catch (error) {
      console.error('Failed to assign ticket:', error);
      throw error;
    }
  }

  /**
   * Auto-assign ticket based on workload and expertise
   */
  private async autoAssignTicket(ticket: SupportTicket): Promise<void> {
    try {
      // Simple round-robin assignment for now
      // In production, this would consider admin workload, expertise, etc.
      const availableAdmins = await this.getAvailableAdmins();
      
      if (availableAdmins.length === 0) {
        console.log('No available admins for auto-assignment');
        return;
      }

      // Find admin with least active tickets
      const adminWorkloads = await Promise.all(
        availableAdmins.map(async admin => ({
          adminId: admin.id,
          activeTickets: await SupportTicketModel.getActiveTicketCountForAdmin(admin.id)
        }))
      );

      const leastBusyAdmin = adminWorkloads.reduce((min, current) => 
        current.activeTickets < min.activeTickets ? current : min
      );

      await this.assignTicket(ticket.id, leastBusyAdmin.adminId, 'system');

    } catch (error) {
      console.error('Auto-assignment failed:', error);
    }
  }

  /**
   * Check for SLA violations and escalate if necessary
   */
  async checkSLAViolations(): Promise<void> {
    try {
      const violations = await SupportTicketModel.getSLAViolations();
      
      for (const ticket of violations) {
        await this.escalateTicket(ticket);
      }

      if (violations.length > 0) {
        console.log(`Escalated ${violations.length} SLA violations`);
      }

    } catch (error) {
      console.error('SLA violation check failed:', error);
    }
  }

  /**
   * Escalate ticket due to SLA violation
   */
  private async escalateTicket(ticket: SupportTicket): Promise<void> {
    try {
      // Increase priority
      const newPriority: SupportTicketPriority = 
        ticket.priority === 'low' ? 'medium' :
        ticket.priority === 'medium' ? 'high' : 'urgent';

      await SupportTicketModel.updatePriority(ticket.id, newPriority);

      // Add escalation message
      await SupportTicketMessageModel.create({
        ticket_id: ticket.id,
        sender_type: 'admin',
        sender_id: 'system',
        content: `Ticket escalated due to SLA violation. Priority increased to: ${newPriority}`,
        is_internal: true
      });

      // Notify supervisor
      await this.sendEscalationNotification(ticket, newPriority);

      console.log(`Ticket ${ticket.id} escalated to ${newPriority} priority`);

    } catch (error) {
      console.error('Ticket escalation failed:', error);
    }
  }

  /**
   * Calculate SLA deadline based on priority and channel
   */
  private calculateSLADeadline(priority: SupportTicketPriority, channel: SupportChannel): Date {
    const now = new Date();
    let hoursToAdd = 2; // Default 2 hours

    // Adjust based on priority
    switch (priority) {
      case 'urgent':
        hoursToAdd = 1;
        break;
      case 'high':
        hoursToAdd = 2;
        break;
      case 'medium':
        hoursToAdd = 4;
        break;
      case 'low':
        hoursToAdd = 24;
        break;
    }

    // Adjust based on channel
    if (channel === 'phone') {
      hoursToAdd = Math.min(hoursToAdd, 0.5); // 30 minutes max for phone
    }

    const deadline = new Date(now.getTime() + (hoursToAdd * 60 * 60 * 1000));
    return deadline;
  }

  /**
   * Determine priority based on subject and content
   */
  private determinePriority(subject: string, description: string): SupportTicketPriority {
    const urgentKeywords = ['fraud', 'security', 'hacked', 'stolen', 'emergency'];
    const highKeywords = ['payment', 'billing', 'money', 'refund', 'charge'];
    const lowKeywords = ['question', 'how to', 'general', 'info'];

    const text = `${subject} ${description}`.toLowerCase();

    if (urgentKeywords.some(keyword => text.includes(keyword))) {
      return 'urgent';
    }
    if (highKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    }
    if (lowKeywords.some(keyword => text.includes(keyword))) {
      return 'low';
    }

    return 'medium'; // Default
  }

  /**
   * Send ticket created notification
   */
  private async sendTicketCreatedNotification(ticket: SupportTicket): Promise<void> {
    try {
      const recipientType: RecipientType = ticket.customer_id ? 'customer' : 'business';
      const recipientId = ticket.customer_id || ticket.business_id || '';

      if (!recipientId) return;

      await CommunicationNotificationModel.create({
        recipient_type: recipientType,
        recipient_id: recipientId,
        notification_type: 'support_ticket_created',
        channel: 'sms',
        template_data: {
          ticket_id: ticket.id,
          subject: ticket.subject,
          sla_deadline: ticket.sla_deadline
        },
        recipient_phone: ticket.contact_phone,
        language: 'sv'
      });

    } catch (error) {
      console.error('Failed to send ticket created notification:', error);
    }
  }

  /**
   * Send message notification to relevant parties
   */
  private async sendMessageNotification(
    ticket: SupportTicket, 
    message: SupportTicketMessage, 
    senderType: string
  ): Promise<void> {
    try {
      // Don't notify the sender
      const shouldNotifyCustomer = senderType !== 'customer' && ticket.customer_id;
      const shouldNotifyBusiness = senderType !== 'business' && ticket.business_id;

      if (shouldNotifyCustomer && ticket.contact_phone) {
        await CommunicationNotificationModel.create({
          recipient_type: 'customer',
          recipient_id: ticket.customer_id!,
          notification_type: 'support_message_received',
          channel: 'sms',
          template_data: {
            ticket_id: ticket.id,
            message_preview: message.content.substring(0, 100)
          },
          recipient_phone: ticket.contact_phone,
          language: 'sv'
        });
      }

      if (shouldNotifyBusiness && ticket.contact_phone) {
        await CommunicationNotificationModel.create({
          recipient_type: 'business',
          recipient_id: ticket.business_id!,
          notification_type: 'support_message_received',
          channel: 'sms',
          template_data: {
            ticket_id: ticket.id,
            message_preview: message.content.substring(0, 100)
          },
          recipient_phone: ticket.contact_phone,
          language: 'sv'
        });
      }

    } catch (error) {
      console.error('Failed to send message notification:', error);
    }
  }

  /**
   * Send status update notification
   */
  private async sendStatusUpdateNotification(ticket: SupportTicket, status: SupportTicketStatus): Promise<void> {
    try {
      const recipientType: RecipientType = ticket.customer_id ? 'customer' : 'business';
      const recipientId = ticket.customer_id || ticket.business_id || '';

      if (!recipientId || !ticket.contact_phone) return;

      await CommunicationNotificationModel.create({
        recipient_type: recipientType,
        recipient_id: recipientId,
        notification_type: 'support_ticket_updated',
        channel: 'sms',
        template_data: {
          ticket_id: ticket.id,
          status: status,
          subject: ticket.subject
        },
        recipient_phone: ticket.contact_phone,
        language: 'sv'
      });

    } catch (error) {
      console.error('Failed to send status update notification:', error);
    }
  }

  /**
   * Send escalation notification to supervisors
   */
  private async sendEscalationNotification(ticket: SupportTicket, newPriority: SupportTicketPriority): Promise<void> {
    // Implementation would send notification to supervisor admin accounts
    console.log(`Escalation notification for ticket ${ticket.id} (priority: ${newPriority})`);
  }

  /**
   * Check SLA compliance for admin response
   */
  private async checkSLACompliance(ticket: SupportTicket, message: SupportTicketMessage): Promise<void> {
    try {
      const slaDeadline = new Date(ticket.sla_deadline);
      const responseTime = new Date(message.created_at);
      const withinSLA = responseTime <= slaDeadline;

      // Log SLA compliance for analytics
      console.log(`SLA compliance for ticket ${ticket.id}: ${withinSLA ? 'PASS' : 'FAIL'}`);

      // Could store this in a metrics table for reporting

    } catch (error) {
      console.error('SLA compliance check failed:', error);
    }
  }

  /**
   * Track resolution metrics
   */
  private async trackResolutionMetrics(ticket: SupportTicket): Promise<void> {
    try {
      const resolutionTime = new Date().getTime() - new Date(ticket.created_at).getTime();
      const resolutionHours = resolutionTime / (1000 * 60 * 60);

      console.log(`Ticket ${ticket.id} resolved in ${resolutionHours.toFixed(1)} hours`);

      // Could store metrics in analytics table

    } catch (error) {
      console.error('Resolution metrics tracking failed:', error);
    }
  }

  /**
   * Get available admin users for assignment
   */
  private async getAvailableAdmins(): Promise<Array<{ id: string; name: string }>> {
    // Mock implementation - would query admin_accounts table
    return [
      { id: 'admin1', name: 'Admin User 1' },
      { id: 'admin2', name: 'Admin User 2' }
    ];
  }

  /**
   * Get support ticket statistics
   */
  async getTicketStats(days: number = 7): Promise<{
    total_tickets: number;
    open_tickets: number;
    resolved_tickets: number;
    avg_resolution_time_hours: number;
    sla_compliance_rate: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // This would query actual statistics from the database
    return {
      total_tickets: 0,
      open_tickets: 0,
      resolved_tickets: 0,
      avg_resolution_time_hours: 0,
      sla_compliance_rate: 0
    };
  }
}