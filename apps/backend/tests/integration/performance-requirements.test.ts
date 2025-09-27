/**
 * Integration Tests - Real-Time Processing Performance (<500ms)
 * Tests the complete workflow performance requirements
 * 
 * This test suite validates that the advanced question logic system can:
 * - Process complex trigger evaluations within 500ms
 * - Handle high concurrent load without degradation
 * - Maintain performance under various data scenarios
 * - Scale efficiently with increased complexity
 * - Provide consistent response times across all features
 */

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Integration: Real-Time Processing Performance', () => {
  let testBusinessId: string;
  let testTriggers: any[] = [];
  let testQuestions: any[] = [];
  let testHarmonizers: any[] = [];
  let authToken: string;

  beforeAll(async () => {
    // Create comprehensive test environment with realistic complexity
    const businessResult = await supabase
      .from('business_contexts')
      .insert({
        business_id: 'performance-test-business',
        name: 'Performance Test Business',
        industry: 'retail',
        target_language: 'sv',
        is_active: true
      })
      .select()
      .single();

    if (businessResult.error) throw businessResult.error;
    testBusinessId = businessResult.data.id;

    authToken = 'test-performance-token';

    // Create a large set of questions (realistic production scale)
    const questionData = Array.from({ length: 50 }, (_, index) => ({
      business_context_id: testBusinessId,
      question_text: `Test question ${index + 1}: Performance evaluation question`,
      question_type: `type_${index % 10}`, // 10 different types
      priority_level: (index % 5) + 1, // Priorities 1-5
      estimated_duration_seconds: 20 + (index % 40), // 20-60 seconds
      semantic_tags: [`tag_${index % 8}`, `category_${index % 6}`],
      is_active: true,
      order_index: index + 1
    }));

    const questionsResult = await supabase
      .from('questions')
      .insert(questionData)
      .select();

    if (questionsResult.error) throw questionsResult.error;
    testQuestions = questionsResult.data;

    // Create multiple complex triggers
    const triggerData = [
      // Purchase-based triggers
      ...Array.from({ length: 10 }, (_, index) => ({
        business_context_id: testBusinessId,
        trigger_name: `Purchase Trigger ${index + 1}`,
        trigger_type: 'purchase_based',
        priority_weight: (index % 10) + 1,
        is_active: true,
        config: {
          purchase_amount_threshold: 100.00 + (index * 200),
          product_categories: [`category_${index % 5}`, `subcategory_${index % 8}`],
          time_since_purchase_hours: 24 + (index * 12),
          question_tags: [`tag_${index % 8}`, `priority_${index % 3}`]
        }
      })),
      // Time-based triggers
      ...Array.from({ length: 8 }, (_, index) => ({
        business_context_id: testBusinessId,
        trigger_name: `Time Trigger ${index + 1}`,
        trigger_type: 'time_based',
        priority_weight: (index % 8) + 3,
        is_active: true,
        config: {
          days_since_last_contact: (index + 1) * 7,
          preferred_contact_hours: Array.from({ length: 6 + index }, (_, h) => 9 + h),
          timezone: 'Europe/Stockholm',
          excluded_days_of_week: index % 2 === 0 ? [0, 6] : [],
          question_tags: [`time_${index}`, `engagement_${index % 4}`]
        }
      })),
      // Amount-based triggers
      ...Array.from({ length: 12 }, (_, index) => ({
        business_context_id: testBusinessId,
        trigger_name: `Amount Trigger ${index + 1}`,
        trigger_type: 'amount_based',
        priority_weight: (index % 12) + 2,
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: index % 3 === 0 ? 'single_purchase' : index % 3 === 1 ? 'cumulative_monthly' : 'lifetime_value',
              operator: 'gte',
              value: 500.00 + (index * 300),
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          time_period_days: index % 3 === 1 ? 30 : null,
          question_tags: [`amount_${index}`, `tier_${index % 4}`]
        }
      }))
    ];

    const triggerResults = await supabase
      .from('dynamic_triggers')
      .insert(triggerData)
      .select();

    if (triggerResults.error) throw triggerResults.error;
    testTriggers = triggerResults.data;

    // Create question combination rules
    const combinationRulesData = Array.from({ length: 5 }, (_, index) => ({
      business_context_id: testBusinessId,
      rule_name: `Combination Rule ${index + 1}`,
      max_call_duration_seconds: 60 + (index * 30),
      priority_threshold_critical: 5,
      priority_threshold_high: 4,
      priority_threshold_medium: 3,
      priority_threshold_low: 2,
      is_active: true
    }));

    await supabase
      .from('question_combination_rules')
      .insert(combinationRulesData);

    // Create frequency harmonizers for realistic conflict scenarios
    const harmonizerData = Array.from({ length: 15 }, (_, index) => {
      const primaryQuestion = testQuestions[index * 2];
      const secondaryQuestion = testQuestions[index * 2 + 1];
      
      return {
        business_context_id: testBusinessId,
        rule_name: `Harmonizer ${index + 1}`,
        question_pair_hash: `${primaryQuestion.id}:${secondaryQuestion.id}`,
        primary_question_id: primaryQuestion.id,
        secondary_question_id: secondaryQuestion.id,
        conflict_detection_method: 'semantic_similarity',
        resolution_strategy: ['combine', 'priority', 'alternate', 'custom'][index % 4],
        min_time_between_hours: 24 + (index * 12),
        priority_boost_factor: 1.0 + (index * 0.1),
        is_active: true,
        metadata: {
          similarity_score: 0.7 + (index * 0.02),
          performance_optimized: true
        }
      };
    });

    const harmonizerResults = await supabase
      .from('frequency_harmonizers')
      .insert(harmonizerData)
      .select();

    if (harmonizerResults.error) throw harmonizerResults.error;
    testHarmonizers = harmonizerResults.data;

    // Create realistic customer data for performance testing
    const customerHistoryData = Array.from({ length: 100 }, (_, index) => ({
      customer_phone: `+4670123${String(index).padStart(4, '0')}`,
      business_context_id: testBusinessId,
      last_contact_date: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString(),
      contact_count: index % 20,
      last_successful_contact: index % 3 !== 0,
      total_lifetime_spend: (index + 1) * 234.56
    }));

    await supabase
      .from('customer_contact_history')
      .insert(customerHistoryData);

    // Create purchase history for complex amount calculations
    const purchaseHistoryData = Array.from({ length: 500 }, (_, index) => {
      const customerIndex = index % 100;
      return {
        customer_phone: `+4670123${String(customerIndex).padStart(4, '0')}`,
        business_context_id: testBusinessId,
        purchase_amount: 50 + (index * 12.34),
        purchase_date: new Date(Date.now() - (index * 2 * 60 * 60 * 1000)).toISOString(),
        currency: 'SEK'
      };
    });

    await supabase
      .from('customer_purchase_history')
      .insert(purchaseHistoryData);

    // Create question interaction history
    const interactionHistoryData = Array.from({ length: 1000 }, (_, index) => {
      const customerIndex = index % 100;
      const questionIndex = index % testQuestions.length;
      
      return {
        customer_phone: `+4670123${String(customerIndex).padStart(4, '0')}`,
        business_context_id: testBusinessId,
        question_id: testQuestions[questionIndex].id,
        asked_at: new Date(Date.now() - (index * 60 * 60 * 1000)).toISOString(),
        response_received: index % 4 !== 0,
        response_quality: ['low', 'medium', 'high'][index % 3]
      };
    });

    await supabase
      .from('customer_question_history')
      .insert(interactionHistoryData);
  }, 30000); // Increased timeout for data setup

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('customer_question_history')
      .delete()
      .eq('business_context_id', testBusinessId);

    await supabase
      .from('customer_purchase_history')
      .delete()
      .eq('business_context_id', testBusinessId);

    await supabase
      .from('customer_contact_history')
      .delete()
      .eq('business_context_id', testBusinessId);

    if (testHarmonizers.length > 0) {
      await supabase
        .from('frequency_harmonizers')
        .delete()
        .in('id', testHarmonizers.map(h => h.id));
    }

    await supabase
      .from('question_combination_rules')
      .delete()
      .eq('business_context_id', testBusinessId);

    if (testTriggers.length > 0) {
      await supabase
        .from('dynamic_triggers')
        .delete()
        .in('id', testTriggers.map(t => t.id));
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
  }, 30000);

  describe('Single Request Performance', () => {
    it('should complete simple trigger evaluation under 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 500.00,
            currency: 'SEK'
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200); // Simple scenario should be very fast
      expect(response.body.success).toBe(true);
    });

    it('should complete complex trigger evaluation under 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701230050', // Customer with extensive history
            purchase_amount: 2500.00, // High amount triggering multiple conditions
            purchase_category: 'category_1',
            currency: 'SEK',
            enable_all_optimizations: true,
            enable_cascading_priorities: true,
            enable_trigger_synergy: true
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // Core performance requirement
      expect(response.body.success).toBe(true);
      expect(response.body.data.matching_triggers.length).toBeGreaterThan(0);
    });

    it('should complete question combination optimization under 400ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701230075',
            purchase_amount: 1500.00,
            currency: 'SEK'
          },
          max_call_duration_seconds: 120,
          optimization_level: 'comprehensive'
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(400);
      expect(response.body.data.selected_questions.length).toBeGreaterThan(0);
    });

    it('should complete frequency harmonization analysis under 300ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/harmonizers/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701230025', // Customer with question history
          candidate_questions: testQuestions.slice(0, 10).map(q => q.id)
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(300);
    });

    it('should complete full workflow integration under 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/workflow/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701230099',
            purchase_amount: 1800.00,
            purchase_category: 'category_2',
            currency: 'SEK',
            customer_tier: 'premium'
          },
          workflow_options: {
            enable_triggers: true,
            enable_combinations: true,
            enable_harmonization: true,
            enable_fatigue_prevention: true,
            max_call_duration_seconds: 150
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // Full workflow under 500ms
      expect(response.body.success).toBe(true);
      expect(response.body.data.workflow_completed).toBe(true);
    });
  });

  describe('Concurrent Load Performance', () => {
    it('should handle 10 concurrent simple requests under 500ms each', async () => {
      const requests = Array.from({ length: 10 }, (_, index) => {
        const startTime = Date.now();
        
        return request(app)
          .post('/api/questions/triggers/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: testBusinessId,
            customer_context: {
              phone: `+467012300${String(index).padStart(2, '0')}`,
              purchase_amount: 300 + (index * 50),
              currency: 'SEK'
            }
          })
          .then(response => ({
            response,
            duration: Date.now() - startTime,
            index
          }));
      });

      const results = await Promise.all(requests);
      
      results.forEach(result => {
        expect(result.response.status).toBe(200);
        expect(result.duration).toBeLessThan(500);
        expect(result.response.body.success).toBe(true);
      });
    });

    it('should handle 20 concurrent complex requests under 800ms each', async () => {
      const requests = Array.from({ length: 20 }, (_, index) => {
        const startTime = Date.now();
        
        return request(app)
          .post('/api/questions/triggers/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: testBusinessId,
            customer_context: {
              phone: `+467012301${String(index).padStart(2, '0')}`,
              purchase_amount: 1000 + (index * 100),
              purchase_category: `category_${index % 5}`,
              currency: 'SEK',
              enable_all_optimizations: true
            }
          })
          .then(response => ({
            response,
            duration: Date.now() - startTime,
            index
          }));
      });

      const overallStart = Date.now();
      const results = await Promise.all(requests);
      const overallDuration = Date.now() - overallStart;
      
      results.forEach(result => {
        expect(result.response.status).toBe(200);
        expect(result.duration).toBeLessThan(800); // Slightly higher for concurrent complex requests
      });
      
      // Overall concurrent processing should be efficient
      expect(overallDuration).toBeLessThan(2000);
      
      // Calculate performance metrics
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxDuration = Math.max(...results.map(r => r.duration));
      const minDuration = Math.min(...results.map(r => r.duration));
      
      console.log(`Concurrent performance: avg=${avgDuration}ms, max=${maxDuration}ms, min=${minDuration}ms`);
      
      expect(avgDuration).toBeLessThan(600);
      expect(maxDuration - minDuration).toBeLessThan(400); // Reasonable variance
    });

    it('should maintain performance under sustained load', async () => {
      const batchSize = 5;
      const batchCount = 4;
      const results: any[] = [];
      
      for (let batch = 0; batch < batchCount; batch++) {
        const batchStart = Date.now();
        
        const batchRequests = Array.from({ length: batchSize }, (_, index) =>
          request(app)
            .post('/api/questions/combinations/evaluate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              business_context_id: testBusinessId,
              customer_context: {
                phone: `+46701232${String(batch).padStart(2, '0')}${index}`,
                purchase_amount: 800 + (batch * 200) + (index * 50),
                currency: 'SEK'
              }
            })
        );
        
        const batchResults = await Promise.all(batchRequests);
        const batchDuration = Date.now() - batchStart;
        
        results.push({
          batch,
          duration: batchDuration,
          avgPerRequest: batchDuration / batchSize,
          responses: batchResults
        });
        
        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Performance should not degrade significantly across batches
      results.forEach((batch, index) => {
        expect(batch.avgPerRequest).toBeLessThan(500);
        batch.responses.forEach((response: any) => {
          expect(response.status).toBe(200);
        });
      });
      
      // Performance consistency check
      const durations = results.map(r => r.avgPerRequest);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      expect(maxDuration - minDuration).toBeLessThan(200); // Less than 200ms variance
    });
  });

  describe('Scale and Data Volume Performance', () => {
    it('should maintain performance with large question sets', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/harmonizers/resolve-batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_phone: '+46701234567',
          question_set: testQuestions.map(q => q.id), // All 50 questions
          max_questions: 8,
          max_duration_seconds: 200
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(600); // Acceptable for large dataset processing
      expect(response.body.data.resolved_questions.length).toBeLessThanOrEqual(8);
    });

    it('should handle customers with extensive history efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701230050', // Customer with extensive history (50+ interactions)
            purchase_amount: 3000.00,
            currency: 'SEK',
            include_full_history_analysis: true
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // Should handle extensive history efficiently
    });

    it('should optimize database queries for performance', async () => {
      // Test with query performance monitoring
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/workflow/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701230075',
            purchase_amount: 1500.00,
            currency: 'SEK'
          },
          workflow_options: {
            enable_triggers: true,
            enable_combinations: true,
            enable_harmonization: true,
            include_performance_metrics: true
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
      
      const metrics = response.body.data.performance_metrics;
      expect(metrics).toBeDefined();
      expect(metrics.database_query_count).toBeLessThan(20); // Efficient query usage
      expect(metrics.database_query_time_ms).toBeLessThan(200); // Fast query execution
    });

    it('should cache frequently accessed data for performance', async () => {
      const customerPhone = '+46701234500';
      const customerContext = {
        phone: customerPhone,
        purchase_amount: 1200.00,
        currency: 'SEK'
      };

      // First request (cold cache)
      const startTime1 = Date.now();
      const response1 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: customerContext
        });
      const duration1 = Date.now() - startTime1;

      // Second identical request (warm cache)
      const startTime2 = Date.now();
      const response2 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: customerContext
        });
      const duration2 = Date.now() - startTime2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Both should be under 500ms, with second request potentially faster
      expect(duration1).toBeLessThan(500);
      expect(duration2).toBeLessThan(500);
      
      // Second request should show some performance benefit from caching
      if (duration1 > 100) { // Only test cache benefit if first request was non-trivial
        expect(duration2).toBeLessThan(duration1 * 0.8); // At least 20% improvement
      }
    });
  });

  describe('Memory and Resource Efficiency', () => {
    it('should not cause memory leaks during extended operations', async () => {
      // Monitor memory usage during multiple operations
      const initialMemory = process.memoryUsage();
      
      // Perform multiple complex operations
      const operations = Array.from({ length: 20 }, (_, index) =>
        request(app)
          .post('/api/questions/workflow/complete')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: testBusinessId,
            customer_context: {
              phone: `+467012345${String(index).padStart(2, '0')}`,
              purchase_amount: 800 + (index * 100),
              currency: 'SEK'
            },
            workflow_options: {
              enable_triggers: true,
              enable_combinations: true,
              enable_harmonization: true
            }
          })
      );

      const results = await Promise.all(operations);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      // All operations should have succeeded
      results.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Memory usage should not have increased dramatically
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(heapGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
    });

    it('should efficiently handle cleanup after processing', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/workflow/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 2000.00,
            currency: 'SEK'
          },
          workflow_options: {
            enable_triggers: true,
            enable_combinations: true,
            enable_harmonization: true,
            enable_cleanup_verification: true
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
      
      if (response.body.data.cleanup_metrics) {
        expect(response.body.data.cleanup_metrics.temporary_data_cleared).toBe(true);
        expect(response.body.data.cleanup_metrics.cache_entries_managed).toBe(true);
      }
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle validation errors quickly', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: 'invalid-phone', // Invalid data
            purchase_amount: 'invalid-amount',
            currency: 'INVALID'
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(400);
      expect(duration).toBeLessThan(100); // Error handling should be very fast
    });

    it('should handle database connection issues gracefully', async () => {
      const startTime = Date.now();
      
      // Test with non-existent business ID (simulates database issues)
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: '00000000-0000-0000-0000-000000000000',
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 500.00,
            currency: 'SEK'
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(404);
      expect(duration).toBeLessThan(200); // Should fail fast
    });

    it('should timeout gracefully for extremely complex scenarios', async () => {
      // This test verifies the system has proper timeout handling
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 5000.00,
            currency: 'SEK',
            force_timeout_test: true, // Trigger timeout scenario if implemented
            processing_timeout_ms: 1000 // Set explicit timeout
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should either complete quickly or timeout gracefully
      if (response.status === 200) {
        expect(duration).toBeLessThan(500);
      } else if (response.status === 408) {
        expect(duration).toBeLessThan(1100); // Slightly over timeout threshold
        expect(response.body.error).toContain('timeout');
      }
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    it('should provide detailed performance metrics', async () => {
      const response = await request(app)
        .post('/api/questions/workflow/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 1500.00,
            currency: 'SEK'
          },
          workflow_options: {
            enable_triggers: true,
            enable_combinations: true,
            enable_harmonization: true,
            include_detailed_metrics: true
          }
        });
      
      expect(response.status).toBe(200);
      
      const metrics = response.body.data.performance_metrics;
      expect(metrics).toBeDefined();
      expect(metrics.total_processing_time_ms).toBeLessThan(500);
      expect(metrics.trigger_evaluation_time_ms).toBeDefined();
      expect(metrics.question_optimization_time_ms).toBeDefined();
      expect(metrics.harmonization_time_ms).toBeDefined();
      expect(metrics.database_operations_time_ms).toBeDefined();
      expect(metrics.cache_hit_rate).toBeDefined();
      
      // Performance breakdown should add up approximately
      const breakdown = 
        metrics.trigger_evaluation_time_ms + 
        metrics.question_optimization_time_ms + 
        metrics.harmonization_time_ms;
      
      expect(Math.abs(breakdown - metrics.total_processing_time_ms)).toBeLessThan(50); // Within 50ms
    });

    it('should track performance trends over multiple requests', async () => {
      const requests = Array.from({ length: 10 }, (_, index) =>
        request(app)
          .post('/api/questions/triggers/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: testBusinessId,
            customer_context: {
              phone: `+467012346${String(index).padStart(2, '0')}`,
              purchase_amount: 600 + (index * 100),
              currency: 'SEK'
            },
            include_performance_metrics: true
          })
      );

      const results = await Promise.all(requests);
      
      const durations = results.map((r, index) => ({
        index,
        duration: r.body.data?.performance_metrics?.total_processing_time_ms || 0,
        status: r.status
      }));
      
      // All requests should succeed
      durations.forEach(d => {
        expect(d.status).toBe(200);
        expect(d.duration).toBeLessThan(500);
      });
      
      // Performance should be consistent
      const avgDuration = durations.reduce((sum, d) => sum + d.duration, 0) / durations.length;
      const maxDuration = Math.max(...durations.map(d => d.duration));
      const minDuration = Math.min(...durations.map(d => d.duration));
      
      expect(maxDuration - minDuration).toBeLessThan(200); // Consistent performance
      console.log(`Performance trend: avg=${avgDuration}ms, range=${minDuration}ms-${maxDuration}ms`);
    });
  });

  describe('Production Readiness Performance', () => {
    it('should meet production performance SLA under realistic load', async () => {
      // Simulate realistic production scenario
      const customerScenarios = [
        { type: 'new_customer', phone: '+46701234001', amount: 1200 },
        { type: 'returning_customer', phone: '+46701230025', amount: 800 },
        { type: 'vip_customer', phone: '+46701230050', amount: 3000 },
        { type: 'bulk_customer', phone: '+46701230075', amount: 500 }
      ];

      const requests = customerScenarios.map(scenario =>
        request(app)
          .post('/api/questions/workflow/complete')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: testBusinessId,
            customer_context: {
              phone: scenario.phone,
              purchase_amount: scenario.amount,
              currency: 'SEK',
              customer_type: scenario.type
            },
            workflow_options: {
              enable_triggers: true,
              enable_combinations: true,
              enable_harmonization: true,
              production_mode: true
            }
          })
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      results.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        const metrics = response.body.data.performance_metrics;
        if (metrics) {
          expect(metrics.total_processing_time_ms).toBeLessThan(500);
        }
      });

      // Concurrent processing should be efficient
      expect(totalTime).toBeLessThan(1000); // All 4 scenarios in under 1 second
    });

    it('should demonstrate scalability headroom', async () => {
      // Test increasing load to verify scalability
      const loadLevels = [5, 10, 15, 20];
      const results: any[] = [];

      for (const loadLevel of loadLevels) {
        const requests = Array.from({ length: loadLevel }, (_, index) =>
          request(app)
            .post('/api/questions/triggers/evaluate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              business_context_id: testBusinessId,
              customer_context: {
                phone: `+4670123${String(loadLevel).padStart(2, '0')}${String(index).padStart(2, '0')}`,
                purchase_amount: 700 + (index * 50),
                currency: 'SEK'
              }
            })
        );

        const startTime = Date.now();
        const responses = await Promise.all(requests);
        const duration = Date.now() - startTime;

        results.push({
          loadLevel,
          duration,
          avgPerRequest: duration / loadLevel,
          allSucceeded: responses.every(r => r.status === 200)
        });

        // Brief pause between load levels
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // System should handle increasing load gracefully
      results.forEach(result => {
        expect(result.allSucceeded).toBe(true);
        expect(result.avgPerRequest).toBeLessThan(600); // Performance degrades gracefully
      });

      // Performance degradation should be sub-linear
      const performanceRatio = results[3].avgPerRequest / results[0].avgPerRequest;
      expect(performanceRatio).toBeLessThan(2.0); // Less than 2x degradation for 4x load
    });
  });
});