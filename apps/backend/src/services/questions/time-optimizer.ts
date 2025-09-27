import {
  getTimeConstraintOptimizers,
  createTimeConstraintOptimizer,
  updateTimeConstraintOptimizer,
  optimizeQuestionSelection,
  updateOptimizerPerformance
} from '@vocilia/database/questions/time-optimizers';
import { loggingService } from '../loggingService';

export interface TimeOptimizationResult {
  selectedQuestions: Array<{
    questionId: string;
    text: string;
    estimatedDuration: number;
    priorityLevel: number;
    selectionReason: string;
    timeAllocation: number; // Percentage of total time
    confidenceScore: number; // How confident we are in the duration estimate
  }>;
  optimizationMetadata: {
    algorithm: 'greedy_priority' | 'dynamic_programming' | 'time_balanced' | 'token_estimation';
    totalEstimatedDuration: number;
    timeUtilization: number; // Percentage of constraint used
    questionsConsidered: number;
    questionsSelected: number;
    averageConfidence: number;
    processingTimeMs: number;
  };
  timeBreakdown: {
    questionTime: number;
    bufferTime: number;
    transitionTime: number;
    totalConstraint: number;
  };
  fallbackStrategies?: string[];
}

export interface QuestionForOptimization {
  questionId: string;
  text: string;
  tokenCount: number;
  category: string;
  topicCategory: string;
  priorityLevel: number;
  estimatedDurationSeconds?: number;
  historicalDuration?: number;
  complexityFactor?: number;
}

export interface TimeConstraintConfig {
  maxDurationSeconds: number;
  minDurationSeconds?: number;
  bufferTimePercentage?: number; // Extra time buffer (default 10%)
  transitionTimePerQuestion?: number; // Time between questions (default 2 seconds)
  priorityThresholds?: Record<number, number>; // Priority level -> minimum time allocation
  algorithmPreference?: 'speed' | 'accuracy' | 'balanced';
}

export interface OptimizationStrategy {
  name: string;
  description: string;
  timeComplexity: string;
  accuracy: 'high' | 'medium' | 'low';
  speed: 'fast' | 'medium' | 'slow';
}

export class TimeConstraintOptimizer {
  constructor(
    private readonly businessId: string,
    private readonly loggingService: typeof loggingService
  ) {}

  async optimizeForTimeConstraint(
    questions: QuestionForOptimization[],
    config: TimeConstraintConfig
  ): Promise<TimeOptimizationResult> {
    const startTime = Date.now();

    try {
      // Get active optimizer configurations
      const optimizers = await getTimeConstraintOptimizers(this.businessId, { isActive: true });
      
      // Determine best algorithm based on config and data size
      const algorithm = this.selectOptimalAlgorithm(questions, config, optimizers);
      
      // Apply time estimation to questions
      const questionsWithEstimates = await this.estimateQuestionDurations(questions);
      
      // Run optimization algorithm
      const optimizationResult = await this.runOptimizationAlgorithm(
        questionsWithEstimates,
        config,
        algorithm
      );

      const processingTime = Date.now() - startTime;

      const result: TimeOptimizationResult = {
        ...optimizationResult,
        optimizationMetadata: {
          ...optimizationResult.optimizationMetadata,
          processingTimeMs: processingTime
        }
      };

      await this.loggingService.logInfo('Time constraint optimization completed', {
        businessId: this.businessId,
        algorithm,
        questionsConsidered: questions.length,
        questionsSelected: optimizationResult.selectedQuestions.length,
        timeUtilization: optimizationResult.optimizationMetadata.timeUtilization,
        processingTimeMs: processingTime
      });

      // Performance requirement: <500ms for optimization
      if (processingTime > 500) {
        await this.loggingService.logWarning('Time optimization exceeded performance threshold', {
          businessId: this.businessId,
          processingTimeMs: processingTime,
          threshold: 500
        });
      }

      return result;

    } catch (error) {
      await this.loggingService.logError('Time constraint optimization failed', {
        businessId: this.businessId,
        questionsCount: questions.length,
        maxDuration: config.maxDurationSeconds,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private selectOptimalAlgorithm(
    questions: QuestionForOptimization[],
    config: TimeConstraintConfig,
    optimizers: any[]
  ): 'greedy_priority' | 'dynamic_programming' | 'time_balanced' | 'token_estimation' {
    
    const questionCount = questions.length;
    const preference = config.algorithmPreference || 'balanced';
    
    // For small datasets, use dynamic programming for optimal results
    if (questionCount <= 20 && preference !== 'speed') {
      return 'dynamic_programming';
    }
    
    // For large datasets or speed preference, use greedy approach
    if (questionCount > 50 || preference === 'speed') {
      return 'greedy_priority';
    }
    
    // For accuracy preference with medium datasets, use time-balanced approach
    if (preference === 'accuracy') {
      return 'time_balanced';
    }
    
    // Default to token estimation for balanced approach
    return 'token_estimation';
  }

  private async estimateQuestionDurations(
    questions: QuestionForOptimization[]
  ): Promise<Array<QuestionForOptimization & { estimatedDuration: number; confidence: number }>> {
    
    const questionsWithEstimates = await Promise.all(
      questions.map(async (question) => {
        let estimatedDuration: number;
        let confidence: number;

        // Use historical data if available
        if (question.historicalDuration) {
          estimatedDuration = question.historicalDuration;
          confidence = 0.9;
        } 
        // Use provided estimate
        else if (question.estimatedDurationSeconds) {
          estimatedDuration = question.estimatedDurationSeconds;
          confidence = 0.7;
        } 
        // Estimate from token count
        else {
          estimatedDuration = this.estimateDurationFromTokens(
            question.tokenCount,
            question.complexityFactor || 1.0
          );
          confidence = 0.6;
        }

        // Apply category-based adjustments
        const categoryAdjustment = this.getCategoryDurationAdjustment(question.category);
        estimatedDuration *= categoryAdjustment;

        return {
          ...question,
          estimatedDuration: Math.round(estimatedDuration),
          confidence
        };
      })
    );

    return questionsWithEstimates;
  }

  private estimateDurationFromTokens(tokenCount: number, complexityFactor: number = 1.0): number {
    // Base estimation: ~4.2 tokens per second for natural speech
    // Add complexity factor for more difficult questions
    const baseDuration = tokenCount / 4.2;
    const complexityAdjustment = 1.0 + ((complexityFactor - 1.0) * 0.3);
    
    // Add minimum duration for very short questions
    return Math.max(8, baseDuration * complexityAdjustment);
  }

  private getCategoryDurationAdjustment(category: string): number {
    const adjustments: Record<string, number> = {
      'product_quality': 1.2, // Often requires more thought
      'service_experience': 1.1,
      'checkout_process': 0.9, // Usually straightforward
      'general_feedback': 1.0,
      'specific_item': 1.3, // May need detailed responses
    };

    return adjustments[category] || 1.0;
  }

  private async runOptimizationAlgorithm(
    questions: Array<QuestionForOptimization & { estimatedDuration: number; confidence: number }>,
    config: TimeConstraintConfig,
    algorithm: 'greedy_priority' | 'dynamic_programming' | 'time_balanced' | 'token_estimation'
  ): Promise<Omit<TimeOptimizationResult, 'optimizationMetadata'> & { 
    optimizationMetadata: Omit<TimeOptimizationResult['optimizationMetadata'], 'processingTimeMs'> 
  }> {
    
    switch (algorithm) {
      case 'greedy_priority':
        return await this.runGreedyPriorityAlgorithm(questions, config);
      
      case 'dynamic_programming':
        return await this.runDynamicProgrammingAlgorithm(questions, config);
      
      case 'time_balanced':
        return await this.runTimeBalancedAlgorithm(questions, config);
      
      case 'token_estimation':
        return await this.runTokenEstimationAlgorithm(questions, config);
      
      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }

  private async runGreedyPriorityAlgorithm(
    questions: Array<QuestionForOptimization & { estimatedDuration: number; confidence: number }>,
    config: TimeConstraintConfig
  ): Promise<any> {
    
    // Calculate available time
    const bufferTime = (config.bufferTimePercentage || 10) / 100 * config.maxDurationSeconds;
    const transitionTimePerQuestion = config.transitionTimePerQuestion || 2;
    let availableTime = config.maxDurationSeconds - bufferTime;

    // Sort by priority (highest first), then by duration (shortest first) as tiebreaker
    const sortedQuestions = [...questions].sort((a, b) => {
      if (a.priorityLevel !== b.priorityLevel) {
        return b.priorityLevel - a.priorityLevel;
      }
      return a.estimatedDuration - b.estimatedDuration;
    });

    const selectedQuestions: TimeOptimizationResult['selectedQuestions'] = [];
    let totalDuration = 0;

    for (const question of sortedQuestions) {
      const questionTime = question.estimatedDuration + transitionTimePerQuestion;
      
      if (totalDuration + questionTime <= availableTime) {
        const timeAllocation = (questionTime / config.maxDurationSeconds) * 100;
        
        selectedQuestions.push({
          questionId: question.questionId,
          text: question.text,
          estimatedDuration: question.estimatedDuration,
          priorityLevel: question.priorityLevel,
          selectionReason: `Greedy selection - Priority ${question.priorityLevel}`,
          timeAllocation,
          confidenceScore: question.confidence
        });

        totalDuration += questionTime;
      }
    }

    const timeUtilization = (totalDuration / config.maxDurationSeconds) * 100;
    const averageConfidence = selectedQuestions.length > 0
      ? selectedQuestions.reduce((sum, q) => sum + q.confidenceScore, 0) / selectedQuestions.length
      : 0;

    return {
      selectedQuestions,
      optimizationMetadata: {
        algorithm: 'greedy_priority' as const,
        totalEstimatedDuration: totalDuration,
        timeUtilization,
        questionsConsidered: questions.length,
        questionsSelected: selectedQuestions.length,
        averageConfidence,
        processingTimeMs: 0 // Will be set by caller
      },
      timeBreakdown: {
        questionTime: totalDuration - (selectedQuestions.length * transitionTimePerQuestion),
        bufferTime,
        transitionTime: selectedQuestions.length * transitionTimePerQuestion,
        totalConstraint: config.maxDurationSeconds
      }
    };
  }

  private async runDynamicProgrammingAlgorithm(
    questions: Array<QuestionForOptimization & { estimatedDuration: number; confidence: number }>,
    config: TimeConstraintConfig
  ): Promise<any> {
    
    // Implementation of knapsack-style dynamic programming
    const bufferTime = (config.bufferTimePercentage || 10) / 100 * config.maxDurationSeconds;
    const availableTime = Math.floor(config.maxDurationSeconds - bufferTime);
    const transitionTimePerQuestion = config.transitionTimePerQuestion || 2;

    // Create DP table: dp[i][w] = maximum value using first i questions with time w
    const n = questions.length;
    const dp: number[][] = Array(n + 1).fill(null).map(() => Array(availableTime + 1).fill(0));
    const selected: boolean[][] = Array(n + 1).fill(null).map(() => Array(availableTime + 1).fill(false));

    // Fill DP table
    for (let i = 1; i <= n; i++) {
      const question = questions[i - 1];
      const questionTime = Math.ceil(question.estimatedDuration + transitionTimePerQuestion);
      const value = question.priorityLevel * question.confidence; // Combined value score

      for (let w = 0; w <= availableTime; w++) {
        // Option 1: Don't include this question
        dp[i][w] = dp[i - 1][w];
        
        // Option 2: Include this question (if it fits)
        if (questionTime <= w) {
          const includeValue = dp[i - 1][w - questionTime] + value;
          if (includeValue > dp[i][w]) {
            dp[i][w] = includeValue;
            selected[i][w] = true;
          }
        }
      }
    }

    // Reconstruct solution
    const selectedQuestions: TimeOptimizationResult['selectedQuestions'] = [];
    let w = availableTime;
    let totalDuration = 0;

    for (let i = n; i > 0; i--) {
      if (selected[i][w]) {
        const question = questions[i - 1];
        const questionTime = question.estimatedDuration + transitionTimePerQuestion;
        const timeAllocation = (questionTime / config.maxDurationSeconds) * 100;

        selectedQuestions.unshift({
          questionId: question.questionId,
          text: question.text,
          estimatedDuration: question.estimatedDuration,
          priorityLevel: question.priorityLevel,
          selectionReason: `Optimal DP selection - Value score: ${(question.priorityLevel * question.confidence).toFixed(2)}`,
          timeAllocation,
          confidenceScore: question.confidence
        });

        totalDuration += questionTime;
        w -= questionTime;
      }
    }

    const timeUtilization = (totalDuration / config.maxDurationSeconds) * 100;
    const averageConfidence = selectedQuestions.length > 0
      ? selectedQuestions.reduce((sum, q) => sum + q.confidenceScore, 0) / selectedQuestions.length
      : 0;

    return {
      selectedQuestions,
      optimizationMetadata: {
        algorithm: 'dynamic_programming' as const,
        totalEstimatedDuration: totalDuration,
        timeUtilization,
        questionsConsidered: questions.length,
        questionsSelected: selectedQuestions.length,
        averageConfidence,
        processingTimeMs: 0
      },
      timeBreakdown: {
        questionTime: totalDuration - (selectedQuestions.length * transitionTimePerQuestion),
        bufferTime,
        transitionTime: selectedQuestions.length * transitionTimePerQuestion,
        totalConstraint: config.maxDurationSeconds
      }
    };
  }

  private async runTimeBalancedAlgorithm(
    questions: Array<QuestionForOptimization & { estimatedDuration: number; confidence: number }>,
    config: TimeConstraintConfig
  ): Promise<any> {
    
    const bufferTime = (config.bufferTimePercentage || 10) / 100 * config.maxDurationSeconds;
    const transitionTimePerQuestion = config.transitionTimePerQuestion || 2;
    let availableTime = config.maxDurationSeconds - bufferTime;

    // Group questions by priority level
    const priorityGroups = new Map<number, typeof questions>();
    questions.forEach(question => {
      const priority = question.priorityLevel;
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      priorityGroups.get(priority)!.push(question);
    });

    // Allocate time proportionally to priority levels
    const priorityLevels = Array.from(priorityGroups.keys()).sort((a, b) => b - a);
    const timeAllocations = new Map<number, number>();
    
    let totalPriorityWeight = 0;
    priorityLevels.forEach(priority => {
      totalPriorityWeight += priority * priorityGroups.get(priority)!.length;
    });

    priorityLevels.forEach(priority => {
      const groupSize = priorityGroups.get(priority)!.length;
      const priorityWeight = (priority * groupSize) / totalPriorityWeight;
      timeAllocations.set(priority, availableTime * priorityWeight);
    });

    // Select questions within each time allocation
    const selectedQuestions: TimeOptimizationResult['selectedQuestions'] = [];
    let totalDuration = 0;

    for (const priority of priorityLevels) {
      const groupQuestions = priorityGroups.get(priority)!;
      const allocatedTime = timeAllocations.get(priority)!;
      
      // Sort by duration within priority group
      groupQuestions.sort((a, b) => a.estimatedDuration - b.estimatedDuration);
      
      let groupTime = 0;
      for (const question of groupQuestions) {
        const questionTime = question.estimatedDuration + transitionTimePerQuestion;
        
        if (groupTime + questionTime <= allocatedTime) {
          const timeAllocation = (questionTime / config.maxDurationSeconds) * 100;
          
          selectedQuestions.push({
            questionId: question.questionId,
            text: question.text,
            estimatedDuration: question.estimatedDuration,
            priorityLevel: question.priorityLevel,
            selectionReason: `Time-balanced selection - Priority ${priority} allocation`,
            timeAllocation,
            confidenceScore: question.confidence
          });

          groupTime += questionTime;
          totalDuration += questionTime;
        }
      }
    }

    const timeUtilization = (totalDuration / config.maxDurationSeconds) * 100;
    const averageConfidence = selectedQuestions.length > 0
      ? selectedQuestions.reduce((sum, q) => sum + q.confidenceScore, 0) / selectedQuestions.length
      : 0;

    return {
      selectedQuestions,
      optimizationMetadata: {
        algorithm: 'time_balanced' as const,
        totalEstimatedDuration: totalDuration,
        timeUtilization,
        questionsConsidered: questions.length,
        questionsSelected: selectedQuestions.length,
        averageConfidence,
        processingTimeMs: 0
      },
      timeBreakdown: {
        questionTime: totalDuration - (selectedQuestions.length * transitionTimePerQuestion),
        bufferTime,
        transitionTime: selectedQuestions.length * transitionTimePerQuestion,
        totalConstraint: config.maxDurationSeconds
      }
    };
  }

  private async runTokenEstimationAlgorithm(
    questions: Array<QuestionForOptimization & { estimatedDuration: number; confidence: number }>,
    config: TimeConstraintConfig
  ): Promise<any> {
    
    const bufferTime = (config.bufferTimePercentage || 10) / 100 * config.maxDurationSeconds;
    const transitionTimePerQuestion = config.transitionTimePerQuestion || 2;
    let availableTime = config.maxDurationSeconds - bufferTime;

    // Calculate efficiency score: priority / estimated_duration
    const questionsWithEfficiency = questions.map(question => ({
      ...question,
      efficiency: question.priorityLevel / question.estimatedDuration
    }));

    // Sort by efficiency (highest first)
    questionsWithEfficiency.sort((a, b) => b.efficiency - a.efficiency);

    const selectedQuestions: TimeOptimizationResult['selectedQuestions'] = [];
    let totalDuration = 0;

    for (const question of questionsWithEfficiency) {
      const questionTime = question.estimatedDuration + transitionTimePerQuestion;
      
      if (totalDuration + questionTime <= availableTime) {
        const timeAllocation = (questionTime / config.maxDurationSeconds) * 100;
        
        selectedQuestions.push({
          questionId: question.questionId,
          text: question.text,
          estimatedDuration: question.estimatedDuration,
          priorityLevel: question.priorityLevel,
          selectionReason: `Token-based efficiency - Score: ${question.efficiency.toFixed(2)}`,
          timeAllocation,
          confidenceScore: question.confidence
        });

        totalDuration += questionTime;
      }
    }

    const timeUtilization = (totalDuration / config.maxDurationSeconds) * 100;
    const averageConfidence = selectedQuestions.length > 0
      ? selectedQuestions.reduce((sum, q) => sum + q.confidenceScore, 0) / selectedQuestions.length
      : 0;

    return {
      selectedQuestions,
      optimizationMetadata: {
        algorithm: 'token_estimation' as const,
        totalEstimatedDuration: totalDuration,
        timeUtilization,
        questionsConsidered: questions.length,
        questionsSelected: selectedQuestions.length,
        averageConfidence,
        processingTimeMs: 0
      },
      timeBreakdown: {
        questionTime: totalDuration - (selectedQuestions.length * transitionTimePerQuestion),
        bufferTime,
        transitionTime: selectedQuestions.length * transitionTimePerQuestion,
        totalConstraint: config.maxDurationSeconds
      }
    };
  }

  async createOptimizer(
    optimizerData: {
      optimizerName: string;
      algorithmType: 'greedy_priority' | 'dynamic_programming' | 'time_balanced' | 'token_estimation';
      configurationRules: Record<string, any>;
      performanceThresholds: Record<string, number>;
    }
  ) {
    return await createTimeConstraintOptimizer({
      business_id: this.businessId,
      optimizer_name: optimizerData.optimizerName,
      algorithm_type: optimizerData.algorithmType,
      configuration_rules: optimizerData.configurationRules,
      performance_thresholds: optimizerData.performanceThresholds
    });
  }

  async updateOptimizer(
    optimizerId: string,
    updates: {
      optimizerName?: string;
      algorithmType?: 'greedy_priority' | 'dynamic_programming' | 'time_balanced' | 'token_estimation';
      configurationRules?: Record<string, any>;
      performanceThresholds?: Record<string, number>;
      isActive?: boolean;
    }
  ) {
    const updateData: any = {};
    
    if (updates.optimizerName) updateData.optimizer_name = updates.optimizerName;
    if (updates.algorithmType) updateData.algorithm_type = updates.algorithmType;
    if (updates.configurationRules) updateData.configuration_rules = updates.configurationRules;
    if (updates.performanceThresholds) updateData.performance_thresholds = updates.performanceThresholds;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    return await updateTimeConstraintOptimizer(optimizerId, updateData);
  }

  async updatePerformanceMetrics(
    optimizerId: string,
    actualDuration: number,
    questionsCompleted: number,
    totalQuestions: number,
    customerSatisfaction?: number
  ): Promise<void> {
    await updateOptimizerPerformance(
      optimizerId,
      actualDuration,
      questionsCompleted,
      totalQuestions,
      customerSatisfaction
    );

    await this.loggingService.logInfo('Time optimizer performance updated', {
      businessId: this.businessId,
      optimizerId,
      actualDuration,
      questionsCompleted,
      totalQuestions,
      customerSatisfaction
    });
  }

  getAvailableStrategies(): OptimizationStrategy[] {
    return [
      {
        name: 'Greedy Priority',
        description: 'Select highest priority questions first until time limit',
        timeComplexity: 'O(n log n)',
        accuracy: 'medium',
        speed: 'fast'
      },
      {
        name: 'Dynamic Programming',
        description: 'Optimal selection using knapsack algorithm',
        timeComplexity: 'O(n * W)',
        accuracy: 'high',
        speed: 'slow'
      },
      {
        name: 'Time Balanced',
        description: 'Distribute time proportionally across priority levels',
        timeComplexity: 'O(n log n)',
        accuracy: 'high',
        speed: 'medium'
      },
      {
        name: 'Token Estimation',
        description: 'Efficiency-based selection using priority-to-duration ratio',
        timeComplexity: 'O(n log n)',
        accuracy: 'medium',
        speed: 'fast'
      }
    ];
  }

  async validatePerformanceRequirement(): Promise<boolean> {
    // Test with sample data to ensure <500ms requirement
    const sampleQuestions: QuestionForOptimization[] = Array.from({ length: 40 }, (_, i) => ({
      questionId: `sample-${i}`,
      text: `Sample question ${i} with some descriptive text that varies in length`,
      tokenCount: Math.floor(Math.random() * 60) + 20,
      category: ['service', 'product', 'experience'][i % 3],
      topicCategory: ['checkout', 'quality', 'delivery'][i % 3],
      priorityLevel: Math.floor(Math.random() * 5) + 1,
      complexityFactor: Math.random() * 2 + 0.5
    }));

    const config: TimeConstraintConfig = {
      maxDurationSeconds: 90,
      bufferTimePercentage: 10,
      transitionTimePerQuestion: 2
    };

    const startTime = Date.now();
    
    try {
      await this.optimizeForTimeConstraint(sampleQuestions, config);
      const duration = Date.now() - startTime;
      return duration < 500;
    } catch {
      return false;
    }
  }
}