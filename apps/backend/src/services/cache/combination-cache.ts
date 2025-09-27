import Redis from 'ioredis'
import { QuestionGroup, QuestionCombinationRule, PriorityWeight } from '@vocilia/types'
import { logger } from '../loggingService'

interface OptimizedCombination {
  questions: Array<{
    questionId: string
    priority: number
    estimatedTokens: number
    topicCategory: string
    order: number
  }>
  estimatedDuration: number
  totalTokens: number
  priorityScore: number
  groupBalance: Record<string, number> // topic category distribution
  cacheKey: string
  generatedAt: number
  ttl: number
}

interface CombinationRequest {
  businessContextId: string
  maxDurationSeconds: number
  availableQuestions: string[]
  priorityWeights: Record<string, number>
  topicPreferences?: Record<string, number>
  excludeQuestions?: string[]
}

interface CacheMetrics {
  hits: number
  misses: number
  evictions: number
  totalRequests: number
  averageResponseTime: number
  cacheSize: number
}

export class CombinationCacheService {
  private redis: Redis | null = null
  private isConnected = false
  private readonly CACHE_TTL = 3600 // 1 hour
  private readonly CACHE_KEY_PREFIX = 'vocilia:combinations:'
  private readonly METRICS_KEY = 'vocilia:combination_metrics'
  private readonly MAX_CACHE_SIZE = 10000 // Maximum cached combinations
  private localMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    cacheSize: 0
  }

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
        logger.info('Redis connected for combination caching')
      })

      this.redis.on('error', (error) => {
        this.isConnected = false
        logger.error('Redis connection error for combination cache:', error)
      })

      await this.redis.connect()
    } catch (error) {
      logger.error('Failed to initialize Redis for combination caching:', error)
      this.isConnected = false
    }
  }

  /**
   * Get optimized question combination from cache or compute it
   */
  async getOptimizedCombination(
    request: CombinationRequest
  ): Promise<OptimizedCombination> {
    const startTime = Date.now()
    this.localMetrics.totalRequests++

    try {
      const cacheKey = this.generateCacheKey(request)
      
      // Try to get from cache first
      const cached = await this.getCachedCombination(cacheKey)
      
      if (cached) {
        this.localMetrics.hits++
        this.recordResponseTime(Date.now() - startTime)
        logger.debug(`Cache hit for combination: ${cacheKey}`)
        return cached
      }

      // Cache miss - compute optimization
      this.localMetrics.misses++
      logger.debug(`Cache miss for combination: ${cacheKey}`)

      const optimizedCombination = await this.computeOptimization(request, cacheKey)
      
      // Cache the result
      await this.cacheCombination(cacheKey, optimizedCombination)
      
      this.recordResponseTime(Date.now() - startTime)
      return optimizedCombination

    } catch (error) {
      logger.error('Failed to get optimized combination:', error)
      throw error
    }
  }

  /**
   * Get cached combination
   */
  private async getCachedCombination(cacheKey: string): Promise<OptimizedCombination | null> {
    if (!this.isConnected || !this.redis) {
      return null
    }

    try {
      const cached = await this.redis.get(`${this.CACHE_KEY_PREFIX}${cacheKey}`)
      
      if (!cached) {
        return null
      }

      const combination: OptimizedCombination = JSON.parse(cached)
      
      // Check if still valid
      if (Date.now() - combination.generatedAt > combination.ttl * 1000) {
        await this.redis.del(`${this.CACHE_KEY_PREFIX}${cacheKey}`)
        return null
      }

      return combination
    } catch (error) {
      logger.error('Failed to retrieve cached combination:', error)
      return null
    }
  }

  /**
   * Cache computed combination
   */
  private async cacheCombination(
    cacheKey: string,
    combination: OptimizedCombination
  ): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return
    }

    try {
      // Check cache size and evict if necessary
      await this.enforceMaxCacheSize()

      const fullCacheKey = `${this.CACHE_KEY_PREFIX}${cacheKey}`
      await this.redis.setex(
        fullCacheKey,
        this.CACHE_TTL,
        JSON.stringify(combination)
      )

      this.localMetrics.cacheSize++
      logger.debug(`Cached combination: ${cacheKey}`)
    } catch (error) {
      logger.error('Failed to cache combination:', error)
    }
  }

  /**
   * Compute optimal question combination
   */
  private async computeOptimization(
    request: CombinationRequest,
    cacheKey: string
  ): Promise<OptimizedCombination> {
    const {
      businessContextId,
      maxDurationSeconds,
      availableQuestions,
      priorityWeights,
      topicPreferences = {},
      excludeQuestions = []
    } = request

    // Filter out excluded questions
    const candidateQuestions = availableQuestions.filter(
      questionId => !excludeQuestions.includes(questionId)
    )

    // Mock question data (in real implementation, this would come from database)
    const questionData = await this.fetchQuestionData(candidateQuestions)

    // Apply optimization algorithm
    const optimizedQuestions = this.optimizeQuestionSelection(
      questionData,
      maxDurationSeconds,
      priorityWeights,
      topicPreferences
    )

    const totalTokens = optimizedQuestions.reduce((sum, q) => sum + q.estimatedTokens, 0)
    const estimatedDuration = this.calculateEstimatedDuration(totalTokens, optimizedQuestions.length)
    const priorityScore = this.calculatePriorityScore(optimizedQuestions, priorityWeights)
    const groupBalance = this.calculateGroupBalance(optimizedQuestions)

    return {
      questions: optimizedQuestions,
      estimatedDuration,
      totalTokens,
      priorityScore,
      groupBalance,
      cacheKey,
      generatedAt: Date.now(),
      ttl: this.CACHE_TTL
    }
  }

  /**
   * Optimization algorithm for question selection
   */
  private optimizeQuestionSelection(
    questions: Array<{
      questionId: string
      priority: number
      estimatedTokens: number
      topicCategory: string
    }>,
    maxDurationSeconds: number,
    priorityWeights: Record<string, number>,
    topicPreferences: Record<string, number>
  ): Array<{
    questionId: string
    priority: number
    estimatedTokens: number
    topicCategory: string
    order: number
  }> {
    // Calculate maximum tokens based on duration
    const maxTokens = this.durationToTokens(maxDurationSeconds)
    
    // Score each question
    const scoredQuestions = questions.map(question => {
      const priorityScore = priorityWeights[question.questionId] || question.priority
      const topicScore = topicPreferences[question.topicCategory] || 1.0
      const tokenEfficiency = 1 / (question.estimatedTokens / 10) // Prefer shorter questions slightly
      
      const totalScore = priorityScore * topicScore * tokenEfficiency
      
      return {
        ...question,
        score: totalScore
      }
    })

    // Sort by score descending
    scoredQuestions.sort((a, b) => b.score - a.score)

    // Greedy selection with constraints
    const selected: Array<{
      questionId: string
      priority: number
      estimatedTokens: number
      topicCategory: string
      order: number
    }> = []
    
    let remainingTokens = maxTokens
    let currentOrder = 1
    const topicCounts: Record<string, number> = {}

    for (const question of scoredQuestions) {
      // Check token constraint
      if (question.estimatedTokens > remainingTokens) {
        continue
      }

      // Check topic balance (max 60% of questions from same topic)
      const currentTopicCount = topicCounts[question.topicCategory] || 0
      const maxTopicQuestions = Math.ceil(selected.length * 0.6)
      
      if (currentTopicCount >= maxTopicQuestions && selected.length > 2) {
        continue
      }

      // Add question
      selected.push({
        questionId: question.questionId,
        priority: question.priority,
        estimatedTokens: question.estimatedTokens,
        topicCategory: question.topicCategory,
        order: currentOrder++
      })

      remainingTokens -= question.estimatedTokens
      topicCounts[question.topicCategory] = currentTopicCount + 1

      // Stop if we have enough questions or very little time left
      if (selected.length >= 20 || remainingTokens < 15) {
        break
      }
    }

    // Re-order by priority for conversation flow
    return this.optimizeConversationOrder(selected)
  }

  /**
   * Optimize order of questions for better conversation flow
   */
  private optimizeConversationOrder(
    questions: Array<{
      questionId: string
      priority: number
      estimatedTokens: number
      topicCategory: string
      order: number
    }>
  ): Array<{
    questionId: string
    priority: number
    estimatedTokens: number
    topicCategory: string
    order: number
  }> {
    // Group by topic category
    const topicGroups: Record<string, typeof questions> = {}
    
    questions.forEach(question => {
      if (!topicGroups[question.topicCategory]) {
        topicGroups[question.topicCategory] = []
      }
      topicGroups[question.topicCategory].push(question)
    })

    // Interleave topics for better flow
    const optimizedOrder: typeof questions = []
    const topicKeys = Object.keys(topicGroups)
    let maxLength = Math.max(...Object.values(topicGroups).map(group => group.length))
    
    for (let i = 0; i < maxLength; i++) {
      for (const topic of topicKeys) {
        if (topicGroups[topic][i]) {
          optimizedOrder.push({
            ...topicGroups[topic][i],
            order: optimizedOrder.length + 1
          })
        }
      }
    }

    return optimizedOrder
  }

  /**
   * Calculate estimated call duration from tokens and question count
   */
  private calculateEstimatedDuration(totalTokens: number, questionCount: number): number {
    // Base calculation: tokens to words to speaking time
    const words = totalTokens * 0.75
    const speakingTime = (words / 150) * 60 // 150 words per minute
    
    // Add time for customer responses and AI processing
    const interactionTime = questionCount * 8 // 8 seconds per question for response
    const processingTime = questionCount * 2 // 2 seconds per question for AI processing
    
    return Math.ceil(speakingTime + interactionTime + processingTime)
  }

  /**
   * Calculate overall priority score for the combination
   */
  private calculatePriorityScore(
    questions: Array<{ priority: number; estimatedTokens: number }>,
    priorityWeights: Record<string, number>
  ): number {
    const totalWeightedPriority = questions.reduce((sum, question) => {
      const weight = priorityWeights[question.questionId] || 1.0
      return sum + (question.priority * weight)
    }, 0)
    
    return questions.length > 0 ? totalWeightedPriority / questions.length : 0
  }

  /**
   * Calculate topic distribution balance
   */
  private calculateGroupBalance(
    questions: Array<{ topicCategory: string }>
  ): Record<string, number> {
    const balance: Record<string, number> = {}
    const total = questions.length
    
    questions.forEach(question => {
      balance[question.topicCategory] = (balance[question.topicCategory] || 0) + 1
    })
    
    // Convert to percentages
    Object.keys(balance).forEach(topic => {
      balance[topic] = Math.round((balance[topic] / total) * 100) / 100
    })
    
    return balance
  }

  /**
   * Convert duration to estimated token budget
   */
  private durationToTokens(durationSeconds: number): number {
    // Rough estimation: 
    // - Speaking rate: ~150 words/minute
    // - Token/word ratio: ~1.3 tokens per word
    // - Account for customer responses and processing time
    
    const availableSpeakingTime = durationSeconds * 0.6 // 60% for questions
    const words = (availableSpeakingTime / 60) * 150
    return Math.floor(words * 1.3)
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: CombinationRequest): string {
    const keyComponents = [
      request.businessContextId,
      request.maxDurationSeconds,
      request.availableQuestions.sort().join(','),
      JSON.stringify(request.priorityWeights),
      JSON.stringify(request.topicPreferences || {}),
      JSON.stringify(request.excludeQuestions?.sort() || [])
    ]
    
    const keyString = keyComponents.join('|')
    return Buffer.from(keyString).toString('base64').slice(0, 32)
  }

  /**
   * Fetch question data from database (mock implementation)
   */
  private async fetchQuestionData(
    questionIds: string[]
  ): Promise<Array<{
    questionId: string
    priority: number
    estimatedTokens: number
    topicCategory: string
  }>> {
    // Mock data - in real implementation, this would be a database query
    return questionIds.map(id => ({
      questionId: id,
      priority: Math.floor(Math.random() * 5) + 1,
      estimatedTokens: Math.floor(Math.random() * 40) + 20,
      topicCategory: ['service', 'product', 'experience', 'recommendation'][
        Math.floor(Math.random() * 4)
      ]
    }))
  }

  /**
   * Enforce maximum cache size by evicting oldest entries
   */
  private async enforceMaxCacheSize(): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return
    }

    try {
      const pattern = `${this.CACHE_KEY_PREFIX}*`
      const keys = await this.redis.keys(pattern)
      
      if (keys.length >= this.MAX_CACHE_SIZE) {
        // Get creation times and sort by oldest first
        const keyTimes: Array<{ key: string; time: number }> = []
        
        for (const key of keys) {
          try {
            const data = await this.redis.get(key)
            if (data) {
              const combination: OptimizedCombination = JSON.parse(data)
              keyTimes.push({ key, time: combination.generatedAt })
            }
          } catch (e) {
            // Invalid entry, mark for deletion
            keyTimes.push({ key, time: 0 })
          }
        }
        
        keyTimes.sort((a, b) => a.time - b.time)
        
        // Delete oldest 20% of entries
        const deleteCount = Math.floor(keys.length * 0.2)
        const keysToDelete = keyTimes.slice(0, deleteCount).map(item => item.key)
        
        if (keysToDelete.length > 0) {
          await this.redis.del(...keysToDelete)
          this.localMetrics.evictions += keysToDelete.length
          this.localMetrics.cacheSize -= keysToDelete.length
          logger.info(`Evicted ${keysToDelete.length} old combination cache entries`)
        }
      }
    } catch (error) {
      logger.error('Failed to enforce cache size limit:', error)
    }
  }

  /**
   * Invalidate cache entries for a business context
   */
  async invalidateBusinessCache(businessContextId: string): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return
    }

    try {
      const pattern = `${this.CACHE_KEY_PREFIX}*`
      const keys = await this.redis.keys(pattern)
      
      const keysToDelete: string[] = []
      
      for (const key of keys) {
        try {
          const data = await this.redis.get(key)
          if (data) {
            const combination: OptimizedCombination = JSON.parse(data)
            // Check if this combination was generated for the business
            if (combination.cacheKey.includes(businessContextId)) {
              keysToDelete.push(key)
            }
          }
        } catch (e) {
          // Invalid entry, delete it
          keysToDelete.push(key)
        }
      }
      
      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete)
        this.localMetrics.cacheSize -= keysToDelete.length
        logger.info(`Invalidated ${keysToDelete.length} combination cache entries for business ${businessContextId}`)
      }
    } catch (error) {
      logger.error('Failed to invalidate business combination cache:', error)
    }
  }

  /**
   * Record response time for metrics
   */
  private recordResponseTime(responseTimeMs: number): void {
    const totalTime = this.localMetrics.averageResponseTime * (this.localMetrics.totalRequests - 1)
    this.localMetrics.averageResponseTime = (totalTime + responseTimeMs) / this.localMetrics.totalRequests
  }

  /**
   * Get cache performance metrics
   */
  async getMetrics(): Promise<CacheMetrics & { hitRate: number; missRate: number }> {
    let redisMetrics = {}
    
    if (this.isConnected && this.redis) {
      try {
        const info = await this.redis.info('stats')
        const keyspaceInfo = await this.redis.info('keyspace')
        
        redisMetrics = {
          redisHits: this.parseRedisStatValue(info, 'keyspace_hits'),
          redisMisses: this.parseRedisStatValue(info, 'keyspace_misses'),
          totalKeys: this.parseKeyspaceValue(keyspaceInfo, 'db0'),
        }
      } catch (error) {
        logger.error('Failed to get Redis metrics:', error)
      }
    }

    const hitRate = this.localMetrics.totalRequests > 0 
      ? this.localMetrics.hits / this.localMetrics.totalRequests 
      : 0
    
    const missRate = this.localMetrics.totalRequests > 0
      ? this.localMetrics.misses / this.localMetrics.totalRequests
      : 0

    return {
      ...this.localMetrics,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      ...redisMetrics
    }
  }

  private parseRedisStatValue(info: string, key: string): number {
    const match = info.match(new RegExp(`${key}:(\\d+)`))
    return match ? parseInt(match[1]) : 0
  }

  private parseKeyspaceValue(info: string, db: string): number {
    const match = info.match(new RegExp(`${db}:keys=(\\d+)`))
    return match ? parseInt(match[1]) : 0
  }

  /**
   * Pre-warm cache for common combinations
   */
  async preWarmCache(
    businessContextId: string,
    commonScenarios: Array<{
      maxDuration: number
      questionPool: string[]
      priorityWeights: Record<string, number>
    }>
  ): Promise<void> {
    logger.info(`Pre-warming combination cache for business ${businessContextId}`)
    
    const promises = commonScenarios.map(async (scenario) => {
      try {
        const request: CombinationRequest = {
          businessContextId,
          maxDurationSeconds: scenario.maxDuration,
          availableQuestions: scenario.questionPool,
          priorityWeights: scenario.priorityWeights
        }
        
        await this.getOptimizedCombination(request)
        logger.debug(`Pre-warmed cache for scenario: ${scenario.maxDuration}s duration`)
      } catch (error) {
        logger.error('Failed to pre-warm cache scenario:', error)
      }
    })
    
    await Promise.all(promises)
    logger.info(`Cache pre-warming completed for business ${businessContextId}`)
  }

  /**
   * Health check
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
      
      const metrics = await this.getMetrics()

      return {
        status: this.isConnected ? 'healthy' : 'unhealthy',
        details: {
          connected: this.isConnected,
          latency: `${latency}ms`,
          metrics
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      }
    }
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
      this.isConnected = false
      logger.info('Combination cache service shut down')
    }
  }
}

// Singleton instance
export const combinationCacheService = new CombinationCacheService()