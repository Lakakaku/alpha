import { createClient } from '../client/supabase';
import type { DynamicTrigger, CreateDynamicTrigger, UpdateDynamicTrigger } from '@vocilia/types';

const supabase = createClient();

export interface DynamicTriggerWithDetails extends DynamicTrigger {
  conditions?: Array<{
    id: string;
    condition_key: string;
    condition_operator: string;
    condition_value: string;
    is_required: boolean;
  }>;
  recent_activations?: Array<{
    activation_count: number;
    last_activation: string;
    success_rate: number;
  }>;
}

/**
 * Get all dynamic triggers for a business
 */
export async function getDynamicTriggers(
  businessId: string,
  options?: {
    triggerType?: 'purchase_based' | 'time_based' | 'amount_based';
    isActive?: boolean;
  }
): Promise<DynamicTrigger[]> {
  let query = supabase
    .from('dynamic_triggers')
    .select('*')
    .eq('business_id', businessId);

  if (options?.triggerType) {
    query = query.eq('trigger_type', options.triggerType);
  }

  if (options?.isActive !== undefined) {
    query = query.eq('is_active', options.isActive);
  }

  const { data, error } = await query.order('priority_level', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch dynamic triggers: ${error.message}`);
  }

  return data?.map(row => ({
    id: row.id,
    business_context_id: row.business_id,
    trigger_name: row.trigger_name,
    trigger_type: row.trigger_type,
    priority_level: row.priority_level,
    sensitivity_threshold: row.sensitivity_threshold,
    is_active: row.is_active,
    trigger_config: row.trigger_config,
    effectiveness_score: parseFloat(row.effectiveness_score || '0'),
    created_at: row.created_at,
    updated_at: row.updated_at
  })) || [];
}

/**
 * Get a specific dynamic trigger with details
 */
export async function getDynamicTriggerById(
  triggerId: string
): Promise<DynamicTriggerWithDetails | null> {
  const { data, error } = await supabase
    .from('dynamic_triggers')
    .select(`
      *,
      trigger_conditions (
        id,
        condition_key,
        condition_operator,
        condition_value,
        is_required
      )
    `)
    .eq('id', triggerId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch dynamic trigger: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    business_context_id: data.business_id,
    trigger_name: data.trigger_name,
    trigger_type: data.trigger_type,
    priority_level: data.priority_level,
    sensitivity_threshold: data.sensitivity_threshold,
    is_active: data.is_active,
    trigger_config: data.trigger_config,
    effectiveness_score: parseFloat(data.effectiveness_score || '0'),
    created_at: data.created_at,
    updated_at: data.updated_at,
    conditions: data.trigger_conditions || []
  };
}

/**
 * Create a new dynamic trigger
 */
export async function createDynamicTrigger(
  triggerData: CreateDynamicTrigger
): Promise<DynamicTrigger> {
  const { data, error } = await supabase
    .from('dynamic_triggers')
    .insert([{
      business_id: triggerData.business_context_id,
      trigger_name: triggerData.trigger_name,
      trigger_type: triggerData.trigger_type,
      priority_level: triggerData.priority_level || 3,
      sensitivity_threshold: triggerData.sensitivity_threshold || 10,
      trigger_config: triggerData.trigger_config,
      is_active: true,
      effectiveness_score: 0.0
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create dynamic trigger: ${error.message}`);
  }

  return {
    id: data.id,
    business_context_id: data.business_id,
    trigger_name: data.trigger_name,
    trigger_type: data.trigger_type,
    priority_level: data.priority_level,
    sensitivity_threshold: data.sensitivity_threshold,
    is_active: data.is_active,
    trigger_config: data.trigger_config,
    effectiveness_score: parseFloat(data.effectiveness_score || '0'),
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

/**
 * Update an existing dynamic trigger
 */
export async function updateDynamicTrigger(
  triggerId: string,
  updates: UpdateDynamicTrigger
): Promise<DynamicTrigger> {
  const updateData: any = {};
  
  if (updates.trigger_name !== undefined) {
    updateData.trigger_name = updates.trigger_name;
  }
  if (updates.priority_level !== undefined) {
    updateData.priority_level = updates.priority_level;
  }
  if (updates.sensitivity_threshold !== undefined) {
    updateData.sensitivity_threshold = updates.sensitivity_threshold;
  }
  if (updates.trigger_config !== undefined) {
    updateData.trigger_config = updates.trigger_config;
  }
  if (updates.is_active !== undefined) {
    updateData.is_active = updates.is_active;
  }

  const { data, error } = await supabase
    .from('dynamic_triggers')
    .update(updateData)
    .eq('id', triggerId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update dynamic trigger: ${error.message}`);
  }

  return {
    id: data.id,
    business_context_id: data.business_id,
    trigger_name: data.trigger_name,
    trigger_type: data.trigger_type,
    priority_level: data.priority_level,
    sensitivity_threshold: data.sensitivity_threshold,
    is_active: data.is_active,
    trigger_config: data.trigger_config,
    effectiveness_score: parseFloat(data.effectiveness_score || '0'),
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

/**
 * Deactivate a dynamic trigger (soft delete)
 */
export async function deactivateDynamicTrigger(triggerId: string): Promise<void> {
  const { error } = await supabase
    .from('dynamic_triggers')
    .update({ is_active: false })
    .eq('id', triggerId);

  if (error) {
    throw new Error(`Failed to deactivate dynamic trigger: ${error.message}`);
  }
}

/**
 * Update trigger effectiveness score
 */
export async function updateTriggerEffectiveness(
  triggerId: string,
  effectivenessScore: number
): Promise<void> {
  const { error } = await supabase
    .from('dynamic_triggers')
    .update({ effectiveness_score: effectivenessScore })
    .eq('id', triggerId);

  if (error) {
    throw new Error(`Failed to update trigger effectiveness: ${error.message}`);
  }
}

/**
 * Get triggers by priority level for a business
 */
export async function getTriggersByPriority(
  businessId: string,
  minPriority: number = 1
): Promise<DynamicTrigger[]> {
  const { data, error } = await supabase
    .from('dynamic_triggers')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .gte('priority_level', minPriority)
    .order('priority_level', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch triggers by priority: ${error.message}`);
  }

  return data?.map(row => ({
    id: row.id,
    business_context_id: row.business_id,
    trigger_name: row.trigger_name,
    trigger_type: row.trigger_type,
    priority_level: row.priority_level,
    sensitivity_threshold: row.sensitivity_threshold,
    is_active: row.is_active,
    trigger_config: row.trigger_config,
    effectiveness_score: parseFloat(row.effectiveness_score || '0'),
    created_at: row.created_at,
    updated_at: row.updated_at
  })) || [];
}

/**
 * Get top performing triggers for effectiveness analysis
 */
export async function getTopPerformingTriggers(
  businessId: string,
  limit: number = 10
): Promise<DynamicTrigger[]> {
  const { data, error } = await supabase
    .from('dynamic_triggers')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('effectiveness_score', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch top performing triggers: ${error.message}`);
  }

  return data?.map(row => ({
    id: row.id,
    business_context_id: row.business_id,
    trigger_name: row.trigger_name,
    trigger_type: row.trigger_type,
    priority_level: row.priority_level,
    sensitivity_threshold: row.sensitivity_threshold,
    is_active: row.is_active,
    trigger_config: row.trigger_config,
    effectiveness_score: parseFloat(row.effectiveness_score || '0'),
    created_at: row.created_at,
    updated_at: row.updated_at
  })) || [];
}