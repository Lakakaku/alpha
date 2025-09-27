import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/app';
import { supabase } from '../../src/config/database';
import type { CustomerPaymentSummary, PaymentTransaction, CustomerHistoryQuery } from '@vocilia/types';

describe('GET /api/admin/payments/customer/:phone', () => {
  let adminToken: string;
  let testBatchIds: string[] = [];
  let testTransactionIds: string[] = [];
  const testPhone = '467012345678';

  beforeAll(async () => {
    // Create test admin session
    const { data: adminAccount } = await supabase
      .from('admin_accounts')
      .insert({
        email: 'customer-history-test@vocilia.se',
        full_name: 'Customer History Test Admin',
        is_super_admin: true
      })
      .select()
      .single();

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminAccount.id,
        token: 'test-admin-token-customer-history',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    adminToken = session.token;

    // Create test batches for different weeks
    const { data: batches } = await supabase
      .from('payment_batches')
      .insert([
        { batch_week: '2025-W17', status: 'completed' },
        { batch_week: '2025-W18', status: 'completed' },
        { batch_week: '2025-W19', status: 'completed' }
      ])
      .select('id');

    testBatchIds = batches.map(b => b.id);

    // Create payment history for customer
    const { data: transactions } = await supabase
      .from('payment_transactions')
      .insert([
        {
          batch_id: testBatchIds[0],
          customer_phone: testPhone,
          amount_ore: 2220, // 22.20 SEK
          status: 'successful',
          processed_at: new Date('2025-04-21').toISOString()
        },
        {
          batch_id: testBatchIds[1],
          customer_phone: testPhone,
          amount_ore: 1510, // 15.10 SEK
          status: 'successful',
          processed_at: new Date('2025-04-28').toISOString()
        },
        {
          batch_id: testBatchIds[2],
          customer_phone: testPhone,
          amount_ore: 720, // 7.20 SEK
          status: 'failed',
          retry_count: 3
        },
        {
          batch_id: testBatchIds[2],
          customer_phone: testPhone,
          amount_ore: 500, // 5.00 SEK
          status: 'pending'
        }
      ])
      .select('id');

    testTransactionIds = transactions.map(t => t.id);

    // Create reward calculations for context
    await supabase
      .from('reward_calculations')
      .insert([
        {
          feedback_id: '00000000-0000-0000-0000-000000000001',
          customer_phone: testPhone,
          store_id: '00000000-0000-0000-0000-000000000002',
          business_id: '00000000-0000-0000-0000-000000000003',
          transaction_id: '00000000-0000-0000-0000-000000000004',
          transaction_amount_sek: 200,
          quality_score: 85,
          reward_percentage: 11.1,
          reward_amount_sek: 22.20,
          verified_by_business: true,
          payment_transaction_id: testTransactionIds[0]
        },
        {
          feedback_id: '00000000-0000-0000-0000-000000000005',
          customer_phone: testPhone,
          store_id: '00000000-0000-0000-0000-000000000006',
          business_id: '00000000-0000-0000-0000-000000000007',
          transaction_id: '00000000-0000-0000-0000-000000000008',
          transaction_amount_sek: 100,
          quality_score: 75,
          reward_percentage: 8.5,
          reward_amount_sek: 8.50,
          verified_by_business: true,
          payment_transaction_id: testTransactionIds[1]
        }
      ]);
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('reward_calculations').delete().in('payment_transaction_id', testTransactionIds);
    await supabase.from('payment_transactions').delete().in('id', testTransactionIds);
    await supabase.from('payment_batches').delete().in('id', testBatchIds);
    await supabase.from('admin_sessions').delete().eq('token', adminToken);
    await supabase.from('admin_accounts').delete().eq('email', 'customer-history-test@vocilia.se');
  });

  it('should return 200 with summary and transactions array', async () => {
    const response = await request(app)
      .get(`/api/admin/payments/customer/${testPhone}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.summary).toBeDefined();
    expect(response.body.transactions).toBeDefined();
    expect(Array.isArray(response.body.transactions)).toBe(true);

    const summary: CustomerPaymentSummary = response.body.summary;
    
    expect(summary.customer_phone).toBe(testPhone);
    expect(summary.total_payments).toBe(4);
    expect(summary.successful_payments).toBe(2);
    expect(summary.failed_payments).toBe(1);
    expect(summary.pending_amount_sek).toBe(5.00);
    expect(summary.total_amount_sek).toBeCloseTo(49.50, 2); // 22.20 + 15.10 + 7.20 + 5.00
    expect(summary.stores_visited).toBeGreaterThanOrEqual(2);
  });

  it('should return transactions in descending date order', async () => {
    const response = await request(app)
      .get(`/api/admin/payments/customer/${testPhone}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const transactions: PaymentTransaction[] = response.body.transactions;
    
    expect(transactions.length).toBe(4);
    
    // Verify descending order by created_at
    for (let i = 1; i < transactions.length; i++) {
      const prevDate = new Date(transactions[i - 1].created_at);
      const currDate = new Date(transactions[i].created_at);
      expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
    }
  });

  it('should support pagination', async () => {
    const query: CustomerHistoryQuery = { limit: 2, offset: 0 };

    const response = await request(app)
      .get(`/api/admin/payments/customer/${testPhone}`)
      .query(query)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.transactions.length).toBe(2);
    expect(response.body.pagination).toBeDefined();
    expect(response.body.pagination.limit).toBe(2);
    expect(response.body.pagination.offset).toBe(0);
    expect(response.body.pagination.total).toBe(4);
    expect(response.body.pagination.hasMore).toBe(true);
  });

  it('should filter by date range', async () => {
    const query: CustomerHistoryQuery = {
      startDate: '2025-04-20',
      endDate: '2025-04-25'
    };

    const response = await request(app)
      .get(`/api/admin/payments/customer/${testPhone}`)
      .query(query)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const transactions: PaymentTransaction[] = response.body.transactions;
    
    // Should only include transaction from 2025-04-21
    expect(transactions.length).toBeGreaterThanOrEqual(1);
    
    transactions.forEach(tx => {
      const txDate = new Date(tx.created_at);
      expect(txDate.getTime()).toBeGreaterThanOrEqual(new Date('2025-04-20').getTime());
      expect(txDate.getTime()).toBeLessThanOrEqual(new Date('2025-04-26').getTime()); // End of day
    });
  });

  it('should return 400 with invalid phone format', async () => {
    const response = await request(app)
      .get('/api/admin/payments/customer/invalid-phone')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('INVALID_PHONE_FORMAT');
    expect(response.body.error.message).toContain('Swedish mobile');
  });

  it('should return 404 if no history found', async () => {
    const unknownPhone = '467099999999';

    const response = await request(app)
      .get(`/api/admin/payments/customer/${unknownPhone}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('NO_PAYMENT_HISTORY');
  });

  it('should return 401 without admin auth token', async () => {
    await request(app)
      .get(`/api/admin/payments/customer/${testPhone}`)
      .expect(401);
  });
});