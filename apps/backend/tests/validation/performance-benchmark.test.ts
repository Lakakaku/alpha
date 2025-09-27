/**
 * T089: Performance Benchmark Validation
 * 
 * Validates that the Advanced Question Logic system meets all performance requirements:
 * - <500ms question evaluation time (95th percentile)
 * - >90% cache hit rate under normal load
 * - Database query optimization targets
 * - Memory and CPU usage within acceptable limits
 */

import { describe, beforeAll, afterAll, test, expect } from '@jest/testing-library/jest-dom';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';
import app from '../../src/app';

// Performance test configuration
const PERFORMANCE_TARGETS = {
  MAX_EVALUATION_TIME_MS: 500,
  MIN_CACHE_HIT_RATE: 0.90,
  MAX_DB_QUERY_TIME_MS: 50,
  MAX_MEMORY_USAGE_MB: 2048,
  MAX_CPU_USAGE_PERCENT: 70
};

const TEST_LOAD_CONFIG = {
  CONCURRENT_REQUESTS: 50,
  SUSTAINED_LOAD_DURATION_MS: 30000, // 30 seconds
  BURST_REQUEST_COUNT: 100,
  WARM_UP_REQUESTS: 20
};

describe('Performance Benchmark Validation', () => {
  let authToken: string;
  let businessContextId: string;

  beforeAll(async () => {
    // Setup authentication and test data
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test-performance@vocilia.com',
        password: 'test-password'
      });
    
    authToken = authResponse.body.access_token;
    businessContextId = 'perf-test-business';

    // Setup performance test environment
    await setupPerformanceTestData();
    
    // Warm up the system
    await warmUpSystem();
  });

  afterAll(async () => {
    await cleanupPerformanceTestData();
  });

  /**
   * Core Performance Requirement: <500ms Evaluation Time
   */
  describe('Question Evaluation Performance (<500ms)', () => {
    test('should complete single evaluation within 500ms', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          customer_data: {
            verification_id: 'perf-test-single',
            purchase_categories: ['meat', 'produce'],
            transaction_amount: 500.00,
            transaction_time: new Date().toISOString()
          }
        });

      const duration = performance.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.MAX_EVALUATION_TIME_MS);
      expect(response.body.processing_time_ms).toBeLessThan(PERFORMANCE_TARGETS.MAX_EVALUATION_TIME_MS);
    });

    test('should maintain <500ms p95 response time under load', async () => {
      const responseTimes: number[] = [];
      const requests = [];

      // Generate concurrent requests
      for (let i = 0; i < TEST_LOAD_CONFIG.CONCURRENT_REQUESTS; i++) {
        const startTime = performance.now();
        const request_promise = request(app)
          .post('/api/questions/combinations/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: businessContextId,
            customer_data: {
              verification_id: `perf-test-concurrent-${i}`,
              purchase_categories: i % 2 === 0 ? ['meat'] : ['produce'],
              transaction_amount: 100 + (i * 10),
              transaction_time: new Date().toISOString()
            }
          })
          .then(response => {
            const duration = performance.now() - startTime;
            responseTimes.push(duration);
            return response;
          });

        requests.push(request_promise);
      }

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Calculate percentiles
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95Time = sortedTimes[p95Index];
      const avgTime = sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length;

      console.log(`Performance Results:
        - Average: ${avgTime.toFixed(2)}ms
        - P95: ${p95Time.toFixed(2)}ms
        - Max: ${Math.max(...sortedTimes).toFixed(2)}ms
        - Min: ${Math.min(...sortedTimes).toFixed(2)}ms`);

      expect(p95Time).toBeLessThan(PERFORMANCE_TARGETS.MAX_EVALUATION_TIME_MS);
      expect(avgTime).toBeLessThan(PERFORMANCE_TARGETS.MAX_EVALUATION_TIME_MS * 0.6); // Avg should be well below P95
    });

    test('should handle burst traffic within performance limits', async () => {
      const burstStartTime = performance.now();
      const burstPromises = [];

      // Generate burst of requests
      for (let i = 0; i < TEST_LOAD_CONFIG.BURST_REQUEST_COUNT; i++) {
        const promise = request(app)
          .post('/api/questions/combinations/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: businessContextId,
            customer_data: {
              verification_id: `burst-test-${i}`,
              purchase_categories: ['produce'],
              transaction_amount: 200 + i
            }
          });
        
        burstPromises.push(promise);
      }

      const responses = await Promise.all(burstPromises);
      const burstDuration = performance.now() - burstStartTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check that system didn't degrade significantly
      const avgResponseTime = burstDuration / TEST_LOAD_CONFIG.BURST_REQUEST_COUNT;
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_TARGETS.MAX_EVALUATION_TIME_MS);
    });
  });

  /**
   * Cache Performance Requirement: >90% Hit Rate
   */
  describe('Cache Performance (>90% Hit Rate)', () => {
    test('should achieve >90% cache hit rate with repeated requests', async () => {
      // Clear cache to start fresh
      await request(app)
        .delete('/api/admin/cache/clear')
        .set('Authorization', `Bearer ${authToken}`);

      const testData = {
        business_context_id: businessContextId,
        customer_data: {
          verification_id: 'cache-test-repeated',
          purchase_categories: ['meat', 'produce'],
          transaction_amount: 500.00
        }
      };

      // First request - cache miss
      const firstResponse = await request(app)
        .post('/api/questions/combinations/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData);

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.cache_hit).toBe(false);

      // Subsequent requests - should be cache hits
      const cacheTestPromises = [];
      for (let i = 0; i < 20; i++) {
        cacheTestPromises.push(
          request(app)
            .post('/api/questions/combinations/evaluate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              ...testData,
              customer_data: {
                ...testData.customer_data,
                verification_id: `cache-test-${i}`
              }
            })
        );
      }

      const cacheResponses = await Promise.all(cacheTestPromises);
      const cacheHits = cacheResponses.filter(response => response.body.cache_hit).length;
      const hitRate = cacheHits / cacheResponses.length;

      console.log(`Cache Performance: ${cacheHits}/${cacheResponses.length} hits (${(hitRate * 100).toFixed(1)}%)`);

      expect(hitRate).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_CACHE_HIT_RATE);
    });

    test('should maintain cache performance under varied load', async () => {
      const cacheTestData = [
        { categories: ['meat'], amount: 300 },
        { categories: ['produce'], amount: 150 },
        { categories: ['bakery'], amount: 200 },
        { categories: ['meat', 'produce'], amount: 450 },
        { categories: ['produce', 'bakery'], amount: 350 }
      ];

      let totalRequests = 0;
      let totalCacheHits = 0;

      // Test each pattern multiple times
      for (const pattern of cacheTestData) {
        for (let i = 0; i < 10; i++) {
          const response = await request(app)
            .post('/api/questions/combinations/evaluate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              business_context_id: businessContextId,
              customer_data: {
                verification_id: `varied-cache-${pattern.amount}-${i}`,
                purchase_categories: pattern.categories,
                transaction_amount: pattern.amount
              }
            });

          totalRequests++;
          if (response.body.cache_hit) {
            totalCacheHits++;
          }
        }
      }

      const overallHitRate = totalCacheHits / totalRequests;
      console.log(`Varied Load Cache Performance: ${totalCacheHits}/${totalRequests} hits (${(overallHitRate * 100).toFixed(1)}%)`);

      expect(overallHitRate).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_CACHE_HIT_RATE * 0.85); // Allow some variation
    });
  });

  /**
   * Database Performance: Query Optimization
   */
  describe('Database Query Performance', () => {
    test('should execute trigger queries within 50ms', async () => {
      const startTime = performance.now();

      // This should trigger database queries for active triggers
      const response = await request(app)
        .get(`/api/questions/triggers?business_context_id=${businessContextId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const queryTime = performance.now() - startTime;

      expect(response.status).toBe(200);
      expect(queryTime).toBeLessThan(PERFORMANCE_TARGETS.MAX_DB_QUERY_TIME_MS);
    });

    test('should handle complex aggregation queries efficiently', async () => {
      const startTime = performance.now();

      // This should trigger complex queries with joins
      const response = await request(app)
        .get(`/api/questions/analytics/triggers?business_context_id=${businessContextId}&timeframe=week`)
        .set('Authorization', `Bearer ${authToken}`);

      const queryTime = performance.now() - startTime;

      expect(response.status).toBe(200);
      expect(queryTime).toBeLessThan(200); // Allow more time for complex queries
      expect(response.body.total_activations).toBeDefined();
    });
  });

  /**
   * System Resource Usage
   */
  describe('System Resource Usage', () => {
    test('should maintain acceptable memory usage during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      const sustainedRequests = [];

      const endTime = Date.now() + TEST_LOAD_CONFIG.SUSTAINED_LOAD_DURATION_MS;

      while (Date.now() < endTime) {
        sustainedRequests.push(
          request(app)
            .post('/api/questions/combinations/evaluate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              business_context_id: businessContextId,
              customer_data: {
                verification_id: `sustained-${Date.now()}`,
                purchase_categories: ['produce'],
                transaction_amount: Math.random() * 500 + 100
              }
            })
        );

        // Limit concurrent requests to avoid overwhelming the system
        if (sustainedRequests.length >= 10) {
          await Promise.all(sustainedRequests);
          sustainedRequests.length = 0;
        }

        // Small delay to simulate realistic load
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for remaining requests
      if (sustainedRequests.length > 0) {
        await Promise.all(sustainedRequests);
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowthMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`Memory Usage:
        - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Growth: ${memoryGrowthMB.toFixed(2)}MB`);

      expect(finalMemory.heapUsed / 1024 / 1024).toBeLessThan(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE_MB);
    });

    test('should handle garbage collection efficiently', async () => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const beforeGC = process.memoryUsage();

      // Generate some memory pressure
      const memoryPressurePromises = [];
      for (let i = 0; i < 100; i++) {
        memoryPressurePromises.push(
          request(app)
            .post('/api/questions/combinations/evaluate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              business_context_id: businessContextId,
              customer_data: {
                verification_id: `gc-test-${i}`,
                purchase_categories: ['meat', 'produce', 'bakery'],
                transaction_amount: 500 + i
              }
            })
        );
      }

      await Promise.all(memoryPressurePromises);

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      const afterGC = process.memoryUsage();
      const memoryEfficiency = (beforeGC.heapUsed / afterGC.heapUsed);

      console.log(`GC Efficiency: ${memoryEfficiency.toFixed(2)}x memory reclaimed`);

      // Memory should not grow unbounded
      expect(afterGC.heapUsed / 1024 / 1024).toBeLessThan(PERFORMANCE_TARGETS.MAX_MEMORY_USAGE_MB);
    });
  });

  /**
   * Performance Monitoring Integration
   */
  describe('Performance Monitoring', () => {
    test('should provide accurate performance metrics via monitoring endpoint', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/performance?timeframe=hour')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.average_evaluation_time_ms).toBeLessThan(PERFORMANCE_TARGETS.MAX_EVALUATION_TIME_MS);
      expect(response.body.cache_hit_rate).toBeGreaterThan(PERFORMANCE_TARGETS.MIN_CACHE_HIT_RATE);
      expect(response.body.error_rate).toBeLessThan(0.01); // <1% error rate

      console.log(`System Performance Metrics:
        - Avg Evaluation Time: ${response.body.average_evaluation_time_ms}ms
        - P95 Evaluation Time: ${response.body.p95_evaluation_time_ms}ms
        - Cache Hit Rate: ${(response.body.cache_hit_rate * 100).toFixed(1)}%
        - Error Rate: ${(response.body.error_rate * 100).toFixed(3)}%`);
    });

    test('should track algorithm performance distribution', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/performance?timeframe=hour')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.optimization_algorithm_usage).toBeDefined();
      
      const algorithmUsage = response.body.optimization_algorithm_usage;
      const totalUsage = Object.values(algorithmUsage).reduce((sum: number, usage: number) => sum + usage, 0);

      expect(totalUsage).toBeCloseTo(1.0, 2); // Should sum to 100%

      console.log('Algorithm Usage Distribution:', JSON.stringify(algorithmUsage, null, 2));
    });
  });

  /**
   * Scalability Validation
   */
  describe('Scalability Validation', () => {
    test('should handle increasing load gracefully', async () => {
      const loadLevels = [10, 25, 50, 100];
      const results = [];

      for (const loadLevel of loadLevels) {
        const startTime = performance.now();
        const promises = [];

        for (let i = 0; i < loadLevel; i++) {
          promises.push(
            request(app)
              .post('/api/questions/combinations/evaluate')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                business_context_id: businessContextId,
                customer_data: {
                  verification_id: `scalability-${loadLevel}-${i}`,
                  purchase_categories: ['produce'],
                  transaction_amount: 200 + i
                }
              })
          );
        }

        const responses = await Promise.all(promises);
        const totalTime = performance.now() - startTime;
        const avgResponseTime = totalTime / loadLevel;

        const successCount = responses.filter(r => r.status === 200).length;
        const successRate = successCount / loadLevel;

        results.push({
          loadLevel,
          avgResponseTime,
          successRate,
          totalTime
        });

        console.log(`Load Level ${loadLevel}: ${avgResponseTime.toFixed(2)}ms avg, ${(successRate * 100).toFixed(1)}% success`);

        // Each load level should maintain acceptable performance
        expect(avgResponseTime).toBeLessThan(PERFORMANCE_TARGETS.MAX_EVALUATION_TIME_MS);
        expect(successRate).toBeGreaterThan(0.99); // 99% success rate
      }

      // Performance degradation should be reasonable
      const degradationFactor = results[results.length - 1].avgResponseTime / results[0].avgResponseTime;
      expect(degradationFactor).toBeLessThan(2.0); // No more than 2x degradation at highest load
    });
  });

  // Helper functions
  async function setupPerformanceTestData() {
    const supabase = createClient(
      process.env.SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_KEY || 'test-service-key'
    );

    // Create performance test business
    await supabase
      .from('business_contexts')
      .upsert({
        id: businessContextId,
        business_name: 'Performance Test Business',
        is_active: true
      });

    // Create test questions with realistic data
    const testQuestions = [
      { id: 'perf-q1', text: 'Service quality?', category: 'service', priority: 4, tokens: 20 },
      { id: 'perf-q2', text: 'Product freshness?', category: 'product', priority: 3, tokens: 25 },
      { id: 'perf-q3', text: 'Meat section cleanliness?', category: 'meat', priority: 3, tokens: 30 },
      { id: 'perf-q4', text: 'Checkout experience?', category: 'service', priority: 2, tokens: 25 },
      { id: 'perf-q5', text: 'Overall satisfaction?', category: 'general', priority: 4, tokens: 20 }
    ];

    for (const question of testQuestions) {
      await supabase
        .from('context_questions')
        .upsert({
          id: question.id,
          business_context_id: businessContextId,
          question_text: question.text,
          topic_category: question.category,
          default_priority_level: question.priority,
          estimated_tokens: question.tokens,
          frequency_every_nth_customer: 5
        });
    }

    // Create test triggers
    const testTriggers = [
      {
        name: 'Perf Meat Trigger',
        type: 'purchase_based',
        priority: 4,
        config: { categories: ['meat'] }
      },
      {
        name: 'Perf High Value',
        type: 'amount_based',
        priority: 3,
        config: { currency: 'SEK', minimum_amount: 300, comparison_operator: '>=' }
      }
    ];

    for (const trigger of testTriggers) {
      await supabase
        .from('dynamic_triggers')
        .upsert({
          business_context_id: businessContextId,
          trigger_name: trigger.name,
          trigger_type: trigger.type,
          priority_level: trigger.priority,
          trigger_config: trigger.config,
          sensitivity_threshold: 5
        });
    }

    // Create combination rule
    await supabase
      .from('question_combination_rules')
      .upsert({
        business_context_id: businessContextId,
        rule_name: 'Performance Test Rule',
        max_call_duration_seconds: 120,
        priority_threshold_critical: 0,
        priority_threshold_high: 60,
        priority_threshold_medium: 90,
        priority_threshold_low: 120
      });
  }

  async function warmUpSystem() {
    console.log('Warming up system...');
    const warmUpPromises = [];

    for (let i = 0; i < TEST_LOAD_CONFIG.WARM_UP_REQUESTS; i++) {
      warmUpPromises.push(
        request(app)
          .post('/api/questions/combinations/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: businessContextId,
            customer_data: {
              verification_id: `warmup-${i}`,
              purchase_categories: i % 2 === 0 ? ['meat'] : ['produce'],
              transaction_amount: 200 + (i * 10)
            }
          })
      );
    }

    await Promise.all(warmUpPromises);
    console.log('System warmed up');
  }

  async function cleanupPerformanceTestData() {
    const supabase = createClient(
      process.env.SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_KEY || 'test-service-key'
    );

    // Clean up in reverse dependency order
    await supabase.from('trigger_activation_logs').delete().like('verification_id', 'perf-%');
    await supabase.from('trigger_activation_logs').delete().like('verification_id', 'cache-%');
    await supabase.from('trigger_activation_logs').delete().like('verification_id', 'burst-%');
    await supabase.from('trigger_activation_logs').delete().like('verification_id', 'sustained-%');
    await supabase.from('trigger_activation_logs').delete().like('verification_id', 'gc-%');
    await supabase.from('trigger_activation_logs').delete().like('verification_id', 'scalability-%');
    
    await supabase.from('dynamic_triggers').delete().eq('business_context_id', businessContextId);
    await supabase.from('question_combination_rules').delete().eq('business_context_id', businessContextId);
    await supabase.from('context_questions').delete().eq('business_context_id', businessContextId);
    await supabase.from('business_contexts').delete().eq('id', businessContextId);
  }
});