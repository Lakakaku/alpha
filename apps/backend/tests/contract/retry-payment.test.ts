import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/app';
import { supabase } from '../../src/config/database';
import type { RetryPaymentRequest, PaymentTransaction } from '@vocilia/types';

describe('POST /api/admin/payments/retry/:transactionId', () => {
  let adminToken: string;
  let testBatchId: string;
  let failedTransactionId: string;
  let successfulTransactionId: string;

  beforeAll(async () => {
    // Create test admin session
    const { data: adminAccount } = await supabase
      .from('admin_accounts')
      .insert({
        email: 'retry-payment-test@vocilia.se',
        full_name: 'Retry Payment Test Admin',
        is_super_admin: true
      })
      .select()
      .single();

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminAccount.id,
        token: 'test-admin-token-retry-payment',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    adminToken = session.token;

    // Create test batch
    const { data: batch } = await supabase
      .from('payment_batches')
      .insert({
        batch_week: '2025-W16',
        status: 'partial'
      })
      .select()
      .single();

    testBatchId = batch.id;

    // Create failed transaction
    const { data: failedTx } = await supabase
      .from('payment_transactions')
      .insert({
        batch_id: testBatchId,
        customer_phone: '467011111111',
        amount_ore: 2220,
        status: 'failed',
        retry_count: 2
      })
      .select()
      .single();

    failedTransactionId = failedTx.id;

    // Create successful transaction
    const { data: successTx } = await supabase
      .from('payment_transactions')
      .insert({
        batch_id: testBatchId,
        customer_phone: '467022222222',
        amount_ore: 1500,
        status: 'successful',
        retry_count: 0,
        swish_transaction_id: 'swish-123456'
      })
      .select()
      .single();

    successfulTransactionId = successTx.id;

    // Create payment failure record
    await supabase
      .from('payment_failures')
      .insert({
        payment_transaction_id: failedTransactionId,
        failure_reason: 'Invalid phone number',
        swish_error_code: 'RF02',
        attempt_number: 3,
        resolution_status: 'manual_review'
      });
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('payment_failures').delete().eq('payment_transaction_id', failedTransactionId);
    await supabase.from('payment_transactions').delete().in('id', [failedTransactionId, successfulTransactionId]);
    await supabase.from('payment_batches').delete().eq('id', testBatchId);
    await supabase.from('admin_sessions').delete().eq('token', adminToken);
    await supabase.from('admin_accounts').delete().eq('email', 'retry-payment-test@vocilia.se');
  });

  it('should return 200 and retry the payment', async () => {
    const requestBody: RetryPaymentRequest = {};

    const response = await request(app)
      .post(`/api/admin/payments/retry/${failedTransactionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(200);

    const transaction: PaymentTransaction = response.body;
    
    expect(transaction.id).toBe(failedTransactionId);
    expect(transaction.status).toBe('processing');
    expect(transaction.retry_count).toBe(3);
  });

  it('should update phone number when provided', async () => {
    const requestBody: RetryPaymentRequest = {
      updatedPhone: '467099999999'
    };

    const response = await request(app)
      .post(`/api/admin/payments/retry/${failedTransactionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(200);

    const transaction: PaymentTransaction = response.body;
    
    expect(transaction.customer_phone).toBe('467099999999');
  });

  it('should add admin notes when provided', async () => {
    const requestBody: RetryPaymentRequest = {
      adminNotes: 'Customer confirmed correct phone number',
      force: true
    };

    const response = await request(app)
      .post(`/api/admin/payments/retry/${failedTransactionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(200);

    // Verify admin notes were saved in payment_failures table
    const { data: failure } = await supabase
      .from('payment_failures')
      .select('admin_notes')
      .eq('payment_transaction_id', failedTransactionId)
      .single();

    expect(failure.admin_notes).toBe('Customer confirmed correct phone number');
  });

  it('should return 404 for invalid transactionId', async () => {
    const fakeTransactionId = '00000000-0000-0000-0000-000000000000';
    const requestBody: RetryPaymentRequest = {};

    const response = await request(app)
      .post(`/api/admin/payments/retry/${fakeTransactionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(404);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('TRANSACTION_NOT_FOUND');
  });

  it('should return 409 if payment already successful', async () => {
    const requestBody: RetryPaymentRequest = {};

    const response = await request(app)
      .post(`/api/admin/payments/retry/${successfulTransactionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(409);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('PAYMENT_ALREADY_SUCCESSFUL');
  });

  it('should force retry even after max attempts with force flag', async () => {
    // Update transaction to have max retry count
    await supabase
      .from('payment_transactions')
      .update({ retry_count: 3 })
      .eq('id', failedTransactionId);

    const requestBody: RetryPaymentRequest = {
      force: true,
      adminNotes: 'Forcing retry after max attempts'
    };

    const response = await request(app)
      .post(`/api/admin/payments/retry/${failedTransactionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(200);

    const transaction: PaymentTransaction = response.body;
    
    expect(transaction.status).toBe('processing');
    // Force flag should allow retry beyond normal limit
    expect(transaction.retry_count).toBe(4);
  });

  it('should return 401 without admin auth token', async () => {
    const requestBody: RetryPaymentRequest = {};

    await request(app)
      .post(`/api/admin/payments/retry/${failedTransactionId}`)
      .send(requestBody)
      .expect(401);
  });
});