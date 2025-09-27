// Contract Test: GET /api/questions/harmonizers/{ruleId}
// Feature: Step 5.2: Advanced Question Logic

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('GET /api/questions/harmonizers/{ruleId}', () => {
  let authToken: string;
  let businessContextId: string;
  let testRuleId: string;
  let otherBusinessRuleId: string;
  let testHarmonizerIds: string[] = [];
  let testQuestionIds: string[] = [];

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
        rule_name: 'Test Harmonizer Rule',
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

    // Create rule in different business context
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

    // Create test questions
    const questions = [
      {
        business_id: businessContextId,
        question_text: 'How was the meat quality?',
        question_type: 'rating',
        priority: 'high',
        frequency_target: 25,
        status: 'active',
        is_active: true
      },
      {
        business_id: businessContextId,
        question_text: 'How was the meat freshness?',
        question_type: 'rating',
        priority: 'high',
        frequency_target: 20,
        status: 'active',
        is_active: true
      },
      {
        business_id: businessContextId,
        question_text: 'Rate our dairy selection',
        question_type: 'rating',
        priority: 'medium',
        frequency_target: 15,
        status: 'active',
        is_active: true
      },
      {
        business_id: businessContextId,
        question_text: 'Rate our dairy prices',
        question_type: 'rating',
        priority: 'medium',
        frequency_target: 10,
        status: 'active',
        is_active: true
      }
    ];

    for (const question of questions) {
      const { data } = await supabase
        .from('context_questions')
        .insert(question)
        .select()
        .single();
      testQuestionIds.push(data.id);
    }

    // Create test frequency harmonizers
    const harmonizers = [
      {
        rule_id: testRuleId,
        question_pair_hash: 'hash1234567890abcdef',
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[1],
        resolution_strategy: 'combine',
        custom_frequency: null,
        priority_question_id: null
      },
      {
        rule_id: testRuleId,
        question_pair_hash: 'hash2345678901bcdefg',
        question_id_1: testQuestionIds[2],
        question_id_2: testQuestionIds[3],
        resolution_strategy: 'priority',
        custom_frequency: null,
        priority_question_id: testQuestionIds[2]
      },
      {
        rule_id: testRuleId,
        question_pair_hash: 'hash3456789012cdefgh',
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[2],
        resolution_strategy: 'custom',
        custom_frequency: 30,
        priority_question_id: null
      }
    ];

    for (const harmonizer of harmonizers) {
      const { data } = await supabase
        .from('frequency_harmonizers')
        .insert(harmonizer)
        .select()
        .single();
      testHarmonizerIds.push(data.id);
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testHarmonizerIds.length > 0) {
      await supabase
        .from('frequency_harmonizers')
        .delete()
        .in('id', testHarmonizerIds);
    }
    
    if (testQuestionIds.length > 0) {
      await supabase
        .from('context_questions')
        .delete()
        .in('id', testQuestionIds);
    }
    
    await supabase
      .from('question_combination_rules')
      .delete()
      .in('id', [testRuleId, otherBusinessRuleId]);
  });

  describe('Success Cases', () => {
    test('should return frequency harmonizers for authenticated rule', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);

      const strategies = response.body.map((h: any) => h.resolution_strategy);
      expect(strategies).toContain('combine');
      expect(strategies).toContain('priority');
      expect(strategies).toContain('custom');
    });

    test('should return harmonizer with combine strategy', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const combineHarmonizer = response.body.find((h: any) => h.resolution_strategy === 'combine');
      expect(combineHarmonizer).toBeDefined();
      expect(combineHarmonizer).toMatchObject({
        rule_id: testRuleId,
        question_pair_hash: 'hash1234567890abcdef',
        resolution_strategy: 'combine',
        custom_frequency: null,
        priority_question_id: null
      });
      expect(combineHarmonizer.question_id_1).toBe(testQuestionIds[0]);
      expect(combineHarmonizer.question_id_2).toBe(testQuestionIds[1]);
    });

    test('should return harmonizer with priority strategy', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const priorityHarmonizer = response.body.find((h: any) => h.resolution_strategy === 'priority');
      expect(priorityHarmonizer).toBeDefined();
      expect(priorityHarmonizer).toMatchObject({
        rule_id: testRuleId,
        resolution_strategy: 'priority',
        custom_frequency: null,
        priority_question_id: testQuestionIds[2]
      });
    });

    test('should return harmonizer with custom strategy', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const customHarmonizer = response.body.find((h: any) => h.resolution_strategy === 'custom');
      expect(customHarmonizer).toBeDefined();
      expect(customHarmonizer).toMatchObject({
        rule_id: testRuleId,
        resolution_strategy: 'custom',
        custom_frequency: 30,
        priority_question_id: null
      });
    });

    test('should return empty array for rule with no harmonizers', async () => {
      // Create a new rule without harmonizers
      const { data: emptyRule } = await supabase
        .from('question_combination_rules')
        .insert({
          business_context_id: businessContextId,
          rule_name: 'Empty Harmonizer Rule',
          max_call_duration_seconds: 100,
          priority_threshold_critical: 0,
          priority_threshold_high: 40,
          priority_threshold_medium: 70,
          priority_threshold_low: 100,
          is_active: true
        })
        .select()
        .single();

      const response = await request(app)
        .get(`/api/questions/harmonizers/${emptyRule.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual([]);

      // Cleanup
      await supabase
        .from('question_combination_rules')
        .delete()
        .eq('id', emptyRule.id);
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 for unauthenticated request', async () => {
      await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .expect(401);
    });

    test('should return 403 for accessing rule from different business context', async () => {
      await request(app)
        .get(`/api/questions/harmonizers/${otherBusinessRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    test('should return 401 for invalid token', async () => {
      await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should return 404 for non-existent rule', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .get(`/api/questions/harmonizers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Validation', () => {
    test('should return 400 for invalid rule ID format', async () => {
      const response = await request(app)
        .get('/api/questions/harmonizers/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('valid UUID');
    });
  });

  describe('Response Format Validation', () => {
    test('should return properly formatted response', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
      
      response.body.forEach((harmonizer: any) => {
        expect(harmonizer).toHaveProperty('id');
        expect(harmonizer).toHaveProperty('rule_id');
        expect(harmonizer).toHaveProperty('question_pair_hash');
        expect(harmonizer).toHaveProperty('question_id_1');
        expect(harmonizer).toHaveProperty('question_id_2');
        expect(harmonizer).toHaveProperty('resolution_strategy');
        expect(harmonizer).toHaveProperty('custom_frequency');
        expect(harmonizer).toHaveProperty('priority_question_id');
        expect(harmonizer).toHaveProperty('created_at');

        expect(typeof harmonizer.id).toBe('string');
        expect(typeof harmonizer.rule_id).toBe('string');
        expect(typeof harmonizer.question_pair_hash).toBe('string');
        expect(typeof harmonizer.question_id_1).toBe('string');
        expect(typeof harmonizer.question_id_2).toBe('string');
        expect(typeof harmonizer.resolution_strategy).toBe('string');

        expect(['combine', 'priority', 'alternate', 'custom']).toContain(harmonizer.resolution_strategy);

        // Type-specific validation
        if (harmonizer.resolution_strategy === 'custom') {
          expect(typeof harmonizer.custom_frequency).toBe('number');
          expect(harmonizer.custom_frequency).toBeGreaterThan(0);
        } else {
          expect(harmonizer.custom_frequency).toBeNull();
        }

        if (harmonizer.resolution_strategy === 'priority') {
          expect(typeof harmonizer.priority_question_id).toBe('string');
          expect([harmonizer.question_id_1, harmonizer.question_id_2]).toContain(harmonizer.priority_question_id);
        }
      });
    });

    test('should maintain question pair ordering constraint', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.forEach((harmonizer: any) => {
        // Question IDs should be ordered (question_id_1 < question_id_2)
        expect(harmonizer.question_id_1).toBeLessThan(harmonizer.question_id_2);
      });
    });
  });

  describe('Query Parameters and Filtering', () => {
    test('should support filtering by resolution_strategy', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ resolution_strategy: 'priority' })
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].resolution_strategy).toBe('priority');
    });

    test('should support filtering by question_id', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ question_id: testQuestionIds[0] })
        .expect(200);

      expect(response.body.length).toBe(2); // Two harmonizers involve testQuestionIds[0]
      response.body.forEach((harmonizer: any) => {
        expect([harmonizer.question_id_1, harmonizer.question_id_2]).toContain(testQuestionIds[0]);
      });
    });

    test('should support sorting by created_at', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          sort_by: 'created_at',
          sort_order: 'desc'
        })
        .expect(200);

      if (response.body.length > 1) {
        for (let i = 1; i < response.body.length; i++) {
          const prevDate = new Date(response.body[i - 1].created_at);
          const currDate = new Date(response.body[i].created_at);
          expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
        }
      }
    });

    test('should return 400 for invalid resolution_strategy filter', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ resolution_strategy: 'invalid_strategy' })
        .expect(400);

      expect(response.body.error).toContain('resolution_strategy');
      expect(response.body.error).toContain('combine, priority, alternate, custom');
    });

    test('should return 400 for invalid question_id format', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ question_id: 'invalid-uuid' })
        .expect(400);

      expect(response.body.error).toContain('question_id');
      expect(response.body.error).toContain('valid UUID');
    });
  });

  describe('Performance', () => {
    test('should respond within 500ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Row Level Security', () => {
    test('should only return harmonizers for rules in authenticated business context', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.forEach((harmonizer: any) => {
        expect(harmonizer.rule_id).toBe(testRuleId);
      });

      // Verify rule belongs to authenticated business context
      const { data: rule } = await supabase
        .from('question_combination_rules')
        .select('business_context_id')
        .eq('id', testRuleId)
        .single();

      expect(rule.business_context_id).toBe(businessContextId);
    });
  });

  describe('Data Consistency', () => {
    test('should return consistent question pair hashes', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const hashes = response.body.map((h: any) => h.question_pair_hash);
      const uniqueHashes = [...new Set(hashes)];
      
      // All hashes should be unique (no duplicate harmonizers for same pair)
      expect(hashes.length).toBe(uniqueHashes.length);

      // All hashes should be consistent length (64 characters expected)
      response.body.forEach((harmonizer: any) => {
        expect(harmonizer.question_pair_hash).toMatch(/^[a-f0-9]{16,64}$/);
      });
    });
  });
});