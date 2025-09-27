/**
 * T088: Complete Quickstart Testing Scenarios
 * 
 * Comprehensive integration tests validating all quickstart scenarios
 * from specs/017-step-5-2/quickstart.md
 */

import { describe, beforeAll, afterAll, beforeEach, test, expect } from '@jest/testing-library/jest-dom';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import app from '../../src/app';

// Test environment setup
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'test-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Test data constants
const TEST_BUSINESS_ID = 'test-business-001';
const TEST_QUESTIONS = [
  {
    id: 'q1',
    text: 'How was the checkout experience?',
    frequency: 3,
    category: 'service',
    priority_level: 4,
    estimated_tokens: 25
  },
  {
    id: 'q2', 
    text: 'Rate the freshness of our produce',
    frequency: 5,
    category: 'product',
    priority_level: 3,
    estimated_tokens: 30
  },
  {
    id: 'q3',
    text: 'How clean was the meat section?',
    frequency: 10,
    category: 'meat',
    priority_level: 2,
    estimated_tokens: 35
  }
];

describe('Advanced Question Logic - Quickstart Scenarios', () => {
  let authToken: string;
  let combinationRuleId: string;
  let triggerIds: string[] = [];

  beforeAll(async () => {
    // Setup test authentication
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test-business@vocilia.com',
        password: 'test-password'
      });
    
    authToken = authResponse.body.access_token;

    // Setup test business context and questions
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Reset cache and state between tests
    await request(app)
      .delete('/api/admin/cache/clear')
      .set('Authorization', `Bearer ${authToken}`);
  });

  /**
   * Scenario 1: Question Combination Engine - Time Constraint Optimization
   */
  describe('Scenario 1: Time Constraint Optimization', () => {
    test('should combine questions within 120 second duration constraint', async () => {
      // Create combination rule
      const ruleResponse = await request(app)
        .post('/api/questions/combinations/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          rule_name: 'Standard Combination Rule',
          max_call_duration_seconds: 120,
          priority_threshold_critical: 0,
          priority_threshold_high: 60,
          priority_threshold_medium: 90,
          priority_threshold_low: 120
        });

      expect(ruleResponse.status).toBe(201);
      combinationRuleId = ruleResponse.body.id;

      // Test question combination evaluation
      const evaluationResponse = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'test-verification-001',
            transaction_time: '2025-09-24T12:30:00Z',
            transaction_amount: 750.50,
            purchase_categories: ['meat', 'produce']
          },
          time_constraints: {
            max_call_duration_seconds: 120,
            target_question_count: 5
          }
        });

      expect(evaluationResponse.status).toBe(200);
      expect(evaluationResponse.body.selected_questions.length).toBeGreaterThan(0);
      expect(evaluationResponse.body.total_estimated_duration).toBeLessThanOrEqual(120);
      expect(evaluationResponse.body.selected_questions[0].priority_level).toBeGreaterThanOrEqual(3);
      expect(evaluationResponse.body.optimization_metadata.algorithm_version).toBeDefined();
    });
  });

  /**
   * Scenario 2: Dynamic Trigger System - Purchase-Based Activation
   */
  describe('Scenario 2: Purchase-Based Triggers', () => {
    let meatTriggerId: string;

    beforeAll(async () => {
      // Create purchase-based trigger
      const triggerResponse = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          trigger_name: 'Meat Section Feedback',
          trigger_type: 'purchase_based',
          priority_level: 4,
          sensitivity_threshold: 5,
          trigger_config: {
            categories: ['meat'],
            minimum_items: 1
          }
        });

      expect(triggerResponse.status).toBe(201);
      meatTriggerId = triggerResponse.body.id;
      triggerIds.push(meatTriggerId);
    });

    test('should trigger meat questions when customer purchases meat', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'test-verification-002',
            purchase_categories: ['meat', 'bakery'],
            purchase_items: ['ground_beef', 'croissant']
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.selected_questions.some((q: any) => q.question_id === 'q3')).toBe(true);
      expect(response.body.triggered_rules).toContain(meatTriggerId);
    });

    test('should not trigger meat questions when customer has no meat purchase', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'test-verification-003',
            purchase_categories: ['produce', 'bakery'],
            purchase_items: ['apples', 'bread']
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.selected_questions.some((q: any) => q.question_id === 'q3')).toBe(false);
      expect(response.body.triggered_rules).not.toContain(meatTriggerId);
    });
  });

  /**
   * Scenario 3: Time-Based Question Activation
   */
  describe('Scenario 3: Time-Based Triggers', () => {
    let timeTriggerId: string;

    beforeAll(async () => {
      // Create time-based trigger
      const triggerResponse = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          trigger_name: 'Lunch Hour Queue Check',
          trigger_type: 'time_based',
          priority_level: 3,
          sensitivity_threshold: 3,
          trigger_config: {
            time_windows: [{
              start_time: '11:30',
              end_time: '13:30',
              days_of_week: [1, 2, 3, 4, 5] // Monday to Friday
            }]
          }
        });

      expect(triggerResponse.status).toBe(201);
      timeTriggerId = triggerResponse.body.id;
      triggerIds.push(timeTriggerId);
    });

    test('should activate lunch-hour questions during 11:30-13:30', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'test-verification-004',
            transaction_time: '2025-09-24T12:30:00Z' // Wednesday lunch time
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.triggered_rules).toContain(timeTriggerId);
    });

    test('should not activate lunch-hour questions outside 11:30-13:30', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'test-verification-005',
            transaction_time: '2025-09-24T15:30:00Z' // Afternoon
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.triggered_rules).not.toContain(timeTriggerId);
    });
  });

  /**
   * Scenario 4: Amount-Based Conditional Logic
   */
  describe('Scenario 4: Amount-Based Triggers', () => {
    let amountTriggerId: string;

    beforeAll(async () => {
      // Create amount-based trigger
      const triggerResponse = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          trigger_name: 'High Value Purchase',
          trigger_type: 'amount_based',
          priority_level: 4,
          sensitivity_threshold: 10,
          trigger_config: {
            currency: 'SEK',
            minimum_amount: 500,
            comparison_operator: '>='
          }
        });

      expect(triggerResponse.status).toBe(201);
      amountTriggerId = triggerResponse.body.id;
      triggerIds.push(amountTriggerId);
    });

    test('should trigger value questions for high-value transactions (>500 SEK)', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'test-verification-006',
            transaction_amount: 750.50,
            transaction_currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.triggered_rules).toContain(amountTriggerId);
    });

    test('should not trigger value questions for low-value transactions (<500 SEK)', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'test-verification-007',
            transaction_amount: 250.00,
            transaction_currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.triggered_rules).not.toContain(amountTriggerId);
    });
  });

  /**
   * Scenario 5: Complex Trigger Combinations - Priority Hierarchy
   */
  describe('Scenario 5: Trigger Priority Hierarchy', () => {
    let criticalTriggerId: string;
    let mediumTriggerId: string;

    beforeAll(async () => {
      // Create critical priority trigger
      const criticalResponse = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          trigger_name: 'Meat Quality Critical',
          trigger_type: 'purchase_based',
          priority_level: 5,
          trigger_config: {
            categories: ['meat']
          }
        });

      criticalTriggerId = criticalResponse.body.id;
      triggerIds.push(criticalTriggerId);

      // Create medium priority trigger
      const mediumResponse = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          trigger_name: 'Lunch Hour Service',
          trigger_type: 'time_based',
          priority_level: 3,
          trigger_config: {
            time_windows: [{
              start_time: '11:30',
              end_time: '13:30',
              days_of_week: [1, 2, 3, 4, 5]
            }]
          }
        });

      mediumTriggerId = mediumResponse.body.id;
      triggerIds.push(mediumTriggerId);
    });

    test('should apply priority hierarchy when multiple conditions met', async () => {
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'test-verification-008',
            transaction_time: '2025-09-24T12:30:00Z', // Lunch time
            purchase_categories: ['meat'],
            transaction_amount: 600.00
          }
        });

      expect(response.status).toBe(200);
      
      // Higher priority trigger should be present
      expect(response.body.triggered_rules).toContain(criticalTriggerId);
      
      // Priority hierarchy should be documented
      expect(response.body.optimization_metadata).toBeDefined();
      expect(response.body.optimization_metadata.trigger_priorities).toBeDefined();
    });
  });

  /**
   * Scenario 6: Frequency Harmonization - Conflict Resolution
   */
  describe('Scenario 6: Frequency Harmonization', () => {
    let harmonizerId: string;

    beforeAll(async () => {
      // Configure frequency harmonizer
      const harmonizerResponse = await request(app)
        .post('/api/questions/harmonizers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rule_id: combinationRuleId,
          question_id_1: 'q1',
          question_id_2: 'q2',
          resolution_strategy: 'combine'
        });

      expect(harmonizerResponse.status).toBe(201);
      harmonizerId = harmonizerResponse.body.id;
    });

    test('should resolve frequency conflicts using harmonizer settings', async () => {
      // Test at LCM point (15th customer - LCM of 3 and 5)
      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'customer-015',
            customer_sequence: 15
          }
        });

      expect(response.status).toBe(200);
      
      // Both questions should be included (combine strategy)
      const questionIds = response.body.selected_questions.map((q: any) => q.question_id);
      expect(questionIds).toContain('q1');
      expect(questionIds).toContain('q2');
    });
  });

  /**
   * Scenario 7: Real-Time Processing Performance
   */
  describe('Scenario 7: Performance Testing', () => {
    test('should process evaluations within 500ms performance requirement', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: TEST_BUSINESS_ID,
          customer_data: {
            verification_id: 'performance-test-001',
            purchase_categories: ['meat', 'produce'],
            transaction_amount: 500.00
          }
        });

      const duration = performance.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // <500ms requirement
      expect(response.body.processing_time_ms).toBeDefined();
      expect(response.body.processing_time_ms).toBeLessThan(500);
    });

    test('should maintain performance under concurrent load', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/questions/combinations/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: TEST_BUSINESS_ID,
            customer_data: {
              verification_id: `concurrent-test-${i}`,
              purchase_categories: ['produce']
            }
          });
        
        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.processing_time_ms).toBeLessThan(500);
      });

      // Check cache hit rate
      const performanceResponse = await request(app)
        .get('/api/admin/monitoring/performance?timeframe=5m')
        .set('Authorization', `Bearer ${authToken}`);

      expect(performanceResponse.body.cache_hit_rate).toBeGreaterThan(0.8); // >80%
    });
  });

  /**
   * Scenario 8: Business Configuration UI Integration
   */
  describe('Scenario 8: Business UI Integration', () => {
    test('should access advanced question logic configuration', async () => {
      const response = await request(app)
        .get('/api/business/context/questions/advanced')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.combination_rules).toBeDefined();
      expect(response.body.dynamic_triggers).toBeDefined();
      expect(response.body.frequency_harmonizers).toBeDefined();
    });

    test('should validate configuration through API', async () => {
      const response = await request(app)
        .get(`/api/questions/combinations/rules?business_context_id=${TEST_BUSINESS_ID}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].business_context_id).toBe(TEST_BUSINESS_ID);
    });
  });

  // Helper functions
  async function setupTestData() {
    // Create test business context
    await supabase
      .from('business_contexts')
      .upsert({
        id: TEST_BUSINESS_ID,
        business_name: 'Test Grocery Store',
        is_active: true
      });

    // Create test questions
    for (const question of TEST_QUESTIONS) {
      await supabase
        .from('context_questions')
        .upsert({
          id: question.id,
          business_context_id: TEST_BUSINESS_ID,
          question_text: question.text,
          frequency_every_nth_customer: question.frequency,
          topic_category: question.category,
          default_priority_level: question.priority_level,
          estimated_tokens: question.estimated_tokens
        });
    }
  }

  async function cleanupTestData() {
    // Clean up triggers
    for (const triggerId of triggerIds) {
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', triggerId);
    }

    // Clean up combination rules
    if (combinationRuleId) {
      await supabase
        .from('question_combination_rules')
        .delete()
        .eq('id', combinationRuleId);
    }

    // Clean up test questions
    await supabase
      .from('context_questions')
      .delete()
      .eq('business_context_id', TEST_BUSINESS_ID);

    // Clean up test business context
    await supabase
      .from('business_contexts')
      .delete()
      .eq('id', TEST_BUSINESS_ID);

    // Clean up activation logs
    await supabase
      .from('trigger_activation_logs')
      .delete()
      .like('verification_id', 'test-%');
  }
});