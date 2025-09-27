import { QuestionCombinationEngine, type QuestionCandidate, type CombinationResult, type CustomerContext } from './combination-engine';
import { DynamicTriggerEngine, type TriggerEvaluationContext, type TriggerEvaluationResult } from './trigger-engine';
import { TopicGroupingService, type QuestionForGrouping, type TopicGroupingResult } from './topic-grouping';
import { PriorityBalancingService, type QuestionForBalancing, type PriorityBalanceResult } from './priority-balancing';
import { FrequencyHarmonizerService, type QuestionForHarmonization, type HarmonizationResult } from './frequency-harmonizer';
import { TimeConstraintOptimizer, type QuestionForOptimization, type TimeOptimizationResult, type TimeConstraintConfig } from './time-optimizer';
import { loggingService } from '../loggingService';

export interface QuestionEvaluationRequest {
  businessId: string;
  customerContext: CustomerContext;
  availableQuestions: Array<{
    questionId: string;
    text: string;
    category: string;
    topicCategory: string;
    basePriority: number;
    frequency: number;
    tokenCount: number;
    keywords?: string[];
    businessImportance?: number;
    lastPresentedAt?: string;
  }>;
  constraints: {
    maxDurationSeconds: number;
    minQuestionsToSelect?: number;
    maxQuestionsToSelect?: number;
    priorityThreshold?: number;
    includeTriggeredOnly?: boolean;
    businessRules?: Record<string, any>;
  };
  processingOptions?: {
    enableTriggerEvaluation?: boolean;
    enableTopicGrouping?: boolean;
    enablePriorityBalancing?: boolean;
    enableFrequencyHarmonization?: boolean;
    enableTimeOptimization?: boolean;
    processingMode?: 'fast' | 'balanced' | 'comprehensive';
  };
}

export interface QuestionEvaluationResult {
  selectedQuestions: Array<{
    questionId: string;
    text: string;
    selectionReason: string;
    finalPriority: number;
    estimatedDuration: number;
    triggerReasons?: string[];
    groupAssignment?: string;
    harmonizedFrequency?: number;
    timeAllocation: number;
  }>;
  evaluationMetadata: {
    totalQuestionsEvaluated: number;
    processingStages: Array<{
      stage: string;
      processingTimeMs: number;
      questionsProcessed: number;
      questionsFiltered: number;
    }>;
    triggerEvaluation?: TriggerEvaluationResult;
    topicGrouping?: TopicGroupingResult;
    priorityBalancing?: PriorityBalanceResult;
    frequencyHarmonization?: HarmonizationResult;
    timeOptimization?: TimeOptimizationResult;
    combination?: CombinationResult;
    totalProcessingTimeMs: number;
    performanceMetrics: {
      meetsTimeRequirement: boolean; // <500ms total
      questionCoverage: number; // Percentage of available questions considered
      priorityDistribution: Record<number, number>;
      averageConfidence: number;
    };
  };
  warnings: string[];
  errors: string[];
}

export class QuestionEvaluationService {
  private combinationEngine: QuestionCombinationEngine;
  private triggerEngine: DynamicTriggerEngine;
  private topicGroupingService: TopicGroupingService;
  private priorityBalancingService: PriorityBalancingService;
  private frequencyHarmonizerService: FrequencyHarmonizerService;
  private timeOptimizer: TimeConstraintOptimizer;

  constructor(
    businessId: string,
    private readonly loggingService: typeof loggingService
  ) {
    this.combinationEngine = new QuestionCombinationEngine(businessId, loggingService);
    this.triggerEngine = new DynamicTriggerEngine(loggingService);
    this.topicGroupingService = new TopicGroupingService(businessId, loggingService);
    this.priorityBalancingService = new PriorityBalancingService(businessId, loggingService);
    this.frequencyHarmonizerService = new FrequencyHarmonizerService(businessId, loggingService);
    this.timeOptimizer = new TimeConstraintOptimizer(businessId, loggingService);
  }

  async evaluateQuestions(request: QuestionEvaluationRequest): Promise<QuestionEvaluationResult> {
    const totalStartTime = Date.now();
    const processingStages: QuestionEvaluationResult['evaluationMetadata']['processingStages'] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Determine processing mode and options
      const options = {
        enableTriggerEvaluation: true,
        enableTopicGrouping: true,
        enablePriorityBalancing: true,
        enableFrequencyHarmonization: true,
        enableTimeOptimization: true,
        processingMode: 'balanced' as const,
        ...request.processingOptions
      };

      // Optimize processing based on mode
      if (options.processingMode === 'fast') {
        options.enableTopicGrouping = false;
        options.enableFrequencyHarmonization = false;
      } else if (options.processingMode === 'comprehensive') {
        // All options remain enabled
      }

      let currentQuestions = [...request.availableQuestions];
      let triggerEvaluation: TriggerEvaluationResult | undefined;
      let topicGrouping: TopicGroupingResult | undefined;
      let priorityBalancing: PriorityBalanceResult | undefined;
      let frequencyHarmonization: HarmonizationResult | undefined;
      let timeOptimization: TimeOptimizationResult | undefined;
      let combination: CombinationResult | undefined;

      // Stage 1: Trigger Evaluation
      if (options.enableTriggerEvaluation) {
        const stageStartTime = Date.now();
        
        try {
          const triggerContext: TriggerEvaluationContext = {
            verificationId: request.customerContext.verificationId,
            businessId: request.businessId,
            customerData: {
              purchaseCategories: request.customerContext.purchaseCategories,
              purchaseItems: request.customerContext.purchaseItems,
              transactionAmount: request.customerContext.transactionAmount,
              transactionCurrency: request.customerContext.transactionCurrency,
              transactionTime: request.customerContext.transactionTime,
              customerSequence: 1, // Would come from customer context
              timeOfDay: request.customerContext.timeOfDay,
              dayOfWeek: new Date().getDay(),
              isWeekend: [0, 6].includes(new Date().getDay())
            }
          };

          triggerEvaluation = await this.triggerEngine.evaluateTriggers(triggerContext);

          // Filter questions if includeTriggeredOnly is enabled
          if (request.constraints.includeTriggeredOnly) {
            const triggeredQuestionIds = new Set(triggerEvaluation.questionsTriggered);
            currentQuestions = currentQuestions.filter(q => triggeredQuestionIds.has(q.questionId));
          }

          // Apply priority boosts from triggers
          currentQuestions = currentQuestions.map(question => ({
            ...question,
            basePriority: question.basePriority + (triggerEvaluation!.priorityBoosts[question.questionId] || 0)
          }));

          const stageTime = Date.now() - stageStartTime;
          processingStages.push({
            stage: 'trigger_evaluation',
            processingTimeMs: stageTime,
            questionsProcessed: request.availableQuestions.length,
            questionsFiltered: currentQuestions.length
          });

        } catch (error) {
          warnings.push(`Trigger evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Stage 2: Topic Grouping
      if (options.enableTopicGrouping && currentQuestions.length > 0) {
        const stageStartTime = Date.now();
        
        try {
          const questionsForGrouping: QuestionForGrouping[] = currentQuestions.map(q => ({
            questionId: q.questionId,
            text: q.text,
            category: q.category,
            topicCategory: q.topicCategory,
            estimatedTokens: q.tokenCount,
            priorityLevel: q.basePriority,
            keywords: q.keywords
          }));

          topicGrouping = await this.topicGroupingService.groupQuestionsByTopic(
            questionsForGrouping,
            { useSemanticSimilarity: options.processingMode === 'comprehensive' }
          );

          const stageTime = Date.now() - stageStartTime;
          processingStages.push({
            stage: 'topic_grouping',
            processingTimeMs: stageTime,
            questionsProcessed: currentQuestions.length,
            questionsFiltered: currentQuestions.length // Grouping doesn't filter
          });

        } catch (error) {
          warnings.push(`Topic grouping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Stage 3: Priority Balancing
      if (options.enablePriorityBalancing && currentQuestions.length > 0) {
        const stageStartTime = Date.now();
        
        try {
          const questionsForBalancing: QuestionForBalancing[] = currentQuestions.map(q => ({
            questionId: q.questionId,
            text: q.text,
            category: q.category,
            topicCategory: q.topicCategory,
            basePriority: q.basePriority,
            frequencyScore: q.frequency,
            recencyScore: q.lastPresentedAt ? this.calculateRecencyScore(q.lastPresentedAt) : 5,
            businessImportance: q.businessImportance || 3,
            customerRelevance: 3, // Would come from customer analysis
            estimatedDuration: q.tokenCount / 4.2
          }));

          priorityBalancing = await this.priorityBalancingService.balanceQuestionPriorities(
            questionsForBalancing,
            {
              strategy: 'business_priority',
              maxPriorityLevel: 5,
              minPriorityLevel: 1
            }
          );

          // Update question priorities
          const balancedQuestionMap = new Map(
            priorityBalancing.balancedQuestions.map(q => [q.questionId, q.balancedPriority])
          );
          currentQuestions = currentQuestions.map(question => ({
            ...question,
            basePriority: balancedQuestionMap.get(question.questionId) || question.basePriority
          }));

          const stageTime = Date.now() - stageStartTime;
          processingStages.push({
            stage: 'priority_balancing',
            processingTimeMs: stageTime,
            questionsProcessed: currentQuestions.length,
            questionsFiltered: currentQuestions.length
          });

        } catch (error) {
          warnings.push(`Priority balancing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Stage 4: Frequency Harmonization
      if (options.enableFrequencyHarmonization && currentQuestions.length > 0) {
        const stageStartTime = Date.now();
        
        try {
          const questionsForHarmonization: QuestionForHarmonization[] = currentQuestions.map(q => ({
            questionId: q.questionId,
            text: q.text,
            currentFrequency: q.frequency,
            targetFrequency: q.frequency * 1.2, // Slight increase target
            category: q.category,
            topicCategory: q.topicCategory,
            priorityLevel: q.basePriority,
            lastPresentedAt: q.lastPresentedAt,
            businessRules: request.constraints.businessRules
          }));

          const combinationRule = await this.combinationEngine.getActiveCombinationRule();
          frequencyHarmonization = await this.frequencyHarmonizerService.harmonizeFrequencies(
            questionsForHarmonization,
            combinationRule?.id || 'default',
            { conflictResolutionStrategy: 'adaptive' }
          );

          const stageTime = Date.now() - stageStartTime;
          processingStages.push({
            stage: 'frequency_harmonization',
            processingTimeMs: stageTime,
            questionsProcessed: currentQuestions.length,
            questionsFiltered: currentQuestions.length
          });

        } catch (error) {
          warnings.push(`Frequency harmonization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Stage 5: Time Optimization
      if (options.enableTimeOptimization && currentQuestions.length > 0) {
        const stageStartTime = Date.now();
        
        try {
          const questionsForOptimization: QuestionForOptimization[] = currentQuestions.map(q => ({
            questionId: q.questionId,
            text: q.text,
            tokenCount: q.tokenCount,
            category: q.category,
            topicCategory: q.topicCategory,
            priorityLevel: q.basePriority
          }));

          const timeConfig: TimeConstraintConfig = {
            maxDurationSeconds: request.constraints.maxDurationSeconds,
            bufferTimePercentage: 15, // 15% buffer for safety
            transitionTimePerQuestion: 2,
            algorithmPreference: options.processingMode === 'fast' ? 'speed' : 'balanced'
          };

          timeOptimization = await this.timeOptimizer.optimizeForTimeConstraint(
            questionsForOptimization,
            timeConfig
          );

          // Filter to only optimized questions
          const optimizedQuestionIds = new Set(
            timeOptimization.selectedQuestions.map(q => q.questionId)
          );
          currentQuestions = currentQuestions.filter(q => optimizedQuestionIds.has(q.questionId));

          const stageTime = Date.now() - stageStartTime;
          processingStages.push({
            stage: 'time_optimization',
            processingTimeMs: stageTime,
            questionsProcessed: questionsForOptimization.length,
            questionsFiltered: currentQuestions.length
          });

        } catch (error) {
          warnings.push(`Time optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Stage 6: Final Question Combination
      const stageStartTime = Date.now();
      
      try {
        const candidateQuestions: QuestionCandidate[] = currentQuestions.map(q => ({
          questionId: q.questionId,
          text: q.text,
          frequency: q.frequency,
          category: q.category,
          priorityLevel: q.basePriority,
          estimatedTokens: q.tokenCount,
          weightFactor: 1.0,
          topicCategory: q.topicCategory,
          isTriggered: triggerEvaluation?.questionsTriggered.includes(q.questionId) || false,
          triggerReasons: triggerEvaluation?.activatedTriggers
            .filter(t => t.questionsToTrigger.includes(q.questionId))
            .map(t => t.activationReason) || []
        }));

        combination = await this.combinationEngine.combineQuestions(
          candidateQuestions,
          request.customerContext,
          {
            maxDurationSeconds: request.constraints.maxDurationSeconds,
            strategy: 'weighted_selection'
          }
        );

        const stageTime = Date.now() - stageStartTime;
        processingStages.push({
          stage: 'question_combination',
          processingTimeMs: stageTime,
          questionsProcessed: candidateQuestions.length,
          questionsFiltered: combination.selectedQuestions.length
        });

      } catch (error) {
        errors.push(`Question combination failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }

      // Build final result
      const totalProcessingTime = Date.now() - totalStartTime;
      const selectedQuestions = combination.selectedQuestions.map(selected => {
        const harmonizedQuestion = frequencyHarmonization?.harmonizedQuestions
          .find(h => h.questionId === selected.questionId);
        const optimizedQuestion = timeOptimization?.selectedQuestions
          .find(o => o.questionId === selected.questionId);

        return {
          questionId: selected.questionId,
          text: selected.text,
          selectionReason: selected.selectionReason,
          finalPriority: selected.finalPriority,
          estimatedDuration: selected.estimatedDuration,
          triggerReasons: candidateQuestions.find(c => c.questionId === selected.questionId)?.triggerReasons,
          groupAssignment: topicGrouping?.groups
            .find(g => g.questions.some(q => q.questionId === selected.questionId))?.groupName,
          harmonizedFrequency: harmonizedQuestion?.harmonizedFrequency,
          timeAllocation: optimizedQuestion?.timeAllocation || 0
        };
      });

      // Calculate performance metrics
      const meetsTimeRequirement = totalProcessingTime < 500;
      const questionCoverage = (selectedQuestions.length / request.availableQuestions.length) * 100;
      const priorityDistribution = selectedQuestions.reduce((dist, q) => {
        dist[q.finalPriority] = (dist[q.finalPriority] || 0) + 1;
        return dist;
      }, {} as Record<number, number>);
      const averageConfidence = combination.optimizationMetadata.coverageRate;

      const result: QuestionEvaluationResult = {
        selectedQuestions,
        evaluationMetadata: {
          totalQuestionsEvaluated: request.availableQuestions.length,
          processingStages,
          triggerEvaluation,
          topicGrouping,
          priorityBalancing,
          frequencyHarmonization,
          timeOptimization,
          combination,
          totalProcessingTimeMs: totalProcessingTime,
          performanceMetrics: {
            meetsTimeRequirement,
            questionCoverage,
            priorityDistribution,
            averageConfidence
          }
        },
        warnings,
        errors
      };

      await this.loggingService.logInfo('Question evaluation completed', {
        businessId: request.businessId,
        verificationId: request.customerContext.verificationId,
        questionsEvaluated: request.availableQuestions.length,
        questionsSelected: selectedQuestions.length,
        totalProcessingTimeMs: totalProcessingTime,
        meetsPerformanceRequirement: meetsTimeRequirement
      });

      // Performance warning if requirement not met
      if (!meetsTimeRequirement) {
        await this.loggingService.logWarning('Question evaluation exceeded performance threshold', {
          businessId: request.businessId,
          processingTimeMs: totalProcessingTime,
          threshold: 500
        });
      }

      return result;

    } catch (error) {
      const totalProcessingTime = Date.now() - totalStartTime;
      
      await this.loggingService.logError('Question evaluation failed', {
        businessId: request.businessId,
        verificationId: request.customerContext.verificationId,
        totalProcessingTimeMs: totalProcessingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingStages: processingStages.length
      });

      throw error;
    }
  }

  private calculateRecencyScore(lastPresentedAt: string): number {
    const lastPresented = new Date(lastPresentedAt);
    const now = new Date();
    const hoursSince = (now.getTime() - lastPresented.getTime()) / (1000 * 60 * 60);
    
    // Score from 0-10, where recent presentations get lower scores
    if (hoursSince < 1) return 0;
    if (hoursSince < 6) return 2;
    if (hoursSince < 24) return 5;
    if (hoursSince < 72) return 7;
    return 10;
  }

  async validatePerformanceRequirement(): Promise<boolean> {
    // Test with sample data to ensure <500ms requirement
    const sampleRequest: QuestionEvaluationRequest = {
      businessId: 'test-business',
      customerContext: {
        verificationId: 'performance-test',
        purchaseCategories: ['meat', 'produce'],
        transactionAmount: 450.0,
        timeOfDay: 12.5
      },
      availableQuestions: Array.from({ length: 30 }, (_, i) => ({
        questionId: `sample-${i}`,
        text: `Sample question ${i} with varying length and complexity`,
        category: ['service', 'product', 'experience'][i % 3],
        topicCategory: ['checkout', 'quality', 'delivery'][i % 3],
        basePriority: Math.floor(Math.random() * 5) + 1,
        frequency: Math.floor(Math.random() * 10) + 1,
        tokenCount: Math.floor(Math.random() * 50) + 20,
        keywords: [`keyword${i}`, `category${i % 3}`],
        businessImportance: Math.floor(Math.random() * 5) + 1,
        lastPresentedAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
      })),
      constraints: {
        maxDurationSeconds: 90,
        minQuestionsToSelect: 3,
        maxQuestionsToSelect: 8,
        priorityThreshold: 2
      },
      processingOptions: {
        processingMode: 'balanced'
      }
    };

    const startTime = Date.now();
    
    try {
      const result = await this.evaluateQuestions(sampleRequest);
      const duration = Date.now() - startTime;
      return duration < 500 && result.evaluationMetadata.performanceMetrics.meetsTimeRequirement;
    } catch {
      return false;
    }
  }

  async getProcessingCapabilities(): Promise<{
    supportedModes: string[];
    processingStages: string[];
    performanceCharacteristics: Record<string, any>;
  }> {
    return {
      supportedModes: ['fast', 'balanced', 'comprehensive'],
      processingStages: [
        'trigger_evaluation',
        'topic_grouping',
        'priority_balancing',
        'frequency_harmonization',
        'time_optimization',
        'question_combination'
      ],
      performanceCharacteristics: {
        fastMode: { targetTime: '<200ms', accuracy: 'medium', features: 'basic' },
        balancedMode: { targetTime: '<500ms', accuracy: 'high', features: 'standard' },
        comprehensiveMode: { targetTime: '<1000ms', accuracy: 'highest', features: 'advanced' }
      }
    };
  }
}