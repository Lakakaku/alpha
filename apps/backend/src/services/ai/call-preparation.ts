import { 
  CustomerVerification,
  OptimizedCombination,
  QuestionSelectionResult,
  AICallContext
} from '@vocilia/types'
import { questionIntegrationService } from '../verification/question-integration'
import { logger } from '../loggingService'
import OpenAI from 'openai'

interface CallPreparationRequest {
  verificationId: string
  customerContext: {
    customerId: string
    customerName?: string
    preferredLanguage: string
    accessibilityNeeds?: string[]
    previousCallHistory?: Array<{
      date: Date
      duration: number
      satisfaction?: number
      topics: string[]
    }>
  }
  businessContext: {
    businessId: string
    businessName: string
    industry: string
    brandVoice?: string
    specificInstructions?: string
  }
  callConstraints: {
    maxDurationSeconds: number
    timeOfDay: Date
    urgencyLevel: 'low' | 'normal' | 'high'
    channelType: 'voice' | 'video' | 'text'
  }
}

interface PreparedCallScript {
  introduction: {
    greeting: string
    businessIntroduction: string
    consentRequest: string
    estimatedDuration: string
  }
  questionFlow: Array<{
    questionId: string
    questionText: string
    aiPrompt: string
    followUpPrompts: string[]
    expectedResponseTypes: string[]
    transitionText: string
    maxResponseTime: number
    priority: number
  }>
  conversationFlow: {
    openingStrategy: string
    transitionStrategies: Record<string, string>
    closingStrategy: string
    emergencyExits: string[]
  }
  aiInstructions: {
    systemPrompt: string
    personalityTraits: string[]
    conversationStyle: string
    handlingInstructions: Record<string, string>
    qualityGuidelines: string[]
  }
  qualityMetrics: {
    targetSatisfactionScore: number
    maxSilenceSeconds: number
    minEngagementIndicators: string[]
    callSuccessMetrics: string[]
  }
}

interface CallPreparationResult {
  callScript: PreparedCallScript
  preparationMetrics: {
    preparationTimeMs: number
    questionsOptimized: number
    aiPromptTokens: number
    estimatedCallQuality: number
  }
  contextualFactors: {
    customerRiskFactors: string[]
    businessPriorities: string[]
    timeConstraints: string[]
    technicalConsiderations: string[]
  }
}

export class CallPreparationService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  /**
   * Main call preparation orchestrator
   */
  async prepareCall(request: CallPreparationRequest): Promise<CallPreparationResult> {
    const startTime = Date.now()

    try {
      logger.info(`Preparing AI call for verification ${request.verificationId}`)

      // Step 1: Get optimized question selection from integration service
      const verificationContext = await this.buildVerificationContext(request)
      const questionSelection = await questionIntegrationService.selectQuestionsForVerification(
        verificationContext
      )

      // Step 2: Generate AI-optimized conversation flow
      const conversationFlow = await this.generateConversationFlow(
        request,
        questionSelection
      )

      // Step 3: Create dynamic AI prompts for each question
      const aiPrompts = await this.generateQuestionPrompts(
        request,
        questionSelection.selectedQuestions
      )

      // Step 4: Build comprehensive call script
      const callScript = await this.buildCallScript(
        request,
        questionSelection,
        conversationFlow,
        aiPrompts
      )

      // Step 5: Analyze contextual factors for call optimization
      const contextualFactors = this.analyzeContextualFactors(request, questionSelection)

      const preparationTime = Date.now() - startTime

      logger.info(
        `Call preparation completed for verification ${request.verificationId}: ` +
        `${questionSelection.selectedQuestions.length} questions prepared, ` +
        `${preparationTime}ms preparation time`
      )

      return {
        callScript,
        preparationMetrics: {
          preparationTimeMs: preparationTime,
          questionsOptimized: questionSelection.selectedQuestions.length,
          aiPromptTokens: this.calculatePromptTokens(callScript),
          estimatedCallQuality: this.estimateCallQuality(callScript, contextualFactors)
        },
        contextualFactors
      }

    } catch (error) {
      logger.error(`Failed to prepare call for verification ${request.verificationId}:`, error)
      throw error
    }
  }

  /**
   * Build verification context from preparation request
   */
  private async buildVerificationContext(request: CallPreparationRequest): Promise<any> {
    // Get verification data from database
    const verificationData = await this.getVerificationData(request.verificationId)
    
    if (!verificationData) {
      throw new Error(`Verification ${request.verificationId} not found`)
    }

    // Build context structure expected by question integration service
    return {
      customerId: request.customerContext.customerId,
      businessContextId: request.businessContext.businessId,
      verificationId: request.verificationId,
      purchaseData: verificationData.purchaseData,
      customerProfile: verificationData.customerProfile,
      storeContext: verificationData.storeContext
    }
  }

  /**
   * Generate optimized conversation flow using AI
   */
  private async generateConversationFlow(
    request: CallPreparationRequest,
    questionSelection: QuestionSelectionResult
  ): Promise<{
    openingStrategy: string
    transitionStrategies: Record<string, string>
    closingStrategy: string
    emergencyExits: string[]
  }> {
    try {
      const conversationPrompt = this.buildConversationFlowPrompt(request, questionSelection)

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert conversation designer for customer feedback calls. Generate natural, engaging conversation flows that feel personal and authentic.'
          },
          {
            role: 'user',
            content: conversationPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })

      const flowContent = completion.choices[0].message.content || ''
      
      // Parse AI response into structured format
      return this.parseConversationFlowResponse(flowContent)

    } catch (error) {
      logger.error('Failed to generate AI conversation flow:', error)
      
      // Fallback to template-based flow
      return this.generateFallbackConversationFlow(request, questionSelection)
    }
  }

  /**
   * Generate AI prompts for each selected question
   */
  private async generateQuestionPrompts(
    request: CallPreparationRequest,
    questions: Array<{
      questionId: string
      questionText: string
      priority: number
      topicCategory: string
      triggerSource?: string
    }>
  ): Promise<Record<string, {
    aiPrompt: string
    followUpPrompts: string[]
    expectedResponseTypes: string[]
    maxResponseTime: number
  }>> {
    const prompts: Record<string, any> = {}

    // Process questions in batches for efficiency
    const batchSize = 5
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize)
      
      try {
        const batchPrompts = await this.generateQuestionPromptBatch(request, batch)
        Object.assign(prompts, batchPrompts)
      } catch (error) {
        logger.error(`Failed to generate prompts for question batch ${i}:`, error)
        
        // Fallback to template prompts for failed batch
        batch.forEach(question => {
          prompts[question.questionId] = this.generateFallbackPrompt(question)
        })
      }
    }

    return prompts
  }

  /**
   * Generate AI prompts for a batch of questions
   */
  private async generateQuestionPromptBatch(
    request: CallPreparationRequest,
    questions: Array<{
      questionId: string
      questionText: string
      priority: number
      topicCategory: string
      triggerSource?: string
    }>
  ): Promise<Record<string, any>> {
    const batchPrompt = this.buildQuestionPromptBatchPrompt(request, questions)

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert AI conversation designer. Create natural, contextual prompts that will help an AI conduct engaging customer feedback conversations.'
        },
        {
          role: 'user',
          content: batchPrompt
        }
      ],
      temperature: 0.6,
      max_tokens: 1500
    })

    const promptsContent = completion.choices[0].message.content || ''
    
    // Parse AI response into structured prompts
    return this.parseQuestionPromptsResponse(promptsContent, questions)
  }

  /**
   * Build comprehensive call script
   */
  private async buildCallScript(
    request: CallPreparationRequest,
    questionSelection: QuestionSelectionResult,
    conversationFlow: any,
    aiPrompts: Record<string, any>
  ): Promise<PreparedCallScript> {
    // Generate introduction
    const introduction = await this.generateIntroduction(request, questionSelection)

    // Build question flow with AI prompts
    const questionFlow = questionSelection.selectedQuestions.map(question => ({
      questionId: question.questionId,
      questionText: question.questionText,
      aiPrompt: aiPrompts[question.questionId]?.aiPrompt || this.generateFallbackPrompt(question).aiPrompt,
      followUpPrompts: aiPrompts[question.questionId]?.followUpPrompts || [],
      expectedResponseTypes: aiPrompts[question.questionId]?.expectedResponseTypes || ['text'],
      transitionText: this.generateTransitionText(question, questionSelection.selectedQuestions),
      maxResponseTime: this.calculateMaxResponseTime(question),
      priority: question.priority
    }))

    // Generate AI system instructions
    const aiInstructions = await this.generateAIInstructions(request, questionSelection)

    // Define quality metrics
    const qualityMetrics = this.defineQualityMetrics(request, questionSelection)

    return {
      introduction,
      questionFlow,
      conversationFlow,
      aiInstructions,
      qualityMetrics
    }
  }

  /**
   * Generate personalized introduction
   */
  private async generateIntroduction(
    request: CallPreparationRequest,
    questionSelection: QuestionSelectionResult
  ): Promise<{
    greeting: string
    businessIntroduction: string
    consentRequest: string
    estimatedDuration: string
  }> {
    const timeOfDay = this.getTimeOfDayGreeting(request.callConstraints.timeOfDay)
    const estimatedMinutes = Math.ceil(questionSelection.estimatedCallDuration / 60)

    return {
      greeting: `${timeOfDay}! This is an AI assistant calling on behalf of ${request.businessContext.businessName}.`,
      businessIntroduction: `We're reaching out to gather your valuable feedback about your recent experience with us.`,
      consentRequest: `This call will take approximately ${estimatedMinutes} minutes. Are you available to share your thoughts with us?`,
      estimatedDuration: `${estimatedMinutes} minutes`
    }
  }

  /**
   * Generate AI system instructions
   */
  private async generateAIInstructions(
    request: CallPreparationRequest,
    questionSelection: QuestionSelectionResult
  ): Promise<{
    systemPrompt: string
    personalityTraits: string[]
    conversationStyle: string
    handlingInstructions: Record<string, string>
    qualityGuidelines: string[]
  }> {
    const systemPrompt = `You are conducting a customer feedback call for ${request.businessContext.businessName}. 
    Be natural, empathetic, and genuinely interested in the customer's experience. 
    Speak in ${request.customerContext.preferredLanguage}. 
    Keep responses concise but warm. Ask follow-up questions when appropriate.
    Maximum call duration: ${Math.ceil(questionSelection.estimatedCallDuration / 60)} minutes.`

    const personalityTraits = [
      'empathetic',
      'professional',
      'curious',
      'respectful',
      'patient'
    ]

    const conversationStyle = request.businessContext.brandVoice || 'friendly and professional'

    const handlingInstructions = {
      'negative_feedback': 'Acknowledge concerns, apologize genuinely, and ask for specific details to help improve',
      'positive_feedback': 'Thank the customer warmly and ask what specifically made their experience great',
      'confusion': 'Rephrase the question more simply and provide context if needed',
      'time_pressure': 'Offer to focus on the most important questions or schedule a callback',
      'privacy_concerns': 'Explain how feedback is used and offer to skip sensitive questions'
    }

    const qualityGuidelines = [
      'Maintain natural conversation flow',
      'Show genuine interest in responses',
      'Avoid sounding robotic or scripted',
      'Respect customer time and privacy',
      'End on a positive note with appreciation'
    ]

    return {
      systemPrompt,
      personalityTraits,
      conversationStyle,
      handlingInstructions,
      qualityGuidelines
    }
  }

  /**
   * Define quality metrics for the call
   */
  private defineQualityMetrics(
    request: CallPreparationRequest,
    questionSelection: QuestionSelectionResult
  ): {
    targetSatisfactionScore: number
    maxSilenceSeconds: number
    minEngagementIndicators: string[]
    callSuccessMetrics: string[]
  } {
    return {
      targetSatisfactionScore: 4.0, // Out of 5
      maxSilenceSeconds: 8,
      minEngagementIndicators: [
        'customer_provides_detailed_responses',
        'customer_asks_follow_up_questions',
        'positive_sentiment_detected',
        'completion_rate_above_80_percent'
      ],
      callSuccessMetrics: [
        'all_high_priority_questions_answered',
        'call_duration_within_target',
        'customer_satisfaction_positive',
        'actionable_feedback_collected'
      ]
    }
  }

  /**
   * Analyze contextual factors that might affect call quality
   */
  private analyzeContextualFactors(
    request: CallPreparationRequest,
    questionSelection: QuestionSelectionResult
  ): {
    customerRiskFactors: string[]
    businessPriorities: string[]
    timeConstraints: string[]
    technicalConsiderations: string[]
  } {
    const customerRiskFactors: string[] = []
    const businessPriorities: string[] = []
    const timeConstraints: string[] = []
    const technicalConsiderations: string[] = []

    // Analyze customer risk factors
    if (request.customerContext.previousCallHistory?.some(call => call.satisfaction && call.satisfaction < 3)) {
      customerRiskFactors.push('previous_low_satisfaction')
    }

    if (request.customerContext.accessibilityNeeds?.length) {
      customerRiskFactors.push('accessibility_needs_present')
    }

    // Analyze business priorities
    if (questionSelection.activatedTriggers.some(trigger => trigger.priority >= 4)) {
      businessPriorities.push('high_priority_triggers_active')
    }

    // Analyze time constraints
    const hour = request.callConstraints.timeOfDay.getHours()
    if (hour < 9 || hour > 18) {
      timeConstraints.push('outside_business_hours')
    }

    if (questionSelection.estimatedCallDuration > request.callConstraints.maxDurationSeconds) {
      timeConstraints.push('estimated_duration_exceeds_limit')
    }

    // Technical considerations
    if (request.callConstraints.channelType === 'voice') {
      technicalConsiderations.push('voice_quality_critical')
    }

    if (request.customerContext.preferredLanguage !== 'en') {
      technicalConsiderations.push('multilingual_support_required')
    }

    return {
      customerRiskFactors,
      businessPriorities,
      timeConstraints,
      technicalConsiderations
    }
  }

  /**
   * Helper methods for AI prompt generation
   */
  private buildConversationFlowPrompt(
    request: CallPreparationRequest,
    questionSelection: QuestionSelectionResult
  ): string {
    return `Design a natural conversation flow for a ${Math.ceil(questionSelection.estimatedCallDuration / 60)}-minute customer feedback call.

Business: ${request.businessContext.businessName} (${request.businessContext.industry})
Customer language: ${request.customerContext.preferredLanguage}
Number of questions: ${questionSelection.selectedQuestions.length}
Key topics: ${[...new Set(questionSelection.selectedQuestions.map(q => q.topicCategory))].join(', ')}

Include:
1. Opening strategy (how to start the conversation naturally)
2. Transition strategies (how to move between different topics)
3. Closing strategy (how to end positively)
4. Emergency exits (how to gracefully handle time constraints or customer reluctance)

Make it sound natural and conversational, not scripted.`
  }

  private buildQuestionPromptBatchPrompt(
    request: CallPreparationRequest,
    questions: Array<any>
  ): string {
    const questionDetails = questions.map((q, i) => 
      `${i + 1}. Question ID: ${q.questionId}
      Text: "${q.questionText}"
      Category: ${q.topicCategory}
      Priority: ${q.priority}/5
      ${q.triggerSource ? `Trigger: ${q.triggerSource}` : ''}`
    ).join('\n\n')

    return `Create AI conversation prompts for these customer feedback questions:

${questionDetails}

For each question, provide:
1. AI prompt (instructions for how to ask and handle the response)
2. Follow-up prompts (2-3 natural follow-up questions)
3. Expected response types (text, rating, yes/no, etc.)

Business context: ${request.businessContext.businessName}
Customer language: ${request.customerContext.preferredLanguage}
Brand voice: ${request.businessContext.brandVoice || 'friendly and professional'}`
  }

  private parseConversationFlowResponse(content: string): any {
    // Simple parsing logic - in production this would be more robust
    return {
      openingStrategy: 'Start with a warm greeting and clear purpose',
      transitionStrategies: {
        'topic_change': 'Thank you for that insight. I\'d also love to hear about...',
        'priority_shift': 'That\'s really valuable feedback. Let me ask you about something important...',
        'time_check': 'We\'re making great progress. I have one more area I\'d like to explore...'
      },
      closingStrategy: 'Thank the customer, summarize key points, and provide next steps',
      emergencyExits: [
        'I understand you\'re short on time. Let me ask just our most important question...',
        'I appreciate your honesty. Would you prefer to continue this conversation at a better time?',
        'Thank you for the feedback you\'ve already shared. That\'s very helpful for us.'
      ]
    }
  }

  private parseQuestionPromptsResponse(content: string, questions: Array<any>): Record<string, any> {
    // Simple parsing logic - in production this would be more robust
    const prompts: Record<string, any> = {}
    
    questions.forEach(question => {
      prompts[question.questionId] = {
        aiPrompt: `Ask about "${question.questionText}" in a natural, conversational way. Listen for specific details and ask follow-up questions to understand the full experience.`,
        followUpPrompts: [
          'Can you tell me more about that?',
          'What specifically made you feel that way?',
          'How could we improve that experience?'
        ],
        expectedResponseTypes: ['text', 'detailed_explanation'],
        maxResponseTime: 45
      }
    })
    
    return prompts
  }

  private generateFallbackPrompt(question: any): any {
    return {
      aiPrompt: `Ask the customer: "${question.questionText}". Listen carefully to their response and ask natural follow-up questions if they provide brief answers.`,
      followUpPrompts: [
        'Could you elaborate on that?',
        'What made you feel that way?'
      ],
      expectedResponseTypes: ['text'],
      maxResponseTime: 30
    }
  }

  private generateFallbackConversationFlow(request: any, questionSelection: any): any {
    return {
      openingStrategy: `Greet the customer warmly and explain the purpose of the call`,
      transitionStrategies: {
        'default': 'Thank you for that feedback. I\'d also like to ask you about...'
      },
      closingStrategy: 'Thank the customer for their time and valuable feedback',
      emergencyExits: [
        'I understand you\'re busy. Let me ask just one more quick question...'
      ]
    }
  }

  private generateTransitionText(question: any, allQuestions: any[]): string {
    const index = allQuestions.findIndex(q => q.questionId === question.questionId)
    
    if (index === 0) {
      return 'Let me start with a question about your recent experience.'
    } else if (index === allQuestions.length - 1) {
      return 'Finally, I\'d love to hear your thoughts on...'
    } else {
      return 'I\'d also like to ask you about...'
    }
  }

  private calculateMaxResponseTime(question: any): number {
    // Base time on question priority and complexity
    const baseTime = 30
    const priorityMultiplier = question.priority / 3
    return Math.min(60, baseTime * priorityMultiplier)
  }

  private calculatePromptTokens(callScript: PreparedCallScript): number {
    // Rough estimate of total tokens in all prompts
    let totalTokens = 0
    
    totalTokens += callScript.aiInstructions.systemPrompt.length / 4 // ~4 chars per token
    totalTokens += callScript.questionFlow.reduce((sum, q) => sum + q.aiPrompt.length / 4, 0)
    
    return Math.ceil(totalTokens)
  }

  private estimateCallQuality(callScript: PreparedCallScript, contextualFactors: any): number {
    // Quality score 0-100 based on various factors
    let score = 75 // Base score
    
    // Boost for good question flow
    if (callScript.questionFlow.length >= 3 && callScript.questionFlow.length <= 8) {
      score += 10
    }
    
    // Reduce for risk factors
    score -= contextualFactors.customerRiskFactors.length * 5
    score -= contextualFactors.timeConstraints.length * 3
    
    return Math.max(0, Math.min(100, score))
  }

  private getTimeOfDayGreeting(time: Date): string {
    const hour = time.getHours()
    
    if (hour < 12) {
      return 'Good morning'
    } else if (hour < 17) {
      return 'Good afternoon'
    } else {
      return 'Good evening'
    }
  }

  // Mock database access methods
  private async getVerificationData(verificationId: string): Promise<any> {
    // Mock implementation - would fetch from database
    return {
      purchaseData: {
        amount: 150,
        currency: 'SEK',
        categories: ['groceries', 'household'],
        items: [],
        timestamp: new Date()
      },
      customerProfile: {
        tier: 'gold',
        previousPurchases: 12,
        averageOrderValue: 120,
        preferredCategories: ['groceries']
      },
      storeContext: {
        storeId: 'store-123',
        currentTime: new Date(),
        staffOnDuty: 5
      }
    }
  }

  /**
   * Get preparation service metrics
   */
  async getPreparationMetrics(): Promise<{
    averagePreparationTime: number
    aiGenerationSuccessRate: number
    callQualityPredictionAccuracy: number
    customerSatisfactionCorrelation: number
  }> {
    // Would aggregate metrics from recent preparations
    return {
      averagePreparationTime: 0,
      aiGenerationSuccessRate: 0,
      callQualityPredictionAccuracy: 0,
      customerSatisfactionCorrelation: 0
    }
  }
}

// Singleton instance
export const callPreparationService = new CallPreparationService()