import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('Scenario 3: Quality Score Threshold and Mapping', () => {
  let adminSessionToken: string;
  let testAdminId: string;
  let testBusinessId: string;
  let testStoreId: string;
  let testFeedbackIds: string[] = [];
  let testTransactionIds: string[] = [];

  beforeAll(async () => {
    const { data: admin } = await supabase
      .from('admin_accounts')
      .insert({ username: 'test_quality_admin', password_hash: 'hash', is_super_admin: true })
      .select()
      .single();
    testAdminId = admin!.id;

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: testAdminId,
        session_token: 'test_quality_session',
        expires_at: new Date(Date.now() + 7200000).toISOString()
      })
      .select()
      .single();
    adminSessionToken = session!.session_token;

    const { data: business } = await supabase
      .from('businesses')
      .insert({ name: 'Quality Test Business', subscription_status: 'active' })
      .select()
      .single();
    testBusinessId = business!.id;

    const { data: store } = await supabase
      .from('stores')
      .insert({ business_id: testBusinessId, name: 'Quality Test Store', active: true })
      .select()
      .single();
    testStoreId = store!.id;

    const qualityScores = [49, 50, 75, 85, 100];
    for (const score of qualityScores) {
      const { data: transaction } = await supabase
        .from('transactions')
        .insert({
          store_id: testStoreId,
          amount_sek: 100.00,
          transaction_time: '14:30:00'
        })
        .select()
        .single();
      testTransactionIds.push(transaction!.id);

      const { data: feedback } = await supabase
        .from('feedback_sessions')
        .insert({
          store_id: testStoreId,
          transaction_id: transaction!.id,
          customer_phone_e164: `+4670${1000000 + qualityScores.indexOf(score)}`,
          quality_score: score,
          verified_by_business: true
        })
        .select()
        .single();
      testFeedbackIds.push(feedback!.id);
    }
  });

  afterAll(async () => {
    await supabase.from('reward_calculations').delete().in('feedback_id', testFeedbackIds);
    await supabase.from('feedback_sessions').delete().in('id', testFeedbackIds);
    await supabase.from('transactions').delete().in('id', testTransactionIds);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('businesses').delete().eq('id', testBusinessId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  it('validates quality score to reward percentage mapping: 49→0%, 50→2%, 75→8.5%, 85→11.1%, 100→15%', async () => {
    const calcResponse = await request(API_URL)
      .post('/api/admin/payments/calculate-rewards')
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .send({ feedbackIds: testFeedbackIds });

    expect(calcResponse.status).toBe(200);
    expect(calcResponse.body.results.length).toBe(5);

    const results = calcResponse.body.results;
    const scoreMap = results.reduce((acc: any, r: any) => {
      const feedback = testFeedbackIds.find(id => id === r.feedbackId);
      const index = testFeedbackIds.indexOf(feedback!);
      acc[[49, 50, 75, 85, 100][index]] = r.rewardPercentage;
      return acc;
    }, {});

    expect(scoreMap[49]).toBe(0);
    expect(scoreMap[50]).toBeCloseTo(0.02, 3);
    expect(scoreMap[75]).toBeCloseTo(0.085, 3);
    expect(scoreMap[85]).toBeCloseTo(0.111, 3);
    expect(scoreMap[100]).toBeCloseTo(0.15, 3);
  });
});