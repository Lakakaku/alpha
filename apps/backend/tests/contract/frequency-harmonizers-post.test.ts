// Contract Test: POST /api/questions/harmonizers/{ruleId}
// Feature: Step 5.2: Advanced Question Logic

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('POST /api/questions/harmonizers/{ruleId}', () => {
  let authToken: string;
  let businessContextId: string;
  let testRuleId: string;
  let otherBusinessRuleId: string;
  let testQuestionIds: string[] = [];
  const createdHarmonizerIds: string[] = [];

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
        rule_name: 'Test Harmonizer Creation Rule',
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
        question_text: 'How was the meat quality today?',
        question_type: 'rating',
        priority: 'high',
        frequency_target: 25,
        status: 'active',
        is_active: true
      },
      {
        business_id: businessContextId,
        question_text: 'How fresh was the meat selection?',
        question_type: 'rating',
        priority: 'high',
        frequency_target: 20,
        status: 'active',
        is_active: true
      },
      {
        business_id: businessContextId,
        question_text: 'Rate our dairy department',
        question_type: 'rating',
        priority: 'medium',
        frequency_target: 15,
        status: 'active',
        is_active: true
      },
      {
        business_id: businessContextId,
        question_text: 'How were our produce prices?',
        question_type: 'rating',
        priority: 'low',
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
  });

  afterAll(async () => {
    // Cleanup created harmonizers
    if (createdHarmonizerIds.length > 0) {
      await supabase
        .from('frequency_harmonizers')
        .delete()
        .in('id', createdHarmonizerIds);
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

  describe('Success Cases - Combine Strategy', () => {
    test('should create harmonizer with combine strategy', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[1],
        resolution_strategy: 'combine'
      };

      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdHarmonizerIds.push(response.body.id);

      expect(response.body).toMatchObject({
        rule_id: testRuleId,
        resolution_strategy: 'combine',
        custom_frequency: null,
        priority_question_id: null
      });

      // Ensure question ordering (question_id_1 should be lexicographically smaller)
      const orderedIds = [testQuestionIds[0], testQuestionIds[1]].sort();
      expect(response.body.question_id_1).toBe(orderedIds[0]);
      expect(response.body.question_id_2).toBe(orderedIds[1]);
      
      expect(response.body.question_pair_hash).toBeDefined();
      expect(typeof response.body.question_pair_hash).toBe('string');
      expect(response.body.created_at).toBeDefined();
    });
  });

  describe('Success Cases - Priority Strategy', () => {
    test('should create harmonizer with priority strategy', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[1],
        question_id_2: testQuestionIds[2],
        resolution_strategy: 'priority',
        priority_question_id: testQuestionIds[1]
      };

      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdHarmonizerIds.push(response.body.id);

      expect(response.body).toMatchObject({
        rule_id: testRuleId,
        resolution_strategy: 'priority',
        priority_question_id: testQuestionIds[1],
        custom_frequency: null
      });
    });

    test('should create priority harmonizer with second question prioritized', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[2],
        question_id_2: testQuestionIds[3],
        resolution_strategy: 'priority',
        priority_question_id: testQuestionIds[3]
      };

      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdHarmonizerIds.push(response.body.id);

      expect(response.body.priority_question_id).toBe(testQuestionIds[3]);
    });
  });

  describe('Success Cases - Custom Strategy', () => {
    test('should create harmonizer with custom strategy', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[2],
        resolution_strategy: 'custom',
        custom_frequency: 45
      };

      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdHarmonizerIds.push(response.body.id);

      expect(response.body).toMatchObject({
        rule_id: testRuleId,
        resolution_strategy: 'custom',
        custom_frequency: 45,
        priority_question_id: null
      });
    });
  });

  describe('Success Cases - Alternate Strategy', () => {
    test('should create harmonizer with alternate strategy', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[3],
        resolution_strategy: 'alternate'
      };

      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdHarmonizerIds.push(response.body.id);

      expect(response.body).toMatchObject({
        rule_id: testRuleId,
        resolution_strategy: 'alternate',
        custom_frequency: null,
        priority_question_id: null
      });
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 for unauthenticated request', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[1],
        resolution_strategy: 'combine'
      };

      await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .send(createRequest)
        .expect(401);
    });

    test('should return 403 for creating harmonizer in different business context rule', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[1],
        resolution_strategy: 'combine'
      };

      await request(app)
        .post(`/api/questions/harmonizers/${otherBusinessRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(403);
    });

    test('should return 401 for invalid token', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[1],
        resolution_strategy: 'combine'
      };

      await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', 'Bearer invalid-token')
        .send(createRequest)
        .expect(401);
    });

    test('should return 404 for non-existent rule', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const createRequest = {
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[1],
        resolution_strategy: 'combine'
      };

      await request(app)
        .post(`/api/questions/harmonizers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(404);
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('question_id_1');
      expect(response.body.error).toContain('question_id_2');
      expect(response.body.error).toContain('resolution_strategy');
    });

    test('should return 400 for invalid rule ID format', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[0],
        question_id_2: testQuestionIds[1],
        resolution_strategy: 'combine'
      };

      const response = await request(app)
        .post('/api/questions/harmonizers/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(400);

      expect(response.body.error).toContain('valid UUID');
    });

    test('should return 400 for invalid question ID formats', async () => {
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id_1: 'invalid-uuid-1',
          question_id_2: 'invalid-uuid-2',
          resolution_strategy: 'combine'
        })
        .expect(400);

      expect(response.body.error).toContain('question_id');
      expect(response.body.error).toContain('valid UUID');
    });

    test('should return 400 for invalid resolution_strategy', async () => {
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id_1: testQuestionIds[0],
          question_id_2: testQuestionIds[1],
          resolution_strategy: 'invalid_strategy'
        })
        .expect(400);

      expect(response.body.error).toContain('resolution_strategy');
      expect(response.body.error).toContain('combine, priority, alternate, custom');
    });

    test('should return 400 for identical question IDs', async () => {
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id_1: testQuestionIds[0],
          question_id_2: testQuestionIds[0], // Same as question_id_1
          resolution_strategy: 'combine'
        })
        .expect(400);

      expect(response.body.error).toContain('different questions');
    });

    test('should return 400 for non-existent questions', async () => {
      const nonExistentQuestionId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id_1: nonExistentQuestionId,
          question_id_2: testQuestionIds[1],
          resolution_strategy: 'combine'
        })
        .expect(400);

      expect(response.body.error).toContain('question not found');
    });

    test('should return 400 for priority strategy without priority_question_id', async () => {
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id_1: testQuestionIds[1],
          question_id_2: testQuestionIds[2],
          resolution_strategy: 'priority'
          // Missing priority_question_id
        })
        .expect(400);

      expect(response.body.error).toContain('priority_question_id');
      expect(response.body.error).toContain('required');
    });

    test('should return 400 for invalid priority_question_id', async () => {
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id_1: testQuestionIds[1],
          question_id_2: testQuestionIds[2],
          resolution_strategy: 'priority',
          priority_question_id: testQuestionIds[0] // Not one of the paired questions
        })
        .expect(400);

      expect(response.body.error).toContain('priority_question_id');
      expect(response.body.error).toContain('must be one of the paired questions');
    });

    test('should return 400 for custom strategy without custom_frequency', async () => {
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id_1: testQuestionIds[1],
          question_id_2: testQuestionIds[2],
          resolution_strategy: 'custom'
          // Missing custom_frequency
        })
        .expect(400);

      expect(response.body.error).toContain('custom_frequency');
      expect(response.body.error).toContain('required');
    });

    test('should return 400 for invalid custom_frequency value', async () => {
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id_1: testQuestionIds[1],
          question_id_2: testQuestionIds[2],
          resolution_strategy: 'custom',
          custom_frequency: -10 // Negative frequency
        })
        .expect(400);

      expect(response.body.error).toContain('custom_frequency');
      expect(response.body.error).toContain('positive');
    });

    test('should return 400 for duplicate harmonizer (same question pair)', async () => {
      // Create first harmonizer
      const createRequest = {
        question_id_1: testQuestionIds[1],
        question_id_2: testQuestionIds[3],
        resolution_strategy: 'combine'
      };

      const firstResponse = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdHarmonizerIds.push(firstResponse.body.id);

      // Try to create second harmonizer with same question pair
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(400);

      expect(response.body.error).toContain('already exists');
      expect(response.body.error).toContain('question pair');
    });

    test('should return 400 for duplicate harmonizer (reversed question pair)', async () => {
      // First harmonizer with specific order
      const firstRequest = {
        question_id_1: testQuestionIds[0], // smaller UUID
        question_id_2: testQuestionIds[1], // larger UUID
        resolution_strategy: 'priority',
        priority_question_id: testQuestionIds[0]
      };

      const firstResponse = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(firstRequest)
        .expect(201);

      createdHarmonizerIds.push(firstResponse.body.id);

      // Try to create harmonizer with reversed order (should still be detected as duplicate)
      const secondRequest = {
        question_id_1: testQuestionIds[1], // larger UUID first
        question_id_2: testQuestionIds[0], // smaller UUID second
        resolution_strategy: 'alternate'
      };

      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(secondRequest)
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('Response Format', () => {
    test('should return properly formatted response', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[2],
        question_id_2: testQuestionIds[1],
        resolution_strategy: 'priority',
        priority_question_id: testQuestionIds[2]
      };

      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdHarmonizerIds.push(response.body.id);

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('rule_id');
      expect(response.body).toHaveProperty('question_pair_hash');
      expect(response.body).toHaveProperty('question_id_1');
      expect(response.body).toHaveProperty('question_id_2');
      expect(response.body).toHaveProperty('resolution_strategy');
      expect(response.body).toHaveProperty('custom_frequency');
      expect(response.body).toHaveProperty('priority_question_id');
      expect(response.body).toHaveProperty('created_at');

      expect(typeof response.body.id).toBe('string');
      expect(typeof response.body.question_pair_hash).toBe('string');
      expect(response.body.question_pair_hash.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should respond within 500ms', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[3],
        question_id_2: testQuestionIds[0],
        resolution_strategy: 'alternate'
      };

      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);

      createdHarmonizerIds.push(response.body.id);
    });
  });

  describe('Database Persistence', () => {
    test('should persist harmonizer to database correctly', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[3],
        question_id_2: testQuestionIds[2],
        resolution_strategy: 'custom',
        custom_frequency: 35
      };

      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdHarmonizerIds.push(response.body.id);

      // Verify in database
      const { data: dbHarmonizer } = await supabase
        .from('frequency_harmonizers')
        .select('*')
        .eq('id', response.body.id)
        .single();

      expect(dbHarmonizer).toMatchObject({
        rule_id: testRuleId,
        resolution_strategy: 'custom',
        custom_frequency: 35,
        priority_question_id: null
      });

      // Verify question ordering
      const orderedIds = [testQuestionIds[3], testQuestionIds[2]].sort();
      expect(dbHarmonizer.question_id_1).toBe(orderedIds[0]);
      expect(dbHarmonizer.question_id_2).toBe(orderedIds[1]);
    });
  });

  describe('Hash Generation', () => {
    test('should generate consistent hash for same question pair', async () => {
      const createRequest = {
        question_id_1: testQuestionIds[1],
        question_id_2: testQuestionIds[0],
        resolution_strategy: 'combine'
      };

      const response = await request(app)
        .post(`/api/questions/harmonizers/${testRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdHarmonizerIds.push(response.body.id);

      // Hash should be deterministic based on the ordered question IDs
      expect(response.body.question_pair_hash).toMatch(/^[a-f0-9]{16,64}$/);
    });
  });
});