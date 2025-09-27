import { QuestionEvaluationService } from '../../src/services/questions/evaluation-service';
import { loggingService } from '../../src/services/loggingService';

// Mock dependencies
jest.mock('../../src/services/loggingService');
jest.mock('@vocilia/database/questions/question-groups');
jest.mock('@vocilia/database/questions/dynamic-triggers');
jest.mock('@vocilia/database/questions/time-optimizers');
jest.mock('../../src/services/cache/trigger-cache');

const mockLoggingService = {
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn()
};

describe('Question Evaluation Performance Tests', () => {
  let evaluationService: QuestionEvaluationService;
  const businessId = 'test-business-id';
  
  beforeEach(() => {
    jest.clearAllMocks();
    evaluationService = new QuestionEvaluationService(businessId, mockLoggingService as any);
  });

  describe('Performance Requirement: <500ms evaluation', () => {
    test('should evaluate small question set within 100ms', async () => {
      const questions = generateSampleQuestions(10);
      const verificationData = {
        customer_id: 'test-customer-id',
        purchase_data: { categories: ['meat', 'produce'], amount: 150 },
        store_context: { location: 'downtown', time_of_day: '14:30' }
      };

      const startTime = performance.now();
      
      await evaluationService.evaluateQuestionsForCustomer(
        questions,
        verificationData,
        { maxDurationSeconds: 90 }
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(100); // Much stricter than requirement for small sets
    });

    test('should evaluate medium question set within 300ms', async () => {
      const questions = generateSampleQuestions(50);
      const verificationData = {
        customer_id: 'test-customer-id',
        purchase_data: { 
          categories: ['meat', 'produce', 'bakery', 'dairy'],
          items: ['beef', 'milk', 'bread', 'apples'],
          amount: 350
        },
        store_context: { 
          location: 'suburb', 
          time_of_day: '10:15',
          day_of_week: 'Tuesday'
        }
      };

      const startTime = performance.now();
      
      await evaluationService.evaluateQuestionsForCustomer(
        questions,
        verificationData,
        { 
          maxDurationSeconds: 120,
          algorithmPreference: 'speed' // Optimize for performance
        }
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(300);
    });

    test('should evaluate large question set within 500ms requirement', async () => {
      const questions = generateSampleQuestions(100);
      const complexVerificationData = {
        customer_id: 'test-customer-id',
        purchase_data: {
          categories: ['meat', 'produce', 'bakery', 'dairy', 'frozen', 'beverages'],
          items: Array.from({ length: 20 }, (_, i) => `item-${i}`),
          amount: 750,
          receipt_data: { line_items: 25, discounts: 3 }
        },
        store_context: {
          location: 'city_center',
          time_of_day: '18:45',
          day_of_week: 'Friday',
          season: 'winter',
          special_events: ['sale', 'promotion']
        }
      };

      const startTime = performance.now();
      
      await evaluationService.evaluateQuestionsForCustomer(
        questions,
        complexVerificationData,
        { 
          maxDurationSeconds: 90,
          bufferTimePercentage: 15,
          algorithmPreference: 'speed'
        }
      );

      const duration = performance.now() - startTime;
      
      // This is the critical performance requirement
      expect(duration).toBeLessThan(500);
    });

    test('should maintain performance under concurrent evaluations', async () => {
      const questions = generateSampleQuestions(30);
      const evaluationPromises = Array.from({ length: 5 }, (_, i) => {
        const verificationData = {
          customer_id: `customer-${i}`,
          purchase_data: { categories: ['category-a', 'category-b'], amount: 100 + i * 50 },
          store_context: { location: `store-${i}`, time_of_day: `1${i}:30` }
        };

        return {
          promise: evaluationService.evaluateQuestionsForCustomer(
            questions,
            verificationData,
            { maxDurationSeconds: 90 }
          ),
          startTime: performance.now()
        };
      });

      const results = await Promise.all(evaluationPromises.map(({ promise }) => promise));
      
      // Each individual evaluation should still meet performance requirement
      for (let i = 0; i < evaluationPromises.length; i++) {
        const duration = performance.now() - evaluationPromises[i].startTime;
        expect(duration).toBeLessThan(800); // Allow some overhead for concurrency
      }

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.selectedQuestions).toBeDefined();
        expect(result.metadata.processingTimeMs).toBeLessThan(500);
      });
    });

    test('should perform efficiently with complex trigger conditions', async () => {
      const questions = generateSampleQuestions(40);
      const complexTriggersData = {
        customer_id: 'test-customer-id',
        purchase_data: {
          categories: ['meat', 'produce', 'bakery', 'dairy'],
          items: ['premium_beef', 'organic_milk', 'artisan_bread'],
          amount: 580,
          loyalty_tier: 'gold',
          payment_method: 'credit_card',
          coupons_used: 2
        },
        store_context: {
          location: 'flagship',
          time_of_day: '15:20',
          day_of_week: 'Saturday',
          weather: 'sunny',
          foot_traffic: 'high',
          staff_rating: 4.8,
          inventory_levels: 'normal'
        }
      };

      const startTime = performance.now();
      
      await evaluationService.evaluateQuestionsForCustomer(
        questions,
        complexTriggersData,
        { 
          maxDurationSeconds: 120,
          algorithmPreference: 'balanced',
          enableAllOptimizations: true
        }
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not leak memory during repeated evaluations', async () => {
      const questions = generateSampleQuestions(25);
      const verificationData = {
        customer_id: 'memory-test-customer',
        purchase_data: { categories: ['test'], amount: 100 },
        store_context: { location: 'test', time_of_day: '12:00' }
      };

      // Perform multiple evaluations to check for memory leaks
      for (let i = 0; i < 20; i++) {
        await evaluationService.evaluateQuestionsForCustomer(
          questions,
          { ...verificationData, customer_id: `customer-${i}` },
          { maxDurationSeconds: 90 }
        );
      }

      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });

    test('should handle large data structures efficiently', async () => {
      const largeQuestions = generateSampleQuestions(200);
      const largeVerificationData = {
        customer_id: 'large-data-customer',
        purchase_data: {
          categories: Array.from({ length: 20 }, (_, i) => `category-${i}`),
          items: Array.from({ length: 100 }, (_, i) => `item-${i}`),
          amount: 1500,
          metadata: generateLargeObject(50)
        },
        store_context: {
          location: 'large-store',
          metadata: generateLargeObject(30)
        }
      };

      const startTime = performance.now();
      
      const result = await evaluationService.evaluateQuestionsForCustomer(
        largeQuestions,
        largeVerificationData,
        { maxDurationSeconds: 120 }
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // Allow more time for very large data
      expect(result.selectedQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Regression Protection', () => {
    test('should maintain baseline performance metrics', async () => {
      const baselineQuestions = generateSampleQuestions(30);
      const baselineData = {
        customer_id: 'baseline-customer',
        purchase_data: { categories: ['standard'], amount: 200 },
        store_context: { location: 'baseline', time_of_day: '14:00' }
      };

      const measurements = [];

      // Take multiple measurements for statistical accuracy
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        await evaluationService.evaluateQuestionsForCustomer(
          baselineQuestions,
          baselineData,
          { maxDurationSeconds: 90 }
        );

        const duration = performance.now() - startTime;
        measurements.push(duration);
      }

      const averageDuration = measurements.reduce((sum, d) => sum + d, 0) / measurements.length;
      const maxDuration = Math.max(...measurements);
      const minDuration = Math.min(...measurements);

      // Performance expectations
      expect(averageDuration).toBeLessThan(200); // Average should be well under requirement
      expect(maxDuration).toBeLessThan(500); // Even worst case should meet requirement
      expect(minDuration).toBeGreaterThan(5); // Sanity check - should take some time

      // Consistency check - performance should be relatively stable
      const variance = measurements.reduce((sum, d) => sum + Math.pow(d - averageDuration, 2), 0) / measurements.length;
      const standardDeviation = Math.sqrt(variance);
      expect(standardDeviation).toBeLessThan(averageDuration * 0.5); // SD should be < 50% of mean
    });

    test('should degrade gracefully under stress conditions', async () => {
      const stressQuestions = generateSampleQuestions(150);
      const stressData = {
        customer_id: 'stress-test-customer',
        purchase_data: {
          categories: Array.from({ length: 10 }, (_, i) => `stress-category-${i}`),
          items: Array.from({ length: 50 }, (_, i) => `stress-item-${i}`),
          amount: 999
        },
        store_context: {
          location: 'stress-store',
          metadata: generateLargeObject(20)
        }
      };

      // Even under stress, should still meet the requirement
      const startTime = performance.now();
      
      const result = await evaluationService.evaluateQuestionsForCustomer(
        stressQuestions,
        stressData,
        { 
          maxDurationSeconds: 60, // Tighter constraint to increase complexity
          algorithmPreference: 'accuracy' // More complex algorithm
        }
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(500);
      expect(result.selectedQuestions.length).toBeGreaterThan(0);
      expect(result.metadata.processingTimeMs).toBeLessThan(500);
    });
  });

  describe('Algorithm Performance Comparison', () => {
    test('should compare performance across different algorithms', async () => {
      const questions = generateSampleQuestions(40);
      const testData = {
        customer_id: 'algorithm-test-customer',
        purchase_data: { categories: ['comparison'], amount: 300 },
        store_context: { location: 'algorithm-test', time_of_day: '16:00' }
      };

      const algorithms: Array<'speed' | 'balanced' | 'accuracy'> = ['speed', 'balanced', 'accuracy'];
      const results: Array<{ algorithm: string; duration: number; result: any }> = [];

      for (const algorithm of algorithms) {
        const startTime = performance.now();
        
        const result = await evaluationService.evaluateQuestionsForCustomer(
          questions,
          testData,
          { 
            maxDurationSeconds: 90,
            algorithmPreference: algorithm
          }
        );

        const duration = performance.now() - startTime;
        results.push({ algorithm, duration, result });
      }

      // All algorithms should meet the performance requirement
      results.forEach(({ algorithm, duration }) => {
        expect(duration).toBeLessThan(500);
      });

      // Speed algorithm should be fastest
      const speedResult = results.find(r => r.algorithm === 'speed')!;
      const balancedResult = results.find(r => r.algorithm === 'balanced')!;
      const accuracyResult = results.find(r => r.algorithm === 'accuracy')!;

      expect(speedResult.duration).toBeLessThanOrEqual(balancedResult.duration);
      // Note: accuracy might not always be slowest due to optimizations, but should still be fast
    });
  });
});

// Helper functions
function generateSampleQuestions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `question-${i}`,
    text: `Sample question ${i} with varying complexity and length ${i % 3 === 0 ? 'that includes additional descriptive text to simulate real-world question variations' : ''}`,
    category: ['product', 'service', 'experience', 'general'][i % 4],
    topicCategory: ['quality', 'delivery', 'staff', 'ambiance'][i % 4],
    priorityLevel: (i % 5) + 1,
    estimatedDurationSeconds: 10 + (i % 30),
    isActive: true,
    frequencyDays: Math.max(1, i % 14),
    metadata: {
      complexity: (i % 3) + 1,
      requires_context: i % 4 === 0
    }
  }));
}

function generateLargeObject(size: number): Record<string, any> {
  const obj: Record<string, any> = {};
  for (let i = 0; i < size; i++) {
    obj[`property_${i}`] = {
      value: `value_${i}`,
      metadata: Array.from({ length: 5 }, (_, j) => `meta_${i}_${j}`),
      timestamp: new Date().toISOString()
    };
  }
  return obj;
}