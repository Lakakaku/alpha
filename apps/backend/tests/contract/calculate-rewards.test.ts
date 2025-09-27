import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import app from '../../src/app';
import { supabase } from '../../src/config/database';
import type { CalculateRewardsRequest, CalculateRewardsResponse } from '@vocilia/types';

describe('POST /api/admin/payments/calculate-rewards', () => {
  let adminToken: string;
  let testFeedbackIds: string[];

  beforeAll(async () => {
    // Create test admin session
    const { data: adminAccount } = await supabase
      .from('admin_accounts')
      .insert({
        email: 'payment-test@vocilia.se',
        full_name: 'Payment Test Admin',
        is_super_admin: true
      })
      .select()
      .single();

    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminAccount.id,
        token: 'test-admin-token-calculate-rewards',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    adminToken = session.token;

    // Create test feedback sessions with quality scores
    const feedbackData = [
      { quality_score: 85, transaction_amount: 200, verified: true },
      { quality_score: 70, transaction_amount: 100, verified: true },
      { quality_score: 95, transaction_amount: 150, verified: true },
      { quality_score: 45, transaction_amount: 300, verified: true }, // Below threshold
      { quality_score: 80, transaction_amount: 250, verified: false } // Not verified
    ];

    const { data: feedbackSessions } = await supabase
      .from('feedback_sessions')
      .insert(feedbackData.map(f => ({
        customer_phone: '467012345678',
        store_id: '00000000-0000-0000-0000-000000000001',
        quality_score: f.quality_score,
        verified_by_business: f.verified,
        created_at: new Date().toISOString()
      })))
      .select('id');

    testFeedbackIds = feedbackSessions.map(f => f.id);
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('admin_sessions').delete().eq('token', adminToken);
    await supabase.from('admin_accounts').delete().eq('email', 'payment-test@vocilia.se');
    await supabase.from('feedback_sessions').delete().in('id', testFeedbackIds);
  });

  it('should return 200 and calculate rewards for valid feedback IDs', async () => {
    const requestBody: CalculateRewardsRequest = {
      feedbackIds: testFeedbackIds.slice(0, 3) // First 3 valid ones
    };

    const response = await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(200);

    const body: CalculateRewardsResponse = response.body;
    
    expect(body.rewards).toBeDefined();
    expect(Array.isArray(body.rewards)).toBe(true);
    expect(body.rewards.length).toBe(3);
    expect(body.totalRewards).toBeGreaterThan(0);
    expect(body.qualifiedCount).toBe(3);
    expect(body.disqualifiedCount).toBe(0);
    expect(body.averageQualityScore).toBeCloseTo(83.33, 1);

    // Verify reward calculations
    const firstReward = body.rewards.find(r => r.quality_score === 85);
    expect(firstReward).toBeDefined();
    expect(firstReward?.reward_percentage).toBeCloseTo(11.1, 1); // (85-50)/50 * 13 + 2
    expect(firstReward?.reward_amount_sek).toBeCloseTo(22.2, 1); // 200 * 0.111
  });

  it('should return 400 for invalid feedback IDs', async () => {
    const requestBody: CalculateRewardsRequest = {
      feedbackIds: ['invalid-uuid-format', 'another-bad-id']
    };

    const response = await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(400);

    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('INVALID_FEEDBACK_IDS');
  });

  it('should return 401 without admin auth token', async () => {
    const requestBody: CalculateRewardsRequest = {
      feedbackIds: testFeedbackIds
    };

    await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .send(requestBody)
      .expect(401);
  });

  it('should exclude feedback below quality threshold (score < 50)', async () => {
    const requestBody: CalculateRewardsRequest = {
      feedbackIds: testFeedbackIds // Includes one with score 45
    };

    const response = await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(200);

    const body: CalculateRewardsResponse = response.body;
    
    // Should only process 3 (excludes score 45 and unverified)
    expect(body.qualifiedCount).toBe(3);
    expect(body.disqualifiedCount).toBe(2);
    expect(body.rewards.every(r => r.quality_score >= 50)).toBe(true);
  });

  it('should exclude unverified feedback', async () => {
    const requestBody: CalculateRewardsRequest = {
      feedbackIds: [testFeedbackIds[4]] // The unverified one
    };

    const response = await request(app)
      .post('/api/admin/payments/calculate-rewards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody)
      .expect(200);

    const body: CalculateRewardsResponse = response.body;
    
    expect(body.qualifiedCount).toBe(0);
    expect(body.disqualifiedCount).toBe(1);
    expect(body.rewards.length).toBe(0);
  });
});