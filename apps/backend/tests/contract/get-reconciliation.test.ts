import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/app';
import { supabase } from '../../src/config/database';
import type { ReconciliationReport, StoreBreakdown } from '@vocilia/types';

describe('GET /api/admin/payments/reconciliation/:batchId', () => {
  let adminToken: string;
  let testBatchId: string;
  let testReportId: string;

  beforeAll(async () => {
    // Create test admin session
    const { data: adminAccount } = await supabase
      .from('admin_accounts')
      .insert({
        email: 'reconciliation-test@vocilia.se',
        full_name: 'Reconciliation Test Admin',
        is_super_admin: true
      })
      .select()
      .single();

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminAccount.id,
        token: 'test-admin-token-reconciliation',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    adminToken = session.token;

    // Create test batch
    const { data: batch } = await supabase
      .from('payment_batches')
      .insert({
        batch_week: '2025-W14',
        status: 'completed',
        total_customers: 100,
        total_amount_sek: 2500.00,
        successful_payments: 98,
        failed_payments: 2,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    testBatchId = batch.id;

    // Create test reconciliation report
    const { data: report } = await supabase
      .from('reconciliation_reports')
      .insert({
        batch_id: testBatchId,
        report_period: '2025-W14',
        total_rewards_paid_sek: 2500.00,
        admin_fees_collected_sek: 500.00, // 20% of rewards
        total_business_invoices_sek: 3000.00,
        payment_success_count: 98,
        payment_failure_count: 2,
        payment_success_rate: 98.0,
        discrepancies: null
      })
      .select()
      .single();

    testReportId = report.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('reconciliation_reports').delete().eq('id', testReportId);
    await supabase.from('payment_batches').delete().eq('id', testBatchId);
    await supabase.from('admin_sessions').delete().eq('token', adminToken);
    await supabase.from('admin_accounts').delete().eq('email', 'reconciliation-test@vocilia.se');
  });

  it('should return 200 with reconciliation report and store breakdown', async () => {
    const response = await request(app)
      .get(`/api/admin/payments/reconciliation/${testBatchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.report).toBeDefined();
    expect(response.body.storeBreakdown).toBeDefined();
    expect(Array.isArray(response.body.storeBreakdown)).toBe(true);

    const report: ReconciliationReport = response.body.report;
    
    expect(report.batch_id).toBe(testBatchId);
    expect(report.report_period).toBe('2025-W14');
    expect(report.total_rewards_paid_sek).toBe(2500.00);
    expect(report.admin_fees_collected_sek).toBe(500.00);
    expect(report.total_business_invoices_sek).toBe(3000.00);
    expect(report.payment_success_count).toBe(98);
    expect(report.payment_failure_count).toBe(2);
    expect(report.payment_success_rate).toBe(98.0);
  });

  it('should include store breakdown with correct structure', async () => {
    // Add test stores and reward calculations
    const { data: store } = await supabase
      .from('stores')
      .insert({
        name: 'Test Store 1',
        business_id: '00000000-0000-0000-0000-000000000001',
        active: true
      })
      .select()
      .single();

    // Add payment transaction
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .insert({
        batch_id: testBatchId,
        customer_phone: '467012345678',
        amount_ore: 2220,
        status: 'successful'
      })
      .select()
      .single();

    // Add reward calculation
    await supabase
      .from('reward_calculations')
      .insert({
        feedback_id: '00000000-0000-0000-0000-000000000002',
        customer_phone: '467012345678',
        store_id: store.id,
        business_id: '00000000-0000-0000-0000-000000000001',
        transaction_id: '00000000-0000-0000-0000-000000000003',
        transaction_amount_sek: 200.00,
        quality_score: 85,
        reward_percentage: 11.1,
        reward_amount_sek: 22.20,
        verified_by_business: true,
        payment_transaction_id: transaction.id
      });

    const response = await request(app)
      .get(`/api/admin/payments/reconciliation/${testBatchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const breakdown: StoreBreakdown[] = response.body.storeBreakdown;
    
    expect(breakdown.length).toBeGreaterThan(0);
    
    const storeData = breakdown[0];
    expect(storeData).toHaveProperty('store_id');
    expect(storeData).toHaveProperty('store_name');
    expect(storeData).toHaveProperty('business_id');
    expect(storeData).toHaveProperty('business_name');
    expect(storeData).toHaveProperty('feedback_count');
    expect(storeData).toHaveProperty('verified_count');
    expect(storeData).toHaveProperty('average_quality_score');
    expect(storeData).toHaveProperty('total_rewards_sek');
    expect(storeData).toHaveProperty('successful_payments');
    expect(storeData).toHaveProperty('failed_payments');
  });

  it('should return 404 if report not found', async () => {
    const fakeBatchId = '00000000-0000-0000-0000-000000000000';

    const response = await request(app)
      .get(`/api/admin/payments/reconciliation/${fakeBatchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('RECONCILIATION_NOT_FOUND');
  });

  it('should return 401 without admin auth token', async () => {
    await request(app)
      .get(`/api/admin/payments/reconciliation/${testBatchId}`)
      .expect(401);
  });
});