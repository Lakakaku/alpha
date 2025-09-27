import { 
  CustomerVerification, 
  DynamicTrigger, 
  TriggerActivationLog, 
  QuestionCombinationRule,
  OptimizedCombination 
} from '@vocilia/types'
import { triggerCacheService } from '../cache/trigger-cache'
import { combinationCacheService } from '../cache/combination-cache'
import { ruleCompilerService } from '../questions/rule-compiler'
import { logger } from '../loggingService'

interface VerificationContext {
  customerId: string
  businessContextId: string
  verificationId: string
  purchaseData: {
    amount: number
    currency: string
    categories: string[]
    items: Array<{ name: string; category: string; price: number }>
    timestamp: Date
    paymentMethod?: string
  }
  customerProfile: {
    tier?: string
    previousPurchases: number
    averageOrderValue: number
    preferredCategories: string[]
    lastVisit?: Date
  }
  storeContext: {
    storeId: string
    location?: string
    currentTime: Date
    staffOnDuty: number
    queueLength?: number
  }
}

interface QuestionSelectionResult {
  selectedQuestions: Array<{
    questionId: string
    questionText: string
    priority: number
    estimatedTokens: number
    topicCategory: string
    triggerSource?: string
    order: number
  }>
  activatedTriggers: Array<{
    triggerId: string
    triggerName: string
    matchedConditions: string[]
    questionsTriggered: string[]
  }>
  estimatedCallDuration: number
  priorityDistribution: Record<string, number>
  optimizationMetrics: {
    cacheHit: boolean
    evaluationTimeMs: number
    triggerEvaluationTimeMs: number
    totalProcessingTimeMs: number
  }
}

export class QuestionIntegrationService {
  /**
   * Main entry point for question selection during verification flow
   */
  async selectQuestionsForVerification(
    context: VerificationContext
  ): Promise<QuestionSelectionResult> {
    const startTime = Date.now()

    try {
      logger.info(`Starting question selection for verification ${context.verificationId}`)

      // Step 1: Evaluate all active triggers for this business
      const triggerResults = await this.evaluateTriggersForContext(context)
      const triggerEvaluationTime = Date.now() - startTime

      // Step 2: Get business's active question combination rules
      const activeRules = await this.getActiveRulesForBusiness(context.businessContextId)

      // Step 3: Combine triggered questions with rule-based optimization
      const optimizationStartTime = Date.now()
      const optimizedCombination = await this.optimizeQuestionSelection(
        context,
        triggerResults,
        activeRules
      )
      const optimizationTime = Date.now() - optimizationStartTime

      // Step 4: Log trigger activations for audit and analytics
      await this.logTriggerActivations(context, triggerResults, optimizedCombination.questions)

      // Step 5: Update verification record with selected questions
      await this.updateVerificationWithQuestions(context.verificationId, optimizedCombination)

      const totalProcessingTime = Date.now() - startTime

      logger.info(
        `Question selection completed for verification ${context.verificationId}: ` +
        `${optimizedCombination.questions.length} questions selected, ` +
        `${triggerResults.activatedTriggers.length} triggers activated, ` +
        `${totalProcessingTime}ms total processing time`
      )

      return {
        selectedQuestions: optimizedCombination.questions,
        activatedTriggers: triggerResults.activatedTriggers,
        estimatedCallDuration: optimizedCombination.estimatedDuration,
        priorityDistribution: this.calculatePriorityDistribution(optimizedCombination.questions),
        optimizationMetrics: {
          cacheHit: optimizedCombination.cacheHit || false,
          evaluationTimeMs: optimizationTime,
          triggerEvaluationTimeMs: triggerEvaluationTime,
          totalProcessingTimeMs: totalProcessingTime
        }
      }

    } catch (error) {
      logger.error(`Failed to select questions for verification ${context.verificationId}:`, error)
      
      // Fallback to default questions
      return await this.getFallbackQuestions(context)
    }
  }

  /**
   * Evaluate all triggers for the given context
   */
  private async evaluateTriggersForContext(
    context: VerificationContext
  ): Promise<{
    activatedTriggers: Array<{
      triggerId: string
      triggerName: string
      triggerType: string
      matchedConditions: string[]
      questionsTriggered: string[]
      priority: number
    }>
    evaluationResults: Array<{
      triggerId: string
      triggered: boolean
      evaluationTimeMs: number
    }>
  }> {
    try {
      // Get active triggers for this business
      const businessTriggers = await this.getActiveTriggersForBusiness(context.businessContextId)

      if (businessTriggers.length === 0) {
        return { activatedTriggers: [], evaluationResults: [] }
      }

      // Prepare evaluation data from context
      const evaluationData = this.prepareEvaluationData(context)

      // Evaluate triggers using cached service
      const triggerIds = businessTriggers.map(t => t.id)
      const evaluationResults = await triggerCacheService.evaluateTriggersFromCache(
        context.businessContextId,
        evaluationData,
        triggerIds
      )

      // Process results and get activated triggers
      const activatedTriggers = []

      for (const result of evaluationResults) {
        if (result.triggered) {
          const trigger = businessTriggers.find(t => t.id === result.triggerId)
          
          if (trigger) {
            // Get questions associated with this trigger
            const questionsTriggered = await this.getQuestionsForTrigger(
              context.businessContextId,
              trigger.id
            )

            activatedTriggers.push({
              triggerId: trigger.id,
              triggerName: trigger.trigger_name,
              triggerType: trigger.trigger_type,
              matchedConditions: result.matchedConditions,
              questionsTriggered,
              priority: trigger.priority_level
            })
          }
        }
      }

      // Sort by priority (highest first)
      activatedTriggers.sort((a, b) => b.priority - a.priority)

      logger.debug(
        `Trigger evaluation completed: ${activatedTriggers.length}/${businessTriggers.length} triggers activated`
      )

      return { activatedTriggers, evaluationResults }

    } catch (error) {
      logger.error('Failed to evaluate triggers for context:', error)
      return { activatedTriggers: [], evaluationResults: [] }
    }
  }

  /**
   * Optimize question selection using combination rules and triggered questions
   */
  private async optimizeQuestionSelection(
    context: VerificationContext,
    triggerResults: { activatedTriggers: any[] },
    activeRules: QuestionCombinationRule[]
  ): Promise<OptimizedCombination & { cacheHit?: boolean }> {
    try {
      // Get all questions triggered by activated triggers
      const triggeredQuestionIds = triggerResults.activatedTriggers
        .flatMap(trigger => trigger.questionsTriggered)

      // Get all available questions for this business
      const allAvailableQuestions = await this.getAllQuestionsForBusiness(context.businessContextId)

      // Determine max call duration from rules (use most restrictive)
      const maxDuration = activeRules.length > 0
        ? Math.min(...activeRules.map(rule => rule.max_call_duration_seconds))
        : 120 // Default 2 minutes

      // Build priority weights (triggered questions get boosted priority)
      const priorityWeights: Record<string, number> = {}
      
      // Base priorities from question configuration
      allAvailableQuestions.forEach(question => {
        priorityWeights[question.id] = question.default_priority_level || 3
      })

      // Boost priority for triggered questions
      triggeredQuestionIds.forEach(questionId => {
        if (priorityWeights[questionId]) {
          priorityWeights[questionId] *= 1.5 // 50% priority boost
        }
      })

      // Build topic preferences based on purchase data
      const topicPreferences = this.buildTopicPreferences(context)

      // Use combination cache service for optimization
      const cacheRequest = {
        businessContextId: context.businessContextId,
        maxDurationSeconds: maxDuration,
        availableQuestions: allAvailableQuestions.map(q => q.id),
        priorityWeights,
        topicPreferences,
        excludeQuestions: [] // Could add excluded questions based on recent history
      }

      const optimizedCombination = await combinationCacheService.getOptimizedCombination(cacheRequest)

      // Enhance with trigger information
      const enhancedQuestions = optimizedCombination.questions.map(q => {
        const questionData = allAvailableQuestions.find(aq => aq.id === q.questionId)
        const triggerSource = triggerResults.activatedTriggers.find(trigger =>
          trigger.questionsTriggered.includes(q.questionId)
        )

        return {
          questionId: q.questionId,
          questionText: questionData?.question_text || 'Unknown question',
          priority: q.priority,
          estimatedTokens: q.estimatedTokens,
          topicCategory: q.topicCategory,
          triggerSource: triggerSource?.triggerName,
          order: q.order
        }
      })

      return {
        ...optimizedCombination,
        questions: enhancedQuestions,
        cacheHit: true // This would be set by the cache service
      }

    } catch (error) {
      logger.error('Failed to optimize question selection:', error)
      throw error
    }
  }

  /**
   * Prepare evaluation data from verification context
   */
  private prepareEvaluationData(context: VerificationContext): any {
    return {
      // Purchase-based trigger data
      purchase_amount: context.purchaseData.amount,
      purchase_categories: context.purchaseData.categories,
      purchase_items: context.purchaseData.items.map(item => item.name),
      purchase_timestamp: context.purchaseData.timestamp,
      payment_method: context.purchaseData.paymentMethod,

      // Time-based trigger data
      current_time: context.storeContext.currentTime,
      day_of_week: context.storeContext.currentTime.getDay(),
      hour_of_day: context.storeContext.currentTime.getHours(),

      // Amount-based trigger data
      order_value: context.purchaseData.amount,
      currency: context.purchaseData.currency,

      // Customer profile data
      customer_tier: context.customerProfile.tier,
      previous_purchases: context.customerProfile.previousPurchases,
      average_order_value: context.customerProfile.averageOrderValue,
      preferred_categories: context.customerProfile.preferredCategories,

      // Store context data
      store_location: context.storeContext.location,
      staff_count: context.storeContext.staffOnDuty,
      queue_length: context.storeContext.queueLength || 0,

      // Additional context
      verification_id: context.verificationId,
      customer_id: context.customerId
    }
  }

  /**
   * Build topic preferences based on purchase context
   */
  private buildTopicPreferences(context: VerificationContext): Record<string, number> {
    const preferences: Record<string, number> = {
      // Default preferences
      'service': 1.0,
      'product': 1.0,
      'experience': 1.0,
      'recommendation': 1.0
    }

    // Boost product-related questions if specific categories were purchased
    if (context.purchaseData.categories.length > 0) {
      preferences['product'] = 1.3
    }

    // Boost service questions for high-value purchases
    if (context.purchaseData.amount > context.customerProfile.averageOrderValue * 1.5) {
      preferences['service'] = 1.4
    }

    // Boost experience questions for repeat customers
    if (context.customerProfile.previousPurchases > 5) {
      preferences['experience'] = 1.2
    }

    // Boost recommendation questions for loyal customers
    if (context.customerProfile.tier === 'gold' || context.customerProfile.tier === 'platinum') {
      preferences['recommendation'] = 1.3
    }

    return preferences
  }

  /**
   * Log trigger activations for audit and analytics
   */
  private async logTriggerActivations(
    context: VerificationContext,
    triggerResults: { activatedTriggers: any[] },
    selectedQuestions: Array<{ questionId: string; triggerSource?: string; order: number }>
  ): Promise<void> {
    try {
      const activationLogs: Partial<TriggerActivationLog>[] = []

      for (const trigger of triggerResults.activatedTriggers) {
        for (const questionId of trigger.questionsTriggered) {
          const selectedQuestion = selectedQuestions.find(q => q.questionId === questionId)
          
          activationLogs.push({
            verification_id: context.verificationId,
            trigger_id: trigger.triggerId,
            question_id: questionId,
            trigger_data: this.prepareEvaluationData(context),
            activation_timestamp: new Date(),
            call_position: selectedQuestion?.order || 0,
            was_asked: !!selectedQuestion, // Only true if question was actually selected
            skip_reason: selectedQuestion ? null : 'Not selected in optimization'
          })
        }
      }

      // Batch insert activation logs
      if (activationLogs.length > 0) {
        await this.insertTriggerActivationLogs(activationLogs)
        logger.debug(`Logged ${activationLogs.length} trigger activations`)
      }

    } catch (error) {
      logger.error('Failed to log trigger activations:', error)
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Update verification record with selected questions
   */
  private async updateVerificationWithQuestions(
    verificationId: string,
    combination: OptimizedCombination
  ): Promise<void> {
    try {
      const questionData = combination.questions.map(q => ({
        questionId: q.questionId,
        order: q.order,
        estimatedTokens: q.estimatedTokens,
        priority: q.priority,
        topicCategory: q.topicCategory
      }))

      // Update verification record (would be actual database update)
      await this.updateVerificationRecord(verificationId, {
        questions_selected: questionData,
        total_estimated_duration: combination.estimatedDuration,
        optimization_version: Date.now() // Simple versioning
      })

      logger.debug(`Updated verification ${verificationId} with ${questionData.length} questions`)

    } catch (error) {
      logger.error('Failed to update verification with questions:', error)
      throw error
    }
  }

  /**
   * Calculate priority distribution for metrics
   */
  private calculatePriorityDistribution(
    questions: Array<{ priority: number }>
  ): Record<string, number> {
    const distribution: Record<string, number> = {
      '5_critical': 0,
      '4_high': 0,
      '3_medium': 0,
      '2_low': 0,
      '1_optional': 0
    }

    questions.forEach(question => {
      const key = `${question.priority}_${this.getPriorityLabel(question.priority)}`
      if (distribution[key] !== undefined) {
        distribution[key]++
      }
    })

    return distribution
  }

  private getPriorityLabel(priority: number): string {
    switch (priority) {
      case 5: return 'critical'
      case 4: return 'high'
      case 3: return 'medium'
      case 2: return 'low'
      case 1: return 'optional'
      default: return 'unknown'
    }
  }

  /**
   * Fallback questions when main selection fails
   */
  private async getFallbackQuestions(context: VerificationContext): Promise<QuestionSelectionResult> {
    try {
      logger.warn(`Using fallback questions for verification ${context.verificationId}`)

      // Get basic questions from business
      const fallbackQuestions = await this.getBasicQuestionsForBusiness(context.businessContextId)

      return {
        selectedQuestions: fallbackQuestions.slice(0, 3).map((question, index) => ({
          questionId: question.id,
          questionText: question.question_text,
          priority: question.default_priority_level || 3,
          estimatedTokens: question.estimated_tokens || 30,
          topicCategory: question.topic_category || 'general',
          order: index + 1
        })),
        activatedTriggers: [],
        estimatedCallDuration: 90, // Conservative estimate
        priorityDistribution: { '3_medium': 3 },
        optimizationMetrics: {
          cacheHit: false,
          evaluationTimeMs: 0,
          triggerEvaluationTimeMs: 0,
          totalProcessingTimeMs: Date.now()
        }
      }

    } catch (error) {
      logger.error('Failed to get fallback questions:', error)
      
      // Ultimate fallback - return empty result
      return {
        selectedQuestions: [],
        activatedTriggers: [],
        estimatedCallDuration: 0,
        priorityDistribution: {},
        optimizationMetrics: {
          cacheHit: false,
          evaluationTimeMs: 0,
          triggerEvaluationTimeMs: 0,
          totalProcessingTimeMs: 0
        }
      }
    }
  }

  // Mock database access methods (these would be real database queries in implementation)
  private async getActiveTriggersForBusiness(businessContextId: string): Promise<DynamicTrigger[]> {
    // Mock implementation
    return []
  }

  private async getActiveRulesForBusiness(businessContextId: string): Promise<QuestionCombinationRule[]> {
    // Mock implementation
    return []
  }

  private async getQuestionsForTrigger(businessContextId: string, triggerId: string): Promise<string[]> {
    // Mock implementation
    return []
  }

  private async getAllQuestionsForBusiness(businessContextId: string): Promise<Array<{
    id: string
    question_text: string
    default_priority_level: number
    estimated_tokens: number
    topic_category: string
  }>> {
    // Mock implementation
    return []
  }

  private async getBasicQuestionsForBusiness(businessContextId: string): Promise<Array<{
    id: string
    question_text: string
    default_priority_level: number
    estimated_tokens: number
    topic_category: string
  }>> {
    // Mock implementation
    return []
  }

  private async insertTriggerActivationLogs(logs: Partial<TriggerActivationLog>[]): Promise<void> {
    // Mock implementation
  }

  private async updateVerificationRecord(verificationId: string, updates: any): Promise<void> {
    // Mock implementation
  }

  /**
   * Get integration performance metrics
   */
  async getIntegrationMetrics(businessContextId: string): Promise<{
    averageProcessingTime: number
    triggerActivationRate: number
    questionSelectionRate: number
    cacheHitRate: number
    fallbackRate: number
  }> {
    // This would aggregate metrics from recent verifications
    return {
      averageProcessingTime: 0,
      triggerActivationRate: 0,
      questionSelectionRate: 0,
      cacheHitRate: 0,
      fallbackRate: 0
    }
  }
}

// Singleton instance
export const questionIntegrationService = new QuestionIntegrationService()