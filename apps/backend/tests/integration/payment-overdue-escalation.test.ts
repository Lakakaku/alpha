import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { addBusinessDays, subBusinessDays, formatISO } from 'date-fns';
import app from '../../src/app';
import { Database } from '@vocilia/types/database';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Payment Overdue Escalation Integration', () => {
  let testBusinessId: string;
  let testStoreId: string;
  let testInvoiceId: string;
  let testPaymentBatchId: string;

  beforeAll(async () => {
    // Setup test business
    const { data: business } = await supabase
      .from('user_accounts')
      .insert({
        phone_number: '+46701234571',
        email: 'payment-test@example.com',
        user_type: 'business',
        preferences: { 
          language: 'sv', 
          notifications_enabled: true,
          payment_reminders: true 
        }
      })
      .select()
      .single();
    testBusinessId = business.id;

    // Setup test store
    const { data: store } = await supabase
      .from('stores')
      .insert({
        name: 'Test Payment Store',
        business_id: testBusinessId,
        email: 'store-payment@example.com',
        payment_settings: {
          invoice_delivery: 'email',
          reminder_preferences: 'standard'
        }
      })
      .select()
      .single();
    testStoreId = store.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('communication_notifications').delete().eq('recipient_id', testBusinessId);
    await supabase.from('business_invoices').delete().eq('business_id', testBusinessId);
    await supabase.from('payment_batches').delete().eq('business_id', testBusinessId);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('user_accounts').delete().eq('id', testBusinessId);
  });

  beforeEach(async () => {
    // Clean payment data before each test
    await supabase.from('communication_notifications').delete().eq('recipient_id', testBusinessId);
    await supabase.from('business_invoices').delete().eq('business_id', testBusinessId);
    await supabase.from('payment_batches').delete().eq('business_id', testBusinessId);
  });

  test('should send day 1 reminder for overdue payment', async () => {
    // Create overdue invoice (1 business day past due)
    const dueDate = subBusinessDays(new Date(), 1);
    const { data: invoice } = await supabase
      .from('business_invoices')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        invoice_number: 'INV-2025-001',
        total_rewards_sek: 2500,
        admin_fee_sek: 625, // 20% of rewards (2500 * 0.25)
        total_amount_sek: 3125,
        invoice_date: subBusinessDays(new Date(), 8).toISOString(),
        due_date: formatISO(dueDate),
        status: 'overdue',
        payment_terms: '7_days'
      })
      .select()
      .single();
    testInvoiceId = invoice.id;

    // Trigger overdue processing (simulates daily cron job)
    const response = await request(app)
      .post('/api/admin/payments/process-overdue')
      .expect(200);

    expect(response.body.reminders_sent).toBeGreaterThan(0);

    // Verify day 1 reminder notification sent
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'payment_overdue_reminder')
      .eq('channel', 'email')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('Påminnelse');
    expect(notification.content).toContain('försenad betalning');
    expect(notification.content).toContain('INV-2025-001');
    expect(notification.content).toContain('3 125 kr');
    expect(notification.metadata.escalation_level).toBe(1);
  });

  test('should send day 7 warning for severely overdue payment', async () => {
    // Create severely overdue invoice (7 business days past due)
    const dueDate = subBusinessDays(new Date(), 7);
    const { data: invoice } = await supabase
      .from('business_invoices')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        invoice_number: 'INV-2025-002',
        total_rewards_sek: 5000,
        admin_fee_sek: 1250,
        total_amount_sek: 6250,
        invoice_date: subBusinessDays(new Date(), 14).toISOString(),
        due_date: formatISO(dueDate),
        status: 'severely_overdue',
        payment_terms: '7_days',
        overdue_days: 7
      })
      .select()
      .single();
    testInvoiceId = invoice.id;

    // Trigger overdue processing
    const response = await request(app)
      .post('/api/admin/payments/process-overdue')
      .expect(200);

    expect(response.body.warnings_sent).toBeGreaterThan(0);

    // Verify day 7 warning notification sent
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'payment_overdue_warning')
      .eq('channel', 'email')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('VARNING');
    expect(notification.content).toContain('allvarligt försenad');
    expect(notification.content).toContain('7 dagar');
    expect(notification.content).toContain('additional fees'); // Late payment fees
    expect(notification.content).toContain('collection agency'); // Collection threat
    expect(notification.metadata.escalation_level).toBe(2);
  });

  test('should send day 14 suspension notice with service termination warning', async () => {
    // Create critically overdue invoice (14 business days past due)
    const dueDate = subBusinessDays(new Date(), 14);
    const { data: invoice } = await supabase
      .from('business_invoices')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        invoice_number: 'INV-2025-003',
        total_rewards_sek: 8000,
        admin_fee_sek: 2000,
        total_amount_sek: 10000,
        invoice_date: subBusinessDays(new Date(), 21).toISOString(),
        due_date: formatISO(dueDate),
        status: 'critical_overdue',
        payment_terms: '7_days',
        overdue_days: 14,
        late_fees_sek: 500
      })
      .select()
      .single();
    testInvoiceId = invoice.id;

    // Trigger overdue processing
    const response = await request(app)
      .post('/api/admin/payments/process-overdue')
      .expect(200);

    expect(response.body.suspension_notices_sent).toBeGreaterThan(0);

    // Verify both email and SMS suspension notice sent (critical level)
    const { data: notifications } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'payment_suspension_notice');

    expect(notifications).toHaveLength(2); // Email + SMS for critical
    
    const emailNotification = notifications.find(n => n.channel === 'email');
    const smsNotification = notifications.find(n => n.channel === 'sms');
    
    expect(emailNotification).toBeDefined();
    expect(smsNotification).toBeDefined();
    
    expect(emailNotification.content).toContain('SUSPENSION NOTICE');
    expect(emailNotification.content).toContain('14 dagar');
    expect(emailNotification.content).toContain('service termination');
    expect(emailNotification.content).toContain('10 500 kr'); // Including late fees
    expect(emailNotification.metadata.escalation_level).toBe(3);
    
    expect(smsNotification.content).toContain('CRITICAL');
    expect(smsNotification.content).toContain('suspension');
  });

  test('should handle partial payment and adjust escalation sequence', async () => {
    // Create overdue invoice
    const dueDate = subBusinessDays(new Date(), 3);
    const { data: invoice } = await supabase
      .from('business_invoices')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        invoice_number: 'INV-2025-004',
        total_rewards_sek: 3000,
        admin_fee_sek: 750,
        total_amount_sek: 3750,
        invoice_date: subBusinessDays(new Date(), 10).toISOString(),
        due_date: formatISO(dueDate),
        status: 'overdue',
        payment_terms: '7_days',
        overdue_days: 3
      })
      .select()
      .single();
    testInvoiceId = invoice.id;

    // Business makes partial payment
    const partialPaymentResponse = await request(app)
      .post(`/api/business/invoices/${testInvoiceId}/payment`)
      .send({
        payment_amount_sek: 2000, // Partial payment
        payment_method: 'bank_transfer',
        payment_reference: 'PARTIAL-2025-001',
        payment_date: new Date().toISOString()
      })
      .expect(200);

    expect(partialPaymentResponse.body.remaining_balance_sek).toBe(1750);

    // Verify partial payment acknowledgment notification
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'payment_partial_received')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('partial payment');
    expect(notification.content).toContain('2 000 kr');
    expect(notification.content).toContain('1 750 kr'); // Remaining balance
    expect(notification.content).toContain('balance outstanding');
  });

  test('should escalate to legal action for extremely overdue payments', async () => {
    // Create extremely overdue invoice (30+ days)
    const dueDate = subBusinessDays(new Date(), 30);
    const { data: invoice } = await supabase
      .from('business_invoices')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        invoice_number: 'INV-2025-005',
        total_rewards_sek: 12000,
        admin_fee_sek: 3000,
        total_amount_sek: 15000,
        invoice_date: subBusinessDays(new Date(), 37).toISOString(),
        due_date: formatISO(dueDate),
        status: 'legal_action',
        payment_terms: '7_days',
        overdue_days: 30,
        late_fees_sek: 1500,
        collection_fees_sek: 750
      })
      .select()
      .single();
    testInvoiceId = invoice.id;

    // Trigger legal escalation process
    const response = await request(app)
      .post('/api/admin/payments/process-legal-escalation')
      .expect(200);

    expect(response.body.legal_notices_sent).toBeGreaterThan(0);

    // Verify legal action notification sent
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'payment_legal_action')
      .eq('channel', 'email')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('LEGAL ACTION');
    expect(notification.content).toContain('debt collection');
    expect(notification.content).toContain('30 dagar');
    expect(notification.content).toContain('17 250 kr'); // Total with all fees
    expect(notification.content).toContain('court proceedings');
    expect(notification.metadata.escalation_level).toBe(4);
  });

  test('should handle payment plan negotiation and modified terms', async () => {
    // Create overdue invoice
    const dueDate = subBusinessDays(new Date(), 5);
    const { data: invoice } = await supabase
      .from('business_invoices')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        invoice_number: 'INV-2025-006',
        total_rewards_sek: 6000,
        admin_fee_sek: 1500,
        total_amount_sek: 7500,
        invoice_date: subBusinessDays(new Date(), 12).toISOString(),
        due_date: formatISO(dueDate),
        status: 'overdue',
        payment_terms: '7_days',
        overdue_days: 5
      })
      .select()
      .single();
    testInvoiceId = invoice.id;

    // Business requests payment plan
    const paymentPlanResponse = await request(app)
      .post(`/api/business/invoices/${testInvoiceId}/payment-plan`)
      .send({
        proposed_installments: 3,
        first_payment_amount_sek: 2500,
        installment_frequency: 'monthly',
        reason: 'Temporary cash flow issues due to seasonal business'
      })
      .expect(200);

    expect(paymentPlanResponse.body.payment_plan_id).toBeDefined();

    // Verify payment plan notification sent
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'payment_plan_proposed')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('payment plan');
    expect(notification.content).toContain('3 installments');
    expect(notification.content).toContain('2 500 kr');
    expect(notification.content).toContain('review within 48 hours');
  });

  test('should send confirmation when payment is received after escalation', async () => {
    // Create overdue invoice with escalations
    const dueDate = subBusinessDays(new Date(), 10);
    const { data: invoice } = await supabase
      .from('business_invoices')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        invoice_number: 'INV-2025-007',
        total_rewards_sek: 4000,
        admin_fee_sek: 1000,
        total_amount_sek: 5000,
        invoice_date: subBusinessDays(new Date(), 17).toISOString(),
        due_date: formatISO(dueDate),
        status: 'severely_overdue',
        payment_terms: '7_days',
        overdue_days: 10,
        late_fees_sek: 250
      })
      .select()
      .single();
    testInvoiceId = invoice.id;

    // Business makes full payment
    const paymentResponse = await request(app)
      .post(`/api/business/invoices/${testInvoiceId}/payment`)
      .send({
        payment_amount_sek: 5250, // Full amount including late fees
        payment_method: 'swish',
        payment_reference: 'SWISH-789012',
        payment_date: new Date().toISOString()
      })
      .expect(200);

    expect(paymentResponse.body.payment_status).toBe('paid_in_full');

    // Verify payment confirmation notification
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'payment_received_confirmation')
      .single();

    expect(notification).toBeDefined();
    expect(notification.content).toContain('Payment received');
    expect(notification.content).toContain('5 250 kr');
    expect(notification.content).toContain('account current');
    expect(notification.content).toContain('escalation stopped');
    expect(notification.content).toContain('thank you');

    // Verify invoice status updated
    const { data: updatedInvoice } = await supabase
      .from('business_invoices')
      .select('*')
      .eq('id', testInvoiceId)
      .single();

    expect(updatedInvoice.status).toBe('paid');
    expect(updatedInvoice.paid_at).toBeDefined();
    expect(updatedInvoice.payment_amount_sek).toBe(5250);
  });

  test('should handle English language preference for international businesses', async () => {
    // Update business language preference
    await supabase
      .from('user_accounts')
      .update({ preferences: { language: 'en', notifications_enabled: true } })
      .eq('id', testBusinessId);

    // Create overdue invoice
    const dueDate = subBusinessDays(new Date(), 1);
    const { data: invoice } = await supabase
      .from('business_invoices')
      .insert({
        business_id: testBusinessId,
        store_id: testStoreId,
        invoice_number: 'INV-2025-008',
        total_rewards_sek: 1500,
        admin_fee_sek: 375,
        total_amount_sek: 1875,
        invoice_date: subBusinessDays(new Date(), 8).toISOString(),
        due_date: formatISO(dueDate),
        status: 'overdue',
        payment_terms: '7_days',
        overdue_days: 1
      })
      .select()
      .single();

    // Trigger overdue processing
    await request(app)
      .post('/api/admin/payments/process-overdue')
      .expect(200);

    // Verify English notification
    const { data: notification } = await supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', testBusinessId)
      .eq('notification_type', 'payment_overdue_reminder')
      .single();

    expect(notification.content).toContain('Payment reminder');
    expect(notification.content).toContain('overdue payment');
    expect(notification.content).toContain('business days');
    expect(notification.content).toContain('SEK'); // Currency in English format
  });
});