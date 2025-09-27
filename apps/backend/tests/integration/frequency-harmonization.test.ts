/**
 * Integration Tests - Frequency Harmonization Conflict Resolution
 * Tests the complete workflow of question frequency conflict resolution
 * 
 * This test suite validates that the system can:
 * - Detect conflicts between overlapping questions
 * - Apply harmonization strategies (combine, priority, alternate, custom)
 * - Maintain optimal customer experience across multiple touchpoints
 * - Balance business needs with customer fatigue prevention
 * - Handle complex multi-business and multi-channel scenarios
 */

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Integration: Frequency Harmonization', () => {
  let testBusinessId: string;
  let testQuestions: any[] = [];
  let testHarmonizers: any[] = [];
  let authToken: string;

  beforeAll(async () => {
    // Create test business context
    const businessResult = await supabase
      .from('business_contexts')
      .insert({
        business_id: 'harmonization-business',
        name: 'Frequency Harmonization Test Business',
        industry: 'retail',
        target_language: 'sv',
        is_active: true
      })
      .select()
      .single();

    if (businessResult.error) throw businessResult.error;
    testBusinessId = businessResult.data.id;

    authToken = 'test-integration-token';

    // Create overlapping questions that will create conflicts
    const questionData = [
      // Satisfaction questions (overlapping content)
      {
        business_context_id: testBusinessId,
        question_text: 'How satisfied are you with your recent purchase?',
        question_type: 'satisfaction_rating',
        priority_level: 5,
        estimated_duration_seconds: 30,
        content_hash: 'satisfaction_general',
        semantic_tags: ['satisfaction', 'purchase', 'experience'],
        is_active: true
      },
      {
        business_context_id: testBusinessId,
        question_text: 'Please rate your overall satisfaction with our service',
        question_type: 'satisfaction_rating',
        priority_level: 4,
        estimated_duration_seconds: 25,
        content_hash: 'satisfaction_service',
        semantic_tags: ['satisfaction', 'service', 'rating'],
        is_active: true
      },
      {
        business_context_id: testBusinessId,
        question_text: 'On a scale of 1-10, how satisfied were you?',
        question_type: 'satisfaction_rating',
        priority_level: 4,
        estimated_duration_seconds: 20,
        content_hash: 'satisfaction_scale',
        semantic_tags: ['satisfaction', 'scale', 'rating'],
        is_active: true
      },
      // Feedback questions (potential overlap)
      {
        business_context_id: testBusinessId,
        question_text: 'What did you like most about your experience?',
        question_type: 'open_feedback',
        priority_level: 3,
        estimated_duration_seconds: 45,
        content_hash: 'feedback_positive',
        semantic_tags: ['feedback', 'positive', 'experience'],
        is_active: true
      },
      {
        business_context_id: testBusinessId,
        question_text: 'Any suggestions for improvement?',
        question_type: 'improvement_feedback',
        priority_level: 3,
        estimated_duration_seconds: 40,
        content_hash: 'feedback_improvement',
        semantic_tags: ['feedback', 'improvement', 'suggestions'],
        is_active: true
      },
      // Recommendation questions (overlapping)
      {
        business_context_id: testBusinessId,
        question_text: 'Would you recommend us to others?',
        question_type: 'nps_score',
        priority_level: 4,
        estimated_duration_seconds: 25,
        content_hash: 'recommend_others',
        semantic_tags: ['recommendation', 'nps', 'loyalty'],
        is_active: true
      },
      {
        business_context_id: testBusinessId,
        question_text: 'How likely are you to recommend our store?',
        question_type: 'nps_score',
        priority_level: 4,
        estimated_duration_seconds: 30,
        content_hash: 'recommend_likely',
        semantic_tags: ['recommendation', 'likelihood', 'store'],
        is_active: true
      }
    ];

    const questionsResult = await supabase
      .from('questions')
      .insert(questionData)
      .select();

    if (questionsResult.error) throw questionsResult.error;
    testQuestions = questionsResult.data;

    // Create frequency harmonizer rules
    const harmonizerData = [
      {
        business_context_id: testBusinessId,
        rule_name: 'Satisfaction Question Harmonizer',
        question_pair_hash: 'satisfaction_general:satisfaction_service',
        primary_question_id: testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
        secondary_question_id: testQuestions.find(q => q.content_hash === 'satisfaction_service').id,
        conflict_detection_method: 'semantic_similarity',
        resolution_strategy: 'combine',
        min_time_between_hours: 168, // 1 week
        priority_boost_factor: 1.2,
        is_active: true,
        metadata: {
          similarity_score: 0.85,
          combine_template: 'How satisfied are you with your recent purchase and our service overall?',
          estimated_combined_duration: 35
        }
      },
      {
        business_context_id: testBusinessId,
        rule_name: 'Scale vs General Satisfaction',
        question_pair_hash: 'satisfaction_general:satisfaction_scale',
        primary_question_id: testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
        secondary_question_id: testQuestions.find(q => q.content_hash === 'satisfaction_scale').id,
        conflict_detection_method: 'semantic_similarity',
        resolution_strategy: 'priority',
        min_time_between_hours: 72, // 3 days
        priority_boost_factor: 1.1,
        is_active: true,
        metadata: {
          similarity_score: 0.92,
          priority_reason: 'General satisfaction provides more context than scale-only'
        }
      },
      {
        business_context_id: testBusinessId,
        rule_name: 'NPS Question Alternation',
        question_pair_hash: 'recommend_others:recommend_likely',
        primary_question_id: testQuestions.find(q => q.content_hash === 'recommend_others').id,
        secondary_question_id: testQuestions.find(q => q.content_hash === 'recommend_likely').id,
        conflict_detection_method: 'semantic_similarity',
        resolution_strategy: 'alternate',
        min_time_between_hours: 504, // 3 weeks
        priority_boost_factor: 1.0,
        is_active: true,
        metadata: {
          similarity_score: 0.88,
          alternation_schedule: 'weekly',
          current_primary: 'recommend_others'
        }
      },
      {
        business_context_id: testBusinessId,
        rule_name: 'Feedback Type Harmonizer',
        question_pair_hash: 'feedback_positive:feedback_improvement',
        primary_question_id: testQuestions.find(q => q.content_hash === 'feedback_positive').id,
        secondary_question_id: testQuestions.find(q => q.content_hash === 'feedback_improvement').id,
        conflict_detection_method: 'content_overlap',
        resolution_strategy: 'custom',
        min_time_between_hours: 336, // 2 weeks
        priority_boost_factor: 1.3,
        is_active: true,
        metadata: {
          custom_logic: {
            condition: 'if positive_sentiment > 0.7 then ask_improvement else skip',
            dependency_type: 'conditional',
            success_threshold: 0.8
          }
        }
      },
      {
        business_context_id: testBusinessId,
        rule_name: 'Satisfaction Service Overlap',
        question_pair_hash: 'satisfaction_service:satisfaction_scale',
        primary_question_id: testQuestions.find(q => q.content_hash === 'satisfaction_service').id,
        secondary_question_id: testQuestions.find(q => q.content_hash === 'satisfaction_scale').id,
        conflict_detection_method: 'semantic_similarity',
        resolution_strategy: 'priority',
        min_time_between_hours: 48, // 2 days
        priority_boost_factor: 0.9,
        is_active: true,
        metadata: {
          similarity_score: 0.78,
          priority_reason: 'Service-specific satisfaction preferred over generic scale'
        }
      }
    ];

    const harmonizerResults = await supabase
      .from('frequency_harmonizers')
      .insert(harmonizerData)
      .select();

    if (harmonizerResults.error) throw harmonizerResults.error;
    testHarmonizers = harmonizerResults.data;

    // Create customer interaction history to test frequency conflicts
    const interactionHistoryData = [
      // Customer with recent satisfaction questions
      {
        customer_phone: '+46701234567',
        business_context_id: testBusinessId,
        question_id: testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
        asked_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        response_received: true,
        response_quality: 'high'
      },
      // Customer with recent NPS question
      {
        customer_phone: '+46701234568',
        business_context_id: testBusinessId,
        question_id: testQuestions.find(q => q.content_hash === 'recommend_others').id,
        asked_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        response_received: true,
        response_quality: 'medium'
      },
      // Customer with multiple recent interactions (heavy frequency)
      {
        customer_phone: '+46701234569',
        business_context_id: testBusinessId,
        question_id: testQuestions.find(q => q.content_hash === 'feedback_positive').id,
        asked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        response_received: true,
        response_quality: 'high'
      },
      {
        customer_phone: '+46701234569',
        business_context_id: testBusinessId,
        question_id: testQuestions.find(q => q.content_hash === 'satisfaction_service').id,
        asked_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        response_received: false,
        response_quality: null
      }
    ];

    await supabase
      .from('customer_question_history')
      .insert(interactionHistoryData);
  });

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('customer_question_history')
      .delete()
      .eq('business_context_id', testBusinessId);

    if (testHarmonizers.length > 0) {
      await supabase
        .from('frequency_harmonizers')
        .delete()
        .in('id', testHarmonizers.map(h => h.id));
    }

    if (testQuestions.length > 0) {
      await supabase
        .from('questions')
        .delete()
        .in('id', testQuestions.map(q => q.id));
    }

    if (testBusinessId) {
      await supabase
        .from('business_contexts')
        .delete()
        .eq('id', testBusinessId);
    }
  });

  describe('Conflict Detection', () => {
    it('should detect semantic similarity conflicts', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234570',
          candidate_questions: [
            testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
            testQuestions.find(q => q.content_hash === 'satisfaction_service').id,
            testQuestions.find(q => q.content_hash === 'satisfaction_scale').id
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const analysis = response.body.data;
      expect(analysis.conflicts_detected.length).toBeGreaterThan(0);
      
      // Should detect satisfaction question conflicts
      const satisfactionConflicts = analysis.conflicts_detected.filter(
        (c: any) => c.conflict_type === 'semantic_similarity'
      );
      expect(satisfactionConflicts.length).toBeGreaterThanOrEqual(2);
      
      // Should provide similarity scores
      satisfactionConflicts.forEach((conflict: any) => {
        expect(conflict.similarity_score).toBeDefined();
        expect(conflict.similarity_score).toBeGreaterThan(0.7);
      });
    });

    it('should detect frequency-based conflicts from history', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234567', // Has recent satisfaction question
          candidate_questions: [
            testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
            testQuestions.find(q => q.content_hash === 'satisfaction_scale').id
          ]
        });

      expect(response.status).toBe(200);
      const analysis = response.body.data;
      
      // Should detect frequency conflicts
      const frequencyConflicts = analysis.conflicts_detected.filter(
        (c: any) => c.conflict_type === 'frequency_violation'
      );
      expect(frequencyConflicts.length).toBeGreaterThan(0);
      
      frequencyConflicts.forEach((conflict: any) => {
        expect(conflict.last_asked_hours_ago).toBeLessThan(conflict.min_time_between_hours);
        expect(conflict.harmonizer_rule_id).toBeDefined();
      });
    });

    it('should detect content overlap conflicts', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234571',
          candidate_questions: [
            testQuestions.find(q => q.content_hash === 'feedback_positive').id,
            testQuestions.find(q => q.content_hash === 'feedback_improvement').id
          ]
        });

      expect(response.status).toBe(200);
      const analysis = response.body.data;
      
      const overlapConflicts = analysis.conflicts_detected.filter(
        (c: any) => c.conflict_type === 'content_overlap'
      );
      expect(overlapConflicts.length).toBeGreaterThan(0);
      
      overlapConflicts.forEach((conflict: any) => {
        expect(conflict.overlap_analysis).toBeDefined();
        expect(conflict.resolution_available).toBe(true);
      });
    });
  });

  describe('Resolution Strategy Application', () => {
    it('should apply combine strategy correctly', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234572',
          conflicting_questions: [
            testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
            testQuestions.find(q => q.content_hash === 'satisfaction_service').id
          ],
          preferred_strategy: 'combine'
        });

      expect(response.status).toBe(200);
      const resolution = response.body.data;
      
      expect(resolution.resolution_strategy).toBe('combine');
      expect(resolution.combined_question).toBeDefined();
      expect(resolution.combined_question.question_text).toContain('satisfaction');
      expect(resolution.combined_question.estimated_duration_seconds).toBe(35);
      
      // Should preserve priority and semantic tags
      expect(resolution.combined_question.priority_level).toBe(5); // Highest of the two
      expect(resolution.combined_question.semantic_tags).toContain('satisfaction');
      expect(resolution.combined_question.semantic_tags).toContain('service');
    });

    it('should apply priority strategy correctly', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234573',
          conflicting_questions: [
            testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
            testQuestions.find(q => q.content_hash === 'satisfaction_scale').id
          ],
          preferred_strategy: 'priority'
        });

      expect(response.status).toBe(200);
      const resolution = response.body.data;
      
      expect(resolution.resolution_strategy).toBe('priority');
      expect(resolution.selected_question_id).toBe(
        testQuestions.find(q => q.content_hash === 'satisfaction_general').id
      );
      expect(resolution.suppressed_questions.length).toBe(1);
      expect(resolution.priority_reasoning).toBeDefined();
    });

    it('should apply alternate strategy correctly', async () => {
      // First call - should get primary question
      const response1 = await request(app)
        .post('/api/questions/harmonizers/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234574',
          conflicting_questions: [
            testQuestions.find(q => q.content_hash === 'recommend_others').id,
            testQuestions.find(q => q.content_hash === 'recommend_likely').id
          ],
          preferred_strategy: 'alternate'
        });

      expect(response1.status).toBe(200);
      const resolution1 = response1.body.data;
      
      expect(resolution1.resolution_strategy).toBe('alternate');
      expect(resolution1.selected_question_id).toBe(
        testQuestions.find(q => q.content_hash === 'recommend_others').id
      );
      expect(resolution1.alternation_metadata).toBeDefined();
      expect(resolution1.alternation_metadata.current_cycle).toBeDefined();

      // Simulate time passage and second call - should alternate
      await supabase
        .from('frequency_harmonizers')
        .update({
          metadata: {
            ...testHarmonizers.find(h => h.rule_name === 'NPS Question Alternation').metadata,
            current_primary: 'recommend_likely',
            last_alternation: new Date().toISOString()
          }
        })
        .eq('rule_name', 'NPS Question Alternation');

      const response2 = await request(app)
        .post('/api/questions/harmonizers/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234575',
          conflicting_questions: [
            testQuestions.find(q => q.content_hash === 'recommend_others').id,
            testQuestions.find(q => q.content_hash === 'recommend_likely').id
          ],
          preferred_strategy: 'alternate'
        });

      expect(response2.status).toBe(200);
      const resolution2 = response2.body.data;
      
      expect(resolution2.selected_question_id).toBe(
        testQuestions.find(q => q.content_hash === 'recommend_likely').id
      );
    });

    it('should apply custom strategy with conditional logic', async () => {
      // Set up positive sentiment context
      const response = await request(app)
        .post('/api/questions/harmonizers/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234576',
          conflicting_questions: [
            testQuestions.find(q => q.content_hash === 'feedback_positive').id,
            testQuestions.find(q => q.content_hash === 'feedback_improvement').id
          ],
          preferred_strategy: 'custom',
          context: {
            previous_responses: [
              {
                question_type: 'satisfaction_rating',
                response_value: 4.5,
                sentiment_score: 0.8 // High positive sentiment
              }
            ]
          }
        });

      expect(response.status).toBe(200);
      const resolution = response.body.data;
      
      expect(resolution.resolution_strategy).toBe('custom');
      expect(resolution.custom_logic_applied).toBe(true);
      
      // With high sentiment, should ask improvement question
      expect(resolution.selected_question_id).toBe(
        testQuestions.find(q => q.content_hash === 'feedback_improvement').id
      );
      expect(resolution.custom_reasoning).toContain('positive_sentiment > 0.7');
    });
  });

  describe('Multi-Question Harmonization', () => {
    it('should handle complex multi-question conflicts', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/resolve-batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234577',
          question_set: testQuestions.map(q => q.id),
          max_questions: 3,
          max_duration_seconds: 90
        });

      expect(response.status).toBe(200);
      const resolution = response.body.data;
      
      expect(resolution.resolved_questions.length).toBeLessThanOrEqual(3);
      expect(resolution.total_estimated_duration).toBeLessThanOrEqual(90);
      
      // Should have applied multiple harmonization rules
      expect(resolution.applied_harmonizers.length).toBeGreaterThan(1);
      
      // Should provide conflict resolution summary
      expect(resolution.resolution_summary).toBeDefined();
      expect(resolution.resolution_summary.conflicts_resolved).toBeDefined();
      expect(resolution.resolution_summary.questions_suppressed).toBeDefined();
      expect(resolution.resolution_summary.questions_combined).toBeDefined();
    });

    it('should optimize harmonization for maximum value', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234578',
          candidate_questions: testQuestions.map(q => q.id),
          optimization_goal: 'maximize_value',
          constraints: {
            max_questions: 4,
            max_duration_seconds: 120,
            min_priority_level: 3
          }
        });

      expect(response.status).toBe(200);
      const optimization = response.body.data;
      
      expect(optimization.optimized_set.length).toBeLessThanOrEqual(4);
      expect(optimization.optimization_score).toBeDefined();
      expect(optimization.optimization_score).toBeGreaterThan(0);
      
      // Should prefer high-value questions
      optimization.optimized_set.forEach((question: any) => {
        expect(question.priority_level).toBeGreaterThanOrEqual(3);
      });
      
      // Should show harmonization impact
      expect(optimization.harmonization_impact).toBeDefined();
      expect(optimization.harmonization_impact.conflicts_avoided).toBeDefined();
      expect(optimization.harmonization_impact.redundancy_eliminated).toBeDefined();
    });

    it('should handle cascading harmonization effects', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/resolve-cascading')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234579',
          initial_questions: [
            testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
            testQuestions.find(q => q.content_hash === 'satisfaction_service').id,
            testQuestions.find(q => q.content_hash === 'satisfaction_scale').id
          ]
        });

      expect(response.status).toBe(200);
      const resolution = response.body.data;
      
      expect(resolution.cascading_effects).toBeDefined();
      expect(resolution.resolution_chain.length).toBeGreaterThan(1);
      
      // Should show how first resolution affects subsequent ones
      resolution.resolution_chain.forEach((step: any, index: number) => {
        expect(step.step_number).toBe(index + 1);
        expect(step.questions_before).toBeDefined();
        expect(step.questions_after).toBeDefined();
        expect(step.harmonizer_applied).toBeDefined();
      });
    });
  });

  describe('Customer Fatigue Prevention', () => {
    it('should prevent excessive questioning of same customer', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/fatigue-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234569', // Customer with multiple recent interactions
          proposed_questions: [
            testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
            testQuestions.find(q => q.content_hash === 'feedback_positive').id
          ],
          time_window_days: 7
        });

      expect(response.status).toBe(200);
      const fatigueCheck = response.body.data;
      
      expect(fatigueCheck.fatigue_risk_level).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(fatigueCheck.fatigue_risk_level);
      
      if (fatigueCheck.fatigue_risk_level === 'high' || fatigueCheck.fatigue_risk_level === 'critical') {
        expect(fatigueCheck.recommendations).toBeDefined();
        expect(fatigueCheck.recommendations.action).toBeDefined();
        expect(['reduce_questions', 'delay_contact', 'skip_contact']).toContain(
          fatigueCheck.recommendations.action
        );
      }
    });

    it('should adjust question frequency based on response quality', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/adaptive-frequency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234567', // Customer with high-quality responses
          question_history_days: 30
        });

      expect(response.status).toBe(200);
      const adaptation = response.body.data;
      
      expect(adaptation.customer_engagement_score).toBeDefined();
      expect(adaptation.recommended_frequency_adjustment).toBeDefined();
      
      // High-quality responders should get more frequent opportunities
      if (adaptation.customer_engagement_score > 0.7) {
        expect(adaptation.recommended_frequency_adjustment).toBeGreaterThanOrEqual(1.0);
      } else {
        expect(adaptation.recommended_frequency_adjustment).toBeLessThan(1.0);
      }
      
      expect(adaptation.next_optimal_contact_time).toBeDefined();
      expect(adaptation.reasoning).toBeDefined();
    });

    it('should provide fatigue recovery recommendations', async () => {
      // Simulate high fatigue scenario
      const response = await request(app)
        .post('/api/questions/harmonizers/fatigue-recovery')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234569',
          current_fatigue_level: 'high',
          last_response_quality: 'low'
        });

      expect(response.status).toBe(200);
      const recovery = response.body.data;
      
      expect(recovery.recovery_strategy).toBeDefined();
      expect(recovery.cooldown_period_days).toBeDefined();
      expect(recovery.re_engagement_approach).toBeDefined();
      
      // Should suggest reduced frequency
      expect(recovery.recommended_next_questions).toBeDefined();
      expect(recovery.recommended_next_questions.length).toBeLessThanOrEqual(2);
      
      // Should focus on high-value questions only
      if (recovery.recommended_next_questions.length > 0) {
        recovery.recommended_next_questions.forEach((question: any) => {
          expect(question.priority_level).toBeGreaterThanOrEqual(4);
        });
      }
    });
  });

  describe('Cross-Business Harmonization', () => {
    it('should handle multi-business customer scenarios', async () => {
      // Create second business context
      const business2Result = await supabase
        .from('business_contexts')
        .insert({
          business_id: 'partner-business',
          name: 'Partner Business',
          industry: 'retail',
          target_language: 'sv',
          is_active: true
        })
        .select()
        .single();

      // Create cross-business harmonizer
      const crossHarmonizerResult = await supabase
        .from('frequency_harmonizers')
        .insert({
          business_context_id: testBusinessId,
          rule_name: 'Cross-Business Coordination',
          question_pair_hash: 'cross_business_satisfaction',
          primary_question_id: testQuestions[0].id,
          secondary_question_id: testQuestions[1].id,
          conflict_detection_method: 'cross_business_frequency',
          resolution_strategy: 'coordinate',
          min_time_between_hours: 336, // 2 weeks between businesses
          is_active: true,
          metadata: {
            partner_business_id: business2Result.data.id,
            coordination_type: 'mutual_exclusion',
            priority_business: testBusinessId
          }
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/harmonizers/cross-business-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_phone: '+46701234580',
          requesting_business_id: testBusinessId,
          proposed_questions: [testQuestions[0].id],
          check_partner_businesses: true
        });

      expect(response.status).toBe(200);
      const crossCheck = response.body.data;
      
      expect(crossCheck.cross_business_conflicts).toBeDefined();
      expect(crossCheck.coordination_requirements).toBeDefined();
      
      if (crossCheck.cross_business_conflicts.length > 0) {
        expect(crossCheck.resolution_recommendations).toBeDefined();
        expect(crossCheck.partner_coordination_needed).toBe(true);
      }

      // Clean up
      await supabase
        .from('frequency_harmonizers')
        .delete()
        .eq('id', crossHarmonizerResult.data.id);
        
      await supabase
        .from('business_contexts')
        .delete()
        .eq('id', business2Result.data.id);
    });

    it('should coordinate with partner businesses', async () => {
      // Create partner business scenario
      const partnerBusinessResult = await supabase
        .from('business_contexts')
        .insert({
          business_id: 'coordinated-partner',
          name: 'Coordinated Partner Business',
          industry: 'retail',
          target_language: 'sv',
          is_active: true
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/harmonizers/partner-coordination')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234581',
          partner_businesses: [partnerBusinessResult.data.id],
          coordination_mode: 'respectful_sharing',
          max_combined_monthly_contacts: 4
        });

      expect(response.status).toBe(200);
      const coordination = response.body.data;
      
      expect(coordination.coordination_plan).toBeDefined();
      expect(coordination.contact_allocation).toBeDefined();
      expect(coordination.respect_windows).toBeDefined();
      
      // Should allocate contacts fairly
      const totalAllocated = Object.values(coordination.contact_allocation)
        .reduce((sum: number, count: any) => sum + count, 0);
      expect(totalAllocated).toBeLessThanOrEqual(4);

      // Clean up
      await supabase
        .from('business_contexts')
        .delete()
        .eq('id', partnerBusinessResult.data.id);
    });
  });

  describe('Performance and Analytics', () => {
    it('should complete harmonization analysis within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/harmonizers/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234582',
          candidate_questions: testQuestions.map(q => q.id)
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should provide harmonization effectiveness metrics', async () => {
      const response = await request(app)
        .get(`/api/questions/harmonizers/${testHarmonizers[0].id}/effectiveness`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          time_period_days: 30
        });

      expect(response.status).toBe(200);
      const effectiveness = response.body.data;
      
      expect(effectiveness.conflicts_resolved).toBeDefined();
      expect(effectiveness.customer_fatigue_prevented).toBeDefined();
      expect(effectiveness.question_efficiency_improved).toBeDefined();
      expect(effectiveness.response_quality_impact).toBeDefined();
      
      // Should provide improvement metrics
      expect(effectiveness.metrics.average_response_rate).toBeDefined();
      expect(effectiveness.metrics.customer_satisfaction_change).toBeDefined();
      expect(effectiveness.metrics.question_redundancy_reduction).toBeDefined();
    });

    it('should track harmonization rule usage analytics', async () => {
      const response = await request(app)
        .get('/api/questions/harmonizers/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          business_context_id: testBusinessId,
          time_period_days: 30,
          include_rule_performance: true
        });

      expect(response.status).toBe(200);
      const analytics = response.body.data;
      
      expect(analytics.rule_performance).toBeDefined();
      expect(Array.isArray(analytics.rule_performance)).toBe(true);
      
      analytics.rule_performance.forEach((rule: any) => {
        expect(rule.rule_id).toBeDefined();
        expect(rule.activations).toBeDefined();
        expect(rule.success_rate).toBeDefined();
        expect(rule.customer_response_impact).toBeDefined();
      });
      
      expect(analytics.overall_statistics).toBeDefined();
      expect(analytics.overall_statistics.total_conflicts_detected).toBeDefined();
      expect(analytics.overall_statistics.total_conflicts_resolved).toBeDefined();
      expect(analytics.overall_statistics.customer_fatigue_incidents_prevented).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing harmonizer rules gracefully', async () => {
      const response = await request(app)
        .post('/api/questions/harmonizers/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234583',
          candidate_questions: [
            testQuestions[0].id,
            '00000000-0000-0000-0000-000000000000' // Non-existent question
          ]
        });

      expect(response.status).toBe(200);
      const analysis = response.body.data;
      
      expect(analysis.warnings).toBeDefined();
      expect(analysis.warnings.some((w: any) => w.type === 'missing_question')).toBe(true);
      
      // Should still process valid questions
      expect(analysis.processed_questions.length).toBe(1);
    });

    it('should handle corrupted harmonizer metadata', async () => {
      // Corrupt a harmonizer's metadata
      await supabase
        .from('frequency_harmonizers')
        .update({
          metadata: { corrupted: true, invalid_json: 'not_json' }
        })
        .eq('id', testHarmonizers[0].id);

      const response = await request(app)
        .post('/api/questions/harmonizers/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234584',
          conflicting_questions: [
            testQuestions.find(q => q.content_hash === 'satisfaction_general').id,
            testQuestions.find(q => q.content_hash === 'satisfaction_service').id
          ]
        });

      expect(response.status).toBe(200);
      const resolution = response.body.data;
      
      expect(resolution.warnings).toBeDefined();
      expect(resolution.warnings.some((w: any) => w.type === 'corrupted_metadata')).toBe(true);
      
      // Should fall back to basic resolution strategy
      expect(resolution.fallback_strategy_used).toBe(true);

      // Restore metadata
      await supabase
        .from('frequency_harmonizers')
        .update({
          metadata: testHarmonizers[0].metadata
        })
        .eq('id', testHarmonizers[0].id);
    });

    it('should handle extreme frequency scenarios', async () => {
      // Create customer with excessive interaction history
      const excessiveHistory = Array.from({ length: 20 }, (_, index) => ({
        customer_phone: '+46701234585',
        business_context_id: testBusinessId,
        question_id: testQuestions[index % testQuestions.length].id,
        asked_at: new Date(Date.now() - index * 2 * 60 * 60 * 1000).toISOString(), // Every 2 hours
        response_received: index % 3 === 0, // Low response rate
        response_quality: 'low'
      }));

      await supabase
        .from('customer_question_history')
        .insert(excessiveHistory);

      const response = await request(app)
        .post('/api/questions/harmonizers/fatigue-check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234585',
          proposed_questions: [testQuestions[0].id],
          time_window_days: 7
        });

      expect(response.status).toBe(200);
      const fatigueCheck = response.body.data;
      
      expect(fatigueCheck.fatigue_risk_level).toBe('critical');
      expect(fatigueCheck.recommendations.action).toBe('skip_contact');
      expect(fatigueCheck.recommended_cooldown_days).toBeGreaterThan(7);

      // Clean up
      await supabase
        .from('customer_question_history')
        .delete()
        .eq('customer_phone', '+46701234585');
    });
  });
});