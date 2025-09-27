import { QuestionService } from '../../src/services/questions/QuestionService';
import { Database } from '@vocilia/database';
import { mockBusiness, mockStore, mockQuestion, mockCategory, mockTrigger } from '../fixtures/questionFixtures';
import { QuestionFormData, QuestionFilters, TriggerCondition } from '@vocilia/types';

// Mock dependencies
jest.mock('@vocilia/database');
jest.mock('../../src/config/database');

const mockDatabase = Database as jest.MockedClass<typeof Database>;

describe('QuestionService', () => {
  let questionService: QuestionService;
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createQuestion', () => {
    const questionData: QuestionFormData = {
      title: 'Test Question',
      description: 'Test description',
      type: 'text',
      required: true,
      category_id: 'cat-123',
      tags: ['tag1', 'tag2'],
      position: 1,
      active: true,
      options: [],
      triggers: [],
      frequency_config: {
        enabled: false,
        window: 'daily',
        max_frequency: 1,
      },
    };

    it('should create a question successfully', async () => {
      const expectedQuestion = { ...mockQuestion, id: 'q-123' };
      mockDbInstance.questions.create.mockResolvedValue(expectedQuestion);

      const result = await questionService.createQuestion(mockBusiness.id, questionData);

      expect(mockDbInstance.questions.create).toHaveBeenCalledWith({
        ...questionData,
        business_id: mockBusiness.id,
      });
      expect(result).toEqual(expectedQuestion);
    });

    it('should validate required fields', async () => {
      const invalidData = { ...questionData, title: '' };

      await expect(questionService.createQuestion(mockBusiness.id, invalidData))
        .rejects.toThrow('Question title is required');
    });

    it('should validate question type', async () => {
      const invalidData = { ...questionData, type: 'invalid' as any };

      await expect(questionService.createQuestion(mockBusiness.id, invalidData))
        .rejects.toThrow('Invalid question type');
    });

    it('should validate multiple choice options', async () => {
      const invalidData = {
        ...questionData,
        type: 'multiple_choice' as const,
        options: [], // Empty options for multiple choice
      };

      await expect(questionService.createQuestion(mockBusiness.id, invalidData))
        .rejects.toThrow('Multiple choice questions must have at least 2 options');
    });

    it('should handle database errors', async () => {
      mockDbInstance.questions.create.mockRejectedValue(new Error('Database error'));

      await expect(questionService.createQuestion(mockBusiness.id, questionData))
        .rejects.toThrow('Database error');
    });
  });

  describe('updateQuestion', () => {
    const updateData: Partial<QuestionFormData> = {
      title: 'Updated Question',
      active: false,
    };

    it('should update a question successfully', async () => {
      const updatedQuestion = { ...mockQuestion, ...updateData };
      mockDbInstance.questions.findById.mockResolvedValue(mockQuestion);
      mockDbInstance.questions.update.mockResolvedValue(updatedQuestion);

      const result = await questionService.updateQuestion(mockQuestion.id, mockBusiness.id, updateData);

      expect(mockDbInstance.questions.update).toHaveBeenCalledWith(
        mockQuestion.id,
        updateData,
        mockBusiness.id
      );
      expect(result).toEqual(updatedQuestion);
    });

    it('should check question ownership', async () => {
      mockDbInstance.questions.findById.mockResolvedValue(null);

      await expect(questionService.updateQuestion('q-123', mockBusiness.id, updateData))
        .rejects.toThrow('Question not found or access denied');
    });

    it('should validate update data', async () => {
      mockDbInstance.questions.findById.mockResolvedValue(mockQuestion);
      const invalidUpdate = { type: 'invalid' as any };

      await expect(questionService.updateQuestion(mockQuestion.id, mockBusiness.id, invalidUpdate))
        .rejects.toThrow('Invalid question type');
    });
  });

  describe('deleteQuestion', () => {
    it('should delete a question successfully', async () => {
      mockDbInstance.questions.findById.mockResolvedValue(mockQuestion);
      mockDbInstance.questions.delete.mockResolvedValue(true);

      const result = await questionService.deleteQuestion(mockQuestion.id, mockBusiness.id);

      expect(mockDbInstance.questions.delete).toHaveBeenCalledWith(mockQuestion.id, mockBusiness.id);
      expect(result).toBe(true);
    });

    it('should check question ownership before deletion', async () => {
      mockDbInstance.questions.findById.mockResolvedValue(null);

      await expect(questionService.deleteQuestion('q-123', mockBusiness.id))
        .rejects.toThrow('Question not found or access denied');
    });

    it('should handle questions with responses', async () => {
      mockDbInstance.questions.findById.mockResolvedValue({ ...mockQuestion, has_responses: true });

      await expect(questionService.deleteQuestion(mockQuestion.id, mockBusiness.id))
        .rejects.toThrow('Cannot delete question with existing responses');
    });
  });

  describe('getQuestions', () => {
    const filters: QuestionFilters = {
      category_id: 'cat-123',
      active: true,
      search: 'test',
      tags: ['tag1'],
      type: 'text',
    };

    it('should retrieve questions with filters', async () => {
      const questions = [mockQuestion];
      mockDbInstance.questions.findByFilters.mockResolvedValue(questions);

      const result = await questionService.getQuestions(mockBusiness.id, filters);

      expect(mockDbInstance.questions.findByFilters).toHaveBeenCalledWith(mockBusiness.id, filters);
      expect(result).toEqual(questions);
    });

    it('should handle empty results', async () => {
      mockDbInstance.questions.findByFilters.mockResolvedValue([]);

      const result = await questionService.getQuestions(mockBusiness.id, {});

      expect(result).toEqual([]);
    });
  });

  describe('bulkOperations', () => {
    const questionIds = ['q-1', 'q-2', 'q-3'];

    it('should bulk update questions', async () => {
      const updates = { active: false };
      mockDbInstance.questions.bulkUpdate.mockResolvedValue(3);

      const result = await questionService.bulkUpdateQuestions(questionIds, updates, mockBusiness.id);

      expect(mockDbInstance.questions.bulkUpdate).toHaveBeenCalledWith(questionIds, updates, mockBusiness.id);
      expect(result).toBe(3);
    });

    it('should bulk delete questions', async () => {
      mockDbInstance.questions.delete.mockResolvedValue(true);

      const result = await questionService.bulkDeleteQuestions(questionIds, mockBusiness.id);

      expect(mockDbInstance.questions.delete).toHaveBeenCalledTimes(questionIds.length);
      expect(result).toBe(questionIds.length);
    });

    it('should handle partial failures in bulk operations', async () => {
      mockDbInstance.questions.delete
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(true);

      const result = await questionService.bulkDeleteQuestions(questionIds, mockBusiness.id);

      expect(result).toBe(2); // Only 2 successful deletions
    });
  });

  describe('questionAnalytics', () => {
    it('should get question analytics', async () => {
      const analytics = {
        total_questions: 10,
        active_questions: 8,
        questions_by_type: { text: 5, rating: 3 },
        avg_response_rate: 0.75,
        top_performing: [mockQuestion],
      };
      mockDbInstance.questions.getAnalytics.mockResolvedValue(analytics);

      const result = await questionService.getQuestionAnalytics(mockBusiness.id);

      expect(mockDbInstance.questions.getAnalytics).toHaveBeenCalledWith(mockBusiness.id);
      expect(result).toEqual(analytics);
    });
  });

  describe('categoryManagement', () => {
    const categoryData = {
      name: 'Test Category',
      color: '#FF5733',
      description: 'Test category description',
    };

    it('should create a category', async () => {
      const category = { ...mockCategory, id: 'cat-123' };
      mockDbInstance.categories.create.mockResolvedValue(category);

      const result = await questionService.createCategory(mockBusiness.id, categoryData);

      expect(mockDbInstance.categories.create).toHaveBeenCalledWith({
        ...categoryData,
        business_id: mockBusiness.id,
      });
      expect(result).toEqual(category);
    });

    it('should get categories with usage stats', async () => {
      const categories = [mockCategory];
      const stats = { 'cat-123': { question_count: 5, active_count: 3 } };
      
      mockDbInstance.categories.findByBusiness.mockResolvedValue(categories);
      mockDbInstance.categories.getUsageStats.mockResolvedValue(stats);

      const result = await questionService.getCategories(mockBusiness.id);

      expect(result).toEqual({
        categories,
        usage_stats: stats,
      });
    });
  });

  describe('triggerEvaluation', () => {
    const triggerConditions: TriggerCondition[] = [
      {
        type: 'time_based',
        field: 'current_time',
        operator: 'between',
        value: ['09:00', '17:00'],
      },
      {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'gte',
        value: 3,
      },
    ];

    it('should evaluate triggers successfully', async () => {
      mockDbInstance.triggers.evaluate.mockResolvedValue(true);

      const result = await questionService.evaluateTriggers(
        mockQuestion.id,
        triggerConditions,
        { store_id: mockStore.id, customer_id: 'cust-123' }
      );

      expect(mockDbInstance.triggers.evaluate).toHaveBeenCalledWith(
        mockQuestion.id,
        triggerConditions,
        { store_id: mockStore.id, customer_id: 'cust-123' }
      );
      expect(result).toBe(true);
    });

    it('should handle invalid trigger conditions', async () => {
      const invalidConditions = [
        {
          type: 'invalid' as any,
          field: 'test',
          operator: 'eq',
          value: 'test',
        },
      ];

      await expect(questionService.evaluateTriggers(mockQuestion.id, invalidConditions, {}))
        .rejects.toThrow('Invalid trigger condition type');
    });

    it('should handle trigger evaluation errors', async () => {
      mockDbInstance.triggers.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      await expect(questionService.evaluateTriggers(mockQuestion.id, triggerConditions, {}))
        .rejects.toThrow('Evaluation failed');
    });
  });

  describe('frequencyTracking', () => {
    it('should check frequency limits', async () => {
      const frequencyConfig = {
        enabled: true,
        window: 'daily' as const,
        max_frequency: 1,
      };

      mockDbInstance.query.mockResolvedValue([{ count: 0 }]);

      const result = await questionService.checkFrequencyLimit(
        mockQuestion.id,
        'cust-123',
        frequencyConfig
      );

      expect(result).toBe(true);
    });

    it('should respect frequency limits', async () => {
      const frequencyConfig = {
        enabled: true,
        window: 'daily' as const,
        max_frequency: 1,
      };

      mockDbInstance.query.mockResolvedValue([{ count: 1 }]);

      const result = await questionService.checkFrequencyLimit(
        mockQuestion.id,
        'cust-123',
        frequencyConfig
      );

      expect(result).toBe(false);
    });
  });

  describe('validation', () => {
    it('should validate question data completely', async () => {
      const validData = {
        title: 'Valid Question',
        type: 'rating' as const,
        required: true,
        options: [],
        triggers: [],
        frequency_config: { enabled: false },
      };

      expect(() => questionService.validateQuestionData(validData)).not.toThrow();
    });

    it('should validate trigger conditions', async () => {
      const validConditions: TriggerCondition[] = [
        {
          type: 'time_based',
          field: 'current_time',
          operator: 'gte',
          value: '09:00',
        },
      ];

      expect(() => questionService.validateTriggerConditions(validConditions)).not.toThrow();
    });

    it('should reject invalid operators for trigger types', async () => {
      const invalidConditions: TriggerCondition[] = [
        {
          type: 'time_based',
          field: 'current_time',
          operator: 'contains' as any, // Invalid for time_based
          value: '09:00',
        },
      ];

      expect(() => questionService.validateTriggerConditions(invalidConditions))
        .toThrow('Invalid operator for time_based trigger');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockDbInstance.questions.findByBusiness.mockRejectedValue(new Error('Network timeout'));

      await expect(questionService.getQuestions(mockBusiness.id, {}))
        .rejects.toThrow('Network timeout');
    });

    it('should handle database constraint violations', async () => {
      const error = new Error('duplicate key value violates unique constraint');
      mockDbInstance.questions.create.mockRejectedValue(error);

      await expect(questionService.createQuestion(mockBusiness.id, {
        title: 'Test',
        type: 'text',
        required: true,
        options: [],
        triggers: [],
        frequency_config: { enabled: false },
      })).rejects.toThrow('duplicate key value violates unique constraint');
    });
  });
});