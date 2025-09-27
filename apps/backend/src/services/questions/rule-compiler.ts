import { QuestionCombinationRule, QuestionGroup, DynamicTrigger, TriggerCondition, PriorityWeight } from '@vocilia/types'
import { triggerCacheService } from '../cache/trigger-cache'
import { logger } from '../loggingService'
import { EventEmitter } from 'events'

interface CompilationJob {
  id: string
  businessContextId: string
  type: 'rule' | 'trigger' | 'full_refresh'
  entityId?: string // rule or trigger ID
  priority: 'low' | 'normal' | 'high'
  createdAt: Date
  attempts: number
  lastError?: string
}

interface CompiledRule {
  ruleId: string
  businessContextId: string
  questionGroups: QuestionGroup[]
  priorityMatrix: PriorityWeight[]
  timeConstraints: {
    maxDuration: number
    thresholds: {
      critical: number
      high: number
      medium: number
      low: number
    }
  }
  compiledAt: Date
  version: number
}

export class RuleCompilerService extends EventEmitter {
  private compilationQueue: CompilationJob[] = []
  private isProcessing = false
  private readonly MAX_CONCURRENT_JOBS = 3
  private readonly MAX_ATTEMPTS = 3
  private readonly COMPILATION_TIMEOUT = 30000 // 30 seconds
  private activeJobs = new Map<string, NodeJS.Timeout>()
  private compiledRulesCache = new Map<string, CompiledRule>()

  constructor() {
    super()
    this.startBackgroundProcessor()
  }

  /**
   * Queue a compilation job
   */
  async queueCompilation(
    businessContextId: string,
    type: 'rule' | 'trigger' | 'full_refresh',
    entityId?: string,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<string> {
    const jobId = `${type}_${businessContextId}_${entityId || 'all'}_${Date.now()}`
    
    const job: CompilationJob = {
      id: jobId,
      businessContextId,
      type,
      entityId,
      priority,
      createdAt: new Date(),
      attempts: 0
    }

    // Remove any existing similar jobs (deduplicate)
    this.deduplicateJobs(businessContextId, type, entityId)
    
    // Insert job based on priority
    this.insertJobByPriority(job)
    
    logger.info(`Queued compilation job: ${jobId} (priority: ${priority})`)
    
    // Emit event for monitoring
    this.emit('jobQueued', { jobId, type, businessContextId, priority })
    
    // Start processing if not already running
    if (!this.isProcessing) {
      setImmediate(() => this.processQueue())
    }

    return jobId
  }

  /**
   * Get compilation status
   */
  getCompilationStatus(businessContextId: string): {
    queuedJobs: number
    activeJobs: number
    lastCompiled?: Date
    compilationVersion?: number
  } {
    const queuedJobs = this.compilationQueue.filter(
      job => job.businessContextId === businessContextId
    ).length

    const activeJobs = Array.from(this.activeJobs.keys()).filter(
      jobId => jobId.includes(businessContextId)
    ).length

    const cachedRule = this.compiledRulesCache.get(businessContextId)

    return {
      queuedJobs,
      activeJobs,
      lastCompiled: cachedRule?.compiledAt,
      compilationVersion: cachedRule?.version
    }
  }

  /**
   * Get compiled rule from cache
   */
  getCompiledRule(businessContextId: string, ruleId?: string): CompiledRule | null {
    const cacheKey = ruleId ? `${businessContextId}_${ruleId}` : businessContextId
    return this.compiledRulesCache.get(cacheKey) || null
  }

  /**
   * Force immediate compilation (for urgent updates)
   */
  async compileImmediate(
    businessContextId: string,
    type: 'rule' | 'trigger' | 'full_refresh',
    entityId?: string
  ): Promise<CompiledRule | null> {
    const jobId = `immediate_${Date.now()}`
    
    try {
      logger.info(`Starting immediate compilation: ${businessContextId}/${type}/${entityId}`)
      
      const result = await this.executeCompilationJob({
        id: jobId,
        businessContextId,
        type,
        entityId,
        priority: 'high',
        createdAt: new Date(),
        attempts: 0
      })

      logger.info(`Immediate compilation completed: ${jobId}`)
      return result
    } catch (error) {
      logger.error(`Immediate compilation failed: ${jobId}`, error)
      throw error
    }
  }

  /**
   * Start background queue processor
   */
  private startBackgroundProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.compilationQueue.length > 0) {
        this.processQueue()
      }
    }, 5000) // Check every 5 seconds
  }

  /**
   * Process compilation queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.compilationQueue.length === 0) {
      return
    }

    this.isProcessing = true
    
    try {
      while (this.compilationQueue.length > 0 && this.activeJobs.size < this.MAX_CONCURRENT_JOBS) {
        const job = this.compilationQueue.shift()!
        
        // Start job with timeout
        const timeoutId = setTimeout(() => {
          this.handleJobTimeout(job.id)
        }, this.COMPILATION_TIMEOUT)
        
        this.activeJobs.set(job.id, timeoutId)
        
        // Execute job asynchronously
        this.executeCompilationJob(job)
          .then(result => {
            this.handleJobSuccess(job, result)
          })
          .catch(error => {
            this.handleJobError(job, error)
          })
          .finally(() => {
            // Clean up
            clearTimeout(timeoutId)
            this.activeJobs.delete(job.id)
          })
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Execute a single compilation job
   */
  private async executeCompilationJob(job: CompilationJob): Promise<CompiledRule | null> {
    const startTime = Date.now()
    
    try {
      logger.debug(`Executing compilation job: ${job.id}`)
      job.attempts++

      let result: CompiledRule | null = null

      switch (job.type) {
        case 'rule':
          result = await this.compileRule(job.businessContextId, job.entityId!)
          break
        case 'trigger':
          await this.compileTrigger(job.businessContextId, job.entityId!)
          break
        case 'full_refresh':
          result = await this.compileFullBusinessContext(job.businessContextId)
          break
      }

      const duration = Date.now() - startTime
      logger.debug(`Compilation job completed: ${job.id} (${duration}ms)`)

      // Emit success event
      this.emit('jobCompleted', {
        jobId: job.id,
        businessContextId: job.businessContextId,
        duration,
        result: result ? 'success' : 'no_changes'
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(`Compilation job failed: ${job.id} (${duration}ms)`, error)
      throw error
    }
  }

  /**
   * Compile a single question combination rule
   */
  private async compileRule(businessContextId: string, ruleId: string): Promise<CompiledRule | null> {
    try {
      // Fetch rule data from database (would be actual DB calls)
      const ruleData = await this.fetchRuleData(businessContextId, ruleId)
      
      if (!ruleData) {
        throw new Error(`Rule ${ruleId} not found`)
      }

      const { rule, questionGroups, priorityWeights } = ruleData

      // Compile the rule
      const compiledRule: CompiledRule = {
        ruleId,
        businessContextId,
        questionGroups: await this.optimizeQuestionGroups(questionGroups),
        priorityMatrix: this.buildPriorityMatrix(priorityWeights),
        timeConstraints: {
          maxDuration: rule.max_call_duration_seconds,
          thresholds: {
            critical: rule.priority_threshold_critical,
            high: rule.priority_threshold_high,
            medium: rule.priority_threshold_medium,
            low: rule.priority_threshold_low
          }
        },
        compiledAt: new Date(),
        version: this.getNextVersion(businessContextId, ruleId)
      }

      // Cache the compiled rule
      const cacheKey = `${businessContextId}_${ruleId}`
      this.compiledRulesCache.set(cacheKey, compiledRule)

      logger.info(`Compiled rule ${ruleId} for business ${businessContextId}`)
      
      return compiledRule
    } catch (error) {
      logger.error(`Failed to compile rule ${ruleId}:`, error)
      throw error
    }
  }

  /**
   * Compile a dynamic trigger
   */
  private async compileTrigger(businessContextId: string, triggerId: string): Promise<void> {
    try {
      // Fetch trigger data from database
      const triggerData = await this.fetchTriggerData(businessContextId, triggerId)
      
      if (!triggerData) {
        throw new Error(`Trigger ${triggerId} not found`)
      }

      const { trigger, conditions } = triggerData

      // Cache the trigger using the trigger cache service
      await triggerCacheService.cacheTrigger(businessContextId, trigger, conditions)

      logger.info(`Compiled trigger ${triggerId} for business ${businessContextId}`)
    } catch (error) {
      logger.error(`Failed to compile trigger ${triggerId}:`, error)
      throw error
    }
  }

  /**
   * Compile all rules and triggers for a business context
   */
  private async compileFullBusinessContext(businessContextId: string): Promise<CompiledRule | null> {
    try {
      logger.info(`Starting full compilation for business ${businessContextId}`)

      // Fetch all rules and triggers for this business
      const businessData = await this.fetchBusinessData(businessContextId)
      
      if (!businessData) {
        throw new Error(`Business context ${businessContextId} not found`)
      }

      // Compile all rules
      const compiledRules = await Promise.all(
        businessData.rules.map(rule => this.compileRule(businessContextId, rule.id))
      )

      // Compile all triggers
      await Promise.all(
        businessData.triggers.map(trigger => 
          this.compileTrigger(businessContextId, trigger.id)
        )
      )

      // Create a master compiled rule (combination of all rules)
      const masterRule = this.createMasterRule(businessContextId, compiledRules.filter(Boolean) as CompiledRule[])
      
      if (masterRule) {
        this.compiledRulesCache.set(businessContextId, masterRule)
      }

      logger.info(`Full compilation completed for business ${businessContextId}`)
      
      return masterRule
    } catch (error) {
      logger.error(`Failed to compile business context ${businessContextId}:`, error)
      throw error
    }
  }

  /**
   * Handle successful job completion
   */
  private handleJobSuccess(job: CompilationJob, result: CompiledRule | null): void {
    logger.debug(`Job succeeded: ${job.id}`)
    
    this.emit('jobCompleted', {
      jobId: job.id,
      businessContextId: job.businessContextId,
      success: true,
      result
    })
  }

  /**
   * Handle job error
   */
  private handleJobError(job: CompilationJob, error: any): void {
    job.lastError = error.message

    if (job.attempts < this.MAX_ATTEMPTS) {
      // Retry with exponential backoff
      const delay = Math.pow(2, job.attempts) * 1000
      
      setTimeout(() => {
        this.compilationQueue.unshift(job) // Add back to front of queue
        logger.info(`Retrying job ${job.id} (attempt ${job.attempts + 1}/${this.MAX_ATTEMPTS})`)
      }, delay)
    } else {
      logger.error(`Job failed permanently: ${job.id}`, error)
      
      this.emit('jobFailed', {
        jobId: job.id,
        businessContextId: job.businessContextId,
        error: error.message,
        attempts: job.attempts
      })
    }
  }

  /**
   * Handle job timeout
   */
  private handleJobTimeout(jobId: string): void {
    logger.error(`Job timed out: ${jobId}`)
    
    // The job will be cleaned up in the finally block
    this.emit('jobTimeout', { jobId })
  }

  /**
   * Remove duplicate jobs from queue
   */
  private deduplicateJobs(businessContextId: string, type: string, entityId?: string): void {
    this.compilationQueue = this.compilationQueue.filter(job => !(
      job.businessContextId === businessContextId &&
      job.type === type &&
      job.entityId === entityId
    ))
  }

  /**
   * Insert job in queue based on priority
   */
  private insertJobByPriority(job: CompilationJob): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    
    let insertIndex = this.compilationQueue.length
    
    for (let i = 0; i < this.compilationQueue.length; i++) {
      if (priorityOrder[job.priority] < priorityOrder[this.compilationQueue[i].priority]) {
        insertIndex = i
        break
      }
    }
    
    this.compilationQueue.splice(insertIndex, 0, job)
  }

  /**
   * Optimize question groups for better conversation flow
   */
  private async optimizeQuestionGroups(groups: QuestionGroup[]): Promise<QuestionGroup[]> {
    // Sort by display_order and estimated tokens
    return groups
      .filter(group => group.is_active)
      .sort((a, b) => {
        if (a.display_order !== b.display_order) {
          return a.display_order - b.display_order
        }
        return a.estimated_tokens - b.estimated_tokens // Shorter questions first within same order
      })
  }

  /**
   * Build priority matrix for quick lookups
   */
  private buildPriorityMatrix(weights: PriorityWeight[]): PriorityWeight[] {
    return weights
      .filter(weight => weight.effective_priority > 0)
      .sort((a, b) => b.effective_priority - a.effective_priority) // Higher priority first
  }

  /**
   * Get next version number
   */
  private getNextVersion(businessContextId: string, ruleId?: string): number {
    const cacheKey = ruleId ? `${businessContextId}_${ruleId}` : businessContextId
    const current = this.compiledRulesCache.get(cacheKey)
    return current ? current.version + 1 : 1
  }

  /**
   * Create master rule combining all business rules
   */
  private createMasterRule(businessContextId: string, compiledRules: CompiledRule[]): CompiledRule | null {
    if (compiledRules.length === 0) {
      return null
    }

    // Combine all question groups
    const allQuestionGroups = compiledRules.flatMap(rule => rule.questionGroups)
    
    // Combine all priority matrices
    const allPriorityWeights = compiledRules.flatMap(rule => rule.priorityMatrix)
    
    // Use the most restrictive time constraints
    const timeConstraints = {
      maxDuration: Math.min(...compiledRules.map(rule => rule.timeConstraints.maxDuration)),
      thresholds: {
        critical: Math.min(...compiledRules.map(rule => rule.timeConstraints.thresholds.critical)),
        high: Math.min(...compiledRules.map(rule => rule.timeConstraints.thresholds.high)),
        medium: Math.min(...compiledRules.map(rule => rule.timeConstraints.thresholds.medium)),
        low: Math.min(...compiledRules.map(rule => rule.timeConstraints.thresholds.low))
      }
    }

    return {
      ruleId: 'master',
      businessContextId,
      questionGroups: this.deduplicateQuestionGroups(allQuestionGroups),
      priorityMatrix: this.deduplicatePriorityWeights(allPriorityWeights),
      timeConstraints,
      compiledAt: new Date(),
      version: this.getNextVersion(businessContextId)
    }
  }

  /**
   * Remove duplicate question groups
   */
  private deduplicateQuestionGroups(groups: QuestionGroup[]): QuestionGroup[] {
    const seen = new Set<string>()
    return groups.filter(group => {
      const key = `${group.topic_category}_${group.group_name}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  /**
   * Remove duplicate priority weights
   */
  private deduplicatePriorityWeights(weights: PriorityWeight[]): PriorityWeight[] {
    const seen = new Set<string>()
    return weights.filter(weight => {
      if (seen.has(weight.question_id)) {
        return false
      }
      seen.add(weight.question_id)
      return true
    })
  }

  // Mock database fetch methods (in real implementation, these would use actual database queries)
  private async fetchRuleData(businessContextId: string, ruleId: string): Promise<{
    rule: QuestionCombinationRule
    questionGroups: QuestionGroup[]
    priorityWeights: PriorityWeight[]
  } | null> {
    // This would be actual database queries
    throw new Error('Database fetch not implemented in mock')
  }

  private async fetchTriggerData(businessContextId: string, triggerId: string): Promise<{
    trigger: DynamicTrigger
    conditions: TriggerCondition[]
  } | null> {
    // This would be actual database queries
    throw new Error('Database fetch not implemented in mock')
  }

  private async fetchBusinessData(businessContextId: string): Promise<{
    rules: QuestionCombinationRule[]
    triggers: DynamicTrigger[]
  } | null> {
    // This would be actual database queries
    throw new Error('Database fetch not implemented in mock')
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    queueLength: number
    activeJobs: number
    compiledRules: number
    processingRate: number
  } {
    return {
      queueLength: this.compilationQueue.length,
      activeJobs: this.activeJobs.size,
      compiledRules: this.compiledRulesCache.size,
      processingRate: 0 // Would track over time in real implementation
    }
  }

  /**
   * Clear all cached compiled rules
   */
  clearCache(businessContextId?: string): void {
    if (businessContextId) {
      // Clear only for specific business
      const keysToDelete = Array.from(this.compiledRulesCache.keys())
        .filter(key => key.startsWith(businessContextId))
      
      keysToDelete.forEach(key => this.compiledRulesCache.delete(key))
      logger.info(`Cleared compiled rules cache for business ${businessContextId}`)
    } else {
      // Clear all
      this.compiledRulesCache.clear()
      logger.info('Cleared all compiled rules cache')
    }
  }

  /**
   * Shutdown the compiler service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down rule compiler service...')
    
    // Wait for active jobs to complete or timeout
    const activeJobIds = Array.from(this.activeJobs.keys())
    
    if (activeJobIds.length > 0) {
      logger.info(`Waiting for ${activeJobIds.length} active jobs to complete...`)
      
      // Give jobs 30 seconds to complete
      const timeout = setTimeout(() => {
        activeJobIds.forEach(jobId => {
          const timeoutId = this.activeJobs.get(jobId)
          if (timeoutId) {
            clearTimeout(timeoutId)
            this.activeJobs.delete(jobId)
          }
        })
      }, 30000)
      
      // Wait for jobs to complete naturally
      while (this.activeJobs.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      clearTimeout(timeout)
    }

    // Clear queue and cache
    this.compilationQueue = []
    this.compiledRulesCache.clear()
    
    logger.info('Rule compiler service shut down')
  }
}

// Singleton instance
export const ruleCompilerService = new RuleCompilerService()