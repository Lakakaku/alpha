import {
  getQuestionCombinationRules,
  createQuestionCombinationRule,
  updateQuestionCombinationRule
} from '@vocilia/database/questions/combination-rules';
import {
  getPriorityWeights,
  calculateQuestionPriority,
  getQuestionsByPriorityThreshold
} from '@vocilia/database/questions/priority-weights';
import {
  getQuestionGroups,
  getQuestionGroupsByCompatibility,
  getQuestionGroupsByDuration
} from '@vocilia/database/questions/question-groups';
import {
  optimizeQuestionSelection,
  updateOptimizerPerformance
} from '@vocilia/database/questions/time-optimizers';
import { loggingService } from '../loggingService';

export interface QuestionCandidate {
  questionId: string;
  text: string;
  frequency: number;
  category: string;
  priorityLevel: number;
  estimatedTokens: number;
  weightFactor: number;
  topicCategory: string;
  isTriggered: boolean;
  triggerReasons: string[];
}

export interface CombinationResult {
  selectedQuestions: Array<{
    questionId: string;
    text: string;
    priorityLevel: number;
    estimatedTokens: number;
    estimatedDuration: number;
    selectionReason: string;
    finalPriority: number;
  }>;
  totalEstimatedDuration: number;
  totalTokens: number;
  optimizationMetadata: {
    strategy: string;
    algorithmVersion: string;
    coverageRate: number;
    utilizationRate: number;
    droppedQuestions: number;
    timeConstraints: {
      maxDurationSeconds: number;
      priorityThresholds: Record<string, number>;
    };
  };
  combinationRuleId: string;
}

export interface CustomerContext {
  verificationId: string;
  purchaseCategories?: string[];
  purchaseItems?: string[];
  transactionAmount?: number;
  transactionCurrency?: string;
  transactionTime?: string;
  customerSegment?: string;
  timeOfDay?: number;
}

export class QuestionCombinationEngine {
  constructor(
    private readonly businessId: string,
    private readonly loggingService: typeof loggingService
  ) {}

  async combineQuestions(
    candidateQuestions: QuestionCandidate[],
    customerContext: CustomerContext,
    constraints: {
      maxDurationSeconds?: number;
      targetQuestionCount?: number;
      minPriorityLevel?: number;
      strategy?: 'greedy' | 'dynamic_programming' | 'weighted_selection' | 'time_based_priority';
    } = {}
  ): Promise<CombinationResult> {
    try {
      const startTime = Date.now();
      
      // Get the active combination rule for this business
      const combinationRules = await getQuestionCombinationRules(this.businessId);
      const activeRule = combinationRules.find(rule => rule.is_active);
      
      if (!activeRule) {
        throw new Error(`No active combination rule found for business ${this.businessId}`);
      }

      // Apply constraints from combination rule
      const maxDuration = constraints.maxDurationSeconds || activeRule.max_call_duration_seconds;
      const priorityThresholds = {
        critical: activeRule.priority_threshold_critical,
        high: activeRule.priority_threshold_high,
        medium: activeRule.priority_threshold_medium,
        low: activeRule.priority_threshold_low
      };

      // Calculate final priorities for all questions
      const questionsWithPriority = await Promise.all(
        candidateQuestions.map(async (question) => {
          const priorityResult = await calculateQuestionPriority(
            question.questionId,
            this.businessId,
            {
              purchaseCategories: customerContext.purchaseCategories,
              transactionAmount: customerContext.transactionAmount,
              timeOfDay: customerContext.timeOfDay,
              customerSegment: customerContext.customerSegment
            }
          );

          return {
            ...question,
            finalPriority: priorityResult.finalPriority,
            baseWeight: priorityResult.baseWeight,
            adjustedWeight: priorityResult.adjustedWeight,
            relevanceBoost: priorityResult.relevanceBoost
          };
        })
      );

      // Apply topic grouping for better conversation flow
      const groupedQuestions = await this.applyTopicGrouping(questionsWithPriority);

      // Optimize question selection based on time constraints
      const optimizationResult = await optimizeQuestionSelection(
        this.businessId,
        groupedQuestions.map(q => ({
          questionId: q.questionId,
          priorityLevel: q.priorityLevel,
          estimatedTokens: q.estimatedTokens,
          weightFactor: q.weightFactor,
          topicCategory: q.topicCategory
        })),
        {
          maxDurationSeconds: maxDuration,
          minPriorityLevel: constraints.minPriorityLevel,
          strategy: constraints.strategy
        }
      );

      // Enrich selected questions with full details
      const enrichedQuestions = optimizationResult.selectedQuestions.map(selected => {
        const originalQuestion = questionsWithPriority.find(q => q.questionId === selected.questionId);
        return {
          questionId: selected.questionId,
          text: originalQuestion?.text || '',
          priorityLevel: selected.priorityLevel,
          estimatedTokens: selected.estimatedTokens,
          estimatedDuration: selected.estimatedDuration,
          selectionReason: selected.selectionReason,
          finalPriority: originalQuestion?.finalPriority || 0
        };
      });

      const result: CombinationResult = {
        selectedQuestions: enrichedQuestions,
        totalEstimatedDuration: optimizationResult.totalEstimatedDuration,
        totalTokens: optimizationResult.totalTokens,
        optimizationMetadata: {
          ...optimizationResult.optimizationMetadata,
          timeConstraints: {
            maxDurationSeconds: maxDuration,
            priorityThresholds
          }
        },
        combinationRuleId: activeRule.id
      };

      // Log performance metrics
      const processingTime = Date.now() - startTime;
      await this.loggingService.logInfo('Question combination completed', {
        businessId: this.businessId,
        verificationId: customerContext.verificationId,
        candidateCount: candidateQuestions.length,
        selectedCount: enrichedQuestions.length,
        processingTimeMs: processingTime,
        strategy: optimizationResult.optimizationMetadata.strategy,
        coverageRate: optimizationResult.optimizationMetadata.coverageRate
      });

      // Performance requirement check: <500ms
      if (processingTime > 500) {
        await this.loggingService.logWarning('Question combination exceeded performance threshold', {
          businessId: this.businessId,
          processingTimeMs: processingTime,
          threshold: 500
        });
      }

      return result;

    } catch (error) {
      await this.loggingService.logError('Question combination failed', {
        businessId: this.businessId,
        verificationId: customerContext.verificationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        candidateCount: candidateQuestions.length
      });
      throw error;
    }
  }

  async updateCombinationEffectiveness(
    combinationRuleId: string,
    actualDuration: number,
    questionsCovered: number,
    totalQuestions: number,
    customerSatisfaction?: number
  ): Promise<void> {
    try {
      // Update the optimizer performance metrics
      const optimizers = await this.getOptimizersForRule(combinationRuleId);
      
      for (const optimizer of optimizers) {
        await updateOptimizerPerformance(
          optimizer.id,
          actualDuration,
          questionsCovered,
          totalQuestions,
          customerSatisfaction
        );
      }

      await this.loggingService.logInfo('Combination effectiveness updated', {
        combinationRuleId,
        actualDuration,
        questionsCovered,
        totalQuestions,
        customerSatisfaction
      });

    } catch (error) {
      await this.loggingService.logError('Failed to update combination effectiveness', {
        combinationRuleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getActiveCombinationRule() {
    const rules = await getQuestionCombinationRules(this.businessId);
    return rules.find(rule => rule.is_active);
  }

  async createCombinationRule(ruleData: {
    ruleName: string;
    maxCallDurationSeconds: number;
    priorityThresholds: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  }) {
    return await createQuestionCombinationRule({
      business_id: this.businessId,
      rule_name: ruleData.ruleName,
      max_call_duration_seconds: ruleData.maxCallDurationSeconds,
      priority_threshold_critical: ruleData.priorityThresholds.critical,
      priority_threshold_high: ruleData.priorityThresholds.high,
      priority_threshold_medium: ruleData.priorityThresholds.medium,
      priority_threshold_low: ruleData.priorityThresholds.low
    });
  }

  async updateCombinationRule(
    ruleId: string,
    updates: {
      ruleName?: string;
      maxCallDurationSeconds?: number;
      priorityThresholds?: {
        critical?: number;
        high?: number;
        medium?: number;
        low?: number;
      };
      isActive?: boolean;
    }
  ) {
    const updateData: any = {};
    
    if (updates.ruleName) updateData.rule_name = updates.ruleName;
    if (updates.maxCallDurationSeconds) updateData.max_call_duration_seconds = updates.maxCallDurationSeconds;
    if (updates.priorityThresholds?.critical !== undefined) updateData.priority_threshold_critical = updates.priorityThresholds.critical;
    if (updates.priorityThresholds?.high !== undefined) updateData.priority_threshold_high = updates.priorityThresholds.high;
    if (updates.priorityThresholds?.medium !== undefined) updateData.priority_threshold_medium = updates.priorityThresholds.medium;
    if (updates.priorityThresholds?.low !== undefined) updateData.priority_threshold_low = updates.priorityThresholds.low;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    return await updateQuestionCombinationRule(ruleId, updateData);
  }

  private async applyTopicGrouping(
    questions: (QuestionCandidate & { finalPriority: number })[]
  ): Promise<(QuestionCandidate & { finalPriority: number })[]> {
    try {
      // Get topic groups for better conversation flow
      const questionGroups = await getQuestionGroups(this.businessId, { isActive: true });
      
      // Create topic category map
      const topicMap = new Map<string, number>();
      questionGroups.forEach(group => {
        topicMap.set(group.topic_category, group.priority_boost);
      });

      // Apply topic grouping boost and sort for natural flow
      const groupedQuestions = questions.map(question => {
        const topicBoost = topicMap.get(question.topicCategory) || 1.0;
        return {
          ...question,
          finalPriority: question.finalPriority * topicBoost,
          topicBoost
        };
      });

      // Sort by topic category first, then by priority within topics
      groupedQuestions.sort((a, b) => {
        if (a.topicCategory !== b.topicCategory) {
          return a.topicCategory.localeCompare(b.topicCategory);
        }
        return b.finalPriority - a.finalPriority;
      });

      return groupedQuestions;

    } catch (error) {
      // If topic grouping fails, return original questions sorted by priority
      await this.loggingService.logWarning('Topic grouping failed, falling back to priority sorting', {
        businessId: this.businessId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return questions.sort((a, b) => b.finalPriority - a.finalPriority);
    }
  }

  private async getOptimizersForRule(combinationRuleId: string) {
    // This would typically query for optimizers associated with this rule
    // For now, return all active optimizers for the business
    const { getTimeConstraintOptimizers } = await import('@vocilia/database/questions/time-optimizers');
    return await getTimeConstraintOptimizers(this.businessId, { isActive: true });
  }

  async getPerformanceMetrics(timeWindowHours: number = 24) {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - timeWindowHours);

    // This would typically query performance logs
    // For now, return mock metrics structure
    return {
      averageProcessingTime: 0,
      successRate: 0,
      averageCoverageRate: 0,
      totalCombinations: 0,
      performanceThresholdViolations: 0
    };
  }

  async validatePerformanceRequirement(): Promise<boolean> {
    // Test with sample data to ensure <500ms requirement
    const sampleQuestions: QuestionCandidate[] = Array.from({ length: 20 }, (_, i) => ({
      questionId: `sample-${i}`,
      text: `Sample question ${i}`,
      frequency: Math.floor(Math.random() * 10) + 1,
      category: ['service', 'product', 'experience'][i % 3],
      priorityLevel: Math.floor(Math.random() * 5) + 1,
      estimatedTokens: Math.floor(Math.random() * 40) + 20,
      weightFactor: Math.random() * 2 + 0.5,
      topicCategory: ['checkout', 'product_quality', 'service'][i % 3],
      isTriggered: Math.random() > 0.5,
      triggerReasons: []
    }));

    const sampleContext: CustomerContext = {
      verificationId: 'performance-test',
      purchaseCategories: ['meat', 'produce'],
      transactionAmount: 450.0,
      timeOfDay: 12.5
    };

    const startTime = Date.now();
    
    try {
      await this.combineQuestions(sampleQuestions, sampleContext);
      const duration = Date.now() - startTime;
      return duration < 500;
    } catch {
      return false;
    }
  }
}