// Jest globals are available globally
import { QuestionSelector } from '../../../src/services/calls/QuestionSelector';

// Mock the database
jest.mock('../../../src/config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: [],
              error: null
            }))
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {},
            error: null
          }))
        }))
      }))
    }))
  }
}));

describe('QuestionSelector', () => {
  let questionSelector: QuestionSelector;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    questionSelector = new QuestionSelector();
    mockSupabase = require('../../../src/config/database').supabase;
  });

  describe('selectQuestions', () => {
    const mockBusinessId = '550e8400-e29b-41d4-a716-446655440000';

    it('should select questions based on frequency algorithm', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          question_text: 'Hur var din upplevelse av vår service?',
          frequency: 2,
          priority: 'high',
          max_response_time: 30,
          department_tags: ['service']
        },
        {
          id: 'q2',
          question_text: 'Vad tycker du om våra öppettider?',
          frequency: 5,
          priority: 'medium',
          max_response_time: 25,
          department_tags: ['operations']
        },
        {
          id: 'q3',
          question_text: 'Hur var vårt produktsortiment?',
          frequency: 3,
          priority: 'low',
          max_response_time: 35,
          department_tags: ['products']
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: mockQuestions,
                error: null
              }))
            }))
          }))
        }))
      });

      const result = await questionSelector.selectQuestions({
        businessId: mockBusinessId,
        customerCount: 6, // Should trigger frequency 2 and 3
        timeBudgetSeconds: 90
      });

      expect(result.selectedQuestions).toHaveLength(2);
      expect(result.selectedQuestions[0].id).toBe('q1'); // High priority first
      expect(result.selectedQuestions[1].id).toBe('q3'); // Then frequency 3
      expect(result.estimatedDuration).toBeLessThanOrEqual(90);
    });

    it('should respect time budget constraints', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          question_text: 'Long question that takes time?',
          frequency: 1, // Every customer
          priority: 'high',
          max_response_time: 45,
          department_tags: ['service']
        },
        {
          id: 'q2',
          question_text: 'Another long question?',
          frequency: 1,
          priority: 'medium',
          max_response_time: 40,
          department_tags: ['operations']
        },
        {
          id: 'q3',
          question_text: 'Third question?',
          frequency: 1,
          priority: 'low',
          max_response_time: 30,
          department_tags: ['products']
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: mockQuestions,
                error: null
              }))
            }))
          }))
        }))
      });

      const result = await questionSelector.selectQuestions({
        businessId: mockBusinessId,
        customerCount: 1, // All questions eligible
        timeBudgetSeconds: 60 // Tight budget
      });

      // Should only select high priority question that fits in budget
      expect(result.selectedQuestions).toHaveLength(1);
      expect(result.selectedQuestions[0].priority).toBe('high');
      expect(result.estimatedDuration).toBeLessThanOrEqual(60);
    });

    it('should prioritize questions correctly', async () => {
      const mockQuestions = [
        {
          id: 'q_low',
          question_text: 'Low priority question?',
          frequency: 1,
          priority: 'low',
          max_response_time: 20,
          department_tags: ['misc']
        },
        {
          id: 'q_high',
          question_text: 'High priority question?',
          frequency: 1,
          priority: 'high',
          max_response_time: 25,
          department_tags: ['service']
        },
        {
          id: 'q_medium',
          question_text: 'Medium priority question?',
          frequency: 1,
          priority: 'medium',
          max_response_time: 22,
          department_tags: ['operations']
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: mockQuestions,
                error: null
              }))
            }))
          }))
        }))
      });

      const result = await questionSelector.selectQuestions({
        businessId: mockBusinessId,
        customerCount: 1,
        timeBudgetSeconds: 120
      });

      // Should be ordered: high → medium → low
      expect(result.selectedQuestions[0].priority).toBe('high');
      expect(result.selectedQuestions[1].priority).toBe('medium');
      expect(result.selectedQuestions[2].priority).toBe('low');
    });

    it('should handle frequency-based selection correctly', async () => {
      const mockQuestions = [
        {
          id: 'q_freq_2',
          question_text: 'Every 2nd customer?',
          frequency: 2,
          priority: 'medium',
          max_response_time: 30,
          department_tags: ['service']
        },
        {
          id: 'q_freq_5',
          question_text: 'Every 5th customer?',
          frequency: 5,
          priority: 'medium',
          max_response_time: 30,
          department_tags: ['operations']
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: mockQuestions,
                error: null
              }))
            }))
          }))
        }))
      });

      // Test customer 10: should trigger both frequency 2 and 5
      const result = await questionSelector.selectQuestions({
        businessId: mockBusinessId,
        customerCount: 10,
        timeBudgetSeconds: 90
      });

      expect(result.selectedQuestions).toHaveLength(2);

      // Test customer 3: should only trigger frequency 2 (not 5)
      const result2 = await questionSelector.selectQuestions({
        businessId: mockBusinessId,
        customerCount: 3,
        timeBudgetSeconds: 90
      });

      expect(result2.selectedQuestions).toHaveLength(0); // 3 doesn't divide by 2
    });

    it('should create selection log entry', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          question_text: 'Test question?',
          frequency: 1,
          priority: 'medium',
          max_response_time: 30,
          department_tags: ['test']
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: mockQuestions,
                error: null
              }))
            }))
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { id: 'log-123' },
              error: null
            }))
          }))
        }))
      });

      await questionSelector.selectQuestions({
        businessId: mockBusinessId,
        customerCount: 1,
        timeBudgetSeconds: 90
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('question_selection_logs');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: mockBusinessId,
          customer_count: 1,
          time_budget_seconds: 90,
          selected_questions: ['q1']
        })
      );
    });

    it('should handle no available questions', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      });

      const result = await questionSelector.selectQuestions({
        businessId: mockBusinessId,
        customerCount: 1,
        timeBudgetSeconds: 90
      });

      expect(result.selectedQuestions).toHaveLength(0);
      expect(result.estimatedDuration).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: null,
                error: new Error('Database connection failed')
              }))
            }))
          }))
        }))
      });

      await expect(
        questionSelector.selectQuestions({
          businessId: mockBusinessId,
          customerCount: 1,
          timeBudgetSeconds: 90
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should validate input parameters', async () => {
      await expect(
        questionSelector.selectQuestions({
          businessId: 'invalid-uuid',
          customerCount: 1,
          timeBudgetSeconds: 90
        })
      ).rejects.toThrow('Invalid business ID format');

      await expect(
        questionSelector.selectQuestions({
          businessId: mockBusinessId,
          customerCount: 0,
          timeBudgetSeconds: 90
        })
      ).rejects.toThrow('Customer count must be positive');

      await expect(
        questionSelector.selectQuestions({
          businessId: mockBusinessId,
          customerCount: 1,
          timeBudgetSeconds: 30
        })
      ).rejects.toThrow('Time budget must be between 60 and 120 seconds');
    });
  });

  describe('calculateEstimatedDuration', () => {
    it('should estimate duration based on question complexity', () => {
      const questions = [
        {
          id: 'q1',
          questionText: 'Simple question?',
          maxResponseTime: 20,
          priority: 'high'
        },
        {
          id: 'q2',
          questionText: 'More complex question with multiple parts?',
          maxResponseTime: 35,
          priority: 'medium'
        }
      ];

      const duration = questionSelector.calculateEstimatedDuration(questions);

      // Should include question time + response time + AI processing overhead
      expect(duration).toBeGreaterThan(55); // 20 + 35
      expect(duration).toBeLessThan(75); // With reasonable overhead
    });

    it('should handle empty question list', () => {
      const duration = questionSelector.calculateEstimatedDuration([]);
      expect(duration).toBe(0);
    });
  });

  describe('frequency algorithm', () => {
    it('should correctly determine if customer number triggers frequency', () => {
      // Test frequency 2
      expect(questionSelector.isFrequencyTriggered(2, 2)).toBe(true);
      expect(questionSelector.isFrequencyTriggered(4, 2)).toBe(true);
      expect(questionSelector.isFrequencyTriggered(6, 2)).toBe(true);
      expect(questionSelector.isFrequencyTriggered(1, 2)).toBe(false);
      expect(questionSelector.isFrequencyTriggered(3, 2)).toBe(false);

      // Test frequency 5
      expect(questionSelector.isFrequencyTriggered(5, 5)).toBe(true);
      expect(questionSelector.isFrequencyTriggered(10, 5)).toBe(true);
      expect(questionSelector.isFrequencyTriggered(15, 5)).toBe(true);
      expect(questionSelector.isFrequencyTriggered(4, 5)).toBe(false);
      expect(questionSelector.isFrequencyTriggered(6, 5)).toBe(false);
    });
  });

  describe('context awareness', () => {
    it('should group related questions when possible', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          question_text: 'Service question?',
          frequency: 1,
          priority: 'high',
          max_response_time: 25,
          department_tags: ['service', 'quality']
        },
        {
          id: 'q2',
          question_text: 'Another service question?',
          frequency: 1,
          priority: 'medium',
          max_response_time: 25,
          department_tags: ['service', 'staff']
        },
        {
          id: 'q3',
          question_text: 'Product question?',
          frequency: 1,
          priority: 'medium',
          max_response_time: 25,
          department_tags: ['products']
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: mockQuestions,
                error: null
              }))
            }))
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { id: 'log-123' },
              error: null
            }))
          }))
        }))
      });

      const result = await questionSelector.selectQuestions({
        businessId: mockBusinessId,
        customerCount: 1,
        timeBudgetSeconds: 90,
        customerContext: {
          lastVisitDepartments: ['service']
        }
      });

      // Should prioritize service-related questions
      const serviceQuestions = result.selectedQuestions.filter(q => 
        q.questionText?.includes('service') || q.questionText?.includes('Service')
      );
      expect(serviceQuestions.length).toBeGreaterThan(0);
    });
  });
});