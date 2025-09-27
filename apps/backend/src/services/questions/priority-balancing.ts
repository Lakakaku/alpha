import {
  getPriorityWeights,
  createPriorityWeight,
  updatePriorityWeight,
  calculateQuestionPriority,
  getQuestionsByPriorityThreshold
} from '@vocilia/database/questions/priority-weights';
import { loggingService } from '../loggingService';

export interface PriorityBalanceResult {
  balancedQuestions: Array<{
    questionId: string;
    text: string;
    originalPriority: number;
    balancedPriority: number;
    balanceReason: string;
    weightFactor: number;
    priorityBoost: number;
  }>;
  balanceMetadata: {
    totalQuestions: number;
    priorityDistribution: Record<number, number>;
    balanceStrategy: string;
    averagePriority: number;
    prioritySpread: number;
    processingTimeMs: number;
  };
}

export interface BalanceConfig {
  strategy: 'equal_distribution' | 'weighted_urgency' | 'time_sensitive' | 'business_priority';
  maxPriorityLevel: number;
  minPriorityLevel: number;
  targetDistribution?: Record<number, number>; // priority level -> percentage
  urgencyMultipliers?: Record<string, number>; // category -> multiplier
  timeSensitivityThresholds?: Record<string, number>; // time window -> boost
}

export interface QuestionForBalancing {
  questionId: string;
  text: string;
  category: string;
  topicCategory: string;
  basePriority: number;
  frequencyScore: number;
  recencyScore: number;
  businessImportance: number;
  customerRelevance: number;
  estimatedDuration: number;
}

export interface BalanceAnalytics {
  businessId: string;
  totalBalanceOperations: number;
  averageBalanceTime: number;
  mostCommonStrategy: string;
  priorityEffectiveness: Record<number, number>;
  distributionOptimality: number;
}

export class PriorityBalancingService {
  constructor(
    private readonly businessId: string,
    private readonly loggingService: typeof loggingService
  ) {}

  async balanceQuestionPriorities(
    questions: QuestionForBalancing[],
    config: BalanceConfig
  ): Promise<PriorityBalanceResult> {
    const startTime = Date.now();

    try {
      // Get existing priority weights for this business
      const priorityWeights = await getPriorityWeights(this.businessId);
      
      // Apply balancing strategy
      const balancedQuestions = await this.applyBalancingStrategy(
        questions,
        config,
        priorityWeights
      );

      // Calculate priority distribution
      const priorityDistribution = this.calculatePriorityDistribution(balancedQuestions);
      const averagePriority = this.calculateAveragePriority(balancedQuestions);
      const prioritySpread = this.calculatePrioritySpread(balancedQuestions);

      const processingTime = Date.now() - startTime;

      const result: PriorityBalanceResult = {
        balancedQuestions,
        balanceMetadata: {
          totalQuestions: questions.length,
          priorityDistribution,
          balanceStrategy: config.strategy,
          averagePriority,
          prioritySpread,
          processingTimeMs: processingTime
        }
      };

      await this.loggingService.logInfo('Priority balancing completed', {
        businessId: this.businessId,
        totalQuestions: questions.length,
        strategy: config.strategy,
        averagePriority,
        processingTimeMs: processingTime
      });

      return result;

    } catch (error) {
      await this.loggingService.logError('Priority balancing failed', {
        businessId: this.businessId,
        totalQuestions: questions.length,
        strategy: config.strategy,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async applyBalancingStrategy(
    questions: QuestionForBalancing[],
    config: BalanceConfig,
    priorityWeights: any[]
  ): Promise<PriorityBalanceResult['balancedQuestions']> {
    
    switch (config.strategy) {
      case 'equal_distribution':
        return await this.applyEqualDistribution(questions, config);
      
      case 'weighted_urgency':
        return await this.applyWeightedUrgency(questions, config, priorityWeights);
      
      case 'time_sensitive':
        return await this.applyTimeSensitive(questions, config, priorityWeights);
      
      case 'business_priority':
        return await this.applyBusinessPriority(questions, config, priorityWeights);
      
      default:
        throw new Error(`Unknown balancing strategy: ${config.strategy}`);
    }
  }

  private async applyEqualDistribution(
    questions: QuestionForBalancing[],
    config: BalanceConfig
  ): Promise<PriorityBalanceResult['balancedQuestions']> {
    
    const totalQuestions = questions.length;
    const priorityLevels = config.maxPriorityLevel - config.minPriorityLevel + 1;
    const questionsPerLevel = Math.ceil(totalQuestions / priorityLevels);

    // Sort questions by combined score (base priority + relevance + business importance)
    const sortedQuestions = [...questions].sort((a, b) => {
      const scoreA = a.basePriority + a.customerRelevance + a.businessImportance;
      const scoreB = b.basePriority + b.customerRelevance + b.businessImportance;
      return scoreB - scoreA;
    });

    const balancedQuestions: PriorityBalanceResult['balancedQuestions'] = [];

    sortedQuestions.forEach((question, index) => {
      const priorityLevelIndex = Math.floor(index / questionsPerLevel);
      const balancedPriority = Math.min(
        config.maxPriorityLevel,
        config.maxPriorityLevel - priorityLevelIndex
      );

      balancedQuestions.push({
        questionId: question.questionId,
        text: question.text,
        originalPriority: question.basePriority,
        balancedPriority,
        balanceReason: `Equal distribution - rank ${index + 1} of ${totalQuestions}`,
        weightFactor: 1.0,
        priorityBoost: balancedPriority - question.basePriority
      });
    });

    return balancedQuestions;
  }

  private async applyWeightedUrgency(
    questions: QuestionForBalancing[],
    config: BalanceConfig,
    priorityWeights: any[]
  ): Promise<PriorityBalanceResult['balancedQuestions']> {
    
    const balancedQuestions: PriorityBalanceResult['balancedQuestions'] = [];

    for (const question of questions) {
      // Calculate urgency score based on frequency and recency
      const urgencyScore = (question.frequencyScore * 0.4) + (question.recencyScore * 0.6);
      
      // Apply category multiplier if configured
      const categoryMultiplier = config.urgencyMultipliers?.[question.category] || 1.0;
      const adjustedUrgencyScore = urgencyScore * categoryMultiplier;

      // Calculate priority using database function
      const priorityResult = await calculateQuestionPriority(
        question.questionId,
        this.businessId,
        {
          baseScore: question.basePriority,
          urgencyScore: adjustedUrgencyScore,
          businessImportance: question.businessImportance,
          customerRelevance: question.customerRelevance
        }
      );

      // Clamp to configured range
      const balancedPriority = Math.min(
        config.maxPriorityLevel,
        Math.max(config.minPriorityLevel, priorityResult.finalPriority)
      );

      balancedQuestions.push({
        questionId: question.questionId,
        text: question.text,
        originalPriority: question.basePriority,
        balancedPriority,
        balanceReason: `Weighted urgency - score: ${adjustedUrgencyScore.toFixed(2)}`,
        weightFactor: priorityResult.adjustedWeight,
        priorityBoost: balancedPriority - question.basePriority
      });
    }

    return balancedQuestions;
  }

  private async applyTimeSensitive(
    questions: QuestionForBalancing[],
    config: BalanceConfig,
    priorityWeights: any[]
  ): Promise<PriorityBalanceResult['balancedQuestions']> {
    
    const balancedQuestions: PriorityBalanceResult['balancedQuestions'] = [];

    for (const question of questions) {
      let timeSensitivityBoost = 0;
      
      // Apply time-based boosts based on estimated duration
      if (config.timeSensitivityThresholds) {
        if (question.estimatedDuration <= 15 && config.timeSensitivityThresholds['short']) {
          timeSensitivityBoost = config.timeSensitivityThresholds['short'];
        } else if (question.estimatedDuration <= 30 && config.timeSensitivityThresholds['medium']) {
          timeSensitivityBoost = config.timeSensitivityThresholds['medium'];
        } else if (config.timeSensitivityThresholds['long']) {
          timeSensitivityBoost = config.timeSensitivityThresholds['long'];
        }
      }

      // Calculate time-adjusted priority
      const timeAdjustedPriority = question.basePriority + 
        (question.recencyScore * 0.3) + 
        timeSensitivityBoost;

      // Apply business importance weighting
      const finalPriority = timeAdjustedPriority + (question.businessImportance * 0.2);

      // Clamp to configured range
      const balancedPriority = Math.min(
        config.maxPriorityLevel,
        Math.max(config.minPriorityLevel, Math.round(finalPriority))
      );

      balancedQuestions.push({
        questionId: question.questionId,
        text: question.text,
        originalPriority: question.basePriority,
        balancedPriority,
        balanceReason: `Time-sensitive - boost: ${timeSensitivityBoost.toFixed(1)}`,
        weightFactor: 1.0 + (timeSensitivityBoost / 10),
        priorityBoost: balancedPriority - question.basePriority
      });
    }

    return balancedQuestions;
  }

  private async applyBusinessPriority(
    questions: QuestionForBalancing[],
    config: BalanceConfig,
    priorityWeights: any[]
  ): Promise<PriorityBalanceResult['balancedQuestions']> {
    
    const balancedQuestions: PriorityBalanceResult['balancedQuestions'] = [];

    // Create weight map for quick lookup
    const weightMap = new Map<string, number>();
    priorityWeights.forEach(weight => {
      weightMap.set(weight.category, weight.weight_factor);
    });

    for (const question of questions) {
      // Get business-configured weight for this category
      const businessWeight = weightMap.get(question.category) || 1.0;
      const topicWeight = weightMap.get(question.topicCategory) || 1.0;

      // Calculate business-weighted priority
      const businessWeightedScore = 
        (question.basePriority * 0.4) +
        (question.businessImportance * businessWeight * 0.3) +
        (question.customerRelevance * topicWeight * 0.3);

      // Apply frequency dampening to avoid over-presenting
      const frequencyDampening = Math.max(0.5, 1.0 - (question.frequencyScore / 10));
      const adjustedScore = businessWeightedScore * frequencyDampening;

      // Clamp to configured range
      const balancedPriority = Math.min(
        config.maxPriorityLevel,
        Math.max(config.minPriorityLevel, Math.round(adjustedScore))
      );

      balancedQuestions.push({
        questionId: question.questionId,
        text: question.text,
        originalPriority: question.basePriority,
        balancedPriority,
        balanceReason: `Business priority - weight: ${businessWeight.toFixed(2)}`,
        weightFactor: businessWeight,
        priorityBoost: balancedPriority - question.basePriority
      });
    }

    return balancedQuestions;
  }

  private calculatePriorityDistribution(
    questions: PriorityBalanceResult['balancedQuestions']
  ): Record<number, number> {
    const distribution: Record<number, number> = {};
    
    questions.forEach(question => {
      const priority = question.balancedPriority;
      distribution[priority] = (distribution[priority] || 0) + 1;
    });

    return distribution;
  }

  private calculateAveragePriority(
    questions: PriorityBalanceResult['balancedQuestions']
  ): number {
    if (questions.length === 0) return 0;
    
    const totalPriority = questions.reduce((sum, q) => sum + q.balancedPriority, 0);
    return totalPriority / questions.length;
  }

  private calculatePrioritySpread(
    questions: PriorityBalanceResult['balancedQuestions']
  ): number {
    if (questions.length === 0) return 0;
    
    const priorities = questions.map(q => q.balancedPriority);
    const min = Math.min(...priorities);
    const max = Math.max(...priorities);
    
    return max - min;
  }

  async optimizeForTimeConstraint(
    questions: QuestionForBalancing[],
    maxDurationSeconds: number,
    priorityThreshold: number = 3
  ): Promise<PriorityBalanceResult> {
    const config: BalanceConfig = {
      strategy: 'time_sensitive',
      maxPriorityLevel: 5,
      minPriorityLevel: 1,
      timeSensitivityThresholds: {
        'short': 1.5,  // Questions under 15 seconds get priority boost
        'medium': 1.0, // Questions 15-30 seconds get moderate boost
        'long': 0.5    // Questions over 30 seconds get reduced priority
      }
    };

    // Filter questions that meet priority threshold
    const eligibleQuestions = questions.filter(q => q.basePriority >= priorityThreshold);

    const result = await this.balanceQuestionPriorities(eligibleQuestions, config);

    // Post-process to fit time constraint
    const timeConstrainedQuestions = this.selectQuestionsForTimeConstraint(
      result.balancedQuestions,
      maxDurationSeconds
    );

    return {
      ...result,
      balancedQuestions: timeConstrainedQuestions,
      balanceMetadata: {
        ...result.balanceMetadata,
        balanceStrategy: `${config.strategy}_with_time_constraint`
      }
    };
  }

  private selectQuestionsForTimeConstraint(
    questions: PriorityBalanceResult['balancedQuestions'],
    maxDurationSeconds: number
  ): PriorityBalanceResult['balancedQuestions'] {
    
    // Sort by balanced priority (highest first)
    const sortedQuestions = [...questions].sort((a, b) => b.balancedPriority - a.balancedPriority);
    
    const selected: PriorityBalanceResult['balancedQuestions'] = [];
    let totalDuration = 0;

    for (const question of sortedQuestions) {
      // Estimate duration from text length (rough approximation)
      const estimatedDuration = Math.max(15, question.text.length / 4.2); // ~4.2 chars per second
      
      if (totalDuration + estimatedDuration <= maxDurationSeconds) {
        selected.push(question);
        totalDuration += estimatedDuration;
      }
    }

    return selected;
  }

  async createPriorityWeight(
    category: string,
    weightFactor: number,
    adjustmentRules?: Record<string, number>
  ) {
    return await createPriorityWeight({
      business_id: this.businessId,
      category,
      weight_factor: weightFactor,
      adjustment_rules: adjustmentRules || {}
    });
  }

  async updatePriorityWeight(
    weightId: string,
    updates: {
      weightFactor?: number;
      adjustmentRules?: Record<string, number>;
      isActive?: boolean;
    }
  ) {
    const updateData: any = {};
    
    if (updates.weightFactor !== undefined) {
      updateData.weight_factor = updates.weightFactor;
    }
    
    if (updates.adjustmentRules !== undefined) {
      updateData.adjustment_rules = updates.adjustmentRules;
    }
    
    if (updates.isActive !== undefined) {
      updateData.is_active = updates.isActive;
    }

    return await updatePriorityWeight(weightId, updateData);
  }

  async getAnalytics(): Promise<BalanceAnalytics> {
    // This would typically query historical balance operations
    // For now, return basic analytics structure
    return {
      businessId: this.businessId,
      totalBalanceOperations: 0,
      averageBalanceTime: 0,
      mostCommonStrategy: 'business_priority',
      priorityEffectiveness: {},
      distributionOptimality: 0
    };
  }

  async validatePerformanceRequirement(): Promise<boolean> {
    // Test with sample data to ensure reasonable performance
    const sampleQuestions: QuestionForBalancing[] = Array.from({ length: 50 }, (_, i) => ({
      questionId: `sample-${i}`,
      text: `Sample question ${i} with some descriptive text`,
      category: ['service', 'product', 'experience'][i % 3],
      topicCategory: ['checkout', 'quality', 'delivery'][i % 3],
      basePriority: Math.floor(Math.random() * 5) + 1,
      frequencyScore: Math.random() * 10,
      recencyScore: Math.random() * 10,
      businessImportance: Math.random() * 5,
      customerRelevance: Math.random() * 5,
      estimatedDuration: Math.floor(Math.random() * 40) + 15
    }));

    const config: BalanceConfig = {
      strategy: 'weighted_urgency',
      maxPriorityLevel: 5,
      minPriorityLevel: 1
    };

    const startTime = Date.now();
    
    try {
      await this.balanceQuestionPriorities(sampleQuestions, config);
      const duration = Date.now() - startTime;
      return duration < 1000; // Should complete within 1 second for 50 questions
    } catch {
      return false;
    }
  }
}