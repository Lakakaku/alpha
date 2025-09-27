import { supabase } from '../client/supabase';

export interface FrequencyHarmonizer {
  id: string;
  business_id: string;
  question_id_1: string;
  question_id_2: string;
  resolution_strategy: 'combine' | 'prioritize_first' | 'prioritize_second' | 'lcm_fallback' | 'alternating';
  combined_frequency: number | null;
  priority_bias: number;
  is_active: boolean;
  effectiveness_score: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFrequencyHarmonizerData {
  business_id: string;
  question_id_1: string;
  question_id_2: string;
  resolution_strategy: 'combine' | 'prioritize_first' | 'prioritize_second' | 'lcm_fallback' | 'alternating';
  combined_frequency?: number | null;
  priority_bias?: number;
  is_active?: boolean;
}

export interface UpdateFrequencyHarmonizerData {
  resolution_strategy?: 'combine' | 'prioritize_first' | 'prioritize_second' | 'lcm_fallback' | 'alternating';
  combined_frequency?: number | null;
  priority_bias?: number;
  is_active?: boolean;
  effectiveness_score?: number;
}

export async function getFrequencyHarmonizers(
  businessId: string,
  options?: {
    questionId?: string;
    isActive?: boolean;
  }
): Promise<FrequencyHarmonizer[]> {
  let query = supabase
    .from('frequency_harmonizers')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (options?.questionId) {
    query = query.or(`question_id_1.eq.${options.questionId},question_id_2.eq.${options.questionId}`);
  }

  if (options?.isActive !== undefined) {
    query = query.eq('is_active', options.isActive);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch frequency harmonizers: ${error.message}`);
  }

  return data || [];
}

export async function getFrequencyHarmonizerById(
  id: string
): Promise<FrequencyHarmonizer | null> {
  const { data, error } = await supabase
    .from('frequency_harmonizers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch frequency harmonizer: ${error.message}`);
  }

  return data;
}

export async function createFrequencyHarmonizer(
  harmonizerData: CreateFrequencyHarmonizerData
): Promise<FrequencyHarmonizer> {
  const { data, error } = await supabase
    .from('frequency_harmonizers')
    .insert([harmonizerData])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create frequency harmonizer: ${error.message}`);
  }

  return data;
}

export async function updateFrequencyHarmonizer(
  id: string,
  updates: UpdateFrequencyHarmonizerData
): Promise<FrequencyHarmonizer> {
  const { data, error } = await supabase
    .from('frequency_harmonizers')
    .update({ 
      ...updates, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update frequency harmonizer: ${error.message}`);
  }

  return data;
}

export async function deleteFrequencyHarmonizer(id: string): Promise<void> {
  const { error } = await supabase
    .from('frequency_harmonizers')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete frequency harmonizer: ${error.message}`);
  }
}

export async function getQuestionPairHarmonizer(
  businessId: string,
  questionId1: string,
  questionId2: string
): Promise<FrequencyHarmonizer | null> {
  const { data, error } = await supabase
    .from('frequency_harmonizers')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .or(`and(question_id_1.eq.${questionId1},question_id_2.eq.${questionId2}),and(question_id_1.eq.${questionId2},question_id_2.eq.${questionId1})`)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch question pair harmonizer: ${error.message}`);
  }

  return data;
}

export async function resolveFrequencyConflict(
  businessId: string,
  questionId1: string,
  questionId2: string,
  frequency1: number,
  frequency2: number,
  customerSequence: number
): Promise<{
  shouldAskQuestion1: boolean;
  shouldAskQuestion2: boolean;
  resolvedFrequency: number;
  strategy: string;
}> {
  const harmonizer = await getQuestionPairHarmonizer(businessId, questionId1, questionId2);

  if (!harmonizer) {
    // Default to LCM strategy if no harmonizer configured
    const lcm = calculateLCM(frequency1, frequency2);
    return {
      shouldAskQuestion1: customerSequence % frequency1 === 0,
      shouldAskQuestion2: customerSequence % frequency2 === 0,
      resolvedFrequency: lcm,
      strategy: 'lcm_default'
    };
  }

  switch (harmonizer.resolution_strategy) {
    case 'combine':
      return {
        shouldAskQuestion1: customerSequence % frequency1 === 0,
        shouldAskQuestion2: customerSequence % frequency2 === 0,
        resolvedFrequency: harmonizer.combined_frequency || calculateLCM(frequency1, frequency2),
        strategy: 'combine'
      };

    case 'prioritize_first':
      const shouldAsk1 = customerSequence % frequency1 === 0;
      return {
        shouldAskQuestion1: shouldAsk1,
        shouldAskQuestion2: shouldAsk1 ? false : customerSequence % frequency2 === 0,
        resolvedFrequency: frequency1,
        strategy: 'prioritize_first'
      };

    case 'prioritize_second':
      const shouldAsk2 = customerSequence % frequency2 === 0;
      return {
        shouldAskQuestion1: shouldAsk2 ? false : customerSequence % frequency1 === 0,
        shouldAskQuestion2: shouldAsk2,
        resolvedFrequency: frequency2,
        strategy: 'prioritize_second'
      };

    case 'alternating':
      const isFirstTurn = Math.floor(customerSequence / Math.min(frequency1, frequency2)) % 2 === 0;
      if (isFirstTurn && customerSequence % frequency1 === 0) {
        return {
          shouldAskQuestion1: true,
          shouldAskQuestion2: false,
          resolvedFrequency: frequency1 * 2,
          strategy: 'alternating'
        };
      } else if (!isFirstTurn && customerSequence % frequency2 === 0) {
        return {
          shouldAskQuestion1: false,
          shouldAskQuestion2: true,
          resolvedFrequency: frequency2 * 2,
          strategy: 'alternating'
        };
      }
      return {
        shouldAskQuestion1: false,
        shouldAskQuestion2: false,
        resolvedFrequency: Math.min(frequency1, frequency2) * 2,
        strategy: 'alternating'
      };

    case 'lcm_fallback':
    default:
      const lcm = calculateLCM(frequency1, frequency2);
      return {
        shouldAskQuestion1: customerSequence % frequency1 === 0,
        shouldAskQuestion2: customerSequence % frequency2 === 0,
        resolvedFrequency: lcm,
        strategy: 'lcm_fallback'
      };
  }
}

export async function updateHarmonizerEffectiveness(
  id: string,
  newEffectivenessScore: number
): Promise<void> {
  const { error } = await supabase
    .from('frequency_harmonizers')
    .update({ 
      effectiveness_score: newEffectivenessScore,
      usage_count: supabase.sql`usage_count + 1`,
      updated_at: new Date().toISOString() 
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update harmonizer effectiveness: ${error.message}`);
  }
}

export async function getTopPerformingHarmonizers(
  businessId: string,
  limit: number = 10
): Promise<FrequencyHarmonizer[]> {
  const { data, error } = await supabase
    .from('frequency_harmonizers')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('effectiveness_score', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch top performing harmonizers: ${error.message}`);
  }

  return data || [];
}

function calculateLCM(a: number, b: number): number {
  return Math.abs(a * b) / calculateGCD(a, b);
}

function calculateGCD(a: number, b: number): number {
  return b === 0 ? a : calculateGCD(b, a % b);
}

export async function bulkResolveFrequencyConflicts(
  businessId: string,
  questionFrequencies: { questionId: string; frequency: number }[],
  customerSequence: number
): Promise<{
  questionsToAsk: string[];
  resolvedFrequencies: Record<string, number>;
  strategiesUsed: Record<string, string>;
}> {
  const questionsToAsk: string[] = [];
  const resolvedFrequencies: Record<string, number> = {};
  const strategiesUsed: Record<string, string> = {};

  // Get all harmonizers for this business
  const harmonizers = await getFrequencyHarmonizers(businessId, { isActive: true });

  // Process each question pair
  for (let i = 0; i < questionFrequencies.length; i++) {
    for (let j = i + 1; j < questionFrequencies.length; j++) {
      const q1 = questionFrequencies[i];
      const q2 = questionFrequencies[j];

      const resolution = await resolveFrequencyConflict(
        businessId,
        q1.questionId,
        q2.questionId,
        q1.frequency,
        q2.frequency,
        customerSequence
      );

      if (resolution.shouldAskQuestion1 && !questionsToAsk.includes(q1.questionId)) {
        questionsToAsk.push(q1.questionId);
      }
      if (resolution.shouldAskQuestion2 && !questionsToAsk.includes(q2.questionId)) {
        questionsToAsk.push(q2.questionId);
      }

      const pairKey = `${q1.questionId}-${q2.questionId}`;
      resolvedFrequencies[pairKey] = resolution.resolvedFrequency;
      strategiesUsed[pairKey] = resolution.strategy;
    }
  }

  // Handle questions without conflicts
  for (const question of questionFrequencies) {
    if (customerSequence % question.frequency === 0 && !questionsToAsk.includes(question.questionId)) {
      questionsToAsk.push(question.questionId);
    }
  }

  return {
    questionsToAsk,
    resolvedFrequencies,
    strategiesUsed
  };
}