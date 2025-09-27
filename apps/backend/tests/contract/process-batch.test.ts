import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import app from '../../src/app';
import { supabase } from '../../src/config/database';
import type { ProcessBatchRequest, ProcessBatchResponse } from '@vocilia/types';

describe('POST /api/admin/payments/process-batch', () => {
  let adminToken: string;

  beforeAll(async () => {
    // Create test admin session
    const { data: adminAccount } = await supabase
      .from('admin_accounts')
      .insert({
        email: 'batch-test@vocilia.se',
        full_name: 'Batch Test Admin',
        is_super_admin: true
      })
      .select()
      .single();

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminAccount.id,
        token: 'test-admin-token-process-batch',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    adminToken = session.token;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('admin_sessions').delete().eq('token', adminToken);
    await supabase.from('admin_accounts').delete().eq('email', 'batch-test@vocilia.se');
    await supabase.from('payment_batches').delete().like('batch_week', '2025-W%');
  });

  it('should return 202 and start batch processing', async () => {
    const requestBody: ProcessBatchRequest = {
      batchWeek: '2025-W09'
    };

    const response = await request(app)
      .post('/api/admin/payments/process-batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(202);

    const body: ProcessBatchResponse = response.body;
    
    expect(body.batchId).toBeDefined();
    expect(body.batchWeek).toBe('2025-W09');
    expect(body.status).toBe('processing');
    expect(body.message).toContain('Batch processing started');
  });

  it('should use previous week if batchWeek not specified', async () => {
    const requestBody: ProcessBatchRequest = {};

    const response = await request(app)
      .post('/api/admin/payments/process-batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(202);

    const body: ProcessBatchResponse = response.body;
    
    expect(body.batchWeek).toMatch(/^\d{4}-W\d{2}$/);
    expect(body.status).toBe('processing');
  });

  it('should return 400 for invalid week format', async () => {
    const requestBody: ProcessBatchRequest = {
      batchWeek: 'invalid-week-format'
    };

    const response = await request(app)
      .post('/api/admin/payments/process-batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(400);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('INVALID_WEEK_FORMAT');
    expect(response.body.error.message).toContain('ISO week format');
  });

  it('should return 409 if batch already processing', async () => {
    // First, create a processing batch
    const batchWeek = '2025-W10';
    await supabase
      .from('payment_batches')
      .insert({
        batch_week: batchWeek,
        status: 'processing',
        job_lock_key: 'locked-key',
        job_locked_at: new Date().toISOString()
      });

    const requestBody: ProcessBatchRequest = {
      batchWeek: batchWeek
    };

    const response = await request(app)
      .post('/api/admin/payments/process-batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(409);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('BATCH_ALREADY_PROCESSING');
  });

  it('should allow reprocessing with force flag', async () => {
    // Create a completed batch
    const batchWeek = '2025-W11';
    await supabase
      .from('payment_batches')
      .insert({
        batch_week: batchWeek,
        status: 'completed',
        completed_at: new Date().toISOString()
      });

    const requestBody: ProcessBatchRequest = {
      batchWeek: batchWeek,
      forceReprocess: true
    };

    const response = await request(app)
      .post('/api/admin/payments/process-batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(202);

    const body: ProcessBatchResponse = response.body;
    
    expect(body.batchWeek).toBe(batchWeek);
    expect(body.status).toBe('processing');
    expect(body.message).toContain('reprocessing');
  });

  it('should return 401 without admin auth token', async () => {
    const requestBody: ProcessBatchRequest = {
      batchWeek: '2025-W12'
    };

    await request(app)
      .post('/api/admin/payments/process-batch')
      .send(requestBody)
      .expect(401);
  });
});