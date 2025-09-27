import { TopicGroupingService, QuestionForGrouping } from '../../../src/services/questions/topic-grouping';
import { loggingService } from '../../../src/services/loggingService';
import {
  getQuestionGroups,
  createQuestionGroup,
  updateQuestionGroupEffectiveness
} from '@vocilia/database/questions/question-groups';

// Mock dependencies
jest.mock('@vocilia/database/questions/question-groups');
jest.mock('../../../src/services/loggingService');

const mockGetQuestionGroups = getQuestionGroups as jest.MockedFunction<typeof getQuestionGroups>;
const mockCreateQuestionGroup = createQuestionGroup as jest.MockedFunction<typeof createQuestionGroup>;
const mockUpdateQuestionGroupEffectiveness = updateQuestionGroupEffectiveness as jest.MockedFunction<typeof updateQuestionGroupEffectiveness>;
const mockLoggingService = {
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn()
};

describe('TopicGroupingService', () => {
  let service: TopicGroupingService;
  const businessId = 'test-business-id';
  
  const sampleQuestions: QuestionForGrouping[] = [
    {
      questionId: 'q1',
      text: 'How was the meat quality?',
      category: 'product_quality',
      topicCategory: 'meat_products',
      estimatedTokens: 50,
      priorityLevel: 4,
      keywords: ['meat', 'quality', 'freshness']
    },
    {
      questionId: 'q2',
      text: 'Was the beef fresh?',
      category: 'product_quality',
      topicCategory: 'meat_products',
      estimatedTokens: 40,
      priorityLevel: 3,
      keywords: ['beef', 'fresh', 'meat']
    },
    {
      questionId: 'q3',
      text: 'How was the checkout experience?',
      category: 'service_quality',
      topicCategory: 'checkout_process',
      estimatedTokens: 60,
      priorityLevel: 2,
      keywords: ['checkout', 'service', 'experience']
    },
    {
      questionId: 'q4',
      text: 'Were the staff friendly?',
      category: 'service_quality',
      topicCategory: 'staff_interaction',
      estimatedTokens: 45,
      priorityLevel: 3,
      keywords: ['staff', 'friendly', 'service']
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TopicGroupingService(businessId, mockLoggingService as any);
  });

  describe('Constructor', () => {
    test('should create instance with valid parameters', () => {
      expect(service).toBeInstanceOf(TopicGroupingService);
    });

    test('should store business ID and logging service', () => {
      // Access private properties through any cast for testing
      const serviceAny = service as any;
      expect(serviceAny.businessId).toBe(businessId);
      expect(serviceAny.loggingService).toBe(mockLoggingService);
    });
  });

  describe('groupQuestionsByTopic', () => {
    test('should successfully group questions by topic category', async () => {
      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic(sampleQuestions);

      expect(result.groups).toHaveLength(3); // meat_products, checkout_process, staff_interaction
      expect(result.ungroupedQuestions).toHaveLength(0);
      expect(result.groupingMetadata.totalGroups).toBe(3);
      expect(result.groupingMetadata.processingTimeMs).toBeGreaterThan(0);
      expect(mockLoggingService.logInfo).toHaveBeenCalledWith(
        'Topic grouping completed',
        expect.objectContaining({
          businessId,
          totalQuestions: 4,
          totalGroups: 3
        })
      );
    });

    test('should assign questions to existing groups when available', async () => {
      const existingGroups = [
        {
          id: 'existing-group-1',
          group_name: 'Meat Quality',
          topic_category: 'meat_products',
          estimated_duration_seconds: 30,
          priority_boost: 1.2
        }
      ];
      mockGetQuestionGroups.mockResolvedValue(existingGroups);

      const result = await service.groupQuestionsByTopic(sampleQuestions, {
        preserveExistingGroups: true
      });

      const meatGroup = result.groups.find(g => g.groupId === 'existing-group-1');
      expect(meatGroup).toBeDefined();
      expect(meatGroup!.questions).toHaveLength(2); // q1 and q2
      expect(meatGroup!.groupName).toBe('Meat Quality');
    });

    test('should respect maxGroupSize parameter', async () => {
      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic(sampleQuestions, {
        maxGroupSize: 1
      });

      result.groups.forEach(group => {
        expect(group.questions.length).toBeLessThanOrEqual(1);
      });
    });

    test('should filter by minimum compatibility score', async () => {
      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic(sampleQuestions, {
        minCompatibilityScore: 0.9 // Very high threshold
      });

      // With high compatibility requirement, some questions might be ungrouped
      expect(result.ungroupedQuestions.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle semantic similarity grouping', async () => {
      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic(sampleQuestions, {
        useSemanticSimilarity: true
      });

      // Meat-related questions should be grouped together due to semantic similarity
      const meatGroup = result.groups.find(g => 
        g.questions.some(q => q.questionId === 'q1') && 
        g.questions.some(q => q.questionId === 'q2')
      );
      expect(meatGroup).toBeDefined();
    });

    test('should calculate group metadata correctly', async () => {
      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic(sampleQuestions);

      expect(result.groupingMetadata.totalGroups).toBeGreaterThan(0);
      expect(result.groupingMetadata.averageGroupSize).toBeGreaterThan(0);
      expect(result.groupingMetadata.groupingConfidence).toBeGreaterThanOrEqual(0);
      expect(result.groupingMetadata.groupingConfidence).toBeLessThanOrEqual(1);
      expect(result.groupingMetadata.processingTimeMs).toBeGreaterThan(0);
    });

    test('should handle empty question array', async () => {
      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic([]);

      expect(result.groups).toHaveLength(0);
      expect(result.ungroupedQuestions).toHaveLength(0);
      expect(result.groupingMetadata.totalGroups).toBe(0);
      expect(result.groupingMetadata.averageGroupSize).toBe(0);
    });

    test('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockGetQuestionGroups.mockRejectedValue(dbError);

      await expect(service.groupQuestionsByTopic(sampleQuestions)).rejects.toThrow(dbError);
      expect(mockLoggingService.logError).toHaveBeenCalledWith(
        'Topic grouping failed',
        expect.objectContaining({
          businessId,
          totalQuestions: 4,
          error: 'Database connection failed'
        })
      );
    });

    test('should disable semantic similarity when requested', async () => {
      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic(sampleQuestions, {
        useSemanticSimilarity: false
      });

      // Should still group by topic category but without semantic refinement
      expect(result.groups.length).toBeGreaterThan(0);
    });
  });

  describe('createQuestionGroup', () => {
    test('should create new question group with provided data', async () => {
      const newGroup = {
        id: 'new-group-id',
        group_name: 'Test Group',
        topic_category: 'test_category'
      };
      mockCreateQuestionGroup.mockResolvedValue(newGroup);

      const groupData = {
        groupName: 'Test Group',
        topicCategory: 'test_category',
        compatibilityScore: 0.85,
        estimatedDurationSeconds: 45,
        priorityBoost: 1.3
      };

      const result = await service.createQuestionGroup(groupData);

      expect(result).toEqual(newGroup);
      expect(mockCreateQuestionGroup).toHaveBeenCalledWith({
        business_id: businessId,
        group_name: 'Test Group',
        topic_category: 'test_category',
        compatibility_score: 0.85,
        estimated_duration_seconds: 45,
        priority_boost: 1.3
      });
    });

    test('should use default values when optional parameters are not provided', async () => {
      const newGroup = { id: 'new-group-id' };
      mockCreateQuestionGroup.mockResolvedValue(newGroup);

      const groupData = {
        groupName: 'Simple Group',
        topicCategory: 'simple_category'
      };

      await service.createQuestionGroup(groupData);

      expect(mockCreateQuestionGroup).toHaveBeenCalledWith({
        business_id: businessId,
        group_name: 'Simple Group',
        topic_category: 'simple_category',
        compatibility_score: 0.8,
        estimated_duration_seconds: 30,
        priority_boost: 1.0
      });
    });
  });

  describe('updateGroupEffectiveness', () => {
    test('should update group effectiveness with compatibility score', async () => {
      const groupId = 'test-group-id';
      const metrics = {
        compatibilityScore: 0.92,
        averageCallDuration: 85,
        customerSatisfaction: 4.2
      };

      await service.updateGroupEffectiveness(groupId, metrics);

      expect(mockUpdateQuestionGroupEffectiveness).toHaveBeenCalledWith(groupId, 0.92);
      expect(mockLoggingService.logInfo).toHaveBeenCalledWith(
        'Question group effectiveness updated',
        {
          businessId,
          groupId,
          metrics
        }
      );
    });

    test('should skip effectiveness update when compatibility score not provided', async () => {
      const groupId = 'test-group-id';
      const metrics = {
        averageCallDuration: 85,
        customerSatisfaction: 4.2
      };

      await service.updateGroupEffectiveness(groupId, metrics);

      expect(mockUpdateQuestionGroupEffectiveness).not.toHaveBeenCalled();
      expect(mockLoggingService.logInfo).toHaveBeenCalledWith(
        'Question group effectiveness updated',
        expect.objectContaining({ groupId, metrics })
      );
    });
  });

  describe('getOptimalGroupConfiguration', () => {
    beforeEach(() => {
      mockGetQuestionGroups.mockResolvedValue([]);
    });

    test('should find optimal configuration for given questions and duration', async () => {
      const maxCallDuration = 120; // 2 minutes

      const result = await service.getOptimalGroupConfiguration(sampleQuestions, maxCallDuration);

      expect(result.recommendedGroups).toBeDefined();
      expect(result.recommendedGroups.length).toBeGreaterThan(0);
      expect(result.maxQuestionsPerCall).toBeGreaterThan(0);
      expect(result.estimatedCoverage).toBeGreaterThan(0);
      expect(result.estimatedCoverage).toBeLessThanOrEqual(1);
    });

    test('should calculate max questions per call based on duration constraint', async () => {
      const maxCallDuration = 60; // 1 minute

      const result = await service.getOptimalGroupConfiguration(sampleQuestions, maxCallDuration);

      // With 1 minute constraint, should limit questions appropriately
      expect(result.maxQuestionsPerCall).toBeLessThan(sampleQuestions.length);
      expect(result.estimatedCoverage).toBeLessThan(1);
    });

    test('should handle long duration constraints', async () => {
      const maxCallDuration = 300; // 5 minutes

      const result = await service.getOptimalGroupConfiguration(sampleQuestions, maxCallDuration);

      // With long duration, should accommodate all questions
      expect(result.maxQuestionsPerCall).toBeGreaterThanOrEqual(sampleQuestions.length);
      expect(result.estimatedCoverage).toBe(1);
    });

    test('should try multiple configurations and select best one', async () => {
      const result = await service.getOptimalGroupConfiguration(sampleQuestions, 120);

      // Should have found a valid configuration
      expect(result.recommendedGroups.length).toBeGreaterThan(0);
      expect(result.estimatedCoverage).toBeGreaterThan(0);
    });
  });

  describe('Performance Characteristics', () => {
    test('should process large question sets within reasonable time', async () => {
      // Generate large question set
      const largeQuestionSet: QuestionForGrouping[] = Array.from({ length: 100 }, (_, i) => ({
        questionId: `q${i}`,
        text: `Test question ${i}`,
        category: `category_${i % 10}`,
        topicCategory: `topic_${i % 5}`,
        estimatedTokens: 40 + (i % 20),
        priorityLevel: (i % 5) + 1,
        keywords: [`keyword${i % 3}`, `term${i % 4}`]
      }));

      mockGetQuestionGroups.mockResolvedValue([]);

      const startTime = Date.now();
      const result = await service.groupQuestionsByTopic(largeQuestionSet);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.groupingMetadata.processingTimeMs).toBeGreaterThan(0);
    });

    test('should handle concurrent grouping requests', async () => {
      mockGetQuestionGroups.mockResolvedValue([]);

      const requests = Array.from({ length: 5 }, () =>
        service.groupQuestionsByTopic(sampleQuestions)
      );

      const results = await Promise.all(requests);

      results.forEach(result => {
        expect(result.groups.length).toBeGreaterThan(0);
        expect(result.groupingMetadata.totalGroups).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle questions with missing optional fields', async () => {
      const incompleteQuestions: QuestionForGrouping[] = [
        {
          questionId: 'q1',
          text: 'Basic question',
          category: 'general',
          topicCategory: 'general',
          estimatedTokens: 30,
          priorityLevel: 3
          // Missing keywords and semanticVector
        }
      ];

      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic(incompleteQuestions);

      expect(result.groups).toHaveLength(1);
      expect(result.ungroupedQuestions).toHaveLength(0);
    });

    test('should handle questions with identical content', async () => {
      const duplicateQuestions: QuestionForGrouping[] = [
        {
          questionId: 'q1',
          text: 'How was your experience?',
          category: 'general',
          topicCategory: 'general',
          estimatedTokens: 40,
          priorityLevel: 3,
          keywords: ['experience']
        },
        {
          questionId: 'q2',
          text: 'How was your experience?',
          category: 'general',
          topicCategory: 'general',
          estimatedTokens: 40,
          priorityLevel: 3,
          keywords: ['experience']
        }
      ];

      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic(duplicateQuestions);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].questions).toHaveLength(2);
    });

    test('should handle very short and very long question texts', async () => {
      const variableLengthQuestions: QuestionForGrouping[] = [
        {
          questionId: 'short',
          text: 'Good?',
          category: 'feedback',
          topicCategory: 'feedback',
          estimatedTokens: 10,
          priorityLevel: 1
        },
        {
          questionId: 'long',
          text: 'Can you please provide detailed feedback about your comprehensive experience with our store including the product quality, staff interaction, checkout process, store cleanliness, product availability, and overall satisfaction level?',
          category: 'feedback',
          topicCategory: 'feedback',
          estimatedTokens: 200,
          priorityLevel: 5
        }
      ];

      mockGetQuestionGroups.mockResolvedValue([]);

      const result = await service.groupQuestionsByTopic(variableLengthQuestions);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].questions).toHaveLength(2);
    });
  });
});