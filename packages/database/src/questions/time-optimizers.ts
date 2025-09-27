import { supabase } from '../client/supabase';

export interface TimeConstraintOptimizer {
  id: string;
  business_id: string;
  rule_name: string;
  target_duration_seconds: number;
  token_budget: number;
  algorithm_version: string;
  optimization_strategy: 'greedy' | 'dynamic_programming' | 'weighted_selection' | 'time_based_priority';
  performance_metrics: Record<string, any>;
  success_rate: number;
  average_call_duration: number;
  question_coverage_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTimeConstraintOptimizerData {
  business_id: string;
  rule_name: string;
  target_duration_seconds: number;
  token_budget?: number;
  algorithm_version?: string;
  optimization_strategy?: 'greedy' | 'dynamic_programming' | 'weighted_selection' | 'time_based_priority';
  is_active?: boolean;
}

export interface UpdateTimeConstraintOptimizerData {
  rule_name?: string;
  target_duration_seconds?: number;
  token_budget?: number;
  algorithm_version?: string;
  optimization_strategy?: 'greedy' | 'dynamic_programming' | 'weighted_selection' | 'time_based_priority';
  performance_metrics?: Record<string, any>;
  success_rate?: number;
  average_call_duration?: number;
  question_coverage_rate?: number;
  is_active?: boolean;
}

export interface OptimizationResult {
  selectedQuestions: {
    questionId: string;
    priorityLevel: number;
    estimatedTokens: number;
    estimatedDuration: number;
    selectionReason: string;
  }[];
  totalEstimatedDuration: number;
  totalTokens: number;
  optimizationMetadata: {
    strategy: string;
    algorithmVersion: string;
    coverageRate: number;
    utilizationRate: number;
    droppedQuestions: number;
  };
}

export async function getTimeConstraintOptimizers(
  businessId: string,
  options?: {
    isActive?: boolean;
    strategy?: 'greedy' | 'dynamic_programming' | 'weighted_selection' | 'time_based_priority';
  }
): Promise<TimeConstraintOptimizer[]> {
  let query = supabase
    .from('time_constraint_optimizers')
    .select('*')
    .eq('business_id', businessId)
    .order('success_rate', { ascending: false });

  if (options?.isActive !== undefined) {
    query = query.eq('is_active', options.isActive);
  }

  if (options?.strategy) {
    query = query.eq('optimization_strategy', options.strategy);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch time constraint optimizers: ${error.message}`);
  }

  return data || [];
}

export async function getTimeConstraintOptimizerById(
  id: string
): Promise<TimeConstraintOptimizer | null> {
  const { data, error } = await supabase
    .from('time_constraint_optimizers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch time constraint optimizer: ${error.message}`);
  }

  return data;
}

export async function createTimeConstraintOptimizer(
  optimizerData: CreateTimeConstraintOptimizerData
): Promise<TimeConstraintOptimizer> {
  // Calculate default token budget based on target duration if not provided
  const defaultTokenBudget = optimizerData.token_budget || Math.floor(optimizerData.target_duration_seconds * 4.2); // ~4.2 tokens per second

  const dataWithDefaults = {
    ...optimizerData,
    token_budget: defaultTokenBudget,
    algorithm_version: optimizerData.algorithm_version || '1.0.0',
    optimization_strategy: optimizerData.optimization_strategy || 'weighted_selection',
    performance_metrics: {},
    success_rate: 0.0,
    average_call_duration: 0.0,
    question_coverage_rate: 0.0
  };

  const { data, error } = await supabase
    .from('time_constraint_optimizers')
    .insert([dataWithDefaults])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create time constraint optimizer: ${error.message}`);
  }

  return data;
}

export async function updateTimeConstraintOptimizer(
  id: string,
  updates: UpdateTimeConstraintOptimizerData
): Promise<TimeConstraintOptimizer> {
  const { data, error } = await supabase
    .from('time_constraint_optimizers')
    .update({ 
      ...updates, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update time constraint optimizer: ${error.message}`);
  }

  return data;
}

export async function deleteTimeConstraintOptimizer(id: string): Promise<void> {
  const { error } = await supabase
    .from('time_constraint_optimizers')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete time constraint optimizer: ${error.message}`);
  }
}

export async function optimizeQuestionSelection(
  businessId: string,
  candidateQuestions: Array<{
    questionId: string;
    priorityLevel: number;
    estimatedTokens: number;
    weightFactor: number;
    topicCategory: string;
  }>,
  constraints: {
    maxDurationSeconds: number;
    maxTokens?: number;
    minPriorityLevel?: number;
    strategy?: 'greedy' | 'dynamic_programming' | 'weighted_selection' | 'time_based_priority';
  }
): Promise<OptimizationResult> {
  const optimizer = await getBestOptimizer(businessId, constraints.strategy);
  const strategy = constraints.strategy || optimizer?.optimization_strategy || 'weighted_selection';
  const tokenBudget = constraints.maxTokens || Math.floor(constraints.maxDurationSeconds * 4.2);

  // Filter questions by minimum priority level
  let eligibleQuestions = candidateQuestions;
  if (constraints.minPriorityLevel) {
    eligibleQuestions = candidateQuestions.filter(q => q.priorityLevel >= constraints.minPriorityLevel!);
  }

  let result: OptimizationResult;

  switch (strategy) {
    case 'greedy':
      result = await greedyOptimization(eligibleQuestions, tokenBudget, constraints.maxDurationSeconds);
      break;
    case 'dynamic_programming':
      result = await dynamicProgrammingOptimization(eligibleQuestions, tokenBudget, constraints.maxDurationSeconds);
      break;
    case 'time_based_priority':
      result = await timeBasedPriorityOptimization(eligibleQuestions, tokenBudget, constraints.maxDurationSeconds);
      break;
    case 'weighted_selection':
    default:
      result = await weightedSelectionOptimization(eligibleQuestions, tokenBudget, constraints.maxDurationSeconds);
      break;
  }

  result.optimizationMetadata.strategy = strategy;
  result.optimizationMetadata.algorithmVersion = optimizer?.algorithm_version || '1.0.0';

  return result;
}

export async function updateOptimizerPerformance(
  optimizerId: string,
  actualDuration: number,
  questionsCovered: number,
  totalQuestions: number,
  customerSatisfaction?: number
): Promise<void> {
  const optimizer = await getTimeConstraintOptimizerById(optimizerId);
  if (!optimizer) {
    throw new Error(`Optimizer ${optimizerId} not found`);
  }

  // Calculate new metrics
  const newCoverageRate = totalQuestions > 0 ? questionsCovered / totalQuestions : 0;
  const wasSuccessful = actualDuration <= optimizer.target_duration_seconds * 1.1; // 10% tolerance

  // Update running averages
  const currentUsage = optimizer.performance_metrics?.usage_count || 0;
  const newUsage = currentUsage + 1;
  
  const newSuccessRate = (optimizer.success_rate * currentUsage + (wasSuccessful ? 1 : 0)) / newUsage;
  const newAverageDuration = (optimizer.average_call_duration * currentUsage + actualDuration) / newUsage;
  const newCoverageAverage = (optimizer.question_coverage_rate * currentUsage + newCoverageRate) / newUsage;

  const updatedMetrics = {
    ...optimizer.performance_metrics,
    usage_count: newUsage,
    last_used: new Date().toISOString(),
    last_duration: actualDuration,
    last_coverage: newCoverageRate,
    customer_satisfaction: customerSatisfaction
  };

  await updateTimeConstraintOptimizer(optimizerId, {
    performance_metrics: updatedMetrics,
    success_rate: newSuccessRate,
    average_call_duration: newAverageDuration,
    question_coverage_rate: newCoverageAverage
  });
}

async function getBestOptimizer(
  businessId: string,
  preferredStrategy?: string
): Promise<TimeConstraintOptimizer | null> {
  const optimizers = await getTimeConstraintOptimizers(businessId, {
    isActive: true,
    strategy: preferredStrategy as any
  });

  if (optimizers.length === 0) {
    return null;
  }

  // Return the optimizer with the best success rate
  return optimizers.reduce((best, current) => 
    current.success_rate > best.success_rate ? current : best
  );
}

async function greedyOptimization(
  questions: Array<{
    questionId: string;
    priorityLevel: number;
    estimatedTokens: number;
    weightFactor: number;
    topicCategory: string;
  }>,
  tokenBudget: number,
  maxDuration: number
): Promise<OptimizationResult> {
  // Sort by priority level descending, then by efficiency (priority/tokens) descending
  const sortedQuestions = questions
    .map(q => ({
      ...q,
      efficiency: (q.priorityLevel * q.weightFactor) / q.estimatedTokens,
      estimatedDuration: q.estimatedTokens / 4.2 // ~4.2 tokens per second
    }))
    .sort((a, b) => b.priorityLevel - a.priorityLevel || b.efficiency - a.efficiency);

  const selectedQuestions = [];
  let totalTokens = 0;
  let totalDuration = 0;

  for (const question of sortedQuestions) {
    if (totalTokens + question.estimatedTokens <= tokenBudget && 
        totalDuration + question.estimatedDuration <= maxDuration) {
      selectedQuestions.push({
        questionId: question.questionId,
        priorityLevel: question.priorityLevel,
        estimatedTokens: question.estimatedTokens,
        estimatedDuration: question.estimatedDuration,
        selectionReason: `Priority ${question.priorityLevel}, efficiency ${question.efficiency.toFixed(2)}`
      });
      totalTokens += question.estimatedTokens;
      totalDuration += question.estimatedDuration;
    }
  }

  return {
    selectedQuestions,
    totalEstimatedDuration: totalDuration,
    totalTokens,
    optimizationMetadata: {
      strategy: 'greedy',
      algorithmVersion: '1.0.0',
      coverageRate: selectedQuestions.length / questions.length,
      utilizationRate: totalDuration / maxDuration,
      droppedQuestions: questions.length - selectedQuestions.length
    }
  };
}

async function weightedSelectionOptimization(
  questions: Array<{
    questionId: string;
    priorityLevel: number;
    estimatedTokens: number;
    weightFactor: number;
    topicCategory: string;
  }>,
  tokenBudget: number,
  maxDuration: number
): Promise<OptimizationResult> {
  // Calculate composite scores for each question
  const scoredQuestions = questions.map(q => {
    const estimatedDuration = q.estimatedTokens / 4.2;
    const priorityWeight = q.priorityLevel * 0.4;
    const efficiencyWeight = (q.weightFactor / q.estimatedTokens) * 0.3;
    const durationWeight = (1 / estimatedDuration) * 0.3;
    
    return {
      ...q,
      estimatedDuration,
      compositeScore: priorityWeight + efficiencyWeight + durationWeight
    };
  });

  // Sort by composite score
  scoredQuestions.sort((a, b) => b.compositeScore - a.compositeScore);

  const selectedQuestions = [];
  let totalTokens = 0;
  let totalDuration = 0;

  for (const question of scoredQuestions) {
    if (totalTokens + question.estimatedTokens <= tokenBudget && 
        totalDuration + question.estimatedDuration <= maxDuration) {
      selectedQuestions.push({
        questionId: question.questionId,
        priorityLevel: question.priorityLevel,
        estimatedTokens: question.estimatedTokens,
        estimatedDuration: question.estimatedDuration,
        selectionReason: `Composite score ${question.compositeScore.toFixed(2)}`
      });
      totalTokens += question.estimatedTokens;
      totalDuration += question.estimatedDuration;
    }
  }

  return {
    selectedQuestions,
    totalEstimatedDuration: totalDuration,
    totalTokens,
    optimizationMetadata: {
      strategy: 'weighted_selection',
      algorithmVersion: '1.0.0',
      coverageRate: selectedQuestions.length / questions.length,
      utilizationRate: totalDuration / maxDuration,
      droppedQuestions: questions.length - selectedQuestions.length
    }
  };
}

async function dynamicProgrammingOptimization(
  questions: Array<{
    questionId: string;
    priorityLevel: number;
    estimatedTokens: number;
    weightFactor: number;
    topicCategory: string;
  }>,
  tokenBudget: number,
  maxDuration: number
): Promise<OptimizationResult> {
  // Simplified knapsack approach using duration as the constraint
  const maxDurationInt = Math.floor(maxDuration);
  const dp: number[][] = Array(questions.length + 1)
    .fill(null)
    .map(() => Array(maxDurationInt + 1).fill(0));

  const questionsWithDuration = questions.map(q => ({
    ...q,
    estimatedDuration: Math.ceil(q.estimatedTokens / 4.2),
    value: q.priorityLevel * q.weightFactor
  }));

  // Fill DP table
  for (let i = 1; i <= questions.length; i++) {
    const question = questionsWithDuration[i - 1];
    for (let w = 1; w <= maxDurationInt; w++) {
      if (question.estimatedDuration <= w && question.estimatedTokens <= tokenBudget) {
        dp[i][w] = Math.max(
          dp[i - 1][w],
          dp[i - 1][w - question.estimatedDuration] + question.value
        );
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  // Backtrack to find selected questions
  const selectedIndices: number[] = [];
  let w = maxDurationInt;
  for (let i = questions.length; i > 0 && w > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedIndices.push(i - 1);
      w -= questionsWithDuration[i - 1].estimatedDuration;
    }
  }

  const selectedQuestions = selectedIndices.map(i => {
    const question = questionsWithDuration[i];
    return {
      questionId: question.questionId,
      priorityLevel: question.priorityLevel,
      estimatedTokens: question.estimatedTokens,
      estimatedDuration: question.estimatedDuration,
      selectionReason: `DP optimal, value ${question.value.toFixed(2)}`
    };
  });

  const totalTokens = selectedQuestions.reduce((sum, q) => sum + q.estimatedTokens, 0);
  const totalDuration = selectedQuestions.reduce((sum, q) => sum + q.estimatedDuration, 0);

  return {
    selectedQuestions,
    totalEstimatedDuration: totalDuration,
    totalTokens,
    optimizationMetadata: {
      strategy: 'dynamic_programming',
      algorithmVersion: '1.0.0',
      coverageRate: selectedQuestions.length / questions.length,
      utilizationRate: totalDuration / maxDuration,
      droppedQuestions: questions.length - selectedQuestions.length
    }
  };
}

async function timeBasedPriorityOptimization(
  questions: Array<{
    questionId: string;
    priorityLevel: number;
    estimatedTokens: number;
    weightFactor: number;
    topicCategory: string;
  }>,
  tokenBudget: number,
  maxDuration: number
): Promise<OptimizationResult> {
  // Time-based priority: critical questions first, then fill remaining time
  const questionsWithDuration = questions.map(q => ({
    ...q,
    estimatedDuration: q.estimatedTokens / 4.2
  }));

  // Group by priority level
  const criticalQuestions = questionsWithDuration.filter(q => q.priorityLevel === 5);
  const highQuestions = questionsWithDuration.filter(q => q.priorityLevel === 4);
  const mediumQuestions = questionsWithDuration.filter(q => q.priorityLevel === 3);
  const lowQuestions = questionsWithDuration.filter(q => q.priorityLevel <= 2);

  const selectedQuestions = [];
  let totalTokens = 0;
  let totalDuration = 0;

  // Add critical questions first
  for (const question of criticalQuestions) {
    if (totalTokens + question.estimatedTokens <= tokenBudget && 
        totalDuration + question.estimatedDuration <= maxDuration) {
      selectedQuestions.push({
        questionId: question.questionId,
        priorityLevel: question.priorityLevel,
        estimatedTokens: question.estimatedTokens,
        estimatedDuration: question.estimatedDuration,
        selectionReason: 'Critical priority - always include'
      });
      totalTokens += question.estimatedTokens;
      totalDuration += question.estimatedDuration;
    }
  }

  // Then high priority questions
  const remainingGroups = [highQuestions, mediumQuestions, lowQuestions];
  for (const group of remainingGroups) {
    // Sort by efficiency within each priority group
    const sortedGroup = group.sort((a, b) => (b.weightFactor / b.estimatedTokens) - (a.weightFactor / a.estimatedTokens));
    
    for (const question of sortedGroup) {
      if (totalTokens + question.estimatedTokens <= tokenBudget && 
          totalDuration + question.estimatedDuration <= maxDuration) {
        selectedQuestions.push({
          questionId: question.questionId,
          priorityLevel: question.priorityLevel,
          estimatedTokens: question.estimatedTokens,
          estimatedDuration: question.estimatedDuration,
          selectionReason: `Priority ${question.priorityLevel} with remaining time`
        });
        totalTokens += question.estimatedTokens;
        totalDuration += question.estimatedDuration;
      }
    }
  }

  return {
    selectedQuestions,
    totalEstimatedDuration: totalDuration,
    totalTokens,
    optimizationMetadata: {
      strategy: 'time_based_priority',
      algorithmVersion: '1.0.0',
      coverageRate: selectedQuestions.length / questions.length,
      utilizationRate: totalDuration / maxDuration,
      droppedQuestions: questions.length - selectedQuestions.length
    }
  };
}