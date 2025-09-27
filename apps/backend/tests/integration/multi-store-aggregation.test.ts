import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Scenario 2: Multiple Stores Aggregation', () => {
  let adminSessionToken: string;
  let testAdminId: string;
  let testBusinessId: string;
  let testStoreIds: string[] = [];
  let testFeedbackIds: string[] = [];
  let customerPhone = '+46701234567';
  let batchId: string;

  beforeAll(async () => {
    const { data: admin } = await supabase
      .from('admin_accounts')
      .insert({ username: 'test_multi_store_admin', password_hash: 'hash', is_super_admin: true })
      .select()
      .single();
    testAdminId = admin!.id;

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: testAdminId,
        session_token: 'test_multi_store_session',
        expires_at: new Date(Date.now() + 7200000).toISOString()
      })
      .select()
      .single();
    adminSessionToken = session!.session_token;

    const { data: business } = await supabase
      .from('businesses')
      .insert({ name: 'Multi Store Business', subscription_status: 'active' })
      .select()
      .single();
    testBusinessId = business!.id;

    const storeData = [
      { name: 'Store A', amount: 100.00, score: 70 },
      { name: 'Store B', amount: 200.00, score: 85 },
      { name: 'Store C', amount: 150.00, score: 95 }
    ];

    for (const store of storeData) {
      const { data: storeRecord } = await supabase
        .from('stores')
        .insert({ business_id: testBusinessId, name: store.name, active: true })
        .select()
        .single();
      testStoreIds.push(storeRecord!.id);

      const { data: transaction } = await supabase
        .from('transactions')
        .insert({
          store_id: storeRecord!.id,
          amount_sek: store.amount,
          transaction_time: '14:30:00'
        })
        .select()
        .single();

      const { data: feedback } = await supabase
        .from('feedback_sessions')
        .insert({
          store_id: storeRecord!.id,
          transaction_id: transaction!.id,
          customer_phone_e164: customerPhone,
          quality_score: store.score,
          verified_by_business: true
        })
        .select()
        .single();
      testFeedbackIds.push(feedback!.id);
    }
  });

  afterAll(async () => {
    await supabase.from('payment_transactions').delete().eq('customer_phone', customerPhone);
    await supabase.from('reconciliation_reports').delete().eq('batch_id', batchId).neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('payment_batches').delete().eq('id', batchId);
    await supabase.from('reward_calculations').delete().in('feedback_id', testFeedbackIds);
    await supabase.from('feedback_sessions').delete().in('id', testFeedbackIds);
    await supabase.from('transactions').delete().in('store_id', testStoreIds);
    await supabase.from('stores').delete().in('id', testStoreIds);
    await supabase.from('businesses').delete().eq('id', testBusinessId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  it('aggregates rewards from 3 stores into single payment of 51.30 SEK', async () => {
    const calcResponse = await request(API_URL)
      .post('/api/admin/payments/calculate-rewards')
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ feedbackIds: testFeedbackIds });

    expect(calcResponse.status).toBe(200);
    expect(calcResponse.body.calculatedCount).toBe(3);

    const batchResponse = await request(API_URL)
      .post('/api/admin/payments/process-batch')
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ weekPeriod: '2025-W39' });

    batchId = batchResponse.body.batchId;
    expect(batchResponse.status).toBe(202);

    await new Promise(resolve => setTimeout(resolve, 5000));

    const historyResponse = await request(API_URL)
      .get(`/api/admin/payments/customer/${customerPhone}`)
      .set('Authorization', `Bearer ${adminSessionToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.summary.totalPaidSek).toBeCloseTo(51.30, 2);
    expect(historyResponse.body.summary.totalTransactions).toBe(1);
    expect(historyResponse.body.rewards.length).toBe(3);
  });
});