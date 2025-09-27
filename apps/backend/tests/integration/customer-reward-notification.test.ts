import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import app from '../../src/app';
import { Database } from '@vocilia/types';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Customer Reward Notification Integration', () => {
  let testCustomerId: string;
  let testStoreId: string;
  let testFeedbackSessionId: string;
  let testNotificationId: string;

  beforeAll(async () => {
    // Setup test customer
    const { data: customer } = await supabase
      .from('user_accounts')
      .insert({
        phone_number: '+46701234567',
        preferences: { language: 'sv', notifications_enabled: true }
      })
      .select()
      .single();
    testCustomerId = customer.id;

    // Setup test store
    const { data: store } = await supabase
      .from('stores')
      .insert({
        name: 'Test Reward Store',
        business_id: testCustomerId,
        communication_preferences: { notifications_enabled: true }
      })
      .select()
      .single();
    testStoreId = store.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('communication_notifications').delete().eq('recipient_id', testCustomerId);
    await supabase.from('feedback_sessions').delete().eq('customer_id', testCustomerId);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('user_accounts').delete().eq('id', testCustomerId);
  });

  beforeEach(async () => {
    // Clean notifications before each test
    await supabase.from('communication_notifications').delete().eq('recipient_id', testCustomerId);
  });

  test('should send immediate SMS notification when customer earns reward', async () => {
    // Create feedback session that earns reward
    const { data: feedbackSession } = await supabase
      .from('feedback_sessions')
      .insert({
        customer_id: testCustomerId,
        store_id: testStoreId,
        quality_score: 85, // High quality score for reward eligibility
        feedback_content: 'Excellent service and great food quality!',
        transaction_amount_sek: 250,
        status: 'completed'
      })
      .select()
      .single();
    testFeedbackSessionId = feedbackSession.id;

    // Trigger reward calculation
    const response = await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .send({
        feedback_session_ids: [testFeedbackSessionId]
      })
      .expect(200);

    expect(response.body.rewards_calculated).toBe(1);
    expect(response.body.notifications_sent).toBe(1);

    // Verify SMS notification was created
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'reward_earned')
      .eq('channel', 'sms')
      .single();

    expect(notification).toBeDefined();
    expect(notification.status).toBe('sent');
    expect(notification.content).toContain('Belöning');
    expect(notification.content).toContain('250 kr');
    expect(notification.recipient_phone).toBe('+46701234567');
    testNotificationId = notification.id;
  });

  test('should include correct reward amount and payment date in SMS', async () => {
    // Create feedback that earns specific reward percentage
    const { data: feedbackSession } = await supabase
      .from('feedback_sessions')
      .insert({
        customer_id: testCustomerId,
        store_id: testStoreId,
        quality_score: 90, // Score 90 should give ~13% reward
        feedback_content: 'Outstanding experience, highly recommend!',
        transaction_amount_sek: 200,
        status: 'completed'
      })
      .select()
      .single();

    // Trigger reward calculation
    await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .send({
        feedback_session_ids: [feedbackSession.id]
      })
      .expect(200);

    // Verify notification content
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'reward_earned')
      .single();

    expect(notification.content).toContain('26 kr'); // ~13% of 200 kr
    expect(notification.content).toContain('kvalitetspoäng: 90');
    expect(notification.content).toMatch(/betalning.*söndag/i); // Payment on Sunday
  });

  test('should handle SMS delivery failure with retry mechanism', async () => {
    // Mock Twilio to fail delivery
    const originalTwilioSend = jest.fn().mockRejectedValue(new Error('SMS delivery failed'));
    
    // Create feedback session
    const { data: feedbackSession } = await supabase
      .from('feedback_sessions')
      .insert({
        customer_id: testCustomerId,
        store_id: testStoreId,
        quality_score: 75,
        feedback_content: 'Good service overall',
        transaction_amount_sek: 150,
        status: 'completed'
      })
      .select()
      .single();

    // Trigger reward calculation
    await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .send({
        feedback_session_ids: [feedbackSession.id]
      })
      .expect(200);

    // Check notification is marked for retry
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'reward_earned')
      .single();

    expect(notification.status).toBe('failed');
    expect(notification.retry_count).toBe(0);
    expect(notification.failed_reason).toContain('SMS delivery failed');

    // Trigger retry processing
    await request(app)
      .post('/api/admin/notifications/process-retries')
      .expect(200);

    // Check retry was attempted
    const { data: updatedNotification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('id', notification.id)
      .single();

    expect(updatedNotification.retry_count).toBe(1);
  });

  test('should support English language preference for international customers', async () => {
    // Update customer language preference
    await supabase
      .from('user_accounts')
      .update({ preferences: { language: 'en', notifications_enabled: true } })
      .eq('id', testCustomerId);

    // Create feedback session
    const { data: feedbackSession } = await supabase
      .from('feedback_sessions')
      .insert({
        customer_id: testCustomerId,
        store_id: testStoreId,
        quality_score: 80,
        feedback_content: 'Great experience!',
        transaction_amount_sek: 300,
        status: 'completed'
      })
      .select()
      .single();

    // Trigger reward calculation
    await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .send({
        feedback_session_ids: [feedbackSession.id]
      })
      .expect(200);

    // Verify English notification
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'reward_earned')
      .single();

    expect(notification.content).toContain('reward'); // English text
    expect(notification.content).toContain('SEK'); // Currency in English format
    expect(notification.content).toContain('Sunday'); // Day in English
  });

  test('should track notification delivery status via webhook', async () => {
    // Create notification first
    const { data: notification } = await supabase
      .from('communication_notifications')
      .insert({
        recipient_type: 'customer',
        recipient_id: testCustomerId,
        recipient_phone: '+46701234567',
        notification_type: 'reward_earned',
        channel: 'sms',
        content: 'Test reward notification',
        status: 'sent'
      })
      .select()
      .single();

    // Simulate Twilio delivery webhook
    const webhookResponse = await request(app)
      .post('/api/webhooks/twilio-delivery-status')
      .send({
        MessageSid: `test_${notification.id}`,
        MessageStatus: 'delivered',
        To: '+46701234567'
      })
      .expect(200);

    // Verify notification status updated
    const { data: updatedNotification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('id', notification.id)
      .single();

    expect(updatedNotification.status).toBe('delivered');
    expect(updatedNotification.delivered_at).toBeDefined();
  });

  test('should handle quiet hours restriction for notifications', async () => {
    // Set current time to quiet hours (e.g., 23:00)
    const quietHourTime = new Date();
    quietHourTime.setHours(23, 0, 0, 0);
    
    // Mock current time
    jest.useFakeTimers();
    jest.setSystemTime(quietHourTime);

    // Create feedback session
    const { data: feedbackSession } = await supabase
      .from('feedback_sessions')
      .insert({
        customer_id: testCustomerId,
        store_id: testStoreId,
        quality_score: 75,
        feedback_content: 'Late night feedback',
        transaction_amount_sek: 100,
        status: 'completed'
      })
      .select()
      .single();

    // Trigger reward calculation during quiet hours
    await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .send({
        feedback_session_ids: [feedbackSession.id]
      })
      .expect(200);

    // Verify notification is scheduled for later
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId)
      .eq('notification_type', 'reward_earned')
      .single();

    expect(notification.status).toBe('pending');
    const scheduledTime = new Date(notification.scheduled_at);
    expect(scheduledTime.getHours()).toBe(8); // Should be scheduled for 08:00

    jest.useRealTimers();
  });
});