/**
 * Integration Tests - Question Combination Engine Time Optimization
 * Tests the complete workflow of question combination with time constraints
 * 
 * This test suite validates that the question combination engine can:
 * - Select optimal question combinations within time limits (60-180 seconds)
 * - Apply priority-based filtering (1=Optional, 5=Critical)
 * - Optimize for maximum value within time constraints
 * - Handle real business scenarios with multiple question types
 */

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Integration: Question Combination Engine', () => {
  let testBusinessId: string;
  let testCombinationRuleId: string;
  let testQuestions: any[] = [];
  let authToken: string;

  beforeAll(async () => {
    // Create test business context
    const businessResult = await supabase
      .from('business_contexts')
      .insert({
        business_id: 'test-combo-business',
        name: 'Question Combination Test Business',
        industry: 'retail',
        target_language: 'sv',
        is_active: true
      })
      .select()
      .single();

    if (businessResult.error) throw businessResult.error;
    testBusinessId = businessResult.data.id;

    // Create auth token (simplified for integration test)
    authToken = 'test-integration-token';

    // Create test questions with different priorities and estimated durations
    const questionData = [
      {
        business_context_id: testBusinessId,
        question_text: 'How satisfied are you with your recent purchase?',
        question_type: 'satisfaction_rating',
        priority_level: 5, // Critical
        estimated_duration_seconds: 30,
        is_active: true,
        order_index: 1
      },
      {
        business_context_id: testBusinessId,
        question_text: 'Would you recommend us to a friend?',
        question_type: 'nps_score',
        priority_level: 4, // High
        estimated_duration_seconds: 25,
        is_active: true,
        order_index: 2
      },
      {
        business_context_id: testBusinessId,
        question_text: 'What specific features did you like most?',
        question_type: 'open_feedback',
        priority_level: 3, // Medium
        estimated_duration_seconds: 45,
        is_active: true,
        order_index: 3
      },
      {
        business_context_id: testBusinessId,
        question_text: 'How did you hear about our store?',
        question_type: 'attribution',
        priority_level: 2, // Low
        estimated_duration_seconds: 20,
        is_active: true,
        order_index: 4
      },
      {
        business_context_id: testBusinessId,
        question_text: 'Any additional comments?',
        question_type: 'open_feedback',
        priority_level: 1, // Optional
        estimated_duration_seconds: 35,
        is_active: true,
        order_index: 5
      },
      {
        business_context_id: testBusinessId,
        question_text: 'Rate our checkout process',
        question_type: 'process_rating',
        priority_level: 3, // Medium
        estimated_duration_seconds: 25,
        is_active: true,
        order_index: 6
      }
    ];

    const questionsResult = await supabase
      .from('questions')
      .insert(questionData)
      .select();

    if (questionsResult.error) throw questionsResult.error;
    testQuestions = questionsResult.data;

    // Create question combination rule
    const ruleResult = await supabase
      .from('question_combination_rules')
      .insert({
        business_context_id: testBusinessId,
        rule_name: 'Optimized Call Duration Rule',
        max_call_duration_seconds: 120, // 2 minutes
        priority_threshold_critical: 5,
        priority_threshold_high: 4,
        priority_threshold_medium: 3,
        priority_threshold_low: 2,
        is_active: true
      })
      .select()
      .single();

    if (ruleResult.error) throw ruleResult.error;
    testCombinationRuleId = ruleResult.data.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testQuestions.length > 0) {
      await supabase
        .from('questions')
        .delete()
        .in('id', testQuestions.map(q => q.id));
    }

    if (testCombinationRuleId) {
      await supabase
        .from('question_combination_rules')
        .delete()
        .eq('id', testCombinationRuleId);
    }

    if (testBusinessId) {
      await supabase
        .from('business_contexts')
        .delete()
        .eq('id', testBusinessId);
    }
  });

  describe('Time Constraint Optimization', () => {
    it('should select optimal questions within 120-second limit', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 299.99,
            purchase_category: 'electronics'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const combination = response.body.data;
      expect(combination).toHaveProperty('selected_questions');
      expect(combination).toHaveProperty('total_estimated_duration');
      expect(combination).toHaveProperty('optimization_metadata');

      // Verify time constraint is respected
      expect(combination.total_estimated_duration).toBeLessThanOrEqual(120);
      
      // Verify questions are selected
      expect(Array.isArray(combination.selected_questions)).toBe(true);
      expect(combination.selected_questions.length).toBeGreaterThan(0);
    });

    it('should prioritize critical questions first', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234568',
            purchase_amount: 150.00
          }
        });

      expect(response.status).toBe(200);
      const combination = response.body.data;
      
      // Find critical priority questions (priority 5)
      const criticalQuestions = combination.selected_questions.filter(
        (q: any) => q.priority_level === 5
      );
      
      // Critical questions should be included
      expect(criticalQuestions.length).toBeGreaterThan(0);
      
      // First question should be highest priority available
      const sortedByPriority = combination.selected_questions.sort(
        (a: any, b: any) => b.priority_level - a.priority_level
      );
      expect(combination.selected_questions[0].priority_level)
        .toBe(sortedByPriority[0].priority_level);
    });

    it('should exclude low-priority questions when time is tight', async () => {
      // Create a very restrictive rule (60 seconds)
      const restrictiveRuleResult = await supabase
        .from('question_combination_rules')
        .insert({
          business_context_id: testBusinessId,
          rule_name: 'Tight Time Rule',
          max_call_duration_seconds: 60,
          priority_threshold_critical: 5,
          priority_threshold_high: 4,
          priority_threshold_medium: 3,
          priority_threshold_low: 2,
          is_active: true
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569',
            purchase_amount: 50.00
          },
          combination_rule_id: restrictiveRuleResult.data.id
        });

      expect(response.status).toBe(200);
      const combination = response.body.data;
      
      // Should not include optional questions (priority 1)
      const optionalQuestions = combination.selected_questions.filter(
        (q: any) => q.priority_level === 1
      );
      expect(optionalQuestions.length).toBe(0);
      
      // Total duration should be under 60 seconds
      expect(combination.total_estimated_duration).toBeLessThanOrEqual(60);

      // Clean up
      await supabase
        .from('question_combination_rules')
        .delete()
        .eq('id', restrictiveRuleResult.data.id);
    });

    it('should handle edge case with single high-value question', async () => {
      // Create a question that takes almost the full time limit
      const longQuestionResult = await supabase
        .from('questions')
        .insert({
          business_context_id: testBusinessId,
          question_text: 'Please provide detailed feedback about your experience',
          question_type: 'detailed_feedback',
          priority_level: 5,
          estimated_duration_seconds: 115, // Almost full 120-second limit
          is_active: true,
          order_index: 10
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234570',
            purchase_amount: 500.00
          }
        });

      expect(response.status).toBe(200);
      const combination = response.body.data;
      
      // Should include the high-value question
      const longQuestion = combination.selected_questions.find(
        (q: any) => q.id === longQuestionResult.data.id
      );
      expect(longQuestion).toBeDefined();
      
      // Should have minimal additional questions due to time constraint
      expect(combination.total_estimated_duration).toBeLessThanOrEqual(120);

      // Clean up
      await supabase
        .from('questions')
        .delete()
        .eq('id', longQuestionResult.data.id);
    });
  });

  describe('Priority-Based Selection Algorithm', () => {
    it('should implement greedy algorithm for maximum value', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234571',
            purchase_amount: 199.99
          }
        });

      expect(response.status).toBe(200);
      const combination = response.body.data;
      
      expect(combination.optimization_metadata).toHaveProperty('algorithm');
      expect(combination.optimization_metadata.algorithm).toBe('priority_greedy');
      
      expect(combination.optimization_metadata).toHaveProperty('value_score');
      expect(combination.optimization_metadata.value_score).toBeGreaterThan(0);
      
      // Questions should be sorted by priority
      let previousPriority = 5;
      for (const question of combination.selected_questions) {
        expect(question.priority_level).toBeLessThanOrEqual(previousPriority);
        previousPriority = question.priority_level;
      }
    });

    it('should calculate value-to-time ratio for optimization', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234572',
            purchase_amount: 75.00
          }
        });

      expect(response.status).toBe(200);
      const combination = response.body.data;
      
      expect(combination.optimization_metadata).toHaveProperty('efficiency_score');
      expect(combination.optimization_metadata.efficiency_score).toBeGreaterThan(0);
      
      // Each selected question should have optimization metrics
      combination.selected_questions.forEach((question: any) => {
        expect(question).toHaveProperty('value_to_time_ratio');
        expect(question.value_to_time_ratio).toBeGreaterThan(0);
      });
    });
  });

  describe('Real Business Scenarios', () => {
    it('should handle high-value customer scenario (premium treatment)', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234573',
            purchase_amount: 1299.99,
            purchase_category: 'electronics',
            customer_tier: 'premium'
          }
        });

      expect(response.status).toBe(200);
      const combination = response.body.data;
      
      // Premium customers should get more comprehensive questioning
      expect(combination.selected_questions.length).toBeGreaterThanOrEqual(3);
      
      // Should include satisfaction and NPS questions for high-value customers
      const hasSatisfaction = combination.selected_questions.some(
        (q: any) => q.question_type === 'satisfaction_rating'
      );
      const hasNPS = combination.selected_questions.some(
        (q: any) => q.question_type === 'nps_score'
      );
      
      expect(hasSatisfaction).toBe(true);
      expect(hasNPS).toBe(true);
    });

    it('should handle low-value customer scenario (efficient questioning)', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234574',
            purchase_amount: 19.99,
            purchase_category: 'accessories'
          }
        });

      expect(response.status).toBe(200);
      const combination = response.body.data;
      
      // Low-value purchases should get focused questioning
      expect(combination.selected_questions.length).toBeLessThanOrEqual(4);
      
      // Should prioritize quick, high-impact questions
      const avgDuration = combination.total_estimated_duration / combination.selected_questions.length;
      expect(avgDuration).toBeLessThanOrEqual(35); // Quick questions
    });

    it('should handle repeat customer scenario (relationship building)', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234575',
            purchase_amount: 299.99,
            customer_history: {
              previous_purchases: 5,
              last_feedback_date: '2024-01-01',
              satisfaction_trend: 'positive'
            }
          }
        });

      expect(response.status).toBe(200);
      const combination = response.body.data;
      
      expect(combination.optimization_metadata).toHaveProperty('customer_context');
      expect(combination.optimization_metadata.customer_context.is_repeat_customer).toBe(true);
    });
  });

  describe('Performance and Efficiency', () => {
    it('should complete optimization within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234576',
            purchase_amount: 149.99
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // Performance requirement
    });

    it('should handle multiple concurrent optimization requests', async () => {
      const requests = Array.from({ length: 5 }, (_, index) =>
        request(app)
          .post('/api/questions/combinations/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: testBusinessId,
            customer_context: {
              phone: `+4670123457${index}`,
              purchase_amount: 100 + index * 50
            }
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Concurrent processing should not significantly increase total time
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should cache optimization results for identical requests', async () => {
      const customerContext = {
        phone: '+46701234577',
        purchase_amount: 199.99,
        purchase_category: 'electronics'
      };

      // First request
      const startTime1 = Date.now();
      const response1 = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: customerContext
        });
      const duration1 = Date.now() - startTime1;

      // Second identical request
      const startTime2 = Date.now();
      const response2 = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: customerContext
        });
      const duration2 = Date.now() - startTime2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Results should be identical
      expect(response1.body.data.selected_questions).toEqual(response2.body.data.selected_questions);
      
      // Second request should be faster (cached)
      expect(duration2).toBeLessThan(duration1 * 0.5);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle scenario with no questions available', async () => {
      // Create business with no questions
      const emptyBusinessResult = await supabase
        .from('business_contexts')
        .insert({
          business_id: 'empty-business',
          name: 'Empty Business',
          industry: 'retail',
          target_language: 'sv',
          is_active: true
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: emptyBusinessResult.data.id,
          customer_context: {
            phone: '+46701234578',
            purchase_amount: 99.99
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.selected_questions).toEqual([]);
      expect(response.body.data.total_estimated_duration).toBe(0);

      // Clean up
      await supabase
        .from('business_contexts')
        .delete()
        .eq('id', emptyBusinessResult.data.id);
    });

    it('should handle extremely short time limit', async () => {
      const shortRuleResult = await supabase
        .from('question_combination_rules')
        .insert({
          business_context_id: testBusinessId,
          rule_name: 'Ultra Short Rule',
          max_call_duration_seconds: 10, // Impossibly short
          priority_threshold_critical: 5,
          priority_threshold_high: 4,
          priority_threshold_medium: 3,
          priority_threshold_low: 2,
          is_active: true
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234579',
            purchase_amount: 199.99
          },
          combination_rule_id: shortRuleResult.data.id
        });

      expect(response.status).toBe(200);
      
      // Should handle gracefully, possibly with no questions or warning
      if (response.body.data.selected_questions.length > 0) {
        expect(response.body.data.total_estimated_duration).toBeLessThanOrEqual(10);
      }
      
      expect(response.body.data).toHaveProperty('optimization_metadata');
      expect(response.body.data.optimization_metadata).toHaveProperty('warnings');

      // Clean up
      await supabase
        .from('question_combination_rules')
        .delete()
        .eq('id', shortRuleResult.data.id);
    });
  });
});