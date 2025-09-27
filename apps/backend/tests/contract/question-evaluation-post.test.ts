// Contract Test: POST /api/questions/combinations/evaluate
// Feature: Step 5.2: Advanced Question Logic

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('POST /api/questions/combinations/evaluate', () => {
  let authToken: string;
  let businessContextId: string;
  let testRuleId: string;
  let testTriggerId: string;
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
        rule_name: 'Test Evaluation Rule',
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

    // Create test dynamic trigger
    const { data: trigger } = await supabase
      .from('dynamic_triggers')
      .insert({
        business_context_id: businessContextId,
        trigger_name: 'Test Purchase Trigger',
        trigger_type: 'purchase_based',
        priority_level: 4,
        sensitivity_threshold: 10,
        is_active: true,
        trigger_config: {
          type: 'purchase_based',
          categories: ['meat', 'dairy', 'bakery'],
          minimum_items: 1
        },
        effectiveness_score: 0.8
      })
      .select()
      .single();
    
    testTriggerId = trigger.id;

    // Create test questions
    const questions = [
      {
        business_id: businessContextId,
        question_text: 'How was your experience with our meat products?',
        question_type: 'rating',
        priority: 'high',
        frequency_target: 20,
        status: 'active',
        is_active: true,
        department: 'meat'
      },
      {
        business_id: businessContextId,
        question_text: 'Did you find everything you were looking for in dairy?',
        question_type: 'yes_no',
        priority: 'medium',
        frequency_target: 15,
        status: 'active',
        is_active: true,
        department: 'dairy'
      },
      {
        business_id: businessContextId,
        question_text: 'Would you recommend our bakery items?',
        question_type: 'yes_no',
        priority: 'medium',
        frequency_target: 10,
        status: 'active',
        is_active: true,
        department: 'bakery'
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
    // Cleanup test data
    if (testQuestionIds.length > 0) {
      await supabase
        .from('context_questions')
        .delete()
        .in('id', testQuestionIds);
    }
    
    await supabase
      .from('dynamic_triggers')
      .delete()
      .eq('id', testTriggerId);
      
    await supabase
      .from('question_combination_rules')
      .delete()
      .eq('id', testRuleId);
  });

  describe('Success Cases', () => {
    test('should evaluate questions with purchase-based trigger matching', async () => {
      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'test-verification-uuid',
          transaction_time: '2025-09-24T10:30:00Z',
          transaction_amount: 450.75,
          transaction_currency: 'SEK',
          purchase_categories: ['meat', 'dairy'],
          purchase_items: ['ground beef', 'milk', 'cheese']
        },
        time_constraints: {
          max_call_duration_seconds: 120,
          target_question_count: 3,
          priority_minimum: 2
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(200);

      expect(response.body).toHaveProperty('verification_id');
      expect(response.body).toHaveProperty('selected_questions');
      expect(response.body).toHaveProperty('total_estimated_duration');
      expect(response.body).toHaveProperty('total_estimated_tokens');
      expect(response.body).toHaveProperty('triggered_rules');
      expect(response.body).toHaveProperty('optimization_metadata');

      expect(response.body.verification_id).toBe('test-verification-uuid');
      expect(response.body.selected_questions).toBeInstanceOf(Array);
      expect(response.body.selected_questions.length).toBeGreaterThan(0);
      expect(response.body.total_estimated_duration).toBeLessThanOrEqual(120);
      expect(response.body.triggered_rules).toContain(testTriggerId);
    });

    test('should evaluate with minimal customer data', async () => {
      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'minimal-test-uuid',
          transaction_time: '2025-09-24T14:15:00Z',
          transaction_amount: 89.50,
          transaction_currency: 'SEK'
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(200);

      expect(response.body.verification_id).toBe('minimal-test-uuid');
      expect(response.body.selected_questions).toBeInstanceOf(Array);
      expect(response.body.total_estimated_duration).toBeGreaterThan(0);
    });

    test('should handle high-value transaction with amount-based triggers', async () => {
      // Create an amount-based trigger for this test
      const { data: amountTrigger } = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: businessContextId,
          trigger_name: 'High Value Trigger',
          trigger_type: 'amount_based',
          priority_level: 5,
          sensitivity_threshold: 5,
          is_active: true,
          trigger_config: {
            type: 'amount_based',
            currency: 'SEK',
            minimum_amount: 1000,
            comparison_operator: '>='
          },
          effectiveness_score: 0.9
        })
        .select()
        .single();

      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'high-value-test-uuid',
          transaction_time: '2025-09-24T16:00:00Z',
          transaction_amount: 1250.00,
          transaction_currency: 'SEK',
          purchase_categories: ['meat', 'dairy', 'bakery'],
          purchase_items: ['premium steak', 'organic milk', 'artisan bread']
        },
        time_constraints: {
          max_call_duration_seconds: 180,
          target_question_count: 5,
          priority_minimum: 1
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(200);

      expect(response.body.triggered_rules).toContain(amountTrigger.id);
      expect(response.body.selected_questions.length).toBeGreaterThan(0);

      // Cleanup
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', amountTrigger.id);
    });

    test('should respect time constraints and prioritize questions', async () => {
      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'time-constraint-test-uuid',
          transaction_time: '2025-09-24T11:00:00Z',
          transaction_amount: 300.00,
          transaction_currency: 'SEK',
          purchase_categories: ['meat', 'dairy', 'bakery']
        },
        time_constraints: {
          max_call_duration_seconds: 60, // Very short call
          target_question_count: 2,
          priority_minimum: 3
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(200);

      expect(response.body.total_estimated_duration).toBeLessThanOrEqual(60);
      expect(response.body.selected_questions.length).toBeLessThanOrEqual(2);
      
      // All selected questions should meet priority minimum
      response.body.selected_questions.forEach((question: any) => {
        expect(question.priority_level).toBeGreaterThanOrEqual(3);
      });
    });

    test('should return optimization metadata', async () => {
      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'metadata-test-uuid',
          transaction_time: '2025-09-24T12:00:00Z',
          transaction_amount: 150.00,
          transaction_currency: 'SEK'
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(200);

      expect(response.body.optimization_metadata).toBeDefined();
      expect(response.body.optimization_metadata).toHaveProperty('algorithm_version');
      expect(response.body.optimization_metadata).toHaveProperty('selection_strategy');
      expect(response.body.optimization_metadata).toHaveProperty('confidence_score');
      
      expect(typeof response.body.optimization_metadata.algorithm_version).toBe('string');
      expect(typeof response.body.optimization_metadata.selection_strategy).toBe('string');
      expect(typeof response.body.optimization_metadata.confidence_score).toBe('number');
      expect(response.body.optimization_metadata.confidence_score).toBeGreaterThanOrEqual(0.0);
      expect(response.body.optimization_metadata.confidence_score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Edge Cases', () => {
    test('should return 422 when no questions can be selected within constraints', async () => {
      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'no-questions-test-uuid',
          transaction_time: '2025-09-24T13:00:00Z',
          transaction_amount: 50.00,
          transaction_currency: 'SEK'
        },
        time_constraints: {
          max_call_duration_seconds: 5, // Impossibly short
          target_question_count: 10, // Too many questions
          priority_minimum: 5 // Very high priority requirement
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(422);

      expect(response.body.error).toContain('No questions');
      expect(response.body).toHaveProperty('constraints');
      expect(response.body.constraints).toMatchObject({
        max_call_duration_seconds: 5,
        target_question_count: 10,
        priority_minimum: 5
      });
    });

    test('should handle non-matching triggers gracefully', async () => {
      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'no-triggers-test-uuid',
          transaction_time: '2025-09-24T08:00:00Z',
          transaction_amount: 25.00,
          transaction_currency: 'SEK',
          purchase_categories: ['electronics'], // No triggers for this category
          purchase_items: ['battery']
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(200);

      expect(response.body.triggered_rules).toEqual([]);
      expect(response.body.selected_questions).toBeInstanceOf(Array);
      // Should still return some questions based on general rules
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 for unauthenticated request', async () => {
      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'unauth-test-uuid',
          transaction_time: '2025-09-24T10:00:00Z',
          transaction_amount: 100.00,
          transaction_currency: 'SEK'
        }
      };

      await request(app)
        .post('/api/questions/combinations/evaluate')
        .send(evaluationRequest)
        .expect(401);
    });

    test('should return 403 for evaluating different business context', async () => {
      const evaluationRequest = {
        business_context_id: 'different-business-uuid',
        customer_data: {
          verification_id: 'forbidden-test-uuid',
          transaction_time: '2025-09-24T10:00:00Z',
          transaction_amount: 100.00,
          transaction_currency: 'SEK'
        }
      };

      await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(403);
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('business_context_id');
      expect(response.body.error).toContain('customer_data');
    });

    test('should return 400 for invalid business_context_id format', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: 'invalid-uuid',
          customer_data: {
            verification_id: 'test-uuid',
            transaction_time: '2025-09-24T10:00:00Z',
            transaction_amount: 100.00,
            transaction_currency: 'SEK'
          }
        })
        .expect(400);

      expect(response.body.error).toContain('valid UUID');
    });

    test('should return 400 for missing customer_data fields', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          customer_data: {}
        })
        .expect(400);

      expect(response.body.error).toContain('verification_id');
    });

    test('should return 400 for invalid transaction_amount', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          customer_data: {
            verification_id: 'test-uuid',
            transaction_time: '2025-09-24T10:00:00Z',
            transaction_amount: -50.00, // Negative amount
            transaction_currency: 'SEK'
          }
        })
        .expect(400);

      expect(response.body.error).toContain('transaction_amount');
    });

    test('should return 400 for invalid time_constraints', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          customer_data: {
            verification_id: 'test-uuid',
            transaction_time: '2025-09-24T10:00:00Z',
            transaction_amount: 100.00,
            transaction_currency: 'SEK'
          },
          time_constraints: {
            max_call_duration_seconds: 300, // Above maximum of 180
            target_question_count: 0 // Below minimum of 1
          }
        })
        .expect(400);

      expect(response.body.error).toContain('max_call_duration_seconds');
      expect(response.body.error).toContain('target_question_count');
    });
  });

  describe('Performance', () => {
    test('should respond within 500ms requirement', async () => {
      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'performance-test-uuid',
          transaction_time: '2025-09-24T15:30:00Z',
          transaction_amount: 200.00,
          transaction_currency: 'SEK',
          purchase_categories: ['meat', 'dairy']
        }
      };

      const startTime = Date.now();
      
      await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Response Format', () => {
    test('should return properly structured selected questions', async () => {
      const evaluationRequest = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'format-test-uuid',
          transaction_time: '2025-09-24T09:00:00Z',
          transaction_amount: 150.00,
          transaction_currency: 'SEK',
          purchase_categories: ['meat']
        }
      };

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(evaluationRequest)
        .expect(200);

      response.body.selected_questions.forEach((question: any) => {
        expect(question).toHaveProperty('question_id');
        expect(question).toHaveProperty('question_text');
        expect(question).toHaveProperty('priority_level');
        expect(question).toHaveProperty('estimated_tokens');
        expect(question).toHaveProperty('topic_category');
        expect(question).toHaveProperty('trigger_source');
        expect(question).toHaveProperty('display_order');
        expect(question).toHaveProperty('group_name');

        expect(typeof question.question_id).toBe('string');
        expect(typeof question.question_text).toBe('string');
        expect(typeof question.priority_level).toBe('number');
        expect(typeof question.estimated_tokens).toBe('number');
        expect(typeof question.display_order).toBe('number');
      });
    });
  });
});