// Contract Test: GET /api/questions/combinations/rules
// Feature: Step 5.2: Advanced Question Logic

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('GET /api/questions/combinations/rules', () => {
  let authToken: string;
  let businessContextId: string;
  let testRuleId: string;

  beforeAll(async () => {
    // Setup authentication
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@business.com',
        password: 'testpassword'
      });
    
    authToken = authResponse.body.token;
    businessContextId = authResponse.body.user.business_context_id;

    // Create test combination rule
    const { data: rule } = await supabase
      .from('question_combination_rules')
      .insert({
        business_context_id: businessContextId,
        rule_name: 'Test Rule',
        max_call_duration_seconds: 120,
        priority_threshold_critical: 0,
        priority_threshold_high: 60,
        priority_threshold_medium: 90,
        priority_threshold_low: 120,
        is_active: true
      })
      .select()
      .single();
    
    testRuleId = rule.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('question_combination_rules')
      .delete()
      .eq('id', testRuleId);
  });

  describe('Success Cases', () => {
    test('should return combination rules for authenticated business user', async () => {
      const response = await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: businessContextId })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      const rule = response.body.find((r: any) => r.id === testRuleId);
      expect(rule).toBeDefined();
      expect(rule).toMatchObject({
        id: testRuleId,
        business_context_id: businessContextId,
        rule_name: 'Test Rule',
        max_call_duration_seconds: 120,
        priority_thresholds: {
          critical: 0,
          high: 60,
          medium: 90,
          low: 120
        },
        is_active: true
      });
      expect(rule.created_at).toBeDefined();
      expect(rule.updated_at).toBeDefined();
    });

    test('should return empty array for business with no rules', async () => {
      const response = await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: 'non-existent-uuid' })
        .expect(200);

      expect(response.body).toEqual([]);
    });

    test('should filter by is_active parameter', async () => {
      // Deactivate test rule
      await supabase
        .from('question_combination_rules')
        .update({ is_active: false })
        .eq('id', testRuleId);

      const response = await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          is_active: true 
        })
        .expect(200);

      const rule = response.body.find((r: any) => r.id === testRuleId);
      expect(rule).toBeUndefined();

      // Reactivate for other tests
      await supabase
        .from('question_combination_rules')
        .update({ is_active: true })
        .eq('id', testRuleId);
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 for unauthenticated request', async () => {
      await request(app)
        .get('/api/questions/combinations/rules')
        .query({ business_context_id: businessContextId })
        .expect(401);
    });

    test('should return 403 for user accessing other business context', async () => {
      await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: 'different-business-uuid' })
        .expect(403);
    });

    test('should return 401 for invalid token', async () => {
      await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', 'Bearer invalid-token')
        .query({ business_context_id: businessContextId })
        .expect(401);
    });
  });

  describe('Validation', () => {
    test('should return 400 for missing business_context_id', async () => {
      const response = await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('business_context_id');
    });

    test('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: 'invalid-uuid' })
        .expect(400);

      expect(response.body.error).toContain('valid UUID');
    });
  });

  describe('Response Format Validation', () => {
    test('should return properly formatted response', async () => {
      const response = await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: businessContextId })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
      
      response.body.forEach((rule: any) => {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('business_context_id');
        expect(rule).toHaveProperty('rule_name');
        expect(rule).toHaveProperty('max_call_duration_seconds');
        expect(rule).toHaveProperty('priority_thresholds');
        expect(rule).toHaveProperty('is_active');
        expect(rule).toHaveProperty('created_at');
        expect(rule).toHaveProperty('updated_at');

        expect(typeof rule.id).toBe('string');
        expect(typeof rule.business_context_id).toBe('string');
        expect(typeof rule.rule_name).toBe('string');
        expect(typeof rule.max_call_duration_seconds).toBe('number');
        expect(typeof rule.is_active).toBe('boolean');
        
        expect(rule.priority_thresholds).toHaveProperty('critical');
        expect(rule.priority_thresholds).toHaveProperty('high');
        expect(rule.priority_thresholds).toHaveProperty('medium');
        expect(rule.priority_thresholds).toHaveProperty('low');
      });
    });
  });

  describe('Performance', () => {
    test('should respond within 500ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: businessContextId })
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Row Level Security', () => {
    test('should only return rules for authenticated business context', async () => {
      const response = await request(app)
        .get('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: businessContextId })
        .expect(200);

      response.body.forEach((rule: any) => {
        expect(rule.business_context_id).toBe(businessContextId);
      });
    });
  });
});