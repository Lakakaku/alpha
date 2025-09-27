/**
 * Integration Tests - Complex Trigger Combinations with Priority Hierarchy
 * Tests the complete workflow of multiple trigger interactions
 * 
 * This test suite validates that the system can:
 * - Handle multiple active triggers simultaneously
 * - Apply priority hierarchy to resolve conflicts
 * - Combine different trigger types (purchase, time, amount)
 * - Optimize question selection across competing triggers
 * - Maintain consistency in complex trigger scenarios
 */

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Integration: Complex Trigger Combinations', () => {
  let testBusinessId: string;
  let testTriggers: any[] = [];
  let testQuestions: any[] = [];
  let authToken: string;

  beforeAll(async () => {
    // Create test business context
    const businessResult = await supabase
      .from('business_contexts')
      .insert({
        business_id: 'complex-triggers-business',
        name: 'Complex Trigger Combinations Test Business',
        industry: 'retail',
        target_language: 'sv',
        is_active: true
      })
      .select()
      .single();

    if (businessResult.error) throw businessResult.error;
    testBusinessId = businessResult.data.id;

    authToken = 'test-integration-token';

    // Create a comprehensive set of questions with different priorities
    const questionData = [
      {
        business_context_id: testBusinessId,
        question_text: 'How satisfied are you with your recent purchase?',
        question_type: 'satisfaction_rating',
        priority_level: 5, // Critical
        estimated_duration_seconds: 30,
        trigger_tags: ['purchase', 'satisfaction'],
        is_active: true
      },
      {
        business_context_id: testBusinessId,
        question_text: 'Would you recommend us to others?',
        question_type: 'nps_score',
        priority_level: 4, // High
        estimated_duration_seconds: 25,
        trigger_tags: ['loyalty', 'recommendation'],
        is_active: true
      },
      {
        business_context_id: testBusinessId,
        question_text: 'What specific features did you like most?',
        question_type: 'open_feedback',
        priority_level: 3, // Medium
        estimated_duration_seconds: 45,
        trigger_tags: ['feature', 'feedback'],
        is_active: true
      },
      {
        business_context_id: testBusinessId,
        question_text: 'How was our customer service?',
        question_type: 'service_rating',
        priority_level: 4, // High
        estimated_duration_seconds: 20,
        trigger_tags: ['service', 'support'],
        is_active: true
      },
      {
        business_context_id: testBusinessId,
        question_text: 'Any suggestions for improvement?',
        question_type: 'improvement_feedback',
        priority_level: 2, // Low
        estimated_duration_seconds: 40,
        trigger_tags: ['improvement', 'feedback'],
        is_active: true
      },
      {
        business_context_id: testBusinessId,
        question_text: 'How did you hear about us?',
        question_type: 'attribution',
        priority_level: 1, // Optional
        estimated_duration_seconds: 15,
        trigger_tags: ['marketing', 'attribution'],
        is_active: true
      }
    ];

    const questionsResult = await supabase
      .from('questions')
      .insert(questionData)
      .select();

    if (questionsResult.error) throw questionsResult.error;
    testQuestions = questionsResult.data;

    // Create complex trigger combinations with different types and priorities
    const triggerData = [
      {
        business_context_id: testBusinessId,
        trigger_name: 'High-Value Purchase VIP',
        trigger_type: 'purchase_based',
        priority_weight: 10, // Highest priority
        is_active: true,
        config: {
          purchase_amount_threshold: 2000.00,
          product_categories: ['electronics', 'appliances'],
          time_since_purchase_hours: 48,
          question_tags: ['satisfaction', 'loyalty', 'service']
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Long-Time Customer Check-in',
        trigger_type: 'time_based',
        priority_weight: 8, // High priority
        is_active: true,
        config: {
          days_since_last_contact: 60,
          preferred_contact_hours: [10, 11, 14, 15, 16],
          timezone: 'Europe/Stockholm',
          question_tags: ['loyalty', 'feedback', 'improvement']
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Premium Tier Benefits',
        trigger_type: 'amount_based',
        priority_weight: 9, // Very high priority
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'cumulative_quarterly',
              operator: 'gte',
              value: 10000.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          question_tags: ['satisfaction', 'service', 'feature']
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Recent Purchase Follow-up',
        trigger_type: 'purchase_based',
        priority_weight: 6, // Medium priority
        is_active: true,
        config: {
          purchase_amount_threshold: 100.00,
          product_categories: [],
          time_since_purchase_hours: 24,
          question_tags: ['satisfaction', 'feedback']
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Regular Engagement',
        trigger_type: 'time_based',
        priority_weight: 4, // Lower priority
        is_active: true,
        config: {
          days_since_last_contact: 14,
          preferred_contact_hours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          timezone: 'Europe/Stockholm',
          question_tags: ['loyalty', 'attribution']
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Special Campaign',
        trigger_type: 'amount_based',
        priority_weight: 7, // High-medium priority
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'single_purchase',
              operator: 'gte',
              value: 500.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          question_tags: ['feature', 'improvement', 'attribution']
        }
      }
    ];

    const triggerResults = await supabase
      .from('dynamic_triggers')
      .insert(triggerData)
      .select();

    if (triggerResults.error) throw triggerResults.error;
    testTriggers = triggerResults.data;

    // Create customer history that will trigger multiple scenarios
    const customerHistoryData = [
      // High-value customer with mixed history
      {
        customer_phone: '+46701234567',
        business_context_id: testBusinessId,
        last_contact_date: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(), // 70 days ago
        contact_count: 8,
        last_successful_contact: true,
        total_lifetime_spend: 15000.00
      },
      // Medium customer with recent activity
      {
        customer_phone: '+46701234568',
        business_context_id: testBusinessId,
        last_contact_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
        contact_count: 3,
        last_successful_contact: true,
        total_lifetime_spend: 2500.00
      },
      // New high-value customer
      {
        customer_phone: '+46701234569',
        business_context_id: testBusinessId,
        last_contact_date: null,
        contact_count: 0,
        last_successful_contact: null,
        total_lifetime_spend: 0.00
      }
    ];

    await supabase
      .from('customer_contact_history')
      .insert(customerHistoryData);

    // Create purchase history for complex scenarios
    const purchaseHistoryData = [
      // Customer 1: High quarterly spend
      {
        customer_phone: '+46701234567',
        business_context_id: testBusinessId,
        purchase_amount: 4000.00,
        purchase_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'SEK'
      },
      {
        customer_phone: '+46701234567',
        business_context_id: testBusinessId,
        purchase_amount: 3500.00,
        purchase_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'SEK'
      },
      {
        customer_phone: '+46701234567',
        business_context_id: testBusinessId,
        purchase_amount: 2800.00,
        purchase_date: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'SEK'
      },
      // Customer 2: Medium spender
      {
        customer_phone: '+46701234568',
        business_context_id: testBusinessId,
        purchase_amount: 1200.00,
        purchase_date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'SEK'
      },
      {
        customer_phone: '+46701234568',
        business_context_id: testBusinessId,
        purchase_amount: 800.00,
        purchase_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'SEK'
      }
    ];

    await supabase
      .from('customer_purchase_history')
      .insert(purchaseHistoryData);
  });

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('trigger_activation_logs')
      .delete()
      .in('trigger_id', testTriggers.map(t => t.id));

    await supabase
      .from('customer_purchase_history')
      .delete()
      .eq('business_context_id', testBusinessId);

    await supabase
      .from('customer_contact_history')
      .delete()
      .eq('business_context_id', testBusinessId);

    if (testQuestions.length > 0) {
      await supabase
        .from('questions')
        .delete()
        .in('id', testQuestions.map(q => q.id));
    }

    if (testTriggers.length > 0) {
      await supabase
        .from('dynamic_triggers')
        .delete()
        .in('id', testTriggers.map(t => t.id));
    }

    if (testBusinessId) {
      await supabase
        .from('business_contexts')
        .delete()
        .eq('id', testBusinessId);
    }
  });

  describe('Multi-Trigger Activation Scenarios', () => {
    it('should activate multiple triggers for high-value, long-time customer', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567', // High-value customer, 70 days since contact
            purchase_amount: 2500.00, // Triggers purchase-based triggers
            purchase_category: 'electronics',
            currency: 'SEK',
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const evaluation = response.body.data;
      expect(evaluation.matching_triggers.length).toBeGreaterThanOrEqual(3);
      
      // Should include high-priority triggers
      const triggerNames = evaluation.matching_triggers.map((t: any) => t.trigger_name);
      expect(triggerNames).toContain('High-Value Purchase VIP');
      expect(triggerNames).toContain('Long-Time Customer Check-in');
      expect(triggerNames).toContain('Premium Tier Benefits');
      
      // Verify triggers are sorted by priority
      const priorities = evaluation.matching_triggers.map((t: any) => t.priority_weight);
      expect(priorities).toEqual([...priorities].sort((a, b) => b - a)); // Descending order
    });

    it('should handle new high-value customer scenario', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569', // New customer
            purchase_amount: 3000.00, // High-value first purchase
            purchase_category: 'appliances',
            currency: 'SEK',
            purchase_timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should prioritize new customer onboarding
      const highValueTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'High-Value Purchase VIP'
      );
      expect(highValueTrigger).toBeDefined();
      expect(highValueTrigger.customer_context.is_new_customer).toBe(true);
      
      // Should have appropriate question selection for new customers
      expect(evaluation.question_strategy).toContain('new_customer_focus');
    });

    it('should handle medium-value regular customer', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234568', // Medium customer, 20 days since contact
            purchase_amount: 750.00, // Medium purchase
            purchase_category: 'accessories',
            currency: 'SEK',
            purchase_timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should activate appropriate triggers
      const triggerNames = evaluation.matching_triggers.map((t: any) => t.trigger_name);
      expect(triggerNames).toContain('Special Campaign');
      expect(triggerNames).toContain('Regular Engagement');
      
      // Should not activate high-tier triggers
      expect(triggerNames).not.toContain('Premium Tier Benefits');
      expect(triggerNames).not.toContain('High-Value Purchase VIP');
    });
  });

  describe('Priority Hierarchy Resolution', () => {
    it('should resolve conflicts using priority weights', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2200.00, // Activates multiple triggers
            purchase_category: 'electronics',
            currency: 'SEK',
            max_call_duration_seconds: 90 // Limited time
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should prioritize highest-weight triggers first
      expect(evaluation.priority_resolution).toBeDefined();
      expect(evaluation.priority_resolution.method).toBe('weighted_priority');
      
      const topTrigger = evaluation.matching_triggers[0];
      expect(topTrigger.priority_weight).toBe(10); // High-Value Purchase VIP
      
      // Questions should be selected based on top-priority trigger tags
      const selectedQuestions = evaluation.selected_questions;
      const questionTags = selectedQuestions.flatMap((q: any) => q.trigger_tags);
      expect(questionTags).toContain('satisfaction');
      expect(questionTags).toContain('loyalty');
    });

    it('should handle equal priority weights with tie-breaking', async () => {
      // Update two triggers to have same priority
      const trigger1 = testTriggers.find(t => t.trigger_name === 'Long-Time Customer Check-in');
      const trigger2 = testTriggers.find(t => t.trigger_name === 'Premium Tier Benefits');
      
      await supabase
        .from('dynamic_triggers')
        .update({ priority_weight: 8 })
        .in('id', [trigger1.id, trigger2.id]);

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 1500.00,
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      expect(evaluation.priority_resolution.tie_breaking_method).toBeDefined();
      expect(['recency', 'customer_value', 'trigger_type']).toContain(
        evaluation.priority_resolution.tie_breaking_method
      );
    });

    it('should apply cascading priority logic', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2500.00,
            currency: 'SEK',
            enable_cascading_priorities: true
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should show priority cascade
      expect(evaluation.priority_cascade).toBeDefined();
      expect(evaluation.priority_cascade.primary_trigger).toBeDefined();
      expect(evaluation.priority_cascade.secondary_triggers).toBeDefined();
      
      // Questions should reflect cascading priorities
      const primaryQuestions = evaluation.selected_questions.filter(
        (q: any) => q.priority_tier === 'primary'
      );
      const secondaryQuestions = evaluation.selected_questions.filter(
        (q: any) => q.priority_tier === 'secondary'
      );
      
      expect(primaryQuestions.length).toBeGreaterThan(0);
      expect(secondaryQuestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Question Selection Optimization', () => {
    it('should optimize question selection across multiple triggers', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2000.00,
            currency: 'SEK',
            max_call_duration_seconds: 120
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      expect(evaluation.question_optimization).toBeDefined();
      expect(evaluation.question_optimization.method).toBe('multi_trigger_weighted');
      
      // Should avoid duplicate question types
      const questionTypes = evaluation.selected_questions.map((q: any) => q.question_type);
      const uniqueTypes = new Set(questionTypes);
      expect(questionTypes.length).toBe(uniqueTypes.size); // No duplicates
      
      // Should prioritize questions that serve multiple triggers
      const multiTriggerQuestions = evaluation.selected_questions.filter(
        (q: any) => q.serving_trigger_count > 1
      );
      expect(multiTriggerQuestions.length).toBeGreaterThan(0);
    });

    it('should balance question priorities and trigger weights', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 1800.00,
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Calculate combined scores
      evaluation.selected_questions.forEach((question: any) => {
        expect(question.combined_priority_score).toBeDefined();
        expect(question.trigger_weight_contribution).toBeDefined();
        expect(question.base_priority_contribution).toBeDefined();
      });
      
      // Questions should be sorted by combined score
      const scores = evaluation.selected_questions.map((q: any) => q.combined_priority_score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });

    it('should handle tag-based question filtering', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2500.00,
            currency: 'SEK',
            question_tag_preferences: ['satisfaction', 'service']
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should prefer questions with matching tags
      const selectedTags = evaluation.selected_questions.flatMap((q: any) => q.trigger_tags);
      expect(selectedTags).toContain('satisfaction');
      expect(selectedTags).toContain('service');
      
      // Should minimize questions with non-matching tags
      const unmatchedTagQuestions = evaluation.selected_questions.filter(
        (q: any) => !q.trigger_tags.some((tag: string) => 
          ['satisfaction', 'service'].includes(tag)
        )
      );
      expect(unmatchedTagQuestions.length).toBeLessThan(evaluation.selected_questions.length / 2);
    });
  });

  describe('Trigger Interaction Patterns', () => {
    it('should handle complementary trigger interactions', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2200.00,
            currency: 'SEK',
            enable_trigger_synergy: true
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      expect(evaluation.trigger_interactions).toBeDefined();
      expect(evaluation.trigger_interactions.synergy_effects).toBeDefined();
      
      // Should identify complementary triggers
      const synergyGroups = evaluation.trigger_interactions.synergy_effects;
      expect(Array.isArray(synergyGroups)).toBe(true);
      
      if (synergyGroups.length > 0) {
        const firstGroup = synergyGroups[0];
        expect(firstGroup.triggers.length).toBeGreaterThan(1);
        expect(firstGroup.synergy_score).toBeGreaterThan(0);
      }
    });

    it('should handle competing trigger conflicts', async () => {
      // Create competing triggers with conflicting goals
      const competingTriggerResult = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: testBusinessId,
          trigger_name: 'Quick Survey Only',
          trigger_type: 'purchase_based',
          priority_weight: 9,
          is_active: true,
          config: {
            purchase_amount_threshold: 1000.00,
            max_questions: 2, // Conflicts with comprehensive surveys
            question_tags: ['satisfaction'],
            survey_type: 'quick'
          }
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2200.00,
            currency: 'SEK',
            enable_conflict_resolution: true
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      expect(evaluation.trigger_conflicts).toBeDefined();
      expect(evaluation.conflict_resolution).toBeDefined();
      expect(evaluation.conflict_resolution.strategy).toBeDefined();
      
      // Should resolve conflicts appropriately
      expect(['priority_override', 'hybrid_approach', 'customer_preference']).toContain(
        evaluation.conflict_resolution.strategy
      );

      // Clean up
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', competingTriggerResult.data.id);
    });

    it('should support trigger composition strategies', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2100.00,
            currency: 'SEK',
            composition_strategy: 'balanced_coverage'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      expect(evaluation.composition_strategy).toBe('balanced_coverage');
      expect(evaluation.coverage_analysis).toBeDefined();
      
      // Should provide balanced coverage across trigger types
      const triggerTypes = evaluation.matching_triggers.map((t: any) => t.trigger_type);
      const uniqueTypes = new Set(triggerTypes);
      expect(uniqueTypes.size).toBeGreaterThan(1); // Multiple trigger types
      
      // Should balance question categories
      const questionCategories = evaluation.selected_questions.map((q: any) => q.question_type);
      const categoryDistribution = {};
      questionCategories.forEach((cat: string) => {
        categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
      });
      
      // No single category should dominate (unless justified)
      const maxCategoryCount = Math.max(...Object.values(categoryDistribution));
      const totalQuestions = questionCategories.length;
      expect(maxCategoryCount / totalQuestions).toBeLessThan(0.8); // No more than 80% of one type
    });
  });

  describe('Performance Under Complex Load', () => {
    it('should complete complex evaluation within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2500.00,
            currency: 'SEK',
            enable_all_optimizations: true
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should handle multiple concurrent complex evaluations', async () => {
      const requests = Array.from({ length: 5 }, (_, index) =>
        request(app)
          .post('/api/questions/triggers/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: testBusinessId,
            customer_context: {
              phone: `+4670123456${index}`,
              purchase_amount: 2000 + index * 100,
              currency: 'SEK',
              enable_all_optimizations: true
            }
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
      
      // Should complete within reasonable time even with concurrency
      expect(endTime - startTime).toBeLessThan(1500);
    });

    it('should provide performance metrics for complex evaluations', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2400.00,
            currency: 'SEK',
            include_performance_metrics: true
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      expect(evaluation.performance_metrics).toBeDefined();
      expect(evaluation.performance_metrics.trigger_evaluation_time_ms).toBeDefined();
      expect(evaluation.performance_metrics.question_optimization_time_ms).toBeDefined();
      expect(evaluation.performance_metrics.total_evaluation_time_ms).toBeDefined();
      expect(evaluation.performance_metrics.triggers_processed).toBe(evaluation.matching_triggers.length);
      expect(evaluation.performance_metrics.questions_considered).toBe(testQuestions.length);
    });
  });

  describe('Advanced Scenarios and Edge Cases', () => {
    it('should handle scenario with all triggers disabled', async () => {
      // Temporarily disable all triggers
      await supabase
        .from('dynamic_triggers')
        .update({ is_active: false })
        .eq('business_context_id', testBusinessId);

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2500.00,
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      expect(evaluation.matching_triggers).toEqual([]);
      expect(evaluation.fallback_strategy).toBeDefined();
      expect(evaluation.selected_questions.length).toBeGreaterThan(0); // Should fallback to default questions

      // Re-enable triggers
      await supabase
        .from('dynamic_triggers')
        .update({ is_active: true })
        .eq('business_context_id', testBusinessId);
    });

    it('should handle circular trigger dependencies', async () => {
      // Create triggers that could potentially create circular references
      const circularTriggerResult = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: testBusinessId,
          trigger_name: 'Circular Reference Test',
          trigger_type: 'purchase_based',
          priority_weight: 5,
          is_active: true,
          config: {
            purchase_amount_threshold: 1000.00,
            depends_on_triggers: ['Special Campaign'], // Creates potential circular dependency
            question_tags: ['feedback']
          }
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 1200.00,
            currency: 'SEK',
            detect_circular_dependencies: true
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      if (evaluation.dependency_warnings) {
        expect(evaluation.dependency_warnings.circular_dependencies).toBeDefined();
      }
      
      // Should still function despite potential circular dependencies
      expect(evaluation.matching_triggers.length).toBeGreaterThan(0);

      // Clean up
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', circularTriggerResult.data.id);
    });

    it('should handle extreme trigger overload scenario', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 25000.00, // Extreme amount to trigger everything
            currency: 'SEK',
            max_call_duration_seconds: 60, // Very short time
            priority_cap_enabled: true
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should handle gracefully despite extreme conditions
      expect(evaluation.matching_triggers.length).toBeGreaterThan(0);
      expect(evaluation.selected_questions.length).toBeGreaterThan(0);
      
      // Should apply priority capping
      expect(evaluation.priority_capping).toBeDefined();
      expect(evaluation.priority_capping.applied).toBe(true);
      
      // Should fit within time constraints
      const totalDuration = evaluation.selected_questions.reduce(
        (sum: number, q: any) => sum + q.estimated_duration_seconds, 0
      );
      expect(totalDuration).toBeLessThanOrEqual(60);
    });
  });

  describe('Consistency and Reliability', () => {
    it('should provide consistent results for identical inputs', async () => {
      const customerContext = {
        phone: '+46701234567',
        purchase_amount: 2200.00,
        currency: 'SEK'
      };

      const response1 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: customerContext
        });

      const response2 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: customerContext
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Results should be identical (assuming no time-sensitive triggers)
      expect(response1.body.data.matching_triggers.length)
        .toBe(response2.body.data.matching_triggers.length);
      
      const triggers1 = response1.body.data.matching_triggers.map((t: any) => t.trigger_name).sort();
      const triggers2 = response2.body.data.matching_triggers.map((t: any) => t.trigger_name).sort();
      expect(triggers1).toEqual(triggers2);
    });

    it('should maintain state consistency during complex operations', async () => {
      // Simulate complex state changes
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2300.00,
            currency: 'SEK',
            simulate_state_changes: true
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Verify state consistency
      expect(evaluation.state_consistency_check).toBeDefined();
      expect(evaluation.state_consistency_check.passed).toBe(true);
      
      // Check for any state warnings
      if (evaluation.state_consistency_check.warnings) {
        expect(evaluation.state_consistency_check.warnings.length).toBe(0);
      }
    });
  });
});