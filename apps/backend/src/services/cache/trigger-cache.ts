import Redis from 'ioredis'
import { DynamicTrigger, TriggerCondition, TriggerActivationLog } from '@vocilia/types'
import { logger } from '../loggingService'

interface TriggerCacheEntry {
  trigger: DynamicTrigger
  conditions: TriggerCondition[]
  compiledEvaluator: string // Serialized evaluation function
  lastUpdated: number
}

interface TriggerEvaluationResult {
  triggerId: string
  triggered: boolean
  matchedConditions: string[]
  evaluationTimeMs: number
}

export class TriggerCacheService {
  private redis: Redis | null = null
  private isConnected = false
  private readonly CACHE_TTL = 900 // 15 minutes
  private readonly CACHE_KEY_PREFIX = 'vocilia:triggers:'
  private readonly EVAL_CACHE_PREFIX = 'vocilia:trigger_eval:'

  constructor() {
    this.initializeRedis()
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        lazyConnect: true
      })

      this.redis.on('connect', () => {
        this.isConnected = true
        logger.info('Redis connected for trigger caching')
      })

      this.redis.on('error', (error) => {
        this.isConnected = false
        logger.error('Redis connection error for trigger cache:', error)
      })

      await this.redis.connect()
    } catch (error) {
      logger.error('Failed to initialize Redis for trigger caching:', error)
      this.isConnected = false
    }
  }

  /**
   * Cache compiled trigger evaluation logic
   */
  async cacheTrigger(
    businessContextId: string,
    trigger: DynamicTrigger,
    conditions: TriggerCondition[]
  ): Promise<void> {
    if (!this.isConnected || !this.redis) {
      logger.warn('Redis not available, skipping trigger cache')
      return
    }

    try {
      const compiledEvaluator = this.compileTriggerEvaluator(trigger, conditions)
      const cacheEntry: TriggerCacheEntry = {
        trigger,
        conditions,
        compiledEvaluator,
        lastUpdated: Date.now()
      }

      const cacheKey = `${this.CACHE_KEY_PREFIX}${businessContextId}:${trigger.id}`
      await this.redis.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(cacheEntry)
      )

      logger.debug(`Cached trigger ${trigger.id} for business ${businessContextId}`)
    } catch (error) {
      logger.error('Failed to cache trigger:', error)
    }
  }

  /**
   * Retrieve cached trigger
   */
  async getCachedTrigger(
    businessContextId: string,
    triggerId: string
  ): Promise<TriggerCacheEntry | null> {
    if (!this.isConnected || !this.redis) {
      return null
    }

    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}${businessContextId}:${triggerId}`
      const cached = await this.redis.get(cacheKey)
      
      if (!cached) {
        return null
      }

      return JSON.parse(cached) as TriggerCacheEntry
    } catch (error) {
      logger.error('Failed to retrieve cached trigger:', error)
      return null
    }
  }

  /**
   * Evaluate triggers against customer data using cached logic
   */
  async evaluateTriggersFromCache(
    businessContextId: string,
    customerData: any,
    triggerIds: string[]
  ): Promise<TriggerEvaluationResult[]> {
    const results: TriggerEvaluationResult[] = []

    for (const triggerId of triggerIds) {
      const startTime = Date.now()
      
      try {
        const cachedTrigger = await this.getCachedTrigger(businessContextId, triggerId)
        
        if (!cachedTrigger) {
          logger.debug(`Trigger ${triggerId} not found in cache, skipping`)
          continue
        }

        const evaluationResult = this.executeTriggerEvaluation(
          cachedTrigger,
          customerData
        )

        const evaluationTimeMs = Date.now() - startTime
        
        results.push({
          triggerId,
          triggered: evaluationResult.triggered,
          matchedConditions: evaluationResult.matchedConditions,
          evaluationTimeMs
        })

        // Cache the evaluation result for a short time to avoid re-evaluation
        await this.cacheEvaluationResult(
          businessContextId,
          triggerId,
          customerData,
          evaluationResult,
          evaluationTimeMs
        )

      } catch (error) {
        logger.error(`Failed to evaluate trigger ${triggerId}:`, error)
        results.push({
          triggerId,
          triggered: false,
          matchedConditions: [],
          evaluationTimeMs: Date.now() - startTime
        })
      }
    }

    return results
  }

  /**
   * Cache evaluation results to avoid duplicate processing
   */
  private async cacheEvaluationResult(
    businessContextId: string,
    triggerId: string,
    customerData: any,
    result: { triggered: boolean; matchedConditions: string[] },
    evaluationTimeMs: number
  ): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return
    }

    try {
      // Create a hash of customer data for cache key
      const dataHash = this.hashCustomerData(customerData)
      const evalCacheKey = `${this.EVAL_CACHE_PREFIX}${businessContextId}:${triggerId}:${dataHash}`
      
      const evalResult = {
        ...result,
        evaluationTimeMs,
        cachedAt: Date.now()
      }

      // Cache for 5 minutes (evaluation results are time-sensitive)
      await this.redis.setex(evalCacheKey, 300, JSON.stringify(evalResult))
    } catch (error) {
      logger.error('Failed to cache evaluation result:', error)
    }
  }

  /**
   * Get cached evaluation result if available
   */
  async getCachedEvaluationResult(
    businessContextId: string,
    triggerId: string,
    customerData: any
  ): Promise<TriggerEvaluationResult | null> {
    if (!this.isConnected || !this.redis) {
      return null
    }

    try {
      const dataHash = this.hashCustomerData(customerData)
      const evalCacheKey = `${this.EVAL_CACHE_PREFIX}${businessContextId}:${triggerId}:${dataHash}`
      
      const cached = await this.redis.get(evalCacheKey)
      if (!cached) {
        return null
      }

      const result = JSON.parse(cached)
      return {
        triggerId,
        triggered: result.triggered,
        matchedConditions: result.matchedConditions,
        evaluationTimeMs: result.evaluationTimeMs
      }
    } catch (error) {
      logger.error('Failed to retrieve cached evaluation result:', error)
      return null
    }
  }

  /**
   * Invalidate trigger cache when trigger is updated
   */
  async invalidateTriggerCache(businessContextId: string, triggerId: string): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return
    }

    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}${businessContextId}:${triggerId}`
      await this.redis.del(cacheKey)
      
      // Also clear evaluation cache for this trigger
      const evalPattern = `${this.EVAL_CACHE_PREFIX}${businessContextId}:${triggerId}:*`
      const evalKeys = await this.redis.keys(evalPattern)
      if (evalKeys.length > 0) {
        await this.redis.del(...evalKeys)
      }

      logger.debug(`Invalidated cache for trigger ${triggerId}`)
    } catch (error) {
      logger.error('Failed to invalidate trigger cache:', error)
    }
  }

  /**
   * Clear all trigger cache for a business context
   */
  async clearBusinessCache(businessContextId: string): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return
    }

    try {
      const pattern = `${this.CACHE_KEY_PREFIX}${businessContextId}:*`
      const keys = await this.redis.keys(pattern)
      
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }

      const evalPattern = `${this.EVAL_CACHE_PREFIX}${businessContextId}:*`
      const evalKeys = await this.redis.keys(evalPattern)
      
      if (evalKeys.length > 0) {
        await this.redis.del(...evalKeys)
      }

      logger.info(`Cleared trigger cache for business ${businessContextId}`)
    } catch (error) {
      logger.error('Failed to clear business trigger cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(businessContextId: string): Promise<{
    cachedTriggers: number
    cacheHitRate: number
    averageEvaluationTime: number
  }> {
    if (!this.isConnected || !this.redis) {
      return { cachedTriggers: 0, cacheHitRate: 0, averageEvaluationTime: 0 }
    }

    try {
      const triggerPattern = `${this.CACHE_KEY_PREFIX}${businessContextId}:*`
      const triggerKeys = await this.redis.keys(triggerPattern)
      
      const evalPattern = `${this.EVAL_CACHE_PREFIX}${businessContextId}:*`
      const evalKeys = await this.redis.keys(evalPattern)

      // Calculate average evaluation time from cached results
      let totalEvalTime = 0
      let evalCount = 0

      for (const key of evalKeys) {
        try {
          const cached = await this.redis.get(key)
          if (cached) {
            const result = JSON.parse(cached)
            totalEvalTime += result.evaluationTimeMs || 0
            evalCount++
          }
        } catch (e) {
          // Skip invalid cache entries
        }
      }

      const averageEvaluationTime = evalCount > 0 ? totalEvalTime / evalCount : 0

      return {
        cachedTriggers: triggerKeys.length,
        cacheHitRate: evalCount > 0 ? Math.min(evalKeys.length / evalCount, 1) : 0,
        averageEvaluationTime: Math.round(averageEvaluationTime * 100) / 100
      }
    } catch (error) {
      logger.error('Failed to get cache stats:', error)
      return { cachedTriggers: 0, cacheHitRate: 0, averageEvaluationTime: 0 }
    }
  }

  /**
   * Compile trigger conditions into executable evaluation logic
   */
  private compileTriggerEvaluator(
    trigger: DynamicTrigger,
    conditions: TriggerCondition[]
  ): string {
    // Generate JavaScript evaluation function based on trigger type and conditions
    const conditionChecks = conditions.map((condition, index) => {
      const key = condition.condition_key
      const operator = condition.condition_operator
      const value = condition.condition_value
      const isRequired = condition.is_required

      let check: string
      switch (operator) {
        case '>=':
          check = `(data.${key} >= ${JSON.stringify(value)})`
          break
        case '<=':
          check = `(data.${key} <= ${JSON.stringify(value)})`
          break
        case '==':
          check = `(data.${key} === ${JSON.stringify(value)})`
          break
        case '!=':
          check = `(data.${key} !== ${JSON.stringify(value)})`
          break
        case 'includes':
          check = `(Array.isArray(data.${key}) && data.${key}.includes(${JSON.stringify(value)}))`
          break
        case 'between':
          const [min, max] = JSON.parse(value)
          check = `(data.${key} >= ${min} && data.${key} <= ${max})`
          break
        default:
          check = `(data.${key} === ${JSON.stringify(value)})`
      }

      return {
        check,
        conditionId: condition.id,
        isRequired
      }
    })

    // Build evaluation function
    const requiredChecks = conditionChecks.filter(c => c.isRequired)
    const optionalChecks = conditionChecks.filter(c => !c.isRequired)

    const evaluatorFunction = `
      function evaluateTrigger(data) {
        const matchedConditions = [];
        
        // Check required conditions (all must pass)
        const requiredResults = [
          ${requiredChecks.map(c => `
            (${c.check} ? (matchedConditions.push('${c.conditionId}'), true) : false)
          `).join(',\n          ')}
        ];
        
        // Check optional conditions
        const optionalResults = [
          ${optionalChecks.map(c => `
            (${c.check} ? (matchedConditions.push('${c.conditionId}'), true) : false)
          `).join(',\n          ')}
        ];
        
        const allRequiredPassed = requiredResults.length === 0 || requiredResults.every(r => r);
        const anyOptionalPassed = optionalResults.length === 0 || optionalResults.some(r => r);
        
        return {
          triggered: allRequiredPassed && anyOptionalPassed,
          matchedConditions
        };
      }
      
      return evaluateTrigger;
    `

    return evaluatorFunction
  }

  /**
   * Execute compiled trigger evaluation
   */
  private executeTriggerEvaluation(
    cachedTrigger: TriggerCacheEntry,
    customerData: any
  ): { triggered: boolean; matchedConditions: string[] } {
    try {
      // Execute the compiled evaluator function
      const evaluatorFunction = new Function('data', cachedTrigger.compiledEvaluator)
      const evaluator = evaluatorFunction(customerData)
      return evaluator
    } catch (error) {
      logger.error('Failed to execute trigger evaluation:', error)
      return { triggered: false, matchedConditions: [] }
    }
  }

  /**
   * Create a hash of customer data for caching purposes
   */
  private hashCustomerData(customerData: any): string {
    // Create a simple hash of the relevant customer data
    // This is used to cache evaluation results for identical data
    const relevantData = {
      purchase_amount: customerData.purchase_amount,
      purchase_categories: customerData.purchase_categories?.sort(),
      purchase_time: customerData.purchase_time,
      customer_tier: customerData.customer_tier,
      previous_purchases: customerData.previous_purchases_count
    }
    
    const dataString = JSON.stringify(relevantData)
    return Buffer.from(dataString).toString('base64').slice(0, 32)
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    if (!this.redis) {
      return {
        status: 'unhealthy',
        details: { error: 'Redis client not initialized' }
      }
    }

    try {
      const start = Date.now()
      await this.redis.ping()
      const latency = Date.now() - start
      
      const info = await this.redis.info('memory')
      const memoryUsage = this.parseRedisMemoryInfo(info)

      return {
        status: this.isConnected ? 'healthy' : 'unhealthy',
        details: {
          connected: this.isConnected,
          latency: `${latency}ms`,
          memoryUsage
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      }
    }
  }

  private parseRedisMemoryInfo(info: string): { used: string; peak: string } {
    const lines = info.split('\n')
    const used = lines.find(line => line.startsWith('used_memory_human:'))
      ?.split(':')[1]?.trim() || 'unknown'
    const peak = lines.find(line => line.startsWith('used_memory_peak_human:'))
      ?.split(':')[1]?.trim() || 'unknown'
    
    return { used, peak }
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
      this.isConnected = false
      logger.info('Trigger cache service shut down')
    }
  }
}

// Singleton instance
export const triggerCacheService = new TriggerCacheService()