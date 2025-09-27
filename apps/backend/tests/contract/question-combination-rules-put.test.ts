// Contract Test: PUT /api/questions/combinations/rules/{ruleId}
// Feature: Step 5.2: Advanced Question Logic

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('PUT /api/questions/combinations/rules/{ruleId}', () => {
  let authToken: string;
  let businessContextId: string;
  let testRuleId: string;
  let otherBusinessRuleId: string;

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
        rule_name: 'Original Rule Name',
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

    // Create rule in different business context for authorization tests
    const { data: otherRule } = await supabase
      .from('question_combination_rules')
      .insert({
        business_context_id: 'different-business-uuid',
        rule_name: 'Other Business Rule',
        max_call_duration_seconds: 90,
        priority_threshold_critical: 0,
        priority_threshold_high: 30,
        priority_threshold_medium: 60,
        priority_threshold_low: 90,
        is_active: true
      })
      .select()
      .single();
    
    otherBusinessRuleId = otherRule.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('question_combination_rules')
      .delete()
      .in('id', [testRuleId, otherBusinessRuleId]);
  });

  describe('Success Cases', () => {
    test('should update rule name only', async () => {
      const updateRequest = {
        rule_name: 'Updated Rule Name'
      };

      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.rule_name).toBe('Updated Rule Name');
      expect(response.body.max_call_duration_seconds).toBe(120); // Unchanged
      expect(response.body.updated_at).not.toBe(response.body.created_at);
    });

    test('should update call duration only', async () => {
      const updateRequest = {
        max_call_duration_seconds: 150
      };

      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.max_call_duration_seconds).toBe(150);
      expect(response.body.rule_name).toBe('Updated Rule Name'); // From previous test
    });

    test('should update priority thresholds', async () => {
      const updateRequest = {
        priority_thresholds: {
          critical: 10,
          high: 40,
          medium: 70,
          low: 100
        }
      };

      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.priority_thresholds).toEqual({
        critical: 10,
        high: 40,
        medium: 70,
        low: 100
      });
    });

    test('should update is_active status', async () => {
      const updateRequest = {
        is_active: false
      };

      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.is_active).toBe(false);

      // Reactivate for other tests
      await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ is_active: true })
        .expect(200);
    });

    test('should update multiple fields at once', async () => {
      const updateRequest = {
        rule_name: 'Multi-Update Rule',
        max_call_duration_seconds: 180,
        priority_thresholds: {
          critical: 5,
          high: 50,
          medium: 100,
          low: 175
        },
        is_active: true
      };

      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body).toMatchObject(updateRequest);
    });

    test('should handle empty update gracefully', async () => {
      const updateRequest = {};

      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      // Should return existing rule unchanged except updated_at
      expect(response.body.rule_name).toBe('Multi-Update Rule');
      expect(response.body.max_call_duration_seconds).toBe(180);
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 for unauthenticated request', async () => {
      await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .send({ rule_name: 'Unauthorized Update' })
        .expect(401);
    });

    test('should return 403 for updating rule in different business context', async () => {
      await request(app)
        .put(`/api/questions/combinations/rules/${otherBusinessRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rule_name: 'Forbidden Update' })
        .expect(403);
    });

    test('should return 401 for invalid token', async () => {
      await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ rule_name: 'Invalid Token Update' })
        .expect(401);
    });

    test('should return 404 for non-existent rule', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .put(`/api/questions/combinations/rules/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rule_name: 'Non-existent Rule' })
        .expect(404);
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 for invalid rule ID format', async () => {
      const response = await request(app)
        .put('/api/questions/combinations/rules/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rule_name: 'Invalid ID Update' })
        .expect(400);

      expect(response.body.error).toContain('valid UUID');
    });

    test('should return 400 for rule_name too long', async () => {
      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rule_name: 'A'.repeat(101) // Max is 100 chars
        })
        .expect(400);

      expect(response.body.error).toContain('rule_name');
      expect(response.body.error).toContain('100');
    });

    test('should return 400 for invalid max_call_duration_seconds', async () => {
      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          max_call_duration_seconds: 30 // Below minimum of 60
        })
        .expect(400);

      expect(response.body.error).toContain('max_call_duration_seconds');
      expect(response.body.error).toContain('60');
    });

    test('should return 400 for max_call_duration_seconds above maximum', async () => {
      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          max_call_duration_seconds: 200 // Above maximum of 180
        })
        .expect(400);

      expect(response.body.error).toContain('max_call_duration_seconds');
      expect(response.body.error).toContain('180');
    });

    test('should return 400 for invalid priority threshold ordering', async () => {
      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priority_thresholds: {
            critical: 100, // Should be <= high
            high: 50,
            medium: 80,
            low: 120
          }
        })
        .expect(400);

      expect(response.body.error).toContain('priority thresholds');
      expect(response.body.error).toContain('ascending');
    });

    test('should return 400 for duplicate rule name in same business context', async () => {
      // Create another rule to test against
      const { data: anotherRule } = await supabase
        .from('question_combination_rules')
        .insert({
          business_context_id: businessContextId,
          rule_name: 'Another Rule For Duplicate Test',
          max_call_duration_seconds: 100,
          priority_threshold_critical: 0,
          priority_threshold_high: 30,
          priority_threshold_medium: 60,
          priority_threshold_low: 90,
          is_active: true
        })
        .select()
        .single();

      // Try to update main rule to have same name as another rule
      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rule_name: 'Another Rule For Duplicate Test'
        })
        .expect(400);

      expect(response.body.error).toContain('rule_name');
      expect(response.body.error).toContain('unique');

      // Cleanup
      await supabase
        .from('question_combination_rules')
        .delete()
        .eq('id', anotherRule.id);
    });
  });

  describe('Response Format', () => {
    test('should return properly formatted response', async () => {
      const updateRequest = {
        rule_name: 'Format Test Update'
      };

      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('business_context_id');
      expect(response.body).toHaveProperty('rule_name');
      expect(response.body).toHaveProperty('max_call_duration_seconds');
      expect(response.body).toHaveProperty('priority_thresholds');
      expect(response.body).toHaveProperty('is_active');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');

      expect(typeof response.body.id).toBe('string');
      expect(typeof response.body.business_context_id).toBe('string');
      expect(typeof response.body.rule_name).toBe('string');
      expect(typeof response.body.max_call_duration_seconds).toBe('number');
      expect(typeof response.body.is_active).toBe('boolean');
    });
  });

  describe('Performance', () => {
    test('should respond within 500ms', async () => {
      const updateRequest = {
        rule_name: 'Performance Test Update'
      };

      const startTime = Date.now();
      
      await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Database Persistence', () => {
    test('should persist updates to database correctly', async () => {
      const updateRequest = {
        rule_name: 'Persistence Test Update',
        max_call_duration_seconds: 165,
        priority_thresholds: {
          critical: 15,
          high: 55,
          medium: 95,
          low: 160
        },
        is_active: true
      };

      const response = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      // Verify in database
      const { data: dbRule } = await supabase
        .from('question_combination_rules')
        .select('*')
        .eq('id', testRuleId)
        .single();

      expect(dbRule).toMatchObject({
        rule_name: 'Persistence Test Update',
        max_call_duration_seconds: 165,
        priority_threshold_critical: 15,
        priority_threshold_high: 55,
        priority_threshold_medium: 95,
        priority_threshold_low: 160,
        is_active: true
      });
      expect(new Date(dbRule.updated_at).getTime()).toBeGreaterThan(new Date(dbRule.created_at).getTime());
    });
  });

  describe('Idempotency', () => {
    test('should handle identical successive updates correctly', async () => {
      const updateRequest = {
        rule_name: 'Idempotency Test',
        max_call_duration_seconds: 75
      };

      // First update
      const response1 = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      // Second identical update
      const response2 = await request(app)
        .put(`/api/questions/combinations/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response2.body.rule_name).toBe(updateRequest.rule_name);
      expect(response2.body.max_call_duration_seconds).toBe(updateRequest.max_call_duration_seconds);
      // updated_at should still be updated even for identical data
      expect(response2.body.updated_at).not.toBe(response1.body.updated_at);
    });
  });
});