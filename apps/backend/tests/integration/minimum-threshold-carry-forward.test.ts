import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Scenario 6: Below Minimum Threshold (5 SEK)', () => {
  let adminSessionToken: string;
  let testAdminId: string;
  let testBusinessId: string;
  let testStoreId: string;
  let testFeedbackId: string;
  let batchId1: string;
  let batchId2: string;
  let customerPhone = '+46703333333';

  beforeAll(async () => {
    const { data: admin } = await supabase
      .from('admin_accounts')
      .insert({ username: 'test_threshold_admin', password_hash: 'hash', is_super_admin: true })
      .select()
      .single();
    testAdminId = admin!.id;

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: testAdminId,
        session_token: 'test_threshold_session',
        expires_at: new Date(Date.now() + 7200000).toISOString()
      })
      .select()
      .single();
    adminSessionToken = session!.session_token;

    const { data: business } = await supabase
      .from('businesses')
      .insert({ name: 'Threshold Test Business', subscription_status: 'active' })
      .select()
      .single();
    testBusinessId = business!.id;

    const { data: store } = await supabase
      .from('stores')
      .insert({ business_id: testBusinessId, name: 'Threshold Test Store', active: true })
      .select()
      .single();
    testStoreId = store!.id;
  });

  afterAll(async () => {
    await supabase.from('payment_transactions').delete().eq('customer_phone', customerPhone);
    await supabase.from('reward_calculations').delete().eq('customer_phone', customerPhone);
    await supabase.from('payment_batches').delete().in('id', [batchId1, batchId2].filter(Boolean));
    await supabase.from('feedback_sessions').delete().eq('customer_phone_e164', customerPhone);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('businesses').delete().eq('id', testBusinessId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  it('carries forward rewards below 5 SEK threshold to next week until threshold reached', async () => {
    const { data: transaction1 } = await supabase
      .from('transactions')
      .insert({
        store_id: testStoreId,
        amount_sek: 30.00,
        transaction_time: '14:30:00'
      })
      .select()
      .single();

    const { data: feedback1 } = await supabase
      .from('feedback_sessions')
      .insert({
        store_id: testStoreId,
        transaction_id: transaction1!.id,
        customer_phone_e164: customerPhone,
        quality_score: 65,
        verified_by_business: true
      })
      .select()
      .single();

    await request(API_URL)
      .post('/api/admin/payments/calculate-rewards')
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ feedbackIds: [feedback1!.id] });

    const batch1Response = await request(API_URL)
      .post('/api/admin/payments/process-batch')
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ weekPeriod: '2025-W39' });

    batchId1 = batch1Response.body.batchId;

    await new Promise(resolve => setTimeout(resolve, 3000));

    const week1Payments = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('customer_phone', customerPhone)
      .eq('batch_id', batchId1);

    expect(week1Payments.data?.length).toBe(0);

    const { data: transaction2 } = await supabase
      .from('transactions')
      .insert({
        store_id: testStoreId,
        amount_sek: 50.00,
        transaction_time: '15:00:00'
      })
      .select()
      .single();

    const { data: feedback2 } = await supabase
      .from('feedback_sessions')
      .insert({
        store_id: testStoreId,
        transaction_id: transaction2!.id,
        customer_phone_e164: customerPhone,
        quality_score: 70,
        verified_by_business: true
      })
      .select()
      .single();

    await request(API_URL)
      .post('/api/admin/payments/calculate-rewards')
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ feedbackIds: [feedback2!.id] });

    const batch2Response = await request(API_URL)
      .post('/api/admin/payments/process-batch')
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ weekPeriod: '2025-W40' });

    batchId2 = batch2Response.body.batchId;

    await new Promise(resolve => setTimeout(resolve, 3000));

    const week2Payments = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('customer_phone', customerPhone)
      .eq('batch_id', batchId2);

    expect(week2Payments.data?.length).toBeGreaterThan(0);
    expect(week2Payments.data?.[0].amount_sek).toBeGreaterThanOrEqual(500);
  });
});