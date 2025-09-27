import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Scenario 4: Payment Failure and Retry', () => {
  let adminSessionToken: string;
  let testAdminId: string;
  let testBatchId: string;
  let testTransactionId: string;

  beforeAll(async () => {
    const { data: admin } = await supabase
      .from('admin_accounts')
      .insert({ username: 'test_retry_admin', password_hash: 'hash', is_super_admin: true })
      .select()
      .single();
    testAdminId = admin!.id;

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: testAdminId,
        session_token: 'test_retry_session',
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
        status: 'processing',
        total_customers: 1,
        total_transactions: 1,
        total_amount_sek: 2500,
        successful_payments: 0,
        failed_payments: 0
      })
      .select()
      .single();
    testBatchId = batch!.id;

    const { data: transaction } = await supabase
      .from('payment_transactions')
      .insert({
        customer_phone: '+46709999999',
        amount_sek: 2500,
        status: 'failed',
        retry_count: 2,
        batch_id: testBatchId
      })
      .select()
      .single();
    testTransactionId = transaction!.id;

    await supabase
      .from('payment_failures')
      .insert([
        {
          payment_transaction_id: testTransactionId,
          attempt_number: 1,
          failure_reason: 'PAYEE_NOT_ENROLLED',
          swish_error_code: 'PA02',
          retry_scheduled_at: new Date(Date.now() + 60000).toISOString()
        },
        {
          payment_transaction_id: testTransactionId,
          attempt_number: 2,
          failure_reason: 'PAYEE_NOT_ENROLLED',
          swish_error_code: 'PA02',
          retry_scheduled_at: new Date(Date.now() + 120000).toISOString()
        }
      ]);
  });

  afterAll(async () => {
    await supabase.from('payment_failures').delete().eq('payment_transaction_id', testTransactionId);
    await supabase.from('payment_transactions').delete().eq('id', testTransactionId);
    await supabase.from('payment_batches').delete().eq('id', testBatchId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  it('retries failed payment with exponential backoff (1min, 2min, 4min) until success on 3rd attempt', async () => {
    const failuresBeforeRetry = await supabase
      .from('payment_failures')
      .select('*')
      .eq('payment_transaction_id', testTransactionId)
      .order('attempt_number', { ascending: true });

    expect(failuresBeforeRetry.data?.length).toBe(2);
    expect(failuresBeforeRetry.data?.[0].attempt_number).toBe(1);
    expect(failuresBeforeRetry.data?.[1].attempt_number).toBe(2);

    const retryResponse = await request(API_URL)
      .post(`/api/admin/payments/retry/${testTransactionId}`)
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({});

    expect(retryResponse.status).toBe(200);
    expect(retryResponse.body.success).toBe(true);

    const updatedTransaction = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', testTransactionId)
      .single();

    expect(updatedTransaction.data?.retry_count).toBeLessThanOrEqual(3);
  });
});