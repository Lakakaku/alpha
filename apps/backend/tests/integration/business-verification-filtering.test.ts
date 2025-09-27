import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Scenario 7: Business Verification Filtering', () => {
  let adminSessionToken: string;
  let testAdminId: string;
  let testBusinessId: string;
  let testStoreId: string;
  let verifiedFeedbackIds: string[] = [];
  let unverifiedFeedbackIds: string[] = [];
  let batchId: string;

  beforeAll(async () => {
    const { data: admin } = await supabase
      .from('admin_accounts')
      .insert({ username: 'test_verification_admin', password_hash: 'hash', is_super_admin: true })
      .select()
      .single();
    testAdminId = admin!.id;

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: testAdminId,
        session_token: 'test_verification_session',
        expires_at: new Date(Date.now() + 7200000).toISOString()
      })
      .select()
      .single();
    adminSessionToken = session!.session_token;

    const { data: business } = await supabase
      .from('businesses')
      .insert({ name: 'Verification Test Business', subscription_status: 'active' })
      .select()
      .single();
    testBusinessId = business!.id;

    const { data: store } = await supabase
      .from('stores')
      .insert({ business_id: testBusinessId, name: 'Verification Test Store', active: true })
      .select()
      .single();
    testStoreId = store!.id;

    for (let i = 0; i < 17; i++) {
      const { data: transaction } = await supabase
        .from('transactions')
        .insert({
          store_id: testStoreId,
          amount_sek: 100.00,
          transaction_time: '14:30:00'
        })
        .select()
        .single();

      const { data: feedback } = await supabase
        .from('feedback_sessions')
        .insert({
          store_id: testStoreId,
          transaction_id: transaction!.id,
          customer_phone_e164: `+4670${5000000 + i}`,
          quality_score: 70,
          verified_by_business: true
        })
        .select()
        .single();
      verifiedFeedbackIds.push(feedback!.id);
    }

    for (let i = 0; i < 3; i++) {
      const { data: transaction } = await supabase
        .from('transactions')
        .insert({
          store_id: testStoreId,
          amount_sek: 100.00,
          transaction_time: '14:30:00'
        })
        .select()
        .single();

      const { data: feedback } = await supabase
        .from('feedback_sessions')
        .insert({
          store_id: testStoreId,
          transaction_id: transaction!.id,
          customer_phone_e164: `+4670${6000000 + i}`,
          quality_score: 70,
          verified_by_business: false
        })
        .select()
        .single();
      unverifiedFeedbackIds.push(feedback!.id);
    }
  });

  afterAll(async () => {
    await supabase.from('payment_transactions').delete().eq('batch_id', batchId).neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reward_calculations').delete().in('feedback_id', [...verifiedFeedbackIds, ...unverifiedFeedbackIds]);
    await supabase.from('payment_batches').delete().eq('id', batchId);
    await supabase.from('feedback_sessions').delete().in('id', [...verifiedFeedbackIds, ...unverifiedFeedbackIds]);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('businesses').delete().eq('id', testBusinessId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  it('filters out 3 unverified submissions, only processes 17 verified ones', async () => {
    const allFeedbackIds = [...verifiedFeedbackIds, ...unverifiedFeedbackIds];

    const calcResponse = await request(API_URL)
      .post('/api/admin/payments/calculate-rewards')
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ feedbackIds: allFeedbackIds });

    expect(calcResponse.status).toBe(200);
    expect(calcResponse.body.calculatedCount).toBe(17);

    const batchResponse = await request(API_URL)
      .post('/api/admin/payments/process-batch')
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ weekPeriod: '2025-W39' });

    batchId = batchResponse.body.batchId;
    expect(batchResponse.status).toBe(202);

    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResponse = await request(API_URL)
      .get(`/api/admin/payments/batch/${batchId}`)
      .set('Authorization', `Bearer ${adminSessionToken}`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.progress.totalTransactions).toBe(17);

    const reconResponse = await request(API_URL)
      .get(`/api/admin/payments/reconciliation/${batchId}`)
      .set('Authorization', `Bearer ${adminSessionToken}`);

    expect(reconResponse.status).toBe(200);
    expect(reconResponse.body.summary.paymentSuccessCount).toBe(17);
  });
});