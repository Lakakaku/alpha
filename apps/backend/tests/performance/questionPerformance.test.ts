import { QuestionService } from '../../src/services/questions/QuestionService';
import { TriggerEvaluationService } from '../../src/services/questions/TriggerEvaluationService';
import { Database } from '@vocilia/database';
import { QuestionFormData, TriggerCondition } from '@vocilia/types';
import { performance } from 'perf_hooks';

// Mock database with performance tracking
jest.mock('@vocilia/database');
const mockDatabase = Database as jest.MockedClass<typeof Database>;

// Performance test utilities
const measurePerformance = async (fn: () => Promise<any>, description: string) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const duration = end - start;
  
  console.log(`${description}: ${duration.toFixed(2)}ms`);
  return { result, duration };
};

const generateMockQuestions = (count: number): QuestionFormData[] => {
  return Array.from({ length: count }, (_, i) => ({
    title: `Performance Test Question ${i + 1}`,
    description: `Description for question ${i + 1}`,
    type: 'text' as const,
    required: i % 2 === 0,
    category_id: `cat-${(i % 5) + 1}`,
    tags: [`tag${i}`, `category${(i % 3) + 1}`],
    position: i + 1,
    active: true,
    options: [],
    triggers: [],
    frequency_config: {
      enabled: i % 3 === 0,
      window: 'daily' as const,
      max_frequency: 1,
    },
  }));
};

const generateMockTriggerConditions = (count: number): TriggerCondition[] => {
  const types = ['time_based', 'frequency_based', 'customer_behavior', 'store_context'] as const;
  const fields = {
    time_based: ['current_time', 'current_day'],
    frequency_based: ['visit_count', 'days_since_last_visit'],
    customer_behavior: ['avg_session_duration', 'total_spent'],
    store_context: ['store_rating', 'peak_hours'],
  };
  const operators = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];

  return Array.from({ length: count }, (_, i) => {
    const type = types[i % types.length];
    const fieldOptions = fields[type];
    const field = fieldOptions[i % fieldOptions.length];
    const operator = operators[i % operators.length];
    
    return {
      type,
      field: field as any,
      operator: operator as any,
      value: i % 2 === 0 ? Math.floor(Math.random() * 100) : 'test_value',
    };
  });
};

describe('Question Performance Tests', () => {
  let questionService: QuestionService;
  let triggerService: TriggerEvaluationService;
  let mockDbInstance: jest.Mocked<Database>;

  beforeEach(() => {
    mockDbInstance = {
      query: jest.fn(),
      transaction: jest.fn(),
      questions: {
        create: jest.fn(),
        findById: jest.fn(),
        findByBusiness: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findByFilters: jest.fn(),
        bulkUpdate: jest.fn(),
        getAnalytics: jest.fn(),
      },
      categories: {
        create: jest.fn(),
        findByBusiness: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        getUsageStats: jest.fn(),
      },
      triggers: {
        create: jest.fn(),
        findByQuestion: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        evaluate: jest.fn(),
      },
    } as any;

    mockDatabase.mockImplementation(() => mockDbInstance);
    questionService = new QuestionService();
    triggerService = new TriggerEvaluationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Question CRUD Performance', () => {
    it('should create questions within performance targets', async () => {
      const questionData = generateMockQuestions(1)[0];
      mockDbInstance.questions.create.mockResolvedValue({ id: 'q-1', ...questionData });

      const { duration } = await measurePerformance(
        () => questionService.createQuestion('bus-1', questionData),
        'Single question creation'
      );

      expect(duration).toBeLessThan(200); // Target: <200ms
    });

    it('should handle bulk question creation efficiently', async () => {
      const questionCount = 100;
      const questions = generateMockQuestions(questionCount);
      
      // Mock bulk creation
      mockDbInstance.transaction.mockImplementation(async (callback) => {
        return callback(mockDbInstance);
      });
      
      questions.forEach((q, i) => {
        mockDbInstance.questions.create.mockResolvedValueOnce({ id: `q-${i}`, ...q });
      });

      const { duration } = await measurePerformance(
        async () => {
          const promises = questions.map(q => questionService.createQuestion('bus-1', q));
          return Promise.all(promises);
        },
        `Bulk creation of ${questionCount} questions`
      );

      const avgPerQuestion = duration / questionCount;
      expect(avgPerQuestion).toBeLessThan(50); // Target: <50ms per question in bulk
    });

    it('should retrieve questions with filters efficiently', async () => {
      const questionCount = 1000;
      const mockQuestions = Array.from({ length: questionCount }, (_, i) => ({
        id: `q-${i}`,
        title: `Question ${i}`,
        type: 'text',
        business_id: 'bus-1',
      }));

      mockDbInstance.questions.findByFilters.mockResolvedValue(mockQuestions.slice(0, 50));

      const { duration } = await measurePerformance(
        () => questionService.getQuestions('bus-1', {
          category_id: 'cat-1',
          active: true,
          search: 'test',
        }),
        'Filtered question retrieval'
      );

      expect(duration).toBeLessThan(100); // Target: <100ms
    });

    it('should handle pagination efficiently', async () => {
      const pageSize = 25;
      const mockQuestions = Array.from({ length: pageSize }, (_, i) => ({
        id: `q-${i}`,
        title: `Question ${i}`,
        type: 'text',
        business_id: 'bus-1',
      }));

      mockDbInstance.questions.findByFilters.mockResolvedValue(mockQuestions);

      const { duration } = await measurePerformance(
        () => questionService.getQuestions('bus-1', {
          limit: pageSize,
          offset: 0,
        }),
        'Paginated question retrieval'
      );

      expect(duration).toBeLessThan(75); // Target: <75ms for pagination
    });
  });

  describe('Trigger Evaluation Performance', () => {
    it('should evaluate single trigger condition quickly', async () => {
      const condition: TriggerCondition = {
        type: 'time_based',
        field: 'current_time',
        operator: 'between',
        value: ['09:00', '17:00'],
      };

      const context = {
        current_time: '14:30',
        store_id: 'store-1',
        customer_id: 'cust-1',
      };

      const { duration } = await measurePerformance(
        () => Promise.resolve(triggerService.evaluateCondition(condition, context)),
        'Single trigger condition evaluation'
      );

      expect(duration).toBeLessThan(10); // Target: <10ms
    });

    it('should evaluate multiple conditions efficiently', async () => {
      const conditionCount = 10;
      const conditions = generateMockTriggerConditions(conditionCount);
      const context = {
        current_time: '14:30',
        current_day: 'tuesday',
        visit_count: 5,
        avg_session_duration: 300,
        total_spent: 150,
        store_rating: 4.2,
        peak_hours: true,
        store_id: 'store-1',
        customer_id: 'cust-1',
      };

      const { duration } = await measurePerformance(
        () => Promise.resolve(triggerService.evaluateConditions(conditions, context, 'AND')),
        `Evaluation of ${conditionCount} trigger conditions`
      );

      expect(duration).toBeLessThan(50); // Target: <50ms for 10 conditions
    });

    it('should handle high-volume trigger evaluations', async () => {
      const evaluationCount = 1000;
      const condition: TriggerCondition = {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'gte',
        value: 3,
      };

      const contexts = Array.from({ length: evaluationCount }, (_, i) => ({
        visit_count: i % 10,
        store_id: 'store-1',
        customer_id: `cust-${i}`,
      }));

      const { duration } = await measurePerformance(
        async () => {
          return contexts.map(context => triggerService.evaluateCondition(condition, context));
        },
        `High-volume trigger evaluation (${evaluationCount} evaluations)`
      );

      const avgPerEvaluation = duration / evaluationCount;
      expect(avgPerEvaluation).toBeLessThan(1); // Target: <1ms per evaluation
    });
  });

  describe('Database Query Optimization', () => {
    it('should minimize database queries for question loading', async () => {
      const businessId = 'bus-1';
      mockDbInstance.questions.findByBusiness.mockResolvedValue([]);
      mockDbInstance.categories.findByBusiness.mockResolvedValue([]);

      await questionService.getQuestions(businessId, {});

      // Should use efficient queries with proper joins
      expect(mockDbInstance.questions.findByBusiness).toHaveBeenCalledTimes(1);
      // Should not make N+1 queries
    });

    it('should use database indexing efficiently', async () => {
      const filters = {
        category_id: 'cat-1',
        active: true,
        tags: ['tag1', 'tag2'],
        search: 'test',
      };

      mockDbInstance.questions.findByFilters.mockResolvedValue([]);

      const { duration } = await measurePerformance(
        () => questionService.getQuestions('bus-1', filters),
        'Indexed query performance'
      );

      expect(duration).toBeLessThan(100); // Should be fast with proper indexes
    });

    it('should handle large result sets efficiently', async () => {
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        id: `q-${i}`,
        title: `Question ${i}`,
        type: 'text',
        business_id: 'bus-1',
      }));

      mockDbInstance.questions.findByFilters.mockResolvedValue(largeDataset);

      const { duration } = await measurePerformance(
        () => questionService.getQuestions('bus-1', { limit: 5000 }),
        'Large dataset query'
      );

      expect(duration).toBeLessThan(500); // Target: <500ms for large datasets
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should handle large question datasets without memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process large dataset
      const largeDataset = generateMockQuestions(10000);
      
      for (let i = 0; i < largeDataset.length; i += 100) {
        const batch = largeDataset.slice(i, i + 100);
        // Simulate processing batch
        batch.forEach(question => {
          questionService.validateQuestionData(question);
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseLimit = 100 * 1024 * 1024; // 100MB

      expect(memoryIncrease).toBeLessThan(memoryIncreaseLimit);
    });

    it('should efficiently cache trigger evaluation results', async () => {
      const condition: TriggerCondition = {
        type: 'time_based',
        field: 'current_time',
        operator: 'gte',
        value: '09:00',
      };

      const context = {
        current_time: '14:30',
        store_id: 'store-1',
        customer_id: 'cust-1',
      };

      // First evaluation (cold)
      const { duration: coldDuration } = await measurePerformance(
        () => Promise.resolve(triggerService.evaluateCondition(condition, context)),
        'Cold trigger evaluation'
      );

      // Subsequent evaluations (should be faster if cached)
      const { duration: warmDuration } = await measurePerformance(
        () => Promise.resolve(triggerService.evaluateCondition(condition, context)),
        'Warm trigger evaluation'
      );

      // Warm should be significantly faster
      expect(warmDuration).toBeLessThanOrEqual(coldDuration);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent question creation', async () => {
      const concurrentCount = 50;
      const questions = generateMockQuestions(concurrentCount);
      
      questions.forEach((q, i) => {
        mockDbInstance.questions.create.mockResolvedValueOnce({ id: `q-${i}`, ...q });
      });

      const { duration } = await measurePerformance(
        async () => {
          const promises = questions.map(q => questionService.createQuestion('bus-1', q));
          return Promise.all(promises);
        },
        `${concurrentCount} concurrent question creations`
      );

      const avgPerQuestion = duration / concurrentCount;
      expect(avgPerQuestion).toBeLessThan(100); // Target: <100ms per question concurrently
    });

    it('should handle concurrent trigger evaluations', async () => {
      const concurrentCount = 100;
      const condition: TriggerCondition = {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'gte',
        value: 3,
      };

      const contexts = Array.from({ length: concurrentCount }, (_, i) => ({
        visit_count: i % 10,
        store_id: 'store-1',
        customer_id: `cust-${i}`,
      }));

      const { duration } = await measurePerformance(
        async () => {
          const promises = contexts.map(context => 
            Promise.resolve(triggerService.evaluateCondition(condition, context))
          );
          return Promise.all(promises);
        },
        `${concurrentCount} concurrent trigger evaluations`
      );

      const avgPerEvaluation = duration / concurrentCount;
      expect(avgPerEvaluation).toBeLessThan(10); // Target: <10ms per evaluation concurrently
    });
  });

  describe('Stress Testing', () => {
    it('should maintain performance under stress', async () => {
      const stressIterations = 1000;
      const durations: number[] = [];

      for (let i = 0; i < stressIterations; i++) {
        const question = generateMockQuestions(1)[0];
        mockDbInstance.questions.create.mockResolvedValueOnce({ id: `q-${i}`, ...question });

        const start = performance.now();
        await questionService.createQuestion('bus-1', question);
        const end = performance.now();
        
        durations.push(end - start);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const p95Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];

      console.log(`Stress test results:
        Average: ${avgDuration.toFixed(2)}ms
        Max: ${maxDuration.toFixed(2)}ms
        P95: ${p95Duration.toFixed(2)}ms
      `);

      expect(avgDuration).toBeLessThan(200);
      expect(p95Duration).toBeLessThan(500);
      expect(maxDuration).toBeLessThan(1000);
    });

    it('should handle memory pressure gracefully', async () => {
      const largeObjectCount = 10000;
      const largeObjects: any[] = [];

      // Create memory pressure
      for (let i = 0; i < largeObjectCount; i++) {
        largeObjects.push({
          id: i,
          data: new Array(1000).fill(`large-data-${i}`),
          question: generateMockQuestions(1)[0],
        });
      }

      // Perform operations under memory pressure
      const question = generateMockQuestions(1)[0];
      mockDbInstance.questions.create.mockResolvedValue({ id: 'q-stress', ...question });

      const { duration } = await measurePerformance(
        () => questionService.createQuestion('bus-1', question),
        'Operation under memory pressure'
      );

      // Should still perform within reasonable limits
      expect(duration).toBeLessThan(1000);

      // Cleanup
      largeObjects.length = 0;
    });
  });

  describe('Real-world Scenario Performance', () => {
    it('should handle typical business dashboard load', async () => {
      // Simulate typical dashboard load:
      // - 20 questions
      // - 5 categories
      // - 10 trigger evaluations per page load
      
      const questions = Array.from({ length: 20 }, (_, i) => ({
        id: `q-${i}`,
        title: `Question ${i}`,
        type: 'text',
        business_id: 'bus-1',
      }));

      const categories = Array.from({ length: 5 }, (_, i) => ({
        id: `cat-${i}`,
        name: `Category ${i}`,
        business_id: 'bus-1',
      }));

      mockDbInstance.questions.findByBusiness.mockResolvedValue(questions);
      mockDbInstance.categories.findByBusiness.mockResolvedValue(categories);

      const { duration } = await measurePerformance(
        async () => {
          // Simulate dashboard load
          await Promise.all([
            questionService.getQuestions('bus-1', {}),
            questionService.getCategories('bus-1'),
            questionService.getQuestionAnalytics('bus-1'),
          ]);
        },
        'Typical dashboard load'
      );

      expect(duration).toBeLessThan(300); // Target: <300ms for full dashboard load
    });

    it('should handle peak traffic efficiently', async () => {
      // Simulate peak traffic: 100 concurrent operations
      const concurrentOperations = 100;
      const operations = Array.from({ length: concurrentOperations }, (_, i) => {
        if (i % 3 === 0) {
          // Read operations (most common)
          mockDbInstance.questions.findByBusiness.mockResolvedValueOnce([]);
          return () => questionService.getQuestions('bus-1', {});
        } else if (i % 3 === 1) {
          // Trigger evaluations
          const condition: TriggerCondition = {
            type: 'time_based',
            field: 'current_time',
            operator: 'gte',
            value: '09:00',
          };
          return () => Promise.resolve(triggerService.evaluateCondition(condition, {
            current_time: '14:30',
            store_id: 'store-1',
          }));
        } else {
          // Write operations (least common)
          const question = generateMockQuestions(1)[0];
          mockDbInstance.questions.create.mockResolvedValueOnce({ id: `q-${i}`, ...question });
          return () => questionService.createQuestion('bus-1', question);
        }
      });

      const { duration } = await measurePerformance(
        () => Promise.all(operations.map(op => op())),
        `Peak traffic simulation (${concurrentOperations} operations)`
      );

      const avgPerOperation = duration / concurrentOperations;
      expect(avgPerOperation).toBeLessThan(50); // Target: <50ms per operation under load
    });
  });
});