import { DynamicTriggerEngine } from '../../src/services/questions/trigger-engine';
import { TriggerCache } from '../../src/services/cache/trigger-cache';
import { loggingService } from '../../src/services/loggingService';

// Mock dependencies
jest.mock('../../src/services/loggingService');
jest.mock('@vocilia/database/questions/dynamic-triggers');

const mockLoggingService = {
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn()
};

describe('Trigger Load Testing', () => {
  let triggerEngine: DynamicTriggerEngine;
  let triggerCache: TriggerCache;
  const businessId = 'load-test-business';

  beforeEach(() => {
    jest.clearAllMocks();
    triggerEngine = new DynamicTriggerEngine(businessId, mockLoggingService as any);
    triggerCache = new TriggerCache();
  });

  describe('Concurrent Trigger Processing', () => {
    test('should handle 10 concurrent trigger evaluations within performance limits', async () => {
      const triggers = generateSampleTriggers(20);
      const customerData = generateCustomerDataVariations(10);

      const evaluationPromises = customerData.map((data, index) => ({
        promise: triggerEngine.evaluateTriggersForCustomer(triggers, data),
        startTime: performance.now(),
        customerId: data.customer_id
      }));

      const results = await Promise.all(evaluationPromises.map(e => e.promise));

      // Verify all evaluations completed successfully
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.activatedTriggers).toBeDefined();
        expect(result.metadata.processingTimeMs).toBeLessThan(500);
        
        const totalTime = performance.now() - evaluationPromises[index].startTime;
        expect(totalTime).toBeLessThan(1000); // Allow overhead for concurrency
      });
    });

    test('should maintain performance with 50 concurrent requests', async () => {
      const triggers = generateSampleTriggers(15);
      const concurrentRequests = 50;

      const startTime = performance.now();
      
      const evaluationPromises = Array.from({ length: concurrentRequests }, (_, i) => {
        const customerData = {
          customer_id: `concurrent-customer-${i}`,
          purchase_data: {
            categories: [`category-${i % 5}`],
            items: [`item-${i % 10}`],
            amount: 100 + (i * 10),
            timestamp: new Date().toISOString()
          },
          store_context: {
            location: `store-${i % 3}`,
            time_of_day: `${10 + (i % 12)}:${(i % 60).toString().padStart(2, '0')}`,
            day_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][i % 5]
          }
        };

        return triggerEngine.evaluateTriggersForCustomer(triggers, customerData);
      });

      const results = await Promise.all(evaluationPromises);
      const totalTime = performance.now() - startTime;

      // Verify system can handle high concurrency
      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 50 concurrent requests

      // Each individual result should still be performant
      results.forEach(result => {
        expect(result.metadata.processingTimeMs).toBeLessThan(500);
      });
    });

    test('should handle sustained load over time', async () => {
      const triggers = generateSampleTriggers(25);
      const batchSize = 10;
      const batches = 5;
      const results: any[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array.from({ length: batchSize }, (_, i) => {
          const customerData = {
            customer_id: `sustained-customer-${batch}-${i}`,
            purchase_data: {
              categories: [`batch-${batch}-category`],
              amount: 150 + (batch * 50),
            },
            store_context: {
              location: 'sustained-test-store',
              time_of_day: `${14 + batch}:${(i * 5).toString().padStart(2, '0')}`,
            }
          };

          return triggerEngine.evaluateTriggersForCustomer(triggers, customerData);
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches to simulate realistic load
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(results).toHaveLength(batchSize * batches);
      
      // Performance should remain consistent across batches
      results.forEach(result => {
        expect(result.metadata.processingTimeMs).toBeLessThan(500);
      });
    });

    test('should handle burst traffic patterns', async () => {
      const triggers = generateSampleTriggers(30);
      
      // Simulate traffic burst: low -> high -> low
      const trafficPatterns = [
        { requests: 5, delay: 200 },   // Low traffic
        { requests: 25, delay: 50 },   // Burst traffic
        { requests: 5, delay: 200 }    // Back to low traffic
      ];

      const allResults: any[] = [];

      for (const [phaseIndex, phase] of trafficPatterns.entries()) {
        const phaseStartTime = performance.now();
        const phasePromises: Promise<any>[] = [];

        for (let i = 0; i < phase.requests; i++) {
          const customerData = {
            customer_id: `burst-customer-${phaseIndex}-${i}`,
            purchase_data: {
              categories: ['burst-test'],
              amount: 200,
            },
            store_context: {
              location: 'burst-test-store',
              time_of_day: `${10 + phaseIndex}:${(i * 2).toString().padStart(2, '0')}`,
            }
          };

          phasePromises.push(triggerEngine.evaluateTriggersForCustomer(triggers, customerData));
          
          // Stagger requests within the phase
          if (i < phase.requests - 1) {
            await new Promise(resolve => setTimeout(resolve, phase.delay));
          }
        }

        const phaseResults = await Promise.all(phasePromises);
        allResults.push(...phaseResults);

        const phaseDuration = performance.now() - phaseStartTime;
        console.log(`Phase ${phaseIndex + 1}: ${phase.requests} requests in ${phaseDuration.toFixed(2)}ms`);
      }

      // All requests should complete successfully
      expect(allResults).toHaveLength(35); // 5 + 25 + 5
      allResults.forEach(result => {
        expect(result.metadata.processingTimeMs).toBeLessThan(500);
      });
    });
  });

  describe('Cache Performance Under Load', () => {
    test('should achieve >90% cache hit rate under concurrent load', async () => {
      const triggers = generateSampleTriggers(20);
      const uniqueCustomerProfiles = 5; // Limited profiles to force cache hits
      
      // Pre-warm the cache with a few evaluations
      for (let i = 0; i < uniqueCustomerProfiles; i++) {
        await triggerEngine.evaluateTriggersForCustomer(triggers, {
          customer_id: `profile-${i}`,
          purchase_data: { categories: [`category-${i}`], amount: 100 + i * 50 },
          store_context: { location: `store-${i}`, time_of_day: '12:00' }
        });
      }

      // Now run many evaluations using the same profiles
      const concurrentRequests = 100;
      const evaluationPromises = Array.from({ length: concurrentRequests }, (_, i) => {
        const profileIndex = i % uniqueCustomerProfiles; // Reuse profiles for cache hits
        return triggerEngine.evaluateTriggersForCustomer(triggers, {
          customer_id: `profile-${profileIndex}-run-${i}`,
          purchase_data: { categories: [`category-${profileIndex}`], amount: 100 + profileIndex * 50 },
          store_context: { location: `store-${profileIndex}`, time_of_day: '12:00' }
        });
      });

      const results = await Promise.all(evaluationPromises);
      
      // All requests should complete fast due to caching
      results.forEach(result => {
        expect(result.metadata.processingTimeMs).toBeLessThan(200); // Should be faster with cache
      });

      // Cache metrics should show high hit rate
      const cacheMetrics = await triggerCache.getMetrics();
      expect(cacheMetrics.hitRate).toBeGreaterThan(0.90); // >90% hit rate
    });

    test('should maintain cache performance during cache evictions', async () => {
      const triggers = generateSampleTriggers(30);
      
      // Fill cache beyond capacity to force evictions
      const cacheCapacity = 100; // Assume cache has limited capacity
      for (let i = 0; i < cacheCapacity + 50; i++) {
        await triggerEngine.evaluateTriggersForCustomer(triggers, {
          customer_id: `eviction-customer-${i}`,
          purchase_data: { categories: [`unique-category-${i}`], amount: i },
          store_context: { location: `unique-store-${i}`, time_of_day: '14:30' }
        });
      }

      // Performance should remain stable even with evictions
      const testPromises = Array.from({ length: 20 }, (_, i) => 
        triggerEngine.evaluateTriggersForCustomer(triggers, {
          customer_id: `post-eviction-${i}`,
          purchase_data: { categories: ['post-eviction'], amount: 250 },
          store_context: { location: 'post-eviction-store', time_of_day: '15:00' }
        })
      );

      const results = await Promise.all(testPromises);
      results.forEach(result => {
        expect(result.metadata.processingTimeMs).toBeLessThan(500);
      });
    });
  });

  describe('Memory Management Under Load', () => {
    test('should not leak memory during extended load testing', async () => {
      const triggers = generateSampleTriggers(40);
      const iterations = 50;

      // Track memory usage (simplified - in real testing you'd use more sophisticated tools)
      const initialMemoryUsage = process.memoryUsage();

      for (let iteration = 0; iteration < iterations; iteration++) {
        const batchPromises = Array.from({ length: 10 }, (_, i) => {
          const customerData = {
            customer_id: `memory-test-${iteration}-${i}`,
            purchase_data: {
              categories: [`memory-category-${i % 3}`],
              amount: 100 + (iteration * 10),
              large_data: generateLargeDataStructure(100) // Intentionally large
            },
            store_context: {
              location: `memory-store-${iteration % 5}`,
              time_of_day: `${10 + (iteration % 12)}:00`
            }
          };

          return triggerEngine.evaluateTriggersForCustomer(triggers, customerData);
        });

        await Promise.all(batchPromises);

        // Periodically check memory usage
        if (iteration % 10 === 0) {
          const currentMemoryUsage = process.memoryUsage();
          const memoryGrowth = currentMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
          
          // Memory growth should be reasonable (not a strict assertion due to GC variability)
          expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
        }
      }

      // Force garbage collection if available (Node.js with --expose-gc)
      if (global.gc) {
        global.gc();
      }

      const finalMemoryUsage = process.memoryUsage();
      const totalMemoryGrowth = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
      
      // After GC, memory growth should be minimal
      expect(totalMemoryGrowth).toBeLessThan(200 * 1024 * 1024); // Less than 200MB total growth
    });

    test('should handle large payload sizes efficiently', async () => {
      const triggers = generateSampleTriggers(20);
      
      const largePayloadPromises = Array.from({ length: 10 }, (_, i) => {
        const customerData = {
          customer_id: `large-payload-${i}`,
          purchase_data: {
            categories: Array.from({ length: 50 }, (_, j) => `category-${j}`),
            items: Array.from({ length: 200 }, (_, j) => `item-${i}-${j}`),
            amount: 1000 + i * 100,
            detailed_receipt: generateLargeDataStructure(500),
            customer_history: generateLargeDataStructure(300)
          },
          store_context: {
            location: `large-store-${i}`,
            time_of_day: `${14 + i}:00`,
            store_metadata: generateLargeDataStructure(200)
          }
        };

        return triggerEngine.evaluateTriggersForCustomer(triggers, customerData);
      });

      const results = await Promise.all(largePayloadPromises);
      
      // Even with large payloads, should meet performance requirements
      results.forEach(result => {
        expect(result.metadata.processingTimeMs).toBeLessThan(800); // Slightly relaxed for large data
      });
    });
  });

  describe('Error Recovery Under Load', () => {
    test('should recover gracefully from intermittent failures', async () => {
      const triggers = generateSampleTriggers(15);
      let failureCount = 0;
      const totalRequests = 30;
      
      // Mock some intermittent failures
      const originalEvaluate = triggerEngine.evaluateTriggersForCustomer;
      triggerEngine.evaluateTriggersForCustomer = jest.fn().mockImplementation(async (triggersList, customerData) => {
        // Fail every 5th request
        if (failureCount % 5 === 2) {
          failureCount++;
          throw new Error('Simulated intermittent failure');
        }
        failureCount++;
        return originalEvaluate.call(triggerEngine, triggersList, customerData);
      });

      const evaluationPromises = Array.from({ length: totalRequests }, (_, i) => {
        const customerData = {
          customer_id: `recovery-test-${i}`,
          purchase_data: { categories: ['recovery'], amount: 150 },
          store_context: { location: 'recovery-store', time_of_day: '13:00' }
        };

        return triggerEngine.evaluateTriggersForCustomer(triggers, customerData)
          .catch(error => ({ error: error.message, customerId: customerData.customer_id }));
      });

      const results = await Promise.all(evaluationPromises);
      
      // Should have both successful results and handled errors
      const successfulResults = results.filter(r => !('error' in r));
      const errorResults = results.filter(r => 'error' in r);

      expect(successfulResults.length).toBeGreaterThan(0);
      expect(errorResults.length).toBeGreaterThan(0);
      expect(successfulResults.length + errorResults.length).toBe(totalRequests);

      // Successful results should still meet performance requirements
      successfulResults.forEach(result => {
        expect(result.metadata?.processingTimeMs).toBeLessThan(500);
      });
    });

    test('should maintain performance during high error rates', async () => {
      const triggers = generateSampleTriggers(25);
      
      // Create conditions that might cause errors (invalid data)
      const problematicRequests = Array.from({ length: 20 }, (_, i) => {
        const customerData = {
          customer_id: `error-prone-${i}`,
          purchase_data: {
            categories: i % 3 === 0 ? [] : ['valid-category'], // Empty categories sometimes
            amount: i % 4 === 0 ? -100 : 200, // Invalid negative amounts sometimes
            items: i % 5 === 0 ? null : ['valid-item'] // Null items sometimes
          },
          store_context: {
            location: i % 6 === 0 ? '' : 'valid-store', // Empty location sometimes
            time_of_day: i % 7 === 0 ? 'invalid-time' : '15:30' // Invalid time format sometimes
          }
        };

        return triggerEngine.evaluateTriggersForCustomer(triggers, customerData)
          .catch(error => ({ 
            error: error.message, 
            customerId: customerData.customer_id,
            processingTime: performance.now() // Even error handling should be fast
          }));
      });

      const results = await Promise.all(problematicRequests);
      
      // System should handle errors gracefully without hanging
      expect(results).toHaveLength(20);
      
      results.forEach(result => {
        if ('error' in result) {
          // Even error handling should be fast
          expect(result.processingTime).toBeLessThan(100);
        } else {
          expect(result.metadata.processingTimeMs).toBeLessThan(500);
        }
      });
    });
  });
});

// Helper functions
function generateSampleTriggers(count: number) {
  const triggerTypes = ['purchase_based', 'time_based', 'amount_based'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `trigger-${i}`,
    business_context_id: 'test-business',
    trigger_name: `Load Test Trigger ${i}`,
    trigger_type: triggerTypes[i % 3] as any,
    priority_level: (i % 5) + 1,
    sensitivity_threshold: Math.max(1, i % 50),
    is_active: true,
    trigger_config: generateTriggerConfig(triggerTypes[i % 3], i),
    effectiveness_score: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
}

function generateTriggerConfig(type: string, index: number) {
  switch (type) {
    case 'purchase_based':
      return {
        categories: [`category-${index % 10}`, `category-${(index + 1) % 10}`],
        required_items: index % 3 === 0 ? [`item-${index}`] : undefined,
        minimum_items: Math.max(1, index % 5)
      };
    case 'time_based':
      return {
        time_windows: [
          {
            start_time: `${10 + (index % 8)}:00`,
            end_time: `${14 + (index % 6)}:00`,
            days_of_week: [index % 7, (index + 1) % 7]
          }
        ]
      };
    case 'amount_based':
      return {
        currency: 'SEK',
        minimum_amount: 50 + (index * 25),
        comparison_operator: '>='
      };
    default:
      return {};
  }
}

function generateCustomerDataVariations(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    customer_id: `load-test-customer-${i}`,
    purchase_data: {
      categories: [`category-${i % 5}`, `category-${(i + 1) % 5}`],
      items: Array.from({ length: 3 + (i % 5) }, (_, j) => `item-${i}-${j}`),
      amount: 100 + (i * 25),
      timestamp: new Date(Date.now() - (i * 60000)).toISOString(), // Stagger timestamps
      payment_method: ['cash', 'card', 'mobile'][i % 3],
      loyalty_member: i % 3 === 0
    },
    store_context: {
      location: `store-${i % 3}`,
      time_of_day: `${10 + (i % 8)}:${(i % 60).toString().padStart(2, '0')}`,
      day_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][i % 5],
      weather: ['sunny', 'cloudy', 'rainy'][i % 3],
      staff_count: 5 + (i % 10),
      queue_length: i % 8
    }
  }));
}

function generateLargeDataStructure(size: number): Record<string, any> {
  const data: Record<string, any> = {};
  for (let i = 0; i < size; i++) {
    data[`field_${i}`] = {
      value: `value_${i}`,
      metadata: Array.from({ length: 3 }, (_, j) => `meta_${i}_${j}`),
      timestamp: new Date().toISOString(),
      nested_data: {
        level_1: Array.from({ length: 2 }, (_, k) => `nested_${i}_${k}`),
        level_2: {
          deep_value: `deep_${i}`,
          counter: i
        }
      }
    };
  }
  return data;
}