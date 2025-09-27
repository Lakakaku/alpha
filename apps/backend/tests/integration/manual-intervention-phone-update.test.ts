import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Scenario 5: Manual Intervention for Failed Payment', () => {
  let adminSessionToken: string;
  let testAdminId: string;
  let testBatchId: string;
  let testTransactionId: string;

  beforeAll(async () => {
    const { data: admin } = await supabase
      .from('admin_accounts')
      .insert({ username: 'test_manual_admin', password_hash: 'hash', is_super_admin: true })
      .select()
      .single();
    testAdminId = admin!.id;

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: testAdminId,
        session_token: 'test_manual_session',
        expires_at: new Date(Date.now() + 7200000).toISOString()
      })
      .select()
      .single();
    adminSessionToken = session!.session_token;

    const { data: batch } = await supabase
      .from('payment_batches')
      .insert({
        batch_week: '2025-W39',
        week_start_date: '2025-09-22',
        week_end_date: '2025-09-28',
        status: 'completed',
        total_customers: 1,
        total_transactions: 1,
        total_amount_sek: 2500,
        successful_payments: 0,
        failed_payments: 1
      })
      .select()
      .single();
    testBatchId = batch!.id;

    const { data: transaction } = await supabase
      .from('payment_transactions')
      .insert({
        customer_phone: '+46701111111',
        amount_sek: 2500,
        status: 'failed',
        retry_count: 3,
        batch_id: testBatchId
      })
      .select()
      .single();
    testTransactionId = transaction!.id;

    await supabase
      .from('payment_failures')
      .insert({
        payment_transaction_id: testTransactionId,
        attempt_number: 3,
        failure_reason: 'PAYEE_NOT_ENROLLED',
        swish_error_code: 'PA02',
        resolution_status: 'manual_review'
      });
  });

  afterAll(async () => {
    await supabase.from('payment_failures').delete().eq('payment_transaction_id', testTransactionId);
    await supabase.from('payment_transactions').delete().eq('id', testTransactionId);
    await supabase.from('payment_batches').delete().eq('id', testBatchId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  it('admin updates customer phone number and successfully retries payment', async () => {
    const failedResponse = await request(API_URL)
      .get('/api/admin/payments/failed')
      .query({ status: 'manual_review', limit: 10, offset: 0 })
      .set('Authorization', `Bearer ${adminSessionToken}`);

    expect(failedResponse.status).toBe(200);
    const failedPayment = failedResponse.body.payments.find(
      (p: any) => p.transactionId === testTransactionId
    );
    expect(failedPayment).toBeDefined();
    expect(failedPayment.resolutionStatus).toBe('manual_review');

    const retryResponse = await request(API_URL)
      .post(`/api/admin/payments/retry/${testTransactionId}`)
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ updatedPhone: '+46702222222' });

    expect(retryResponse.status).toBe(200);
    expect(retryResponse.body.success).toBe(true);
    expect(retryResponse.body.updatedPhone).toBe('+46702222222');

    const updatedTransaction = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', testTransactionId)
      .single();

    expect(updatedTransaction.data?.customer_phone).toBe('+46702222222');
  });
});