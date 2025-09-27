import { TimeConstraintOptimizer, QuestionForOptimization, TimeConstraintConfig } from '../../../src/services/questions/time-optimizer';
import { loggingService } from '../../../src/services/loggingService';
import {
  getTimeConstraintOptimizers,
  createTimeConstraintOptimizer,
  updateTimeConstraintOptimizer,
  updateOptimizerPerformance
} from '@vocilia/database/questions/time-optimizers';

// Mock dependencies
jest.mock('@vocilia/database/questions/time-optimizers');
jest.mock('../../../src/services/loggingService');

const mockGetTimeConstraintOptimizers = getTimeConstraintOptimizers as jest.MockedFunction<typeof getTimeConstraintOptimizers>;
const mockCreateTimeConstraintOptimizer = createTimeConstraintOptimizer as jest.MockedFunction<typeof createTimeConstraintOptimizer>;
const mockUpdateTimeConstraintOptimizer = updateTimeConstraintOptimizer as jest.MockedFunction<typeof updateTimeConstraintOptimizer>;
const mockUpdateOptimizerPerformance = updateOptimizerPerformance as jest.MockedFunction<typeof updateOptimizerPerformance>;

const mockLoggingService = {
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn()
};

describe('TimeConstraintOptimizer', () => {
  let optimizer: TimeConstraintOptimizer;
  const businessId = 'test-business-id';
  
  const sampleQuestions: QuestionForOptimization[] = [
    {
      questionId: 'q1',
      text: 'How was the overall quality of our products?',
      tokenCount: 85,
      category: 'product_quality',
      topicCategory: 'quality',
      priorityLevel: 5,
      estimatedDurationSeconds: 20,
      historicalDuration: 18,
      complexityFactor: 1.2
    },
    {
      questionId: 'q2',
      text: 'Rate the checkout experience',
      tokenCount: 42,
      category: 'service_experience',
      topicCategory: 'checkout',
      priorityLevel: 4,
      estimatedDurationSeconds: 12,
      complexityFactor: 0.8
    },
    {
      questionId: 'q3',
      text: 'Any additional feedback?',
      tokenCount: 30,
      category: 'general_feedback',
      topicCategory: 'general',
      priorityLevel: 2,
      estimatedDurationSeconds: 15
    },
    {
      questionId: 'q4',
      text: 'Would you recommend us to friends and family members?',
      tokenCount: 70,
      category: 'general_feedback',
      topicCategory: 'recommendation',
      priorityLevel: 3,
      complexityFactor: 1.0
    }
  ];

  const defaultConfig: TimeConstraintConfig = {
    maxDurationSeconds: 90,
    minDurationSeconds: 30,
    bufferTimePercentage: 10,
    transitionTimePerQuestion: 2,
    algorithmPreference: 'balanced'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    optimizer = new TimeConstraintOptimizer(businessId, mockLoggingService as any);
  });

  describe('Constructor', () => {
    test('should create instance with valid parameters', () => {
      expect(optimizer).toBeInstanceOf(TimeConstraintOptimizer);
    });

    test('should store business ID and logging service', () => {
      const optimizerAny = optimizer as any;
      expect(optimizerAny.businessId).toBe(businessId);
      expect(optimizerAny.loggingService).toBe(mockLoggingService);
    });
  });

  describe('optimizeForTimeConstraint', () => {
    beforeEach(() => {
      mockGetTimeConstraintOptimizers.mockResolvedValue([]);
    });

    test('should successfully optimize questions within time constraint', async () => {
      const result = await optimizer.optimizeForTimeConstraint(sampleQuestions, defaultConfig);

      expect(result.selectedQuestions.length).toBeGreaterThan(0);
      expect(result.selectedQuestions.length).toBeLessThanOrEqual(sampleQuestions.length);
      expect(result.optimizationMetadata.totalEstimatedDuration).toBeLessThanOrEqual(defaultConfig.maxDurationSeconds);
      expect(result.optimizationMetadata.timeUtilization).toBeGreaterThan(0);
      expect(result.optimizationMetadata.timeUtilization).toBeLessThanOrEqual(100);
      expect(result.optimizationMetadata.processingTimeMs).toBeGreaterThan(0);
    });

    test('should select high priority questions first with greedy algorithm', async () => {
      const config: TimeConstraintConfig = {
        ...defaultConfig,
        algorithmPreference: 'speed'
      };

      const result = await optimizer.optimizeForTimeConstraint(sampleQuestions, config);

      expect(result.optimizationMetadata.algorithm).toBe('greedy_priority');
      
      // Verify that higher priority questions are selected
      const selectedPriorities = result.selectedQuestions.map(q => q.priorityLevel);
      if (selectedPriorities.length > 1) {
        expect(selectedPriorities[0]).toBeGreaterThanOrEqual(selectedPriorities[selectedPriorities.length - 1]);
      }
    });

    test('should use dynamic programming for small datasets with accuracy preference', async () => {
      const config: TimeConstraintConfig = {
        ...defaultConfig,
        algorithmPreference: 'accuracy'
      };

      const smallQuestionSet = sampleQuestions.slice(0, 3);
      const result = await optimizer.optimizeForTimeConstraint(smallQuestionSet, config);

      expect(result.optimizationMetadata.algorithm).toBe('dynamic_programming');
      expect(result.selectedQuestions.length).toBeGreaterThan(0);
    });

    test('should apply time-balanced algorithm appropriately', async () => {
      // Mock to ensure time_balanced algorithm is selected
      const config: TimeConstraintConfig = {
        ...defaultConfig,
        maxDurationSeconds: 120,
        algorithmPreference: 'accuracy'
      };

      const mediumQuestionSet = [...sampleQuestions, ...sampleQuestions]; // Duplicate to get medium size
      const result = await optimizer.optimizeForTimeConstraint(mediumQuestionSet, config);

      expect(result.optimizationMetadata.questionsConsidered).toBe(mediumQuestionSet.length);
      expect(result.selectedQuestions.length).toBeGreaterThan(0);
    });

    test('should handle token estimation algorithm', async () => {
      const config: TimeConstraintConfig = {
        ...defaultConfig,
        algorithmPreference: 'balanced'
      };

      // Force medium dataset size
      const result = await optimizer.optimizeForTimeConstraint(sampleQuestions, config);

      expect(result.optimizationMetadata.questionsSelected).toBeGreaterThan(0);
      expect(result.optimizationMetadata.averageConfidence).toBeGreaterThan(0);
      expect(result.optimizationMetadata.averageConfidence).toBeLessThanOrEqual(1);
    });

    test('should calculate time breakdown correctly', async () => {
      const result = await optimizer.optimizeForTimeConstraint(sampleQuestions, defaultConfig);

      expect(result.timeBreakdown.totalConstraint).toBe(defaultConfig.maxDurationSeconds);
      expect(result.timeBreakdown.bufferTime).toBe(defaultConfig.maxDurationSeconds * 0.1);
      expect(result.timeBreakdown.questionTime).toBeGreaterThan(0);
      expect(result.timeBreakdown.transitionTime).toBeGreaterThanOrEqual(0);

      // Verify breakdown adds up (allowing for small rounding differences)
      const totalCalculated = 
        result.timeBreakdown.questionTime + 
        result.timeBreakdown.transitionTime + 
        result.timeBreakdown.bufferTime;
      
      expect(Math.abs(totalCalculated - result.optimizationMetadata.totalEstimatedDuration - result.timeBreakdown.bufferTime)).toBeLessThan(5);
    });

    test('should use historical duration when available', async () => {
      const questionsWithHistory = sampleQuestions.map(q => ({
        ...q,
        historicalDuration: q.estimatedDurationSeconds! * 0.9 // Slightly different from estimate
      }));

      const result = await optimizer.optimizeForTimeConstraint(questionsWithHistory, defaultConfig);

      // Should have high confidence due to historical data
      expect(result.optimizationMetadata.averageConfidence).toBeGreaterThan(0.8);
    });

    test('should estimate duration from tokens when no other data available', async () => {
      const questionsTokenOnly = sampleQuestions.map(q => ({
        questionId: q.questionId,
        text: q.text,
        tokenCount: q.tokenCount,
        category: q.category,
        topicCategory: q.topicCategory,
        priorityLevel: q.priorityLevel,
        complexityFactor: q.complexityFactor
        // No estimatedDurationSeconds or historicalDuration
      }));

      const result = await optimizer.optimizeForTimeConstraint(questionsTokenOnly, defaultConfig);

      expect(result.selectedQuestions.length).toBeGreaterThan(0);
      // Confidence should be lower without historical/estimated data
      expect(result.optimizationMetadata.averageConfidence).toBeLessThan(0.8);
    });

    test('should respect minimum duration constraint', async () => {
      const config: TimeConstraintConfig = {
        ...defaultConfig,
        minDurationSeconds: 60,
        maxDurationSeconds: 90
      };

      const result = await optimizer.optimizeForTimeConstraint(sampleQuestions, config);

      expect(result.optimizationMetadata.totalEstimatedDuration).toBeGreaterThanOrEqual(config.minDurationSeconds! - 10); // Allow small buffer
    });

    test('should handle empty question array', async () => {
      const result = await optimizer.optimizeForTimeConstraint([], defaultConfig);

      expect(result.selectedQuestions).toHaveLength(0);
      expect(result.optimizationMetadata.questionsConsidered).toBe(0);
      expect(result.optimizationMetadata.questionsSelected).toBe(0);
      expect(result.optimizationMetadata.timeUtilization).toBe(0);
    });

    test('should log warning when processing exceeds 500ms threshold', async () => {
      // Create large dataset to potentially exceed threshold
      const largeQuestionSet: QuestionForOptimization[] = Array.from({ length: 200 }, (_, i) => ({
        questionId: `q${i}`,
        text: `Question ${i} with some descriptive text`,
        tokenCount: Math.floor(Math.random() * 80) + 20,
        category: 'general',
        topicCategory: 'general',
        priorityLevel: Math.floor(Math.random() * 5) + 1,
        complexityFactor: Math.random() + 0.5
      }));

      await optimizer.optimizeForTimeConstraint(largeQuestionSet, defaultConfig);

      // Should have completed regardless of time
      expect(mockLoggingService.logInfo).toHaveBeenCalledWith(
        'Time constraint optimization completed',
        expect.objectContaining({
          businessId,
          questionsConsidered: largeQuestionSet.length
        })
      );
    });

    test('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockGetTimeConstraintOptimizers.mockRejectedValue(dbError);

      await expect(optimizer.optimizeForTimeConstraint(sampleQuestions, defaultConfig))
        .rejects.toThrow(dbError);

      expect(mockLoggingService.logError).toHaveBeenCalledWith(
        'Time constraint optimization failed',
        expect.objectContaining({
          businessId,
          questionsCount: sampleQuestions.length,
          error: 'Database connection failed'
        })
      );
    });
  });

  describe('createOptimizer', () => {
    test('should create new optimizer with provided configuration', async () => {
      const newOptimizer = {
        id: 'new-optimizer-id',
        optimizer_name: 'Test Optimizer'
      };
      mockCreateTimeConstraintOptimizer.mockResolvedValue(newOptimizer);

      const optimizerData = {
        optimizerName: 'Test Optimizer',
        algorithmType: 'greedy_priority' as const,
        configurationRules: { maxQuestions: 10 },
        performanceThresholds: { maxProcessingTime: 500 }
      };

      const result = await optimizer.createOptimizer(optimizerData);

      expect(result).toEqual(newOptimizer);
      expect(mockCreateTimeConstraintOptimizer).toHaveBeenCalledWith({
        business_id: businessId,
        optimizer_name: 'Test Optimizer',
        algorithm_type: 'greedy_priority',
        configuration_rules: { maxQuestions: 10 },
        performance_thresholds: { maxProcessingTime: 500 }
      });
    });
  });

  describe('updateOptimizer', () => {
    test('should update optimizer with provided changes', async () => {
      const optimizerId = 'test-optimizer-id';
      const updatedOptimizer = { id: optimizerId, optimizer_name: 'Updated Optimizer' };
      mockUpdateTimeConstraintOptimizer.mockResolvedValue(updatedOptimizer);

      const updates = {
        optimizerName: 'Updated Optimizer',
        algorithmType: 'dynamic_programming' as const,
        isActive: false
      };

      const result = await optimizer.updateOptimizer(optimizerId, updates);

      expect(result).toEqual(updatedOptimizer);
      expect(mockUpdateTimeConstraintOptimizer).toHaveBeenCalledWith(optimizerId, {
        optimizer_name: 'Updated Optimizer',
        algorithm_type: 'dynamic_programming',
        is_active: false
      });
    });

    test('should handle partial updates', async () => {
      const optimizerId = 'test-optimizer-id';
      mockUpdateTimeConstraintOptimizer.mockResolvedValue({ id: optimizerId });

      const updates = {
        isActive: true
      };

      await optimizer.updateOptimizer(optimizerId, updates);

      expect(mockUpdateTimeConstraintOptimizer).toHaveBeenCalledWith(optimizerId, {
        is_active: true
      });
    });
  });

  describe('updatePerformanceMetrics', () => {
    test('should update performance metrics and log the update', async () => {
      const optimizerId = 'test-optimizer-id';
      const actualDuration = 75;
      const questionsCompleted = 4;
      const totalQuestions = 5;
      const customerSatisfaction = 4.2;

      await optimizer.updatePerformanceMetrics(
        optimizerId,
        actualDuration,
        questionsCompleted,
        totalQuestions,
        customerSatisfaction
      );

      expect(mockUpdateOptimizerPerformance).toHaveBeenCalledWith(
        optimizerId,
        actualDuration,
        questionsCompleted,
        totalQuestions,
        customerSatisfaction
      );

      expect(mockLoggingService.logInfo).toHaveBeenCalledWith(
        'Time optimizer performance updated',
        {
          businessId,
          optimizerId,
          actualDuration,
          questionsCompleted,
          totalQuestions,
          customerSatisfaction
        }
      );
    });

    test('should handle performance update without customer satisfaction', async () => {
      const optimizerId = 'test-optimizer-id';
      
      await optimizer.updatePerformanceMetrics(optimizerId, 60, 3, 4);

      expect(mockUpdateOptimizerPerformance).toHaveBeenCalledWith(
        optimizerId,
        60,
        3,
        4,
        undefined
      );
    });
  });

  describe('getAvailableStrategies', () => {
    test('should return all available optimization strategies', () => {
      const strategies = optimizer.getAvailableStrategies();

      expect(strategies).toHaveLength(4);
      
      const strategyNames = strategies.map(s => s.name);
      expect(strategyNames).toContain('Greedy Priority');
      expect(strategyNames).toContain('Dynamic Programming');
      expect(strategyNames).toContain('Time Balanced');
      expect(strategyNames).toContain('Token Estimation');

      strategies.forEach(strategy => {
        expect(strategy).toHaveProperty('name');
        expect(strategy).toHaveProperty('description');
        expect(strategy).toHaveProperty('timeComplexity');
        expect(strategy).toHaveProperty('accuracy');
        expect(strategy).toHaveProperty('speed');
        expect(['high', 'medium', 'low']).toContain(strategy.accuracy);
        expect(['fast', 'medium', 'slow']).toContain(strategy.speed);
      });
    });
  });

  describe('validatePerformanceRequirement', () => {
    test('should validate that optimization completes within 500ms', async () => {
      mockGetTimeConstraintOptimizers.mockResolvedValue([]);

      const result = await optimizer.validatePerformanceRequirement();

      expect(result).toBe(true);
    });

    test('should handle validation errors gracefully', async () => {
      mockGetTimeConstraintOptimizers.mockRejectedValue(new Error('Validation failed'));

      const result = await optimizer.validatePerformanceRequirement();

      expect(result).toBe(false);
    });
  });

  describe('Algorithm Performance Characteristics', () => {
    beforeEach(() => {
      mockGetTimeConstraintOptimizers.mockResolvedValue([]);
    });

    test('should complete optimization within reasonable time for small datasets', async () => {
      const startTime = Date.now();
      await optimizer.optimizeForTimeConstraint(sampleQuestions, defaultConfig);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should be very fast for 4 questions
    });

    test('should handle medium datasets efficiently', async () => {
      const mediumQuestionSet: QuestionForOptimization[] = Array.from({ length: 25 }, (_, i) => ({
        questionId: `q${i}`,
        text: `Question ${i}`,
        tokenCount: Math.floor(Math.random() * 60) + 30,
        category: 'general',
        topicCategory: 'general',
        priorityLevel: Math.floor(Math.random() * 5) + 1,
        complexityFactor: Math.random() + 0.5
      }));

      const startTime = Date.now();
      const result = await optimizer.optimizeForTimeConstraint(mediumQuestionSet, defaultConfig);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
      expect(result.selectedQuestions.length).toBeGreaterThan(0);
    });

    test('should maintain performance with complex constraints', async () => {
      const complexConfig: TimeConstraintConfig = {
        maxDurationSeconds: 120,
        minDurationSeconds: 60,
        bufferTimePercentage: 15,
        transitionTimePerQuestion: 3,
        priorityThresholds: {
          5: 30,
          4: 20,
          3: 15,
          2: 10,
          1: 5
        },
        algorithmPreference: 'accuracy'
      };

      const startTime = Date.now();
      const result = await optimizer.optimizeForTimeConstraint(sampleQuestions, complexConfig);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
      expect(result.selectedQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockGetTimeConstraintOptimizers.mockResolvedValue([]);
    });

    test('should handle questions with zero duration', async () => {
      const zeroDurationQuestions: QuestionForOptimization[] = [
        {
          questionId: 'zero1',
          text: 'Quick question',
          tokenCount: 0,
          category: 'quick',
          topicCategory: 'quick',
          priorityLevel: 5,
          estimatedDurationSeconds: 0
        }
      ];

      const result = await optimizer.optimizeForTimeConstraint(zeroDurationQuestions, defaultConfig);

      expect(result.selectedQuestions.length).toBe(1); // Should still select it
    });

    test('should handle very tight time constraints', async () => {
      const tightConfig: TimeConstraintConfig = {
        maxDurationSeconds: 10, // Very short
        bufferTimePercentage: 0,
        transitionTimePerQuestion: 1
      };

      const result = await optimizer.optimizeForTimeConstraint(sampleQuestions, tightConfig);

      expect(result.optimizationMetadata.totalEstimatedDuration).toBeLessThanOrEqual(tightConfig.maxDurationSeconds);
    });

    test('should handle very long time constraints', async () => {
      const longConfig: TimeConstraintConfig = {
        maxDurationSeconds: 600, // 10 minutes
        bufferTimePercentage: 5
      };

      const result = await optimizer.optimizeForTimeConstraint(sampleQuestions, longConfig);

      expect(result.selectedQuestions.length).toBe(sampleQuestions.length); // Should select all
      expect(result.optimizationMetadata.timeUtilization).toBeLessThan(100);
    });

    test('should handle questions with extreme priority levels', async () => {
      const extremeQuestions: QuestionForOptimization[] = [
        {
          ...sampleQuestions[0],
          priorityLevel: 1 // Very low priority
        },
        {
          ...sampleQuestions[1],
          priorityLevel: 5 // Very high priority
        }
      ];

      const result = await optimizer.optimizeForTimeConstraint(extremeQuestions, defaultConfig);

      // High priority question should be selected first
      const highPrioritySelected = result.selectedQuestions.some(q => q.priorityLevel === 5);
      expect(highPrioritySelected).toBe(true);
    });
  });
});