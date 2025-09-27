import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/app';
import { supabase } from '../../src/config/database';
import type { PaymentBatch } from '@vocilia/types';

describe('GET /api/admin/payments/batch/:batchId', () => {
  let adminToken: string;
  let testBatchId: string;

  beforeAll(async () => {
    // Create test admin session
    const { data: adminAccount } = await supabase
      .from('admin_accounts')
      .insert({
        email: 'batch-status-test@vocilia.se',
        full_name: 'Batch Status Test Admin',
        is_super_admin: true
      })
      .select()
      .single();

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminAccount.id,
        token: 'test-admin-token-batch-status',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    adminToken = session.token;

    // Create test batch
    const { data: batch } = await supabase
      .from('payment_batches')
      .insert({
        batch_week: '2025-W13',
        status: 'processing',
        total_customers: 150,
        total_amount_sek: 3500.50,
        successful_payments: 145,
        failed_payments: 5,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    testBatchId = batch.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('payment_batches').delete().eq('id', testBatchId);
    await supabase.from('admin_sessions').delete().eq('token', adminToken);
    await supabase.from('admin_accounts').delete().eq('email', 'batch-status-test@vocilia.se');
  });

  it('should return 200 with batch details', async () => {
    const response = await request(app)
      .get(`/api/admin/payments/batch/${testBatchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const batch: PaymentBatch = response.body;
    
    expect(batch.id).toBe(testBatchId);
    expect(batch.batch_week).toBe('2025-W13');
    expect(batch.status).toBe('processing');
    expect(batch.total_customers).toBe(150);
    expect(batch.total_amount_sek).toBe(3500.5);
    expect(batch.successful_payments).toBe(145);
    expect(batch.failed_payments).toBe(5);
    expect(batch.started_at).toBeDefined();
  });

  it('should return 404 for non-existent batchId', async () => {
    const fakeBatchId = '00000000-0000-0000-0000-000000000000';

    const response = await request(app)
      .get(`/api/admin/payments/batch/${fakeBatchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('BATCH_NOT_FOUND');
  });

  it('should return 400 for invalid UUID format', async () => {
    const response = await request(app)
      .get('/api/admin/payments/batch/invalid-uuid')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('INVALID_BATCH_ID');
  });

  it('should return 401 without admin auth token', async () => {
    await request(app)
      .get(`/api/admin/payments/batch/${testBatchId}`)
      .expect(401);
  });

  it('should include payment statistics in response', async () => {
    // Add some payment transactions to the batch
    await supabase
      .from('payment_transactions')
      .insert([
        {
          batch_id: testBatchId,
          customer_phone: '467012345678',
          amount_ore: 2220, // 22.20 SEK
          status: 'successful'
        },
        {
          batch_id: testBatchId,
          customer_phone: '467087654321',
          amount_ore: 1500, // 15.00 SEK
          status: 'failed',
          retry_count: 1
        }
      ]);

    const response = await request(app)
      .get(`/api/admin/payments/batch/${testBatchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const batch: PaymentBatch = response.body;
    
    expect(batch.successful_payments).toBe(145);
    expect(batch.failed_payments).toBe(5);
    
    // Calculate success rate
    const successRate = (145 / 150) * 100;
    expect(successRate).toBeCloseTo(96.67, 1);
  });
});