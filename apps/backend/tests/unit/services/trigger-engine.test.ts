import { DynamicTriggerEngine } from '../../../src/services/questions/trigger-engine'
import { DynamicTrigger, TriggerCondition, TriggerActivationLog } from '@vocilia/types'

describe('DynamicTriggerEngine', () => {
  let engine: DynamicTriggerEngine

  beforeEach(() => {
    engine = new DynamicTriggerEngine()
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(engine).toBeDefined()
      expect(engine).toBeInstanceOf(DynamicTriggerEngine)
    })
  })

  describe('evaluateTrigger', () => {
    const mockTrigger: DynamicTrigger = {
      id: 'trigger-1',
      business_context_id: 'business-1',
      trigger_name: 'High Value Purchase',
      trigger_type: 'amount_based',
      priority_level: 4,
      sensitivity_threshold: 10,
      is_active: true,
      trigger_config: {
        currency: 'SEK',
        minimum_amount: 500,
        comparison_operator: '>='
      },
      effectiveness_score: 0.85,
      created_at: new Date(),
      updated_at: new Date()
    }

    const mockConditions: TriggerCondition[] = [
      {
        id: 'condition-1',
        trigger_id: 'trigger-1',
        condition_key: 'purchase_amount',
        condition_operator: '>=',
        condition_value: '500',
        is_required: true,
        created_at: new Date()
      }
    ]

    it('should evaluate amount-based trigger correctly', async () => {
      const customerData = {
        purchase_amount: 750,
        currency: 'SEK',
        customer_id: 'customer-1'
      }

      const result = await engine.evaluateTrigger(
        mockTrigger,
        mockConditions,
        customerData
      )

      expect(result.triggered).toBe(true)
      expect(result.matchedConditions).toContain('condition-1')
      expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('should not trigger when conditions not met', async () => {
      const customerData = {
        purchase_amount: 300, // Below threshold
        currency: 'SEK',
        customer_id: 'customer-1'
      }

      const result = await engine.evaluateTrigger(
        mockTrigger,
        mockConditions,
        customerData
      )

      expect(result.triggered).toBe(false)
      expect(result.matchedConditions).toHaveLength(0)
    })

    it('should handle time-based triggers', async () => {
      const timeTrigger: DynamicTrigger = {
        ...mockTrigger,
        trigger_type: 'time_based',
        trigger_config: {
          time_windows: [{
            start_time: '09:00',
            end_time: '17:00',
            days_of_week: [1, 2, 3, 4, 5] // Monday-Friday
          }]
        }
      }

      const timeConditions: TriggerCondition[] = [
        {
          id: 'condition-2',
          trigger_id: 'trigger-1',
          condition_key: 'hour_of_day',
          condition_operator: 'between',
          condition_value: '9,17',
          is_required: true,
          created_at: new Date()
        }
      ]

      const customerData = {
        hour_of_day: 14, // 2 PM
        day_of_week: 3,  // Wednesday
        customer_id: 'customer-1'
      }

      const result = await engine.evaluateTrigger(
        timeTrigger,
        timeConditions,
        customerData
      )

      expect(result.triggered).toBe(true)
    })

    it('should handle purchase-based triggers', async () => {
      const purchaseTrigger: DynamicTrigger = {
        ...mockTrigger,
        trigger_type: 'purchase_based',
        trigger_config: {
          categories: ['electronics', 'books'],
          minimum_items: 2
        }
      }

      const purchaseConditions: TriggerCondition[] = [
        {
          id: 'condition-3',
          trigger_id: 'trigger-1',
          condition_key: 'purchase_categories',
          condition_operator: 'includes',
          condition_value: 'electronics',
          is_required: true,
          created_at: new Date()
        }
      ]

      const customerData = {
        purchase_categories: ['electronics', 'accessories'],
        item_count: 3,
        customer_id: 'customer-1'
      }

      const result = await engine.evaluateTrigger(
        purchaseTrigger,
        purchaseConditions,
        customerData
      )

      expect(result.triggered).toBe(true)
    })

    it('should handle multiple conditions with AND logic', async () => {
      const multiConditions: TriggerCondition[] = [
        {
          id: 'condition-1',
          trigger_id: 'trigger-1',
          condition_key: 'purchase_amount',
          condition_operator: '>=',
          condition_value: '500',
          is_required: true,
          created_at: new Date()
        },
        {
          id: 'condition-2',
          trigger_id: 'trigger-1',
          condition_key: 'customer_tier',
          condition_operator: '==',
          condition_value: 'gold',
          is_required: true,
          created_at: new Date()
        }
      ]

      const customerData = {
        purchase_amount: 750,
        customer_tier: 'gold',
        customer_id: 'customer-1'
      }

      const result = await engine.evaluateTrigger(
        mockTrigger,
        multiConditions,
        customerData
      )

      expect(result.triggered).toBe(true)
      expect(result.matchedConditions).toHaveLength(2)
    })

    it('should handle optional conditions with OR logic', async () => {
      const mixedConditions: TriggerCondition[] = [
        {
          id: 'condition-1',
          trigger_id: 'trigger-1',
          condition_key: 'purchase_amount',
          condition_operator: '>=',
          condition_value: '500',
          is_required: true,
          created_at: new Date()
        },
        {
          id: 'condition-2',
          trigger_id: 'trigger-1',
          condition_key: 'is_vip',
          condition_operator: '==',
          condition_value: 'true',
          is_required: false, // Optional condition
          created_at: new Date()
        }
      ]

      const customerData = {
        purchase_amount: 750,
        is_vip: false,
        customer_id: 'customer-1'
      }

      const result = await engine.evaluateTrigger(
        mockTrigger,
        mixedConditions,
        customerData
      )

      expect(result.triggered).toBe(true) // Required condition met, optional doesn't matter
      expect(result.matchedConditions).toContain('condition-1')
    })
  })

  describe('evaluateMultipleTriggers', () => {
    it('should evaluate multiple triggers efficiently', async () => {
      const triggers = Array.from({ length: 5 }, (_, i) => ({
        id: `trigger-${i}`,
        business_context_id: 'business-1',
        trigger_name: `Trigger ${i}`,
        trigger_type: 'amount_based' as const,
        priority_level: i + 1,
        sensitivity_threshold: 10,
        is_active: true,
        trigger_config: { minimum_amount: i * 100 },
        effectiveness_score: 0.8,
        created_at: new Date(),
        updated_at: new Date()
      }))

      const allConditions: TriggerCondition[] = triggers.map((trigger, i) => ({
        id: `condition-${i}`,
        trigger_id: trigger.id,
        condition_key: 'purchase_amount',
        condition_operator: '>=',
        condition_value: String(i * 100),
        is_required: true,
        created_at: new Date()
      }))

      const customerData = {
        purchase_amount: 250,
        customer_id: 'customer-1'
      }

      const startTime = Date.now()
      const results = await engine.evaluateMultipleTriggers(
        triggers,
        allConditions,
        customerData
      )
      const evaluationTime = Date.now() - startTime

      expect(results).toHaveLength(5)
      expect(evaluationTime).toBeLessThan(100) // Should be fast
      
      // Should trigger for amounts <= 250
      const triggeredCount = results.filter(r => r.triggered).length
      expect(triggeredCount).toBe(3) // triggers 0, 1, 2 (thresholds 0, 100, 200)
    })

    it('should return empty array for no triggers', async () => {
      const results = await engine.evaluateMultipleTriggers([], [], {})
      expect(results).toHaveLength(0)
    })
  })

  describe('logTriggerActivation', () => {
    it('should create activation log entry', async () => {
      const mockLog: Partial<TriggerActivationLog> = {
        verification_id: 'verification-1',
        trigger_id: 'trigger-1',
        question_id: 'question-1',
        trigger_data: { purchase_amount: 500 },
        activation_timestamp: new Date(),
        call_position: 1,
        was_asked: true,
        skip_reason: null
      }

      const result = await engine.logTriggerActivation(mockLog)

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.verification_id).toBe('verification-1')
      expect(result.was_asked).toBe(true)
    })

    it('should log skip reason when question not asked', async () => {
      const mockLog: Partial<TriggerActivationLog> = {
        verification_id: 'verification-1',
        trigger_id: 'trigger-1',
        question_id: 'question-1',
        trigger_data: { purchase_amount: 500 },
        activation_timestamp: new Date(),
        call_position: 0,
        was_asked: false,
        skip_reason: 'Time constraint exceeded'
      }

      const result = await engine.logTriggerActivation(mockLog)

      expect(result.was_asked).toBe(false)
      expect(result.skip_reason).toBe('Time constraint exceeded')
    })
  })

  describe('getTriggerEffectiveness', () => {
    it('should calculate trigger effectiveness metrics', async () => {
      const effectiveness = await engine.getTriggerEffectiveness('trigger-1', {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endDate: new Date()
      })

      expect(effectiveness).toBeDefined()
      expect(typeof effectiveness.activationRate).toBe('number')
      expect(typeof effectiveness.completionRate).toBe('number')
      expect(typeof effectiveness.averageResponseQuality).toBe('number')
      expect(Array.isArray(effectiveness.topQuestions)).toBe(true)
    })

    it('should return zero metrics for non-existent trigger', async () => {
      const effectiveness = await engine.getTriggerEffectiveness('non-existent', {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date()
      })

      expect(effectiveness.activationRate).toBe(0)
      expect(effectiveness.completionRate).toBe(0)
      expect(effectiveness.averageResponseQuality).toBe(0)
    })
  })

  describe('updateTriggerEffectiveness', () => {
    it('should update effectiveness score based on performance', async () => {
      const performanceData = {
        activationRate: 0.75,
        completionRate: 0.90,
        averageResponseQuality: 4.2,
        feedbackScore: 4.0
      }

      const newScore = await engine.updateTriggerEffectiveness(
        'trigger-1',
        performanceData
      )

      expect(typeof newScore).toBe('number')
      expect(newScore).toBeGreaterThanOrEqual(0)
      expect(newScore).toBeLessThanOrEqual(1)
    })

    it('should handle poor performance with low effectiveness', async () => {
      const poorPerformance = {
        activationRate: 0.15,
        completionRate: 0.30,
        averageResponseQuality: 2.1,
        feedbackScore: 2.5
      }

      const newScore = await engine.updateTriggerEffectiveness(
        'trigger-1',
        poorPerformance
      )

      expect(newScore).toBeLessThan(0.5) // Should be low effectiveness
    })
  })

  describe('error handling', () => {
    it('should handle malformed trigger configuration', async () => {
      const invalidTrigger = {
        id: 'invalid',
        business_context_id: 'business-1',
        trigger_name: 'Invalid',
        trigger_type: 'invalid_type' as any,
        priority_level: 3,
        sensitivity_threshold: 10,
        is_active: true,
        trigger_config: null, // Invalid config
        effectiveness_score: 0.5,
        created_at: new Date(),
        updated_at: new Date()
      }

      await expect(engine.evaluateTrigger(invalidTrigger, [], {}))
        .rejects.toThrow()
    })

    it('should handle missing customer data gracefully', async () => {
      const mockTrigger: DynamicTrigger = {
        id: 'trigger-1',
        business_context_id: 'business-1',
        trigger_name: 'Test',
        trigger_type: 'amount_based',
        priority_level: 3,
        sensitivity_threshold: 10,
        is_active: true,
        trigger_config: { minimum_amount: 100 },
        effectiveness_score: 0.8,
        created_at: new Date(),
        updated_at: new Date()
      }

      const conditions: TriggerCondition[] = [{
        id: 'condition-1',
        trigger_id: 'trigger-1',
        condition_key: 'purchase_amount',
        condition_operator: '>=',
        condition_value: '100',
        is_required: true,
        created_at: new Date()
      }]

      // Missing purchase_amount in customer data
      const result = await engine.evaluateTrigger(mockTrigger, conditions, {})

      expect(result.triggered).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('performance characteristics', () => {
    it('should complete trigger evaluation within time limit', async () => {
      const complexTrigger: DynamicTrigger = {
        id: 'complex-trigger',
        business_context_id: 'business-1',
        trigger_name: 'Complex Trigger',
        trigger_type: 'amount_based',
        priority_level: 4,
        sensitivity_threshold: 10,
        is_active: true,
        trigger_config: { minimum_amount: 500 },
        effectiveness_score: 0.8,
        created_at: new Date(),
        updated_at: new Date()
      }

      const manyConditions: TriggerCondition[] = Array.from({ length: 10 }, (_, i) => ({
        id: `condition-${i}`,
        trigger_id: 'complex-trigger',
        condition_key: `field_${i}`,
        condition_operator: '==',
        condition_value: `value_${i}`,
        is_required: i < 5, // Half required, half optional
        created_at: new Date()
      }))

      const customerData = Array.from({ length: 10 }, (_, i) => ({
        [`field_${i}`]: `value_${i}`
      })).reduce((acc, cur) => ({ ...acc, ...cur }), {})

      const startTime = Date.now()
      const result = await engine.evaluateTrigger(complexTrigger, manyConditions, customerData)
      const evaluationTime = Date.now() - startTime

      expect(result).toBeDefined()
      expect(evaluationTime).toBeLessThan(50) // Should be very fast
    })
  })
})