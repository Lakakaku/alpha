import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { addHours, addMinutes } from 'date-fns';
import app from '../../src/app';
import { Database } from '@vocilia/types/database';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Support Ticket Lifecycle Integration', () => {
  let testCustomerId: string;
  let testBusinessId: string;
  let testSupportTicketId: string;
  let testAdminId: string;

  beforeAll(async () => {
    // Setup test customer
    const { data: customer } = await supabase
      .from('user_accounts')
      .insert({
        phone_number: '+46701234569',
        email: 'customer@example.com',
        user_type: 'customer',
        preferences: { language: 'sv', notifications_enabled: true }
      })
      .select()
      .single();
    testCustomerId = customer.id;

    // Setup test business
    const { data: business } = await supabase
      .from('user_accounts')
      .insert({
        phone_number: '+46701234570',
        email: 'business@example.com',
        user_type: 'business',
        preferences: { language: 'sv', notifications_enabled: true }
      })
      .select()
      .single();
    testBusinessId = business.id;

    // Setup test admin
    const { data: admin } = await supabase
      .from('admin_accounts')
      .insert({
        email: 'admin@vocilia.com',
        name: 'Test Admin',
        role: 'support_agent',
        is_active: true
      })
      .select()
      .single();
    testAdminId = admin.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('support_ticket_messages').delete().eq('ticket_id', testSupportTicketId);
    await supabase.from('support_tickets').delete().in('requester_id', [testCustomerId, testBusinessId]);
    await supabase.from('communication_notifications').delete().in('recipient_id', [testCustomerId, testBusinessId]);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
    await supabase.from('user_accounts').delete().in('id', [testCustomerId, testBusinessId]);
  });

  beforeEach(async () => {
    // Clean support data before each test
    await supabase.from('support_ticket_messages').delete().eq('ticket_id', testSupportTicketId);
    await supabase.from('support_tickets').delete().in('requester_id', [testCustomerId, testBusinessId]);
    await supabase.from('communication_notifications').delete().in('recipient_id', [testCustomerId, testBusinessId]);
  });

  test('should create support ticket and send confirmation notification', async () => {
    // Customer creates support ticket
    const response = await request(app)
      .post('/api/customer/support/tickets')
      .send({
        customer_id: testCustomerId,
        subject: 'Payment issue with reward',
        message: 'I have not received my reward payment from last week',
        priority: 'medium',
        category: 'payment',
        channel: 'web'
      })
      .expect(201);

    expect(response.body.ticket_id).toBeDefined();
    testSupportTicketId = response.body.ticket_id;

    // Verify ticket was created
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', testSupportTicketId)
      .single();

    expect(ticket).toBeDefined();
    expect(ticket.status).toBe('open');
    expect(ticket.priority).toBe('medium');
    expect(ticket.sla_deadline).toBeDefined();
    expect(new Date(ticket.sla_deadline)).toBeAfter(new Date());

    // Verify confirmation notification sent
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'support_ticket_created')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('Support ticket created');
    expect(notification.content).toContain(testSupportTicketId);
    expect(notification.content).toContain('2 timmar'); // SLA response time
  });

  test('should assign ticket to agent and track SLA compliance', async () => {
    // Create support ticket
    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({
        requester_id: testCustomerId,
        requester_type: 'customer',
        subject: 'Unable to access rewards',
        message: 'The app is not showing my reward balance',
        priority: 'high',
        category: 'technical',
        channel: 'email',
        status: 'open',
        sla_deadline: addHours(new Date(), 2).toISOString()
      })
      .select()
      .single();
    testSupportTicketId = ticket.id;

    // Admin assigns ticket to agent
    const assignResponse = await request(app)
      .post(`/api/admin/support/tickets/${testSupportTicketId}/assign`)
      .send({
        assigned_to: testAdminId,
        priority: 'high'
      })
      .expect(200);

    expect(assignResponse.body.assigned_to).toBe(testAdminId);

    // Verify assignment notification sent to customer
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'support_ticket_assigned')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('assigned');
    expect(notification.content).toContain('Test Admin');

    // Verify SLA tracking
    const { data: updatedTicket } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', testSupportTicketId)
      .single();

    expect(updatedTicket.assigned_to).toBe(testAdminId);
    expect(updatedTicket.assigned_at).toBeDefined();
  });

  test('should handle ticket response and update SLA status', async () => {
    // Create and assign ticket
    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({
        requester_id: testBusinessId,
        requester_type: 'business',
        subject: 'Verification deadline extension request',
        message: 'We need an extension for this weeks verification due to technical issues',
        priority: 'high',
        category: 'verification',
        channel: 'email',
        status: 'in_progress',
        assigned_to: testAdminId,
        sla_deadline: addHours(new Date(), 2).toISOString()
      })
      .select()
      .single();
    testSupportTicketId = ticket.id;

    // Agent responds to ticket
    const responseMessage = await request(app)
      .post(`/api/admin/support/tickets/${testSupportTicketId}/messages`)
      .send({
        sender_id: testAdminId,
        sender_type: 'admin',
        message: 'We understand your technical difficulties. I can extend your verification deadline by 2 business days.',
        message_type: 'response',
        is_internal: false
      })
      .expect(201);

    expect(responseMessage.body.message_id).toBeDefined();

    // Verify response notification sent to business
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'support_ticket_response')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('response');
    expect(notification.content).toContain(testSupportTicketId);

    // Verify SLA compliance tracked
    const { data: updatedTicket } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', testSupportTicketId)
      .single();

    expect(updatedTicket.first_response_at).toBeDefined();
    expect(updatedTicket.sla_breached).toBe(false);
  });

  test('should escalate tickets when SLA deadline is breached', async () => {
    // Create ticket with past SLA deadline
    const pastDeadline = addMinutes(new Date(), -30); // 30 minutes overdue
    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({
        requester_id: testCustomerId,
        requester_type: 'customer',
        subject: 'Urgent: Cannot access account',
        message: 'I have been locked out of my account and cannot view my rewards',
        priority: 'high',
        category: 'account',
        channel: 'phone',
        status: 'open',
        sla_deadline: pastDeadline.toISOString(),
        sla_breached: true
      })
      .select()
      .single();
    testSupportTicketId = ticket.id;

    // Run SLA monitoring process
    const escalationResponse = await request(app)
      .post('/api/admin/support/process-sla-escalations')
      .expect(200);

    expect(escalationResponse.body.tickets_escalated).toBeGreaterThan(0);

    // Verify escalation notification sent to customer
    const { data: customerNotification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'support_ticket_escalated')
      .single();

    expect(customerNotification).toBeDefined();
    expect(customerNotification.content).toContain('escalated');
    expect(customerNotification.content).toContain('prioritized');

    // Verify internal escalation notification sent to admin
    const { data: updatedTicket } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', testSupportTicketId)
      .single();

    expect(updatedTicket.escalated_at).toBeDefined();
    expect(updatedTicket.priority).toBe('urgent'); // Priority should be escalated
  });

  test('should handle ticket resolution and satisfaction survey', async () => {
    // Create and resolve ticket
    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({
        requester_id: testCustomerId,
        requester_type: 'customer',
        subject: 'Question about reward calculation',
        message: 'How is the reward percentage calculated based on feedback quality?',
        priority: 'low',
        category: 'general',
        channel: 'chat',
        status: 'in_progress',
        assigned_to: testAdminId,
        first_response_at: new Date().toISOString(),
        sla_deadline: addHours(new Date(), 2).toISOString()
      })
      .select()
      .single();
    testSupportTicketId = ticket.id;

    // Agent resolves ticket
    const resolutionResponse = await request(app)
      .post(`/api/admin/support/tickets/${testSupportTicketId}/resolve`)
      .send({
        resolution_message: 'Reward percentage is calculated linearly from 2% (score 50) to 15% (score 100). Higher quality feedback earns higher rewards.',
        resolution_category: 'information_provided',
        customer_satisfied: true
      })
      .expect(200);

    expect(resolutionResponse.body.status).toBe('resolved');

    // Verify resolution notification sent
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'support_ticket_resolved')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('resolved');
    expect(notification.content).toContain('satisfaction survey');

    // Verify ticket status updated
    const { data: updatedTicket } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', testSupportTicketId)
      .single();

    expect(updatedTicket.status).toBe('resolved');
    expect(updatedTicket.resolved_at).toBeDefined();
    expect(updatedTicket.resolution_time_minutes).toBeDefined();
  });

  test('should support multi-channel communication preferences', async () => {
    // Update customer preferences for urgent phone notifications
    await supabase
      .from('user_accounts')
      .update({ 
        preferences: { 
          language: 'sv', 
          notifications_enabled: true,
          urgent_support_phone: true,
          preferred_support_channel: 'phone'
        } 
      })
      .eq('id', testCustomerId);

    // Create urgent support ticket
    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({
        requester_id: testCustomerId,
        requester_type: 'customer',
        subject: 'URGENT: Fraudulent charges on account',
        message: 'I see charges I did not authorize, need immediate assistance',
        priority: 'urgent',
        category: 'security',
        channel: 'phone',
        status: 'open',
        sla_deadline: addMinutes(new Date(), 30).toISOString() // 30 min SLA for urgent
      })
      .select()
      .single();
    testSupportTicketId = ticket.id;

    // Verify multiple notification channels for urgent ticket
    const { data: notifications } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'support_ticket_created');

    expect(notifications.length).toBeGreaterThanOrEqual(1);
    
    // Should have SMS notification for urgent security issue
    const smsNotification = notifications.find(n => n.channel === 'sms');
    expect(smsNotification).toBeDefined();
    expect(smsNotification.content).toContain('URGENT');
    expect(smsNotification.content).toContain('security');
  });

  test('should handle internal notes and agent collaboration', async () => {
    // Create complex ticket requiring collaboration
    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({
        requester_id: testBusinessId,
        requester_type: 'business',
        subject: 'Complex verification discrepancy',
        message: 'We found significant discrepancies in this weeks verification data that require technical review',
        priority: 'high',
        category: 'verification',
        channel: 'email',
        status: 'in_progress',
        assigned_to: testAdminId
      })
      .select()
      .single();
    testSupportTicketId = ticket.id;

    // Agent adds internal note
    const internalNoteResponse = await request(app)
      .post(`/api/admin/support/tickets/${testSupportTicketId}/messages`)
      .send({
        sender_id: testAdminId,
        sender_type: 'admin',
        message: 'This requires database team review. Escalating to technical team for data integrity check.',
        message_type: 'internal_note',
        is_internal: true,
        tags: ['technical_escalation', 'database_review']
      })
      .expect(201);

    expect(internalNoteResponse.body.is_internal).toBe(true);

    // Verify no notification sent to business for internal note
    const { data: notifications } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .gte('created_at', new Date().toISOString());

    const internalNoteNotifications = notifications.filter(n => 
      n.notification_type === 'support_ticket_internal_note'
    );
    expect(internalNoteNotifications).toHaveLength(0);

    // Verify internal message recorded
    const { data: message } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', testSupportTicketId)
      .eq('is_internal', true)
      .single();

    expect(message).toBeDefined();
    expect(message.message).toContain('technical team');
  });
});