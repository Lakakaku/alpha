import { supabase } from '../client/supabase';

export interface TriggerCondition {
  id: string;
  trigger_id: string;
  condition_type: 'purchase_category' | 'purchase_item' | 'transaction_amount' | 'time_window' | 'customer_frequency';
  condition_operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in_range';
  condition_value: string;
  secondary_value: string | null;
  weight_factor: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTriggerConditionData {
  trigger_id: string;
  condition_type: 'purchase_category' | 'purchase_item' | 'transaction_amount' | 'time_window' | 'customer_frequency';
  condition_operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in_range';
  condition_value: string;
  secondary_value?: string | null;
  weight_factor?: number;
  is_required?: boolean;
}

export interface UpdateTriggerConditionData {
  condition_type?: 'purchase_category' | 'purchase_item' | 'transaction_amount' | 'time_window' | 'customer_frequency';
  condition_operator?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in_range';
  condition_value?: string;
  secondary_value?: string | null;
  weight_factor?: number;
  is_required?: boolean;
}

export async function getTriggerConditions(
  triggerId: string
): Promise<TriggerCondition[]> {
  const { data, error } = await supabase
    .from('trigger_conditions')
    .select('*')
    .eq('trigger_id', triggerId)
    .order('weight_factor', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch trigger conditions: ${error.message}`);
  }

  return data || [];
}

export async function getTriggerConditionById(
  id: string
): Promise<TriggerCondition | null> {
  const { data, error } = await supabase
    .from('trigger_conditions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch trigger condition: ${error.message}`);
  }

  return data;
}

export async function createTriggerCondition(
  conditionData: CreateTriggerConditionData
): Promise<TriggerCondition> {
  const { data, error } = await supabase
    .from('trigger_conditions')
    .insert([conditionData])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create trigger condition: ${error.message}`);
  }

  return data;
}

export async function createMultipleTriggerConditions(
  conditionsData: CreateTriggerConditionData[]
): Promise<TriggerCondition[]> {
  const { data, error } = await supabase
    .from('trigger_conditions')
    .insert(conditionsData)
    .select();

  if (error) {
    throw new Error(`Failed to create trigger conditions: ${error.message}`);
  }

  return data || [];
}

export async function updateTriggerCondition(
  id: string,
  updates: UpdateTriggerConditionData
): Promise<TriggerCondition> {
  const { data, error } = await supabase
    .from('trigger_conditions')
    .update({ 
      ...updates, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update trigger condition: ${error.message}`);
  }

  return data;
}

export async function deleteTriggerCondition(id: string): Promise<void> {
  const { error } = await supabase
    .from('trigger_conditions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete trigger condition: ${error.message}`);
  }
}

export async function getRequiredConditions(
  triggerId: string
): Promise<TriggerCondition[]> {
  const { data, error } = await supabase
    .from('trigger_conditions')
    .select('*')
    .eq('trigger_id', triggerId)
    .eq('is_required', true)
    .order('weight_factor', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch required trigger conditions: ${error.message}`);
  }

  return data || [];
}

export async function getConditionsByType(
  triggerId: string,
  conditionType: 'purchase_category' | 'purchase_item' | 'transaction_amount' | 'time_window' | 'customer_frequency'
): Promise<TriggerCondition[]> {
  const { data, error } = await supabase
    .from('trigger_conditions')
    .select('*')
    .eq('trigger_id', triggerId)
    .eq('condition_type', conditionType)
    .order('weight_factor', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch conditions by type: ${error.message}`);
  }

  return data || [];
}

export async function deleteTriggerConditionsByTriggerId(
  triggerId: string
): Promise<void> {
  const { error } = await supabase
    .from('trigger_conditions')
    .delete()
    .eq('trigger_id', triggerId);

  if (error) {
    throw new Error(`Failed to delete trigger conditions: ${error.message}`);
  }
}

export async function evaluateConditionMatch(
  condition: TriggerCondition,
  customerData: {
    purchaseCategories?: string[];
    purchaseItems?: string[];
    transactionAmount?: number;
    transactionTime?: string;
    customerSequence?: number;
  }
): Promise<boolean> {
  switch (condition.condition_type) {
    case 'purchase_category':
      if (!customerData.purchaseCategories) return false;
      return evaluateArrayCondition(
        customerData.purchaseCategories,
        condition.condition_operator,
        condition.condition_value
      );

    case 'purchase_item':
      if (!customerData.purchaseItems) return false;
      return evaluateArrayCondition(
        customerData.purchaseItems,
        condition.condition_operator,
        condition.condition_value
      );

    case 'transaction_amount':
      if (!customerData.transactionAmount) return false;
      return evaluateNumericCondition(
        customerData.transactionAmount,
        condition.condition_operator,
        parseFloat(condition.condition_value),
        condition.secondary_value ? parseFloat(condition.secondary_value) : undefined
      );

    case 'customer_frequency':
      if (!customerData.customerSequence) return false;
      const frequency = parseInt(condition.condition_value);
      return customerData.customerSequence % frequency === 0;

    case 'time_window':
      if (!customerData.transactionTime) return false;
      return evaluateTimeCondition(
        new Date(customerData.transactionTime),
        condition.condition_value,
        condition.secondary_value
      );

    default:
      return false;
  }
}

function evaluateArrayCondition(
  values: string[],
  operator: string,
  target: string
): boolean {
  switch (operator) {
    case 'equals':
      return values.includes(target);
    case 'not_equals':
      return !values.includes(target);
    case 'contains':
      return values.some(v => v.toLowerCase().includes(target.toLowerCase()));
    case 'not_contains':
      return !values.some(v => v.toLowerCase().includes(target.toLowerCase()));
    default:
      return false;
  }
}

function evaluateNumericCondition(
  value: number,
  operator: string,
  target: number,
  secondaryTarget?: number
): boolean {
  switch (operator) {
    case 'equals':
      return value === target;
    case 'not_equals':
      return value !== target;
    case 'greater_than':
      return value > target;
    case 'less_than':
      return value < target;
    case 'between':
      return secondaryTarget !== undefined && value >= target && value <= secondaryTarget;
    default:
      return false;
  }
}

function evaluateTimeCondition(
  transactionTime: Date,
  startTime: string,
  endTime: string | null
): boolean {
  const hour = transactionTime.getHours();
  const minute = transactionTime.getMinutes();
  const currentTimeMinutes = hour * 60 + minute;

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startTimeMinutes = startHour * 60 + startMinute;

  if (!endTime) {
    return currentTimeMinutes >= startTimeMinutes;
  }

  const [endHour, endMinute] = endTime.split(':').map(Number);
  const endTimeMinutes = endHour * 60 + endMinute;

  return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
}