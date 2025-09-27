import { FrequencyHarmonizerService } from '../../../src/services/questions/frequency-harmonizer'
import { FrequencyHarmonizer, QuestionCombinationRule } from '@vocilia/types'

describe('FrequencyHarmonizerService', () => {
  let service: FrequencyHarmonizerService

  beforeEach(() => {
    service = new FrequencyHarmonizerService()
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(FrequencyHarmonizerService)
    })
  })

  describe('resolveFrequencyConflicts', () => {
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

    const mockHarmonizers: FrequencyHarmonizer[] = [
      {
        id: 'harmonizer-1',
        rule_id: 'rule-1',
        question_pair_hash: 'q1-q2-hash',
        question_id_1: 'question-1',
        question_id_2: 'question-2',
        resolution_strategy: 'priority',
        custom_frequency: null,
        priority_question_id: 'question-1',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]

    it('should resolve conflicts using priority strategy', async () => {
      const questionCombinations = [
        {
          questionId: 'question-1',
          frequency: 'every_visit',
          priority: 5,
          lastAsked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
        },
        {
          questionId: 'question-2',
          frequency: 'every_visit',
          priority: 3,
          lastAsked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
        }
      ]

      const resolved = await service.resolveFrequencyConflicts(
        questionCombinations,
        mockHarmonizers,
        mockRule
      )

      expect(resolved).toBeDefined()
      expect(Array.isArray(resolved.resolvedQuestions)).toBe(true)
      expect(resolved.conflictsFound).toBeGreaterThan(0)
      
      // Should prioritize question-1 due to priority strategy
      const question1Resolved = resolved.resolvedQuestions.find(q => q.questionId === 'question-1')
      expect(question1Resolved?.shouldAsk).toBe(true)
    })

    it('should handle combine strategy', async () => {
      const combineHarmonizer: FrequencyHarmonizer = {
        ...mockHarmonizers[0],
        resolution_strategy: 'combine',
        priority_question_id: null
      }

      const questionCombinations = [
        {
          questionId: 'question-1',
          frequency: 'weekly',
          priority: 4,
          lastAsked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        },
        {
          questionId: 'question-2',
          frequency: 'weekly',
          priority: 4,
          lastAsked: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) // 4 days ago
        }
      ]

      const resolved = await service.resolveFrequencyConflicts(
        questionCombinations,
        [combineHarmonizer],
        mockRule
      )

      // Combine strategy should allow both questions
      const resolvedQuestions = resolved.resolvedQuestions.filter(q => q.shouldAsk)
      expect(resolvedQuestions.length).toBeGreaterThan(1)
    })

    it('should handle alternate strategy', async () => {
      const alternateHarmonizer: FrequencyHarmonizer = {
        ...mockHarmonizers[0],
        resolution_strategy: 'alternate',
        priority_question_id: null
      }

      const questionCombinations = [
        {
          questionId: 'question-1',
          frequency: 'every_visit',
          priority: 3,
          lastAsked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // Yesterday
        },
        {
          questionId: 'question-2',
          frequency: 'every_visit',
          priority: 3,
          lastAsked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
        }
      ]

      const resolved = await service.resolveFrequencyConflicts(
        questionCombinations,
        [alternateHarmonizer],
        mockRule
      )

      // Alternate strategy should pick the one asked longest ago
      const question2Resolved = resolved.resolvedQuestions.find(q => q.questionId === 'question-2')
      expect(question2Resolved?.shouldAsk).toBe(true)
      
      const question1Resolved = resolved.resolvedQuestions.find(q => q.questionId === 'question-1')
      expect(question1Resolved?.shouldAsk).toBe(false)
    })

    it('should handle custom frequency strategy', async () => {
      const customHarmonizer: FrequencyHarmonizer = {
        ...mockHarmonizers[0],
        resolution_strategy: 'custom',
        custom_frequency: 14, // 14 days
        priority_question_id: null
      }

      const questionCombinations = [
        {
          questionId: 'question-1',
          frequency: 'weekly',
          priority: 3,
          lastAsked: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
        },
        {
          questionId: 'question-2',
          frequency: 'weekly',
          priority: 3,
          lastAsked: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
        }
      ]

      const resolved = await service.resolveFrequencyConflicts(
        questionCombinations,
        [customHarmonizer],
        mockRule
      )

      // Only question-2 should be asked (15 days > 14 day custom frequency)
      const question2Resolved = resolved.resolvedQuestions.find(q => q.questionId === 'question-2')
      expect(question2Resolved?.shouldAsk).toBe(true)
      
      const question1Resolved = resolved.resolvedQuestions.find(q => q.questionId === 'question-1')
      expect(question1Resolved?.shouldAsk).toBe(false)
    })

    it('should handle questions with no conflicts', async () => {
      const questionCombinations = [
        {
          questionId: 'question-solo',
          frequency: 'every_visit',
          priority: 4,
          lastAsked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        }
      ]

      const resolved = await service.resolveFrequencyConflicts(
        questionCombinations,
        [], // No harmonizers
        mockRule
      )

      expect(resolved.conflictsFound).toBe(0)
      expect(resolved.resolvedQuestions).toHaveLength(1)
      expect(resolved.resolvedQuestions[0].shouldAsk).toBe(true)
    })
  })

  describe('detectFrequencyConflicts', () => {
    it('should detect conflicts between questions with same frequency', async () => {
      const questions = [
        { questionId: 'q1', frequency: 'every_visit', priority: 4 },
        { questionId: 'q2', frequency: 'every_visit', priority: 3 },
        { questionId: 'q3', frequency: 'weekly', priority: 4 }
      ]

      const conflicts = await service.detectFrequencyConflicts(questions as any)

      expect(conflicts).toHaveLength(1) // q1 and q2 conflict
      expect(conflicts[0]).toEqual({
        questionId1: 'q1',
        questionId2: 'q2',
        conflictType: 'same_frequency',
        frequency: 'every_visit'
      })
    })

    it('should detect conflicts between overlapping frequencies', async () => {
      const questions = [
        { questionId: 'q1', frequency: 'every_visit', priority: 4 },
        { questionId: 'q2', frequency: 'daily', priority: 3 }
      ]

      const conflicts = await service.detectFrequencyConflicts(questions as any)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('overlapping_frequency')
    })

    it('should return empty array when no conflicts exist', async () => {
      const questions = [
        { questionId: 'q1', frequency: 'daily', priority: 4 },
        { questionId: 'q2', frequency: 'weekly', priority: 3 },
        { questionId: 'q3', frequency: 'monthly', priority: 2 }
      ]

      const conflicts = await service.detectFrequencyConflicts(questions as any)

      expect(conflicts).toHaveLength(0)
    })
  })

  describe('calculateOptimalFrequency', () => {
    it('should calculate LCM for numeric frequencies', () => {
      const frequencies = [3, 7, 14] // Every 3, 7, 14 days
      const optimal = service.calculateOptimalFrequency(frequencies)

      expect(optimal).toBe(42) // LCM of 3, 7, 14
    })

    it('should handle single frequency', () => {
      const optimal = service.calculateOptimalFrequency([7])
      expect(optimal).toBe(7)
    })

    it('should return reasonable default for empty input', () => {
      const optimal = service.calculateOptimalFrequency([])
      expect(optimal).toBeGreaterThan(0)
    })

    it('should handle large frequencies efficiently', () => {
      const frequencies = [30, 45, 60] // Monthly-like frequencies
      const optimal = service.calculateOptimalFrequency(frequencies)

      expect(optimal).toBeGreaterThan(0)
      expect(optimal).toBeLessThan(1000) // Reasonable upper bound
    })
  })

  describe('generateHarmonizerRecommendations', () => {
    it('should recommend harmonizers for detected conflicts', async () => {
      const businessContextId = 'business-1'
      const conflictingQuestions = [
        { questionId: 'q1', frequency: 'every_visit', priority: 5, topicCategory: 'service' },
        { questionId: 'q2', frequency: 'every_visit', priority: 3, topicCategory: 'service' }
      ]

      const recommendations = await service.generateHarmonizerRecommendations(
        businessContextId,
        conflictingQuestions as any
      )

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].recommendedStrategy).toBeDefined()
      expect(recommendations[0].reasoning).toBeDefined()
      expect(['priority', 'combine', 'alternate', 'custom']).toContain(
        recommendations[0].recommendedStrategy
      )
    })

    it('should prioritize by question priority in recommendations', async () => {
      const businessContextId = 'business-1'
      const conflictingQuestions = [
        { questionId: 'q1', frequency: 'daily', priority: 5, topicCategory: 'service' },
        { questionId: 'q2', frequency: 'daily', priority: 2, topicCategory: 'product' }
      ]

      const recommendations = await service.generateHarmonizerRecommendations(
        businessContextId,
        conflictingQuestions as any
      )

      expect(recommendations[0].recommendedStrategy).toBe('priority')
      expect(recommendations[0].priorityQuestionId).toBe('q1')
    })

    it('should suggest combine for similar priority questions', async () => {
      const businessContextId = 'business-1'
      const conflictingQuestions = [
        { questionId: 'q1', frequency: 'weekly', priority: 4, topicCategory: 'service' },
        { questionId: 'q2', frequency: 'weekly', priority: 4, topicCategory: 'service' }
      ]

      const recommendations = await service.generateHarmonizerRecommendations(
        businessContextId,
        conflictingQuestions as any
      )

      expect(recommendations[0].recommendedStrategy).toBe('combine')
    })
  })

  describe('getHarmonizerEffectiveness', () => {
    it('should calculate effectiveness metrics for harmonizers', async () => {
      const harmonizerId = 'harmonizer-1'
      const dateRange = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date()
      }

      const effectiveness = await service.getHarmonizerEffectiveness(harmonizerId, dateRange)

      expect(effectiveness).toBeDefined()
      expect(typeof effectiveness.conflictResolutionRate).toBe('number')
      expect(typeof effectiveness.customerSatisfactionImpact).toBe('number')
      expect(typeof effectiveness.questionCompletionRate).toBe('number')
      expect(Array.isArray(effectiveness.topResolvedConflicts)).toBe(true)
    })

    it('should return zero metrics for non-existent harmonizer', async () => {
      const effectiveness = await service.getHarmonizerEffectiveness('non-existent', {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      })

      expect(effectiveness.conflictResolutionRate).toBe(0)
      expect(effectiveness.customerSatisfactionImpact).toBe(0)
      expect(effectiveness.questionCompletionRate).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should handle invalid frequency values gracefully', async () => {
      const invalidQuestions = [
        { questionId: 'q1', frequency: 'invalid_frequency', priority: 4 },
        { questionId: 'q2', frequency: 'every_visit', priority: 3 }
      ]

      const conflicts = await service.detectFrequencyConflicts(invalidQuestions as any)
      
      // Should handle gracefully and not crash
      expect(Array.isArray(conflicts)).toBe(true)
    })

    it('should handle null/undefined harmonizer configurations', async () => {
      const questionCombinations = [
        {
          questionId: 'question-1',
          frequency: 'every_visit',
          priority: 4,
          lastAsked: new Date()
        }
      ]

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

      await expect(service.resolveFrequencyConflicts(
        questionCombinations,
        null as any, // Invalid harmonizers
        mockRule
      )).rejects.toThrow()
    })
  })

  describe('performance characteristics', () => {
    it('should handle large numbers of questions efficiently', async () => {
      const manyQuestions = Array.from({ length: 100 }, (_, i) => ({
        questionId: `question-${i}`,
        frequency: i % 2 === 0 ? 'every_visit' : 'weekly',
        priority: (i % 5) + 1,
        lastAsked: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      }))

      const startTime = Date.now()
      const conflicts = await service.detectFrequencyConflicts(manyQuestions as any)
      const detectionTime = Date.now() - startTime

      expect(detectionTime).toBeLessThan(200) // Should be fast
      expect(Array.isArray(conflicts)).toBe(true)
    })

    it('should resolve conflicts efficiently with many harmonizers', async () => {
      const questions = Array.from({ length: 20 }, (_, i) => ({
        questionId: `question-${i}`,
        frequency: 'every_visit',
        priority: (i % 5) + 1,
        lastAsked: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      }))

      const harmonizers = Array.from({ length: 50 }, (_, i) => ({
        id: `harmonizer-${i}`,
        rule_id: 'rule-1',
        question_pair_hash: `hash-${i}`,
        question_id_1: `question-${i % 10}`,
        question_id_2: `question-${(i + 1) % 10}`,
        resolution_strategy: 'priority' as const,
        custom_frequency: null,
        priority_question_id: `question-${i % 10}`,
        created_at: new Date(),
        updated_at: new Date()
      }))

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

      const startTime = Date.now()
      const resolved = await service.resolveFrequencyConflicts(questions, harmonizers, mockRule)
      const resolutionTime = Date.now() - startTime

      expect(resolutionTime).toBeLessThan(500) // Should be reasonably fast
      expect(resolved).toBeDefined()
    })
  })
})