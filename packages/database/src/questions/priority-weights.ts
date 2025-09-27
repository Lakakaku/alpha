import { supabase } from '../client/supabase';

export interface PriorityWeight {
  id: string;
  question_id: string;
  business_id: string;
  priority_level: number;
  weight_factor: number;
  time_sensitivity: number;
  topic_importance: number;
  customer_relevance_boost: number;
  estimated_tokens: number;
  last_effectiveness_score: number | null;
  adjustment_history: Record<string, any>[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePriorityWeightData {
  question_id: string;
  business_id: string;
  priority_level: number;
  weight_factor?: number;
  time_sensitivity?: number;
  topic_importance?: number;
  customer_relevance_boost?: number;
  estimated_tokens?: number;
  is_active?: boolean;
}

export interface UpdatePriorityWeightData {
  priority_level?: number;
  weight_factor?: number;
  time_sensitivity?: number;
  topic_importance?: number;
  customer_relevance_boost?: number;
  estimated_tokens?: number;
  last_effectiveness_score?: number | null;
  adjustment_history?: Record<string, any>[];
  is_active?: boolean;
}

export async function getPriorityWeights(
  businessId: string,
  options?: {
    questionId?: string;
    minPriorityLevel?: number;
    isActive?: boolean;
  }
): Promise<PriorityWeight[]> {
  let query = supabase
    .from('priority_weights')
    .select('*')
    .eq('business_id', businessId)
    .order('priority_level', { ascending: false });

  if (options?.questionId) {
    query = query.eq('question_id', options.questionId);
  }

  if (options?.minPriorityLevel) {
    query = query.gte('priority_level', options.minPriorityLevel);
  }

  if (options?.isActive !== undefined) {
    query = query.eq('is_active', options.isActive);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch priority weights: ${error.message}`);
  }

  return data || [];
}

export async function getPriorityWeightById(
  id: string
): Promise<PriorityWeight | null> {
  const { data, error } = await supabase
    .from('priority_weights')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch priority weight: ${error.message}`);
  }

  return data;
}

export async function getPriorityWeightByQuestionId(
  questionId: string,
  businessId: string
): Promise<PriorityWeight | null> {
  const { data, error } = await supabase
    .from('priority_weights')
    .select('*')
    .eq('question_id', questionId)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch priority weight by question: ${error.message}`);
  }

  return data;
}

export async function createPriorityWeight(
  weightData: CreatePriorityWeightData
): Promise<PriorityWeight> {
  // Calculate default weight_factor based on priority_level if not provided
  const calculatedWeightFactor = weightData.weight_factor || calculateDefaultWeightFactor(weightData.priority_level);

  const dataWithDefaults = {
    ...weightData,
    weight_factor: calculatedWeightFactor,
    time_sensitivity: weightData.time_sensitivity || 1.0,
    topic_importance: weightData.topic_importance || 1.0,
    customer_relevance_boost: weightData.customer_relevance_boost || 1.0,
    estimated_tokens: weightData.estimated_tokens || 25,
    adjustment_history: []
  };

  const { data, error } = await supabase
    .from('priority_weights')
    .insert([dataWithDefaults])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create priority weight: ${error.message}`);
  }

  return data;
}

export async function updatePriorityWeight(
  id: string,
  updates: UpdatePriorityWeightData
): Promise<PriorityWeight> {
  // Recalculate weight_factor if priority_level changed
  const updatesWithCalculations = { ...updates };
  if (updates.priority_level && !updates.weight_factor) {
    updatesWithCalculations.weight_factor = calculateDefaultWeightFactor(updates.priority_level);
  }

  const { data, error } = await supabase
    .from('priority_weights')
    .update({ 
      ...updatesWithCalculations, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update priority weight: ${error.message}`);
  }

  return data;
}

export async function deletePriorityWeight(id: string): Promise<void> {
  const { error } = await supabase
    .from('priority_weights')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete priority weight: ${error.message}`);
  }
}

export async function calculateQuestionPriority(
  questionId: string,
  businessId: string,
  customerContext?: {
    purchaseCategories?: string[];
    transactionAmount?: number;
    timeOfDay?: number;
    customerSegment?: string;
  }
): Promise<{
  finalPriority: number;
  baseWeight: number;
  adjustedWeight: number;
  relevanceBoost: number;
}> {
  const priorityWeight = await getPriorityWeightByQuestionId(questionId, businessId);

  if (!priorityWeight) {
    throw new Error(`No priority weight found for question ${questionId}`);
  }

  const baseWeight = priorityWeight.weight_factor;
  let relevanceBoost = 1.0;

  // Apply customer relevance adjustments
  if (customerContext) {
    relevanceBoost *= priorityWeight.customer_relevance_boost;

    // Time sensitivity adjustment
    if (customerContext.timeOfDay !== undefined) {
      const timeSensitivityFactor = calculateTimeSensitivity(
        customerContext.timeOfDay,
        priorityWeight.time_sensitivity
      );
      relevanceBoost *= timeSensitivityFactor;
    }

    // Transaction amount relevance
    if (customerContext.transactionAmount !== undefined) {
      const amountFactor = calculateAmountRelevance(
        customerContext.transactionAmount,
        priorityWeight.topic_importance
      );
      relevanceBoost *= amountFactor;
    }
  }

  const adjustedWeight = baseWeight * relevanceBoost;
  const finalPriority = priorityWeight.priority_level * adjustedWeight;

  return {
    finalPriority,
    baseWeight,
    adjustedWeight,
    relevanceBoost
  };
}

export async function adjustPriorityFromFeedback(
  questionId: string,
  businessId: string,
  effectivenessScore: number,
  responseQuality: number
): Promise<void> {
  const priorityWeight = await getPriorityWeightByQuestionId(questionId, businessId);

  if (!priorityWeight) {
    throw new Error(`No priority weight found for question ${questionId}`);
  }

  // Calculate adjustment based on effectiveness and response quality
  const adjustmentFactor = calculateAdjustmentFactor(effectivenessScore, responseQuality);
  const newWeightFactor = Math.max(0.1, Math.min(5.0, priorityWeight.weight_factor * adjustmentFactor));

  // Record the adjustment in history
  const adjustmentRecord = {
    timestamp: new Date().toISOString(),
    previous_weight: priorityWeight.weight_factor,
    new_weight: newWeightFactor,
    effectiveness_score: effectivenessScore,
    response_quality: responseQuality,
    adjustment_factor: adjustmentFactor
  };

  const updatedHistory = [...(priorityWeight.adjustment_history || []), adjustmentRecord];

  await updatePriorityWeight(priorityWeight.id, {
    weight_factor: newWeightFactor,
    last_effectiveness_score: effectivenessScore,
    adjustment_history: updatedHistory
  });
}

export async function getQuestionsByPriorityThreshold(
  businessId: string,
  timeRemainingSeconds: number,
  priorityThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  }
): Promise<{
  eligibleQuestions: PriorityWeight[];
  recommendedPriorityLevel: number;
}> {
  let recommendedPriorityLevel = 1; // Default to low priority

  // Determine minimum priority level based on time remaining
  if (timeRemainingSeconds <= priorityThresholds.critical) {
    recommendedPriorityLevel = 5; // Critical only
  } else if (timeRemainingSeconds <= priorityThresholds.high) {
    recommendedPriorityLevel = 4; // High and above
  } else if (timeRemainingSeconds <= priorityThresholds.medium) {
    recommendedPriorityLevel = 3; // Medium and above
  } else if (timeRemainingSeconds <= priorityThresholds.low) {
    recommendedPriorityLevel = 2; // Low and above
  }

  const eligibleQuestions = await getPriorityWeights(businessId, {
    minPriorityLevel: recommendedPriorityLevel,
    isActive: true
  });

  return {
    eligibleQuestions,
    recommendedPriorityLevel
  };
}

export async function bulkUpdatePriorityWeights(
  businessId: string,
  updates: Array<{
    questionId: string;
    priorityLevel?: number;
    weightFactor?: number;
    timeSensitivity?: number;
    topicImportance?: number;
  }>
): Promise<PriorityWeight[]> {
  const results: PriorityWeight[] = [];

  for (const update of updates) {
    const existing = await getPriorityWeightByQuestionId(update.questionId, businessId);
    
    if (existing) {
      const updated = await updatePriorityWeight(existing.id, {
        priority_level: update.priorityLevel,
        weight_factor: update.weightFactor,
        time_sensitivity: update.timeSensitivity,
        topic_importance: update.topicImportance
      });
      results.push(updated);
    }
  }

  return results;
}

function calculateDefaultWeightFactor(priorityLevel: number): number {
  // Map priority levels (1-5) to weight factors
  const weightMap = {
    1: 0.5, // Optional
    2: 1.0, // Low
    3: 1.5, // Medium
    4: 2.5, // High
    5: 4.0  // Critical
  };
  
  return weightMap[priorityLevel as keyof typeof weightMap] || 1.0;
}

function calculateTimeSensitivity(timeOfDay: number, timeSensitivity: number): number {
  // Boost questions during relevant times (e.g., lunch questions during lunch)
  const lunchHour = timeOfDay >= 11.5 && timeOfDay <= 13.5; // 11:30 - 13:30
  const eveningHour = timeOfDay >= 17.0 && timeOfDay <= 21.0; // 17:00 - 21:00
  const weekendBoost = new Date().getDay() === 0 || new Date().getDay() === 6;

  let factor = 1.0;
  
  if (lunchHour && timeSensitivity >= 1.5) {
    factor *= 1.3; // Boost lunch-related questions
  }
  
  if (eveningHour && timeSensitivity >= 1.2) {
    factor *= 1.2; // Boost evening-related questions
  }
  
  if (weekendBoost && timeSensitivity >= 1.1) {
    factor *= 1.1; // Slight boost for weekend context
  }

  return factor;
}

function calculateAmountRelevance(transactionAmount: number, topicImportance: number): number {
  // Higher amounts may warrant higher priority questions
  const isHighValue = transactionAmount > 500; // SEK
  const isMediumValue = transactionAmount > 200;

  if (isHighValue && topicImportance >= 1.5) {
    return 1.4; // Significant boost for high-value transactions
  }
  
  if (isMediumValue && topicImportance >= 1.2) {
    return 1.2; // Moderate boost for medium-value transactions
  }

  return 1.0; // No adjustment for low-value transactions
}

function calculateAdjustmentFactor(effectivenessScore: number, responseQuality: number): number {
  // Scale: 1-5 for both metrics
  const normalizedEffectiveness = effectivenessScore / 5.0;
  const normalizedQuality = responseQuality / 5.0;
  const combinedScore = (normalizedEffectiveness + normalizedQuality) / 2.0;

  // Adjustment factor: 0.8-1.2 range for moderate adjustments
  const adjustmentFactor = 0.8 + (combinedScore * 0.4);

  return Math.max(0.8, Math.min(1.2, adjustmentFactor));
}