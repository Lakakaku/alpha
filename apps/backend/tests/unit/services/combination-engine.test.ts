import { QuestionCombinationEngine } from '../../../src/services/questions/combination-engine'
import { QuestionCombinationRule, QuestionGroup, PriorityWeight } from '@vocilia/types'

describe('QuestionCombinationEngine', () => {
  let engine: QuestionCombinationEngine
  
  beforeEach(() => {
    engine = new QuestionCombinationEngine()
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(engine).toBeDefined()
      expect(engine).toBeInstanceOf(QuestionCombinationEngine)
    })
  })

  describe('selectOptimalQuestions', () => {
    const mockRule: QuestionCombinationRule = {
      id: 'rule-1',
      business_context_id: 'business-1',
      rule_name: 'Test Rule',
      max_call_duration_seconds: 120,
      priority_threshold_critical: 0,
      priority_threshold_high: 30,
      priority_threshold_medium: 60,
      priority_threshold_low: 90,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }

    const mockQuestionGroups: QuestionGroup[] = [
      {
        id: 'group-1',
        rule_id: 'rule-1',
        group_name: 'Service Quality',
        topic_category: 'service',
        estimated_tokens: 45,
        display_order: 0,
        is_active: true,
        created_at: new Date()
      },
      {
        id: 'group-2',
        rule_id: 'rule-1',
        group_name: 'Product Feedback',
        topic_category: 'product',
        estimated_tokens: 35,
        display_order: 1,
        is_active: true,
        created_at: new Date()
      }
    ]

    const mockPriorityWeights: PriorityWeight[] = [
      {
        id: 'weight-1',
        question_id: 'question-1',
        priority_level: 5,
        weight_multiplier: 1.0,
        effective_priority: 5.0,
        assigned_by: 'admin-1',
        assigned_at: new Date(),
        is_system_assigned: false
      },
      {
        id: 'weight-2',
        question_id: 'question-2',
        priority_level: 3,
        weight_multiplier: 1.2,
        effective_priority: 3.6,
        assigned_by: 'admin-1',
        assigned_at: new Date(),
        is_system_assigned: false
      }
    ]

    it('should select questions within time constraints', async () => {
      const availableQuestions = [
        { id: 'question-1', groupId: 'group-1', estimatedTokens: 25, priority: 5 },
        { id: 'question-2', groupId: 'group-2', estimatedTokens: 20, priority: 3 },
        { id: 'question-3', groupId: 'group-1', estimatedTokens: 30, priority: 4 }
      ]

      const result = await engine.selectOptimalQuestions(
        mockRule,
        mockQuestionGroups,
        mockPriorityWeights,
        availableQuestions,
        90 // remaining time
      )

      expect(result).toBeDefined()
      expect(result.selectedQuestions).toBeInstanceOf(Array)
      expect(result.estimatedDuration).toBeLessThanOrEqual(90)
      expect(result.totalTokens).toBeGreaterThan(0)
    })

    it('should prioritize high-priority questions', async () => {
      const availableQuestions = [
        { id: 'question-1', groupId: 'group-1', estimatedTokens: 25, priority: 5 },
        { id: 'question-2', groupId: 'group-2', estimatedTokens: 20, priority: 2 },
        { id: 'question-3', groupId: 'group-1', estimatedTokens: 30, priority: 1 }
      ]

      const result = await engine.selectOptimalQuestions(
        mockRule,
        mockQuestionGroups,
        mockPriorityWeights,
        availableQuestions,
        120
      )

      // First question should be the highest priority
      expect(result.selectedQuestions[0].questionId).toBe('question-1')
      expect(result.selectedQuestions[0].priority).toBe(5)
    })

    it('should handle empty question list', async () => {
      const result = await engine.selectOptimalQuestions(
        mockRule,
        mockQuestionGroups,
        mockPriorityWeights,
        [],
        120
      )

      expect(result.selectedQuestions).toHaveLength(0)
      expect(result.estimatedDuration).toBe(0)
      expect(result.totalTokens).toBe(0)
    })

    it('should respect time thresholds for priority levels', async () => {
      const availableQuestions = [
        { id: 'question-critical', groupId: 'group-1', estimatedTokens: 20, priority: 5 },
        { id: 'question-high', groupId: 'group-1', estimatedTokens: 25, priority: 4 },
        { id: 'question-medium', groupId: 'group-2', estimatedTokens: 30, priority: 3 },
        { id: 'question-low', groupId: 'group-2', estimatedTokens: 35, priority: 2 }
      ]

      // Test with only 25 seconds remaining (below high priority threshold of 30)
      const result = await engine.selectOptimalQuestions(
        mockRule,
        mockQuestionGroups,
        mockPriorityWeights,
        availableQuestions,
        25
      )

      // Should only include critical priority questions
      const includedPriorities = result.selectedQuestions.map(q => q.priority)
      expect(Math.max(...includedPriorities)).toBeLessThanOrEqual(5)
      expect(result.selectedQuestions.some(q => q.questionId === 'question-critical')).toBe(true)
    })
  })

  describe('optimizeQuestionOrder', () => {
    it('should order questions by conversation flow', async () => {
      const questions = [
        { questionId: 'q1', priority: 3, topicCategory: 'service', estimatedTokens: 20 },
        { questionId: 'q2', priority: 5, topicCategory: 'product', estimatedTokens: 25 },
        { questionId: 'q3', priority: 4, topicCategory: 'service', estimatedTokens: 30 }
      ]

      const ordered = await engine.optimizeQuestionOrder(questions)

      expect(ordered).toHaveLength(3)
      expect(ordered[0].order).toBe(1)
      expect(ordered[1].order).toBe(2)
      expect(ordered[2].order).toBe(3)
      
      // Should start with highest priority
      expect(ordered[0].priority).toBe(5)
    })

    it('should balance topic categories', async () => {
      const questions = [
        { questionId: 'q1', priority: 3, topicCategory: 'service', estimatedTokens: 20 },
        { questionId: 'q2', priority: 3, topicCategory: 'service', estimatedTokens: 25 },
        { questionId: 'q3', priority: 3, topicCategory: 'product', estimatedTokens: 30 },
        { questionId: 'q4', priority: 3, topicCategory: 'product', estimatedTokens: 35 }
      ]

      const ordered = await engine.optimizeQuestionOrder(questions)

      // Should interleave different topic categories
      const categories = ordered.map(q => q.topicCategory)
      expect(categories[0]).not.toBe(categories[1])
    })
  })

  describe('calculateEstimatedDuration', () => {
    it('should calculate duration based on tokens and question count', () => {
      const questions = [
        { estimatedTokens: 30, questionId: 'q1' },
        { estimatedTokens: 25, questionId: 'q2' },
        { estimatedTokens: 20, questionId: 'q3' }
      ]

      const duration = engine.calculateEstimatedDuration(questions as any[])

      expect(duration).toBeGreaterThan(0)
      expect(typeof duration).toBe('number')
      
      // Should account for both AI speaking time and customer response time
      expect(duration).toBeGreaterThan(questions.length * 5) // Minimum 5 seconds per question
    })

    it('should return 0 for empty question list', () => {
      const duration = engine.calculateEstimatedDuration([])
      expect(duration).toBe(0)
    })

    it('should scale with question complexity', () => {
      const simpleQuestions = [
        { estimatedTokens: 15, questionId: 'q1' },
        { estimatedTokens: 15, questionId: 'q2' }
      ]
      
      const complexQuestions = [
        { estimatedTokens: 45, questionId: 'q3' },
        { estimatedTokens: 45, questionId: 'q4' }
      ]

      const simpleDuration = engine.calculateEstimatedDuration(simpleQuestions as any[])
      const complexDuration = engine.calculateEstimatedDuration(complexQuestions as any[])

      expect(complexDuration).toBeGreaterThan(simpleDuration)
    })
  })

  describe('validateTimeConstraints', () => {
    const mockRule: QuestionCombinationRule = {
      id: 'rule-1',
      business_context_id: 'business-1',
      rule_name: 'Test Rule',
      max_call_duration_seconds: 120,
      priority_threshold_critical: 0,
      priority_threshold_high: 30,
      priority_threshold_medium: 60,
      priority_threshold_low: 90,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }

    it('should validate questions fit within time constraints', () => {
      const questions = [
        { estimatedTokens: 20, priority: 5, questionId: 'q1' },
        { estimatedTokens: 25, priority: 4, questionId: 'q2' }
      ]

      const isValid = engine.validateTimeConstraints(
        questions as any[],
        mockRule,
        90 // remaining time
      )

      expect(typeof isValid).toBe('boolean')
    })

    it('should reject questions that exceed time limit', () => {
      const questions = [
        { estimatedTokens: 60, priority: 3, questionId: 'q1' },
        { estimatedTokens: 70, priority: 2, questionId: 'q2' }
      ]

      const isValid = engine.validateTimeConstraints(
        questions as any[],
        mockRule,
        30 // very limited time
      )

      expect(isValid).toBe(false)
    })

    it('should accept empty question list', () => {
      const isValid = engine.validateTimeConstraints([], mockRule, 120)
      expect(isValid).toBe(true)
    })
  })

  describe('getOptimizationMetrics', () => {
    it('should return performance metrics', async () => {
      const metrics = await engine.getOptimizationMetrics()

      expect(metrics).toBeDefined()
      expect(typeof metrics.averageOptimizationTime).toBe('number')
      expect(typeof metrics.questionSelectionRate).toBe('number')
      expect(typeof metrics.timeConstraintViolations).toBe('number')
      expect(Array.isArray(metrics.topPerformingRules)).toBe(true)
    })

    it('should include relevant performance data', async () => {
      const metrics = await engine.getOptimizationMetrics()

      expect(metrics.averageOptimizationTime).toBeGreaterThanOrEqual(0)
      expect(metrics.questionSelectionRate).toBeGreaterThanOrEqual(0)
      expect(metrics.questionSelectionRate).toBeLessThanOrEqual(1)
      expect(metrics.timeConstraintViolations).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error handling', () => {
    it('should handle invalid rule configuration', async () => {
      const invalidRule = {
        ...mockRule,
        max_call_duration_seconds: -1 // Invalid duration
      }

      await expect(engine.selectOptimalQuestions(
        invalidRule,
        [],
        [],
        [],
        120
      )).rejects.toThrow()
    })

    it('should handle malformed question data gracefully', async () => {
      const malformedQuestions = [
        { id: 'q1' }, // Missing required fields
        { id: 'q2', estimatedTokens: 'invalid' } // Invalid data type
      ] as any

      await expect(engine.selectOptimalQuestions(
        mockRule,
        [],
        [],
        malformedQuestions,
        120
      )).rejects.toThrow()
    })
  })

  describe('performance characteristics', () => {
    it('should complete optimization within reasonable time', async () => {
      const largeQuestionSet = Array.from({ length: 100 }, (_, i) => ({
        id: `question-${i}`,
        groupId: `group-${i % 5}`,
        estimatedTokens: 20 + (i % 30),
        priority: 1 + (i % 5)
      }))

      const startTime = Date.now()
      
      await engine.selectOptimalQuestions(
        mockRule,
        mockQuestionGroups,
        mockPriorityWeights,
        largeQuestionSet,
        120
      )
      
      const optimizationTime = Date.now() - startTime
      
      // Should complete within 500ms for large dataset
      expect(optimizationTime).toBeLessThan(500)
    })

    it('should scale efficiently with question count', async () => {
      const smallSet = Array.from({ length: 10 }, (_, i) => ({
        id: `q-${i}`,
        groupId: `group-${i % 2}`,
        estimatedTokens: 25,
        priority: 3
      }))

      const largeSet = Array.from({ length: 50 }, (_, i) => ({
        id: `q-${i}`,
        groupId: `group-${i % 5}`,
        estimatedTokens: 25,
        priority: 3
      }))

      const startSmall = Date.now()
      await engine.selectOptimalQuestions(mockRule, mockQuestionGroups, mockPriorityWeights, smallSet, 120)
      const smallTime = Date.now() - startSmall

      const startLarge = Date.now()
      await engine.selectOptimalQuestions(mockRule, mockQuestionGroups, mockPriorityWeights, largeSet, 120)
      const largeTime = Date.now() - startLarge

      // Large set shouldn't take more than 5x longer than small set
      expect(largeTime).toBeLessThan(smallTime * 5)
    })
  })
})