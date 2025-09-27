import { createClient } from '../client/supabase';
import type { QuestionCombinationRule, CreateQuestionCombinationRule, UpdateQuestionCombinationRule } from '@vocilia/types';

const supabase = createClient();

export interface QuestionCombinationRuleWithDetails extends QuestionCombinationRule {
  question_groups?: Array<{
    id: string;
    group_name: string;
    topic_category: string;
    estimated_tokens: number;
    display_order: number;
    is_active: boolean;
  }>;
}

/**
 * Get all question combination rules for a business
 */
export async function getQuestionCombinationRules(
  businessId: string
): Promise<QuestionCombinationRule[]> {
  const { data, error } = await supabase
    .from('question_combination_rules')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch combination rules: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a specific question combination rule with details
 */
export async function getQuestionCombinationRuleById(
  ruleId: string
): Promise<QuestionCombinationRuleWithDetails | null> {
  const { data, error } = await supabase
    .from('question_combination_rules')
    .select(`
      *,
      question_groups (
        id,
        group_name,
        topic_category,
        estimated_tokens,
        display_order,
        is_active
      )
    `)
    .eq('id', ruleId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch combination rule: ${error.message}`);
  }

  return data;
}

/**
 * Create a new question combination rule
 */
export async function createQuestionCombinationRule(
  ruleData: CreateQuestionCombinationRule
): Promise<QuestionCombinationRule> {
  const { data, error } = await supabase
    .from('question_combination_rules')
    .insert([{
      business_id: ruleData.business_context_id,
      rule_name: ruleData.rule_name,
      max_call_duration_seconds: ruleData.max_call_duration_seconds || 120,
      priority_threshold_critical: ruleData.priority_thresholds?.critical || 0,
      priority_threshold_high: ruleData.priority_thresholds?.high || 60,
      priority_threshold_medium: ruleData.priority_thresholds?.medium || 90,
      priority_threshold_low: ruleData.priority_thresholds?.low || 120,
      is_active: true
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create combination rule: ${error.message}`);
  }

  return {
    id: data.id,
    business_context_id: data.business_id,
    rule_name: data.rule_name,
    max_call_duration_seconds: data.max_call_duration_seconds,
    priority_thresholds: {
      critical: data.priority_threshold_critical,
      high: data.priority_threshold_high,
      medium: data.priority_threshold_medium,
      low: data.priority_threshold_low
    },
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

/**
 * Update an existing question combination rule
 */
export async function updateQuestionCombinationRule(
  ruleId: string,
  updates: UpdateQuestionCombinationRule
): Promise<QuestionCombinationRule> {
  const updateData: any = {};
  
  if (updates.rule_name !== undefined) {
    updateData.rule_name = updates.rule_name;
  }
  if (updates.max_call_duration_seconds !== undefined) {
    updateData.max_call_duration_seconds = updates.max_call_duration_seconds;
  }
  if (updates.priority_thresholds) {
    if (updates.priority_thresholds.critical !== undefined) {
      updateData.priority_threshold_critical = updates.priority_thresholds.critical;
    }
    if (updates.priority_thresholds.high !== undefined) {
      updateData.priority_threshold_high = updates.priority_thresholds.high;
    }
    if (updates.priority_thresholds.medium !== undefined) {
      updateData.priority_threshold_medium = updates.priority_thresholds.medium;
    }
    if (updates.priority_thresholds.low !== undefined) {
      updateData.priority_threshold_low = updates.priority_thresholds.low;
    }
  }
  if (updates.is_active !== undefined) {
    updateData.is_active = updates.is_active;
  }

  const { data, error } = await supabase
    .from('question_combination_rules')
    .update(updateData)
    .eq('id', ruleId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update combination rule: ${error.message}`);
  }

  return {
    id: data.id,
    business_context_id: data.business_id,
    rule_name: data.rule_name,
    max_call_duration_seconds: data.max_call_duration_seconds,
    priority_thresholds: {
      critical: data.priority_threshold_critical,
      high: data.priority_threshold_high,
      medium: data.priority_threshold_medium,
      low: data.priority_threshold_low
    },
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

/**
 * Deactivate a question combination rule (soft delete)
 */
export async function deactivateQuestionCombinationRule(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from('question_combination_rules')
    .update({ is_active: false })
    .eq('id', ruleId);

  if (error) {
    throw new Error(`Failed to deactivate combination rule: ${error.message}`);
  }
}

/**
 * Get active rules for a business with time constraints
 */
export async function getActiveRulesWithConstraints(
  businessId: string,
  maxDuration?: number
): Promise<QuestionCombinationRule[]> {
  let query = supabase
    .from('question_combination_rules')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (maxDuration) {
    query = query.lte('max_call_duration_seconds', maxDuration);
  }

  const { data, error } = await query.order('max_call_duration_seconds', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch active rules: ${error.message}`);
  }

  return data?.map(row => ({
    id: row.id,
    business_context_id: row.business_id,
    rule_name: row.rule_name,
    max_call_duration_seconds: row.max_call_duration_seconds,
    priority_thresholds: {
      critical: row.priority_threshold_critical,
      high: row.priority_threshold_high,
      medium: row.priority_threshold_medium,
      low: row.priority_threshold_low
    },
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at
  })) || [];
}