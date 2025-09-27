import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { addDays, subDays, startOfWeek, endOfWeek, formatISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import app from '../../src/app';
import { Database } from '@vocilia/types/database';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Weekly Summary Batch Processing Integration', () => {
  let testCustomerId1: string;
  let testCustomerId2: string;
  let testBusinessId: string;
  let testStoreId1: string;
  let testStoreId2: string;
  let testBatchId: string;

  beforeAll(async () => {
    // Setup test customers
    const { data: customer1 } = await supabase
      .from('user_accounts')
      .insert({
        phone_number: '+46701234572',
        email: 'customer1@example.com',
        user_type: 'customer',
        preferences: { 
          language: 'sv', 
          notifications_enabled: true,
          weekly_summary: true 
        }
      })
      .select()
      .single();
    testCustomerId1 = customer1.id;

    const { data: customer2 } = await supabase
      .from('user_accounts')
      .insert({
        phone_number: '+46701234573',
        email: 'customer2@example.com',
        user_type: 'customer',
        preferences: { 
          language: 'en', 
          notifications_enabled: true,
          weekly_summary: true 
        }
      })
      .select()
      .single();
    testCustomerId2 = customer2.id;

    // Setup test business
    const { data: business } = await supabase
      .from('user_accounts')
      .insert({
        phone_number: '+46701234574',
        email: 'batch-business@example.com',
        user_type: 'business',
        preferences: { language: 'sv', notifications_enabled: true }
      })
      .select()
      .single();
    testBusinessId = business.id;

    // Setup test stores
    const { data: store1 } = await supabase
      .from('stores')
      .insert({
        name: 'Test Batch Store 1',
        business_id: testBusinessId,
        location: 'Stockholm'
      })
      .select()
      .single();
    testStoreId1 = store1.id;

    const { data: store2 } = await supabase
      .from('stores')
      .insert({
        name: 'Test Batch Store 2',
        business_id: testBusinessId,
        location: 'Gothenburg'
      })
      .select()
      .single();
    testStoreId2 = store2.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('communication_notifications').delete().in('recipient_id', [testCustomerId1, testCustomerId2]);
    await supabase.from('weekly_summary_batches').delete().eq('batch_id', testBatchId);
    await supabase.from('feedback_sessions').delete().in('customer_id', [testCustomerId1, testCustomerId2]);
    await supabase.from('stores').delete().in('id', [testStoreId1, testStoreId2]);
    await supabase.from('user_accounts').delete().in('id', [testCustomerId1, testCustomerId2, testBusinessId]);
  });

  beforeEach(async () => {
    // Clean batch data before each test
    await supabase.from('communication_notifications').delete().in('recipient_id', [testCustomerId1, testCustomerId2]);
    await supabase.from('weekly_summary_batches').delete().eq('batch_id', testBatchId);
    await supabase.from('feedback_sessions').delete().in('customer_id', [testCustomerId1, testCustomerId2]);
  });

  test('should process weekly summary batch for multiple customers', async () => {
    // Create feedback sessions for the week for customer 1
    const weekStart = startOfWeek(new Date(), { locale: sv });
    const weekEnd = endOfWeek(new Date(), { locale: sv });
    
    await supabase.from('feedback_sessions').insert([
      {
        customer_id: testCustomerId1,
        store_id: testStoreId1,
        quality_score: 85,
        feedback_content: 'Great service this week!',
        transaction_amount_sek: 200,
        reward_amount_sek: 24, // ~12% reward
        status: 'completed',
        created_at: addDays(weekStart, 1).toISOString()
      },
      {
        customer_id: testCustomerId1,
        store_id: testStoreId2,
        quality_score: 75,
        feedback_content: 'Good experience',
        transaction_amount_sek: 150,
        reward_amount_sek: 15, // ~10% reward
        status: 'completed',
        created_at: addDays(weekStart, 3).toISOString()
      }
    ]);

    // Create feedback sessions for customer 2
    await supabase.from('feedback_sessions').insert([
      {
        customer_id: testCustomerId2,
        store_id: testStoreId1,
        quality_score: 90,
        feedback_content: 'Excellent food and service!',
        transaction_amount_sek: 300,
        reward_amount_sek: 42, // ~14% reward
        status: 'completed',
        created_at: addDays(weekStart, 2).toISOString()
      }
    ]);

    // Trigger weekly summary batch processing (simulates Sunday morning cron)
    const response = await request(app)
      .post('/api/admin/communication/process-weekly-summaries')
      .send({
        week_start: formatISO(weekStart),
        week_end: formatISO(weekEnd)
      })
      .expect(200);

    expect(response.body.customers_processed).toBe(2);
    expect(response.body.summaries_sent).toBe(2);
    testBatchId = response.body.batch_id;

    // Verify summary sent to customer 1 (Swedish)
    const { data: notification1 } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId1)
      .eq('notification_type', 'weekly_summary')
      .eq('channel', 'sms')
      .single();

    expect(notification1).toBeDefined();
    expect(notification1.content).toContain('Veckans sammanfattning');
    expect(notification1.content).toContain('2 besök');
    expect(notification1.content).toContain('39 kr'); // Total rewards (24 + 15)
    expect(notification1.content).toContain('Test Batch Store 1, Test Batch Store 2');

    // Verify summary sent to customer 2 (English)
    const { data: notification2 } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId2)
      .eq('notification_type', 'weekly_summary')
      .eq('channel', 'sms')
      .single();

    expect(notification2).toBeDefined();
    expect(notification2.content).toContain('Weekly summary');
    expect(notification2.content).toContain('1 visit');
    expect(notification2.content).toContain('42 SEK');
    expect(notification2.content).toContain('Test Batch Store 1');
  });

  test('should handle customers with no activity in the week', async () => {
    // Create batch with no feedback sessions
    const weekStart = startOfWeek(subDays(new Date(), 7), { locale: sv });
    const weekEnd = endOfWeek(subDays(new Date(), 7), { locale: sv });

    // Trigger weekly summary processing for empty week
    const response = await request(app)
      .post('/api/admin/communication/process-weekly-summaries')
      .send({
        week_start: formatISO(weekStart),
        week_end: formatISO(weekEnd),
        include_inactive: false
      })
      .expect(200);

    expect(response.body.customers_processed).toBe(0);
    expect(response.body.summaries_sent).toBe(0);
    expect(response.body.inactive_customers_skipped).toBe(2);

    // Verify no notifications sent
    const { data: notifications } = await supabase
      .from('communication_notifications')
      .select('*')
      .in('recipient_id', [testCustomerId1, testCustomerId2])
      .eq('notification_type', 'weekly_summary');

    expect(notifications).toHaveLength(0);
  });

  test('should batch process large number of customers efficiently', async () => {
    // Create multiple feedback sessions spread across the week
    const weekStart = startOfWeek(new Date(), { locale: sv });
    const feedbackSessions = [];

    // Create 50 feedback sessions for customer 1 across different days
    for (let i = 0; i < 50; i++) {
      feedbackSessions.push({
        customer_id: testCustomerId1,
        store_id: i % 2 === 0 ? testStoreId1 : testStoreId2,
        quality_score: 70 + (i % 30), // Scores between 70-99
        feedback_content: `Feedback session ${i + 1}`,
        transaction_amount_sek: 100 + (i * 10),
        reward_amount_sek: (100 + (i * 10)) * 0.1, // ~10% reward
        status: 'completed',
        created_at: addDays(weekStart, i % 7).toISOString()
      });
    }

    await supabase.from('feedback_sessions').insert(feedbackSessions);

    // Start performance timer
    const startTime = Date.now();

    // Trigger batch processing
    const response = await request(app)
      .post('/api/admin/communication/process-weekly-summaries')
      .send({
        week_start: formatISO(weekStart),
        week_end: formatISO(endOfWeek(new Date(), { locale: sv })),
        batch_size: 10 // Process in smaller batches
      })
      .expect(200);

    const processingTime = Date.now() - startTime;

    expect(response.body.customers_processed).toBeGreaterThan(0);
    expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds

    // Verify summary aggregation for high-volume customer
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId1)
      .eq('notification_type', 'weekly_summary')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('50 besök');
    expect(notification.content).toContain('både Test Batch Store 1 och Test Batch Store 2');
    expect(notification.metadata.total_visits).toBe(50);
  });

  test('should handle SMS delivery failures during batch processing', async () => {
    // Mock SMS provider to fail for specific customer
    const weekStart = startOfWeek(new Date(), { locale: sv });
    
    // Create feedback sessions
    await supabase.from('feedback_sessions').insert([
      {
        customer_id: testCustomerId1,
        store_id: testStoreId1,
        quality_score: 80,
        feedback_content: 'Good week',
        transaction_amount_sek: 200,
        reward_amount_sek: 20,
        status: 'completed',
        created_at: addDays(weekStart, 1).toISOString()
      }
    ]);

    // Simulate batch processing with SMS failure
    const response = await request(app)
      .post('/api/admin/communication/process-weekly-summaries')
      .send({
        week_start: formatISO(weekStart),
        week_end: formatISO(endOfWeek(new Date(), { locale: sv })),
        simulate_sms_failure: testCustomerId1 // Test parameter
      })
      .expect(200);

    expect(response.body.failed_deliveries).toBe(1);

    // Verify notification marked for retry
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId1)
      .eq('notification_type', 'weekly_summary')
      .single();

    expect(notification.status).toBe('failed');
    expect(notification.retry_count).toBe(0);
    expect(notification.failed_reason).toContain('SMS delivery failed');

    // Verify batch retry processing
    const retryResponse = await request(app)
      .post('/api/admin/communication/retry-failed-summaries')
      .send({
        batch_id: response.body.batch_id
      })
      .expect(200);

    expect(retryResponse.body.retry_attempts).toBe(1);
  });

  test('should respect quiet hours for weekly summary delivery', async () => {
    // Set system time to quiet hours (e.g., 6:00 AM)
    const quietTime = new Date();
    quietTime.setHours(6, 0, 0, 0);
    
    jest.useFakeTimers();
    jest.setSystemTime(quietTime);

    // Create feedback session
    const weekStart = startOfWeek(new Date(), { locale: sv });
    await supabase.from('feedback_sessions').insert([
      {
        customer_id: testCustomerId1,
        store_id: testStoreId1,
        quality_score: 85,
        feedback_content: 'Early morning test',
        transaction_amount_sek: 150,
        reward_amount_sek: 18,
        status: 'completed',
        created_at: addDays(weekStart, 1).toISOString()
      }
    ]);

    // Trigger batch processing during quiet hours
    const response = await request(app)
      .post('/api/admin/communication/process-weekly-summaries')
      .send({
        week_start: formatISO(weekStart),
        week_end: formatISO(endOfWeek(new Date(), { locale: sv })),
        respect_quiet_hours: true
      })
      .expect(200);

    expect(response.body.scheduled_for_later).toBe(1);

    // Verify notification scheduled for later delivery
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testCustomerId1)
      .eq('notification_type', 'weekly_summary')
      .single();

    expect(notification.status).toBe('pending');
    const scheduledTime = new Date(notification.scheduled_at);
    expect(scheduledTime.getHours()).toBe(8); // Should be scheduled for 8:00 AM

    jest.useRealTimers();
  });

  test('should generate batch processing metrics and monitoring data', async () => {
    // Create diverse feedback data for metrics
    const weekStart = startOfWeek(new Date(), { locale: sv });
    
    await supabase.from('feedback_sessions').insert([
      {
        customer_id: testCustomerId1,
        store_id: testStoreId1,
        quality_score: 95,
        feedback_content: 'Excellent service',
        transaction_amount_sek: 500,
        reward_amount_sek: 75,
        status: 'completed',
        created_at: addDays(weekStart, 1).toISOString()
      },
      {
        customer_id: testCustomerId2,
        store_id: testStoreId2,
        quality_score: 70,
        feedback_content: 'Average experience',
        transaction_amount_sek: 100,
        reward_amount_sek: 8,
        status: 'completed',
        created_at: addDays(weekStart, 2).toISOString()
      }
    ]);

    // Trigger batch processing with metrics collection
    const response = await request(app)
      .post('/api/admin/communication/process-weekly-summaries')
      .send({
        week_start: formatISO(weekStart),
        week_end: formatISO(endOfWeek(new Date(), { locale: sv })),
        collect_metrics: true
      })
      .expect(200);

    expect(response.body.metrics).toBeDefined();
    expect(response.body.metrics.total_customers).toBe(2);
    expect(response.body.metrics.total_rewards_sek).toBe(83);
    expect(response.body.metrics.average_reward_per_customer).toBe(41.5);
    expect(response.body.metrics.processing_time_ms).toBeDefined();

    // Verify batch record created
    const { data: batchRecord } = await supabase
      .from('weekly_summary_batches')
      .select('*')
      .eq('batch_id', response.body.batch_id)
      .single();

    expect(batchRecord).toBeDefined();
    expect(batchRecord.customers_processed).toBe(2);
    expect(batchRecord.total_notifications_sent).toBe(2);
    expect(batchRecord.batch_status).toBe('completed');
    expect(batchRecord.processing_metrics).toBeDefined();
  });

  test('should handle customer preference opt-outs during batch processing', async () => {
    // Update customer 1 to opt out of weekly summaries
    await supabase
      .from('user_accounts')
      .update({ 
        preferences: { 
          language: 'sv', 
          notifications_enabled: true,
          weekly_summary: false // Opted out
        } 
      })
      .eq('id', testCustomerId1);

    // Create feedback sessions for both customers
    const weekStart = startOfWeek(new Date(), { locale: sv });
    await supabase.from('feedback_sessions').insert([
      {
        customer_id: testCustomerId1,
        store_id: testStoreId1,
        quality_score: 80,
        feedback_content: 'Opted out customer',
        transaction_amount_sek: 200,
        reward_amount_sek: 20,
        status: 'completed',
        created_at: addDays(weekStart, 1).toISOString()
      },
      {
        customer_id: testCustomerId2,
        store_id: testStoreId1,
        quality_score: 85,
        feedback_content: 'Opted in customer',
        transaction_amount_sek: 250,
        reward_amount_sek: 28,
        status: 'completed',
        created_at: addDays(weekStart, 2).toISOString()
      }
    ]);

    // Trigger batch processing
    const response = await request(app)
      .post('/api/admin/communication/process-weekly-summaries')
      .send({
        week_start: formatISO(weekStart),
        week_end: formatISO(endOfWeek(new Date(), { locale: sv }))
      })
      .expect(200);

    expect(response.body.customers_processed).toBe(1); // Only opted-in customer
    expect(response.body.opted_out_customers_skipped).toBe(1);

    // Verify only customer 2 received summary
    const { data: notifications } = await supabase
      .from('communication_notifications')
      .select('*')
      .in('recipient_id', [testCustomerId1, testCustomerId2])
      .eq('notification_type', 'weekly_summary');

    expect(notifications).toHaveLength(1);
    expect(notifications[0].recipient_id).toBe(testCustomerId2);
  });
});