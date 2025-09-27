// Contract Test: POST /api/questions/combinations/rules
// Feature: Step 5.2: Advanced Question Logic

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('POST /api/questions/combinations/rules', () => {
  let authToken: string;
  let businessContextId: string;
  const createdRuleIds: string[] = [];

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
  });

  afterAll(async () => {
    // Cleanup created rules
    if (createdRuleIds.length > 0) {
      await supabase
        .from('question_combination_rules')
        .delete()
        .in('id', createdRuleIds);
    }
  });

  describe('Success Cases', () => {
    test('should create combination rule with minimal required fields', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Minimal Test Rule'
      };

      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdRuleIds.push(response.body.id);

      expect(response.body).toMatchObject({
        business_context_id: businessContextId,
        rule_name: 'Minimal Test Rule',
        max_call_duration_seconds: 120, // Default value
        priority_thresholds: {
          critical: 0,
          high: 60,
          medium: 90,
          low: 120
        },
        is_active: true
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.created_at).toBeDefined();
      expect(response.body.updated_at).toBeDefined();
    });

    test('should create combination rule with all fields specified', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Complete Test Rule',
        max_call_duration_seconds: 150,
        priority_thresholds: {
          critical: 10,
          high: 50,
          medium: 80,
          low: 130
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdRuleIds.push(response.body.id);

      expect(response.body).toMatchObject(createRequest);
      expect(response.body.is_active).toBe(true);
    });

    test('should create rule with edge case duration values', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Edge Case Duration Rule',
        max_call_duration_seconds: 60 // Minimum allowed
      };

      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdRuleIds.push(response.body.id);
      expect(response.body.max_call_duration_seconds).toBe(60);
    });

    test('should create rule with maximum duration value', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Max Duration Rule',
        max_call_duration_seconds: 180 // Maximum allowed
      };

      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdRuleIds.push(response.body.id);
      expect(response.body.max_call_duration_seconds).toBe(180);
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 for unauthenticated request', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Unauthorized Rule'
      };

      await request(app)
        .post('/api/questions/combinations/rules')
        .send(createRequest)
        .expect(401);
    });

    test('should return 403 for creating rule in different business context', async () => {
      const createRequest = {
        business_context_id: 'different-business-uuid',
        rule_name: 'Forbidden Rule'
      };

      await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(403);
    });

    test('should return 401 for invalid token', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Invalid Token Rule'
      };

      await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', 'Bearer invalid-token')
        .send(createRequest)
        .expect(401);
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('business_context_id');
      expect(response.body.error).toContain('rule_name');
    });

    test('should return 400 for invalid business_context_id format', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: 'invalid-uuid',
          rule_name: 'Test Rule'
        })
        .expect(400);

      expect(response.body.error).toContain('valid UUID');
    });

    test('should return 400 for rule_name too long', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          rule_name: 'A'.repeat(101) // Max is 100 chars
        })
        .expect(400);

      expect(response.body.error).toContain('rule_name');
      expect(response.body.error).toContain('100');
    });

    test('should return 400 for invalid max_call_duration_seconds', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          rule_name: 'Invalid Duration Rule',
          max_call_duration_seconds: 30 // Below minimum of 60
        })
        .expect(400);

      expect(response.body.error).toContain('max_call_duration_seconds');
      expect(response.body.error).toContain('60');
    });

    test('should return 400 for max_call_duration_seconds above maximum', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          rule_name: 'Over Max Duration Rule',
          max_call_duration_seconds: 200 // Above maximum of 180
        })
        .expect(400);

      expect(response.body.error).toContain('max_call_duration_seconds');
      expect(response.body.error).toContain('180');
    });

    test('should return 400 for invalid priority threshold ordering', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          rule_name: 'Invalid Priority Rule',
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
      // Create first rule
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Duplicate Name Rule'
      };

      const firstResponse = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdRuleIds.push(firstResponse.body.id);

      // Try to create second rule with same name
      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(400);

      expect(response.body.error).toContain('rule_name');
      expect(response.body.error).toContain('unique');
    });
  });

  describe('Response Format', () => {
    test('should return properly formatted response', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Format Test Rule'
      };

      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdRuleIds.push(response.body.id);

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
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Performance Test Rule'
      };

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);

      createdRuleIds.push(response.body.id);
    });
  });

  describe('Database Persistence', () => {
    test('should persist rule to database correctly', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        rule_name: 'Persistence Test Rule',
        max_call_duration_seconds: 90,
        priority_thresholds: {
          critical: 5,
          high: 30,
          medium: 60,
          low: 85
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdRuleIds.push(response.body.id);

      // Verify in database
      const { data: dbRule } = await supabase
        .from('question_combination_rules')
        .select('*')
        .eq('id', response.body.id)
        .single();

      expect(dbRule).toMatchObject({
        business_context_id: businessContextId,
        rule_name: 'Persistence Test Rule',
        max_call_duration_seconds: 90,
        priority_threshold_critical: 5,
        priority_threshold_high: 30,
        priority_threshold_medium: 60,
        priority_threshold_low: 85,
        is_active: true
      });
    });
  });
});