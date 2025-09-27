import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { addBusinessDays, formatISO } from 'date-fns';
import app from '../../src/app';
import { Database } from '@vocilia/types/database';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Business Verification Request Integration', () => {
  let testBusinessId: string;
  let testStoreId: string;
  let testVerificationBatchId: string;
  let testNotificationId: string;

  beforeAll(async () => {
    // Setup test business
    const { data: business } = await supabase
      .from('user_accounts')
      .insert({
        phone_number: '+46701234568',
        email: 'test-business@example.com',
        user_type: 'business',
        preferences: { 
          language: 'sv', 
          notifications_enabled: true,
          verification_reminders: true 
        }
      })
      .select()
      .single();
    testBusinessId = business.id;

    // Setup test store
    const { data: store } = await supabase
      .from('stores')
      .insert({
        name: 'Test Verification Store',
        business_id: testBusinessId,
        email: 'store@example.com',
        communication_preferences: { 
          verification_notifications: true,
          reminder_frequency: 'standard'
        }
      })
      .select()
      .single();
    testStoreId = store.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('communication_notifications').delete().eq('recipient_id', testBusinessId);
    await supabase.from('verification_batches').delete().eq('business_id', testBusinessId);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('user_accounts').delete().eq('id', testBusinessId);
  });

  beforeEach(async () => {
    // Clean notifications and batches before each test
    await supabase.from('communication_notifications').delete().eq('recipient_id', testBusinessId);
    await supabase.from('verification_batches').delete().eq('business_id', testBusinessId);
  });

  test('should send verification request when weekly database is ready', async () => {
    // Create verification batch for business
    const { data: batch } = await supabase
      .from('verification_batches')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        batch_period: '2025-09-22/2025-09-28',
        total_transactions: 25,
        total_reward_amount_sek: 1250,
        verification_deadline: formatISO(addBusinessDays(new Date(), 5)),
        status: 'pending_verification'
      })
      .select()
      .single();
    testVerificationBatchId = batch.id;

    // Trigger verification request notification
    const response = await request(app)
      .post('/api/admin/verification/send-requests')
      .send({
        batch_ids: [testVerificationBatchId]
      })
      .expect(200);

    expect(response.body.requests_sent).toBe(1);
    expect(response.body.notifications_created).toBe(1);

    // Verify email notification was created
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'verification_request')
      .eq('channel', 'email')
      .single();

    expect(notification).toBeDefined();
    expect(notification.status).toBe('sent');
    expect(notification.content).toContain('Verifiering krävs');
    expect(notification.content).toContain('5 arbetsdagar');
    expect(notification.content).toContain('25 transaktioner');
    expect(notification.recipient_email).toBe('test-business@example.com');
    testNotificationId = notification.id;
  });

  test('should include verification deadline and database access instructions', async () => {
    // Create verification batch with specific data
    const verificationDeadline = addBusinessDays(new Date(), 5);
    const { data: batch } = await supabase
      .from('verification_batches')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        batch_period: '2025-09-22/2025-09-28',
        total_transactions: 42,
        total_reward_amount_sek: 2100,
        verification_deadline: formatISO(verificationDeadline),
        database_url: 'https://admin.vocilia.com/verification/batch-123',
        status: 'pending_verification'
      })
      .select()
      .single();

    // Send verification request
    await request(app)
      .post('/api/admin/verification/send-requests')
      .send({
        batch_ids: [batch.id]
      })
      .expect(200);

    // Verify notification content
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'verification_request')
      .single();

    expect(notification.content).toContain('42 transaktioner');
    expect(notification.content).toContain('2 100 kr');
    expect(notification.content).toContain('https://admin.vocilia.com/verification/batch-123');
    expect(notification.content).toContain(formatISO(verificationDeadline, { representation: 'date' }));
    expect(notification.content).toContain('penalty'); // Penalty warning
  });

  test('should send reminder notifications before deadline', async () => {
    // Create verification batch with deadline in 3 days
    const verificationDeadline = addBusinessDays(new Date(), 3);
    const { data: batch } = await supabase
      .from('verification_batches')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        batch_period: '2025-09-22/2025-09-28',
        total_transactions: 18,
        total_reward_amount_sek: 900,
        verification_deadline: formatISO(verificationDeadline),
        status: 'pending_verification'
      })
      .select()
      .single();

    // Trigger reminder processing (simulates cron job)
    const response = await request(app)
      .post('/api/admin/verification/process-reminders')
      .expect(200);

    expect(response.body.reminders_sent).toBeGreaterThan(0);

    // Verify reminder notification was created
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'verification_reminder')
      .eq('channel', 'email')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('Påminnelse');
    expect(notification.content).toContain('3 arbetsdagar');
    expect(notification.content).toContain('deadline');
  });

  test('should handle verification completion confirmation', async () => {
    // Create verification batch
    const { data: batch } = await supabase
      .from('verification_batches')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        batch_period: '2025-09-22/2025-09-28',
        total_transactions: 30,
        total_reward_amount_sek: 1500,
        verification_deadline: formatISO(addBusinessDays(new Date(), 5)),
        status: 'pending_verification'
      })
      .select()
      .single();

    // Simulate business completing verification
    const response = await request(app)
      .post(`/api/business/verification/${batch.id}/submit`)
      .send({
        verified_transactions: 28,
        rejected_transactions: 2,
        rejection_reasons: ['duplicate', 'invalid_feedback'],
        business_signature: 'Test Business AB',
        verification_notes: 'Completed verification review'
      })
      .expect(200);

    expect(response.body.verification_status).toBe('completed');

    // Verify confirmation notification was sent
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'verification_completed')
      .eq('channel', 'email')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('Verifiering mottagen');
    expect(notification.content).toContain('28 godkända');
    expect(notification.content).toContain('2 avvisade');
    expect(notification.content).toContain('betalning kommer att skickas');
  });

  test('should escalate overdue verification notifications', async () => {
    // Create verification batch with past deadline
    const pastDeadline = addBusinessDays(new Date(), -1); // 1 day overdue
    const { data: batch } = await supabase
      .from('verification_batches')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        batch_period: '2025-09-15/2025-09-21',
        total_transactions: 15,
        total_reward_amount_sek: 750,
        verification_deadline: formatISO(pastDeadline),
        status: 'overdue'
      })
      .select()
      .single();

    // Trigger overdue processing
    const response = await request(app)
      .post('/api/admin/verification/process-overdue')
      .expect(200);

    expect(response.body.overdue_processed).toBeGreaterThan(0);

    // Verify escalation notification
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'verification_overdue')
      .eq('channel', 'email')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('FÖRSENAD');
    expect(notification.content).toContain('penalty');
    expect(notification.content).toContain('immediate action');
  });

  test('should support multiple communication channels for critical notifications', async () => {
    // Update business preferences for multi-channel
    await supabase
      .from('user_accounts')
      .update({ 
        preferences: { 
          language: 'sv', 
          notifications_enabled: true,
          verification_reminders: true,
          urgent_notifications_sms: true 
        } 
      })
      .eq('id', testBusinessId);

    // Create critical verification batch (large amount)
    const { data: batch } = await supabase
      .from('verification_batches')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        batch_period: '2025-09-22/2025-09-28',
        total_transactions: 100,
        total_reward_amount_sek: 10000, // Large amount triggers SMS
        verification_deadline: formatISO(addBusinessDays(new Date(), 5)),
        status: 'pending_verification',
        priority: 'high'
      })
      .select()
      .single();

    // Send verification request
    await request(app)
      .post('/api/admin/verification/send-requests')
      .send({
        batch_ids: [batch.id]
      })
      .expect(200);

    // Verify both email and SMS notifications were created
    const { data: notifications } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'verification_request');

    expect(notifications).toHaveLength(2);
    
    const emailNotification = notifications.find(n => n.channel === 'email');
    const smsNotification = notifications.find(n => n.channel === 'sms');
    
    expect(emailNotification).toBeDefined();
    expect(smsNotification).toBeDefined();
    expect(smsNotification.content).toContain('URGENT');
  });

  test('should handle English language preference for international businesses', async () => {
    // Update business language preference
    await supabase
      .from('user_accounts')
      .update({ preferences: { language: 'en', notifications_enabled: true } })
      .eq('id', testBusinessId);

    // Create verification batch
    const { data: batch } = await supabase
      .from('verification_batches')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        batch_period: '2025-09-22/2025-09-28',
        total_transactions: 20,
        total_reward_amount_sek: 1000,
        verification_deadline: formatISO(addBusinessDays(new Date(), 5)),
        status: 'pending_verification'
      })
      .select()
      .single();

    // Send verification request
    await request(app)
      .post('/api/admin/verification/send-requests')
      .send({
        batch_ids: [batch.id]
      })
      .expect(200);

    // Verify English notification
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'verification_request')
      .single();

    expect(notification.content).toContain('Verification required');
    expect(notification.content).toContain('business days');
    expect(notification.content).toContain('SEK'); // Currency in English format
    expect(notification.content).toContain('database access');
  });
});