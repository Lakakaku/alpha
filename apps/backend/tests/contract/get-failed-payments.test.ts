import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/app';
import { supabase } from '../../src/config/database';
import type { PaymentFailure, FailedPaymentsQuery } from '@vocilia/types';

describe('GET /api/admin/payments/failed', () => {
  let adminToken: string;
  let testBatchId: string;
  let testTransactionIds: string[] = [];

  beforeAll(async () => {
    // Create test admin session
    const { data: adminAccount } = await supabase
      .from('admin_accounts')
      .insert({
        email: 'failed-payments-test@vocilia.se',
        full_name: 'Failed Payments Test Admin',
        is_super_admin: true
      })
      .select()
      .single();

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminAccount.id,
        token: 'test-admin-token-failed-payments',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    adminToken = session.token;

    // Create test batch
    const { data: batch } = await supabase
      .from('payment_batches')
      .insert({
        batch_week: '2025-W15',
        status: 'partial'
      })
      .select()
      .single();

    testBatchId = batch.id;

    // Create failed payment transactions
    const { data: transactions } = await supabase
      .from('payment_transactions')
      .insert([
        {
          batch_id: testBatchId,
          customer_phone: '467011111111',
          amount_ore: 2220,
          status: 'failed',
          retry_count: 3
        },
        {
          batch_id: testBatchId,
          customer_phone: '467022222222',
          amount_ore: 1500,
          status: 'failed',
          retry_count: 1
        },
        {
          batch_id: testBatchId,
          customer_phone: '467033333333',
          amount_ore: 3000,
          status: 'failed',
          retry_count: 2
        }
      ])
      .select('id');

    testTransactionIds = transactions.map(t => t.id);

    // Create payment failures
    await supabase
      .from('payment_failures')
      .insert([
        {
          payment_transaction_id: testTransactionIds[0],
          failure_reason: 'Invalid phone number',
          swish_error_code: 'RF02',
          attempt_number: 4,
          resolution_status: 'manual_review'
        },
        {
          payment_transaction_id: testTransactionIds[1],
          failure_reason: 'Payment declined by user',
          swish_error_code: 'RF03',
          attempt_number: 2,
          resolution_status: 'pending',
          retry_scheduled_at: new Date(Date.now() + 60000).toISOString()
        },
        {
          payment_transaction_id: testTransactionIds[2],
          failure_reason: 'Insufficient funds',
          swish_error_code: 'RF04',
          attempt_number: 3,
          resolution_status: 'pending',
          retry_scheduled_at: new Date(Date.now() + 120000).toISOString()
        }
      ]);
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('payment_failures').delete().in('payment_transaction_id', testTransactionIds);
    await supabase.from('payment_transactions').delete().in('id', testTransactionIds);
    await supabase.from('payment_batches').delete().eq('id', testBatchId);
    await supabase.from('admin_sessions').delete().eq('token', adminToken);
    await supabase.from('admin_accounts').delete().eq('email', 'failed-payments-test@vocilia.se');
  });

  it('should return 200 with failures array and pagination', async () => {
    const response = await request(app)
      .get('/api/admin/payments/failed')
      .query({ limit: 10, offset: 0 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.failures).toBeDefined();
    expect(Array.isArray(response.body.failures)).toBe(true);
    expect(response.body.failures.length).toBeGreaterThan(0);
    
    expect(response.body.pagination).toBeDefined();
    expect(response.body.pagination.limit).toBe(10);
    expect(response.body.pagination.offset).toBe(0);
    expect(response.body.pagination.total).toBeGreaterThan(0);
  });

  it('should filter by status', async () => {
    const response = await request(app)
      .get('/api/admin/payments/failed')
      .query({ status: 'manual_review' } as FailedPaymentsQuery)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.failures).toBeDefined();
    expect(response.body.failures.length).toBeGreaterThanOrEqual(1);
    
    const failure: PaymentFailure = response.body.failures[0];
    expect(failure.resolution_status).toBe('manual_review');
  });

  it('should filter by pending status', async () => {
    const response = await request(app)
      .get('/api/admin/payments/failed')
      .query({ status: 'pending' } as FailedPaymentsQuery)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.failures).toBeDefined();
    expect(response.body.failures.length).toBeGreaterThanOrEqual(2);
    
    response.body.failures.forEach((failure: PaymentFailure) => {
      expect(failure.resolution_status).toBe('pending');
    });
  });

  it('should support pagination', async () => {
    // Get first page
    const firstPage = await request(app)
      .get('/api/admin/payments/failed')
      .query({ limit: 1, offset: 0 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(firstPage.body.failures.length).toBe(1);
    
    // Get second page
    const secondPage = await request(app)
      .get('/api/admin/payments/failed')
      .query({ limit: 1, offset: 1 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(secondPage.body.failures.length).toBe(1);
    
    // Verify different failures
    expect(firstPage.body.failures[0].id).not.toBe(secondPage.body.failures[0].id);
  });

  it('should include failure details', async () => {
    const response = await request(app)
      .get('/api/admin/payments/failed')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const failure: PaymentFailure = response.body.failures[0];
    
    expect(failure).toHaveProperty('id');
    expect(failure).toHaveProperty('payment_transaction_id');
    expect(failure).toHaveProperty('failure_reason');
    expect(failure).toHaveProperty('swish_error_code');
    expect(failure).toHaveProperty('attempt_number');
    expect(failure).toHaveProperty('resolution_status');
    expect(failure).toHaveProperty('created_at');
  });

  it('should return 401 without admin auth token', async () => {
    await request(app)
      .get('/api/admin/payments/failed')
      .expect(401);
  });
});