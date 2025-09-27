import { supabase } from '../client/supabase';

export interface TriggerActivationLog {
  id: string;
  trigger_id: string;
  business_id: string;
  customer_verification_id: string;
  activation_timestamp: string;
  conditions_met: Record<string, any>;
  questions_triggered: string[];
  effectiveness_score: number | null;
  response_quality: number | null;
  call_duration_seconds: number | null;
  created_at: string;
}

export interface CreateTriggerActivationLogData {
  trigger_id: string;
  business_id: string;
  customer_verification_id: string;
  conditions_met: Record<string, any>;
  questions_triggered: string[];
  effectiveness_score?: number | null;
  response_quality?: number | null;
  call_duration_seconds?: number | null;
}

export interface UpdateTriggerActivationLogData {
  effectiveness_score?: number | null;
  response_quality?: number | null;
  call_duration_seconds?: number | null;
}

export async function getTriggerActivationLogs(
  businessId: string,
  options?: {
    triggerId?: string;
    customerVerificationId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<TriggerActivationLog[]> {
  let query = supabase
    .from('trigger_activation_logs')
    .select('*')
    .eq('business_id', businessId)
    .order('activation_timestamp', { ascending: false });

  if (options?.triggerId) {
    query = query.eq('trigger_id', options.triggerId);
  }

  if (options?.customerVerificationId) {
    query = query.eq('customer_verification_id', options.customerVerificationId);
  }

  if (options?.startDate) {
    query = query.gte('activation_timestamp', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('activation_timestamp', options.endDate);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch trigger activation logs: ${error.message}`);
  }

  return data || [];
}

export async function getTriggerActivationLogById(
  id: string
): Promise<TriggerActivationLog | null> {
  const { data, error } = await supabase
    .from('trigger_activation_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch trigger activation log: ${error.message}`);
  }

  return data;
}

export async function createTriggerActivationLog(
  logData: CreateTriggerActivationLogData
): Promise<TriggerActivationLog> {
  const dataWithTimestamp = {
    ...logData,
    activation_timestamp: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('trigger_activation_logs')
    .insert([dataWithTimestamp])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create trigger activation log: ${error.message}`);
  }

  return data;
}

export async function updateTriggerActivationLog(
  id: string,
  updates: UpdateTriggerActivationLogData
): Promise<TriggerActivationLog> {
  const { data, error } = await supabase
    .from('trigger_activation_logs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update trigger activation log: ${error.message}`);
  }

  return data;
}

export async function getTriggerEffectivenessMetrics(
  businessId: string,
  triggerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<{
  totalActivations: number;
  averageEffectivenessScore: number;
  averageResponseQuality: number;
  averageCallDuration: number;
  successRate: number;
}> {
  let query = supabase
    .from('trigger_activation_logs')
    .select('effectiveness_score, response_quality, call_duration_seconds')
    .eq('business_id', businessId)
    .eq('trigger_id', triggerId);

  if (options?.startDate) {
    query = query.gte('activation_timestamp', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('activation_timestamp', options.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch trigger effectiveness metrics: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      totalActivations: 0,
      averageEffectivenessScore: 0,
      averageResponseQuality: 0,
      averageCallDuration: 0,
      successRate: 0
    };
  }

  const totalActivations = data.length;
  const validEffectivenessScores = data
    .map(d => d.effectiveness_score)
    .filter((score): score is number => score !== null);
  const validResponseQuality = data
    .map(d => d.response_quality)
    .filter((quality): quality is number => quality !== null);
  const validCallDurations = data
    .map(d => d.call_duration_seconds)
    .filter((duration): duration is number => duration !== null);

  const averageEffectivenessScore = validEffectivenessScores.length > 0
    ? validEffectivenessScores.reduce((sum, score) => sum + score, 0) / validEffectivenessScores.length
    : 0;

  const averageResponseQuality = validResponseQuality.length > 0
    ? validResponseQuality.reduce((sum, quality) => sum + quality, 0) / validResponseQuality.length
    : 0;

  const averageCallDuration = validCallDurations.length > 0
    ? validCallDurations.reduce((sum, duration) => sum + duration, 0) / validCallDurations.length
    : 0;

  const successRate = validEffectivenessScores.filter(score => score >= 3).length / totalActivations;

  return {
    totalActivations,
    averageEffectivenessScore,
    averageResponseQuality,
    averageCallDuration,
    successRate
  };
}

export async function getBusinessTriggerAnalytics(
  businessId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<{
  triggerId: string;
  activationCount: number;
  averageEffectiveness: number;
  averageResponseQuality: number;
  successRate: number;
}[]> {
  let query = supabase
    .from('trigger_activation_logs')
    .select('trigger_id, effectiveness_score, response_quality')
    .eq('business_id', businessId);

  if (options?.startDate) {
    query = query.gte('activation_timestamp', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('activation_timestamp', options.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch business trigger analytics: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group by trigger_id and calculate metrics
  const triggerGroups = data.reduce((groups, log) => {
    if (!groups[log.trigger_id]) {
      groups[log.trigger_id] = [];
    }
    groups[log.trigger_id].push(log);
    return groups;
  }, {} as Record<string, typeof data>);

  const analytics = Object.entries(triggerGroups).map(([triggerId, logs]) => {
    const activationCount = logs.length;
    const validEffectivenessScores = logs
      .map(l => l.effectiveness_score)
      .filter((score): score is number => score !== null);
    const validResponseQuality = logs
      .map(l => l.response_quality)
      .filter((quality): quality is number => quality !== null);

    const averageEffectiveness = validEffectivenessScores.length > 0
      ? validEffectivenessScores.reduce((sum, score) => sum + score, 0) / validEffectivenessScores.length
      : 0;

    const averageResponseQuality = validResponseQuality.length > 0
      ? validResponseQuality.reduce((sum, quality) => sum + quality, 0) / validResponseQuality.length
      : 0;

    const successRate = validEffectivenessScores.filter(score => score >= 3).length / activationCount;

    return {
      triggerId,
      activationCount,
      averageEffectiveness,
      averageResponseQuality,
      successRate
    };
  });

  // Sort by activation count and limit if specified
  analytics.sort((a, b) => b.activationCount - a.activationCount);

  return options?.limit ? analytics.slice(0, options.limit) : analytics;
}

export async function getCustomerTriggerHistory(
  customerVerificationId: string
): Promise<TriggerActivationLog[]> {
  const { data, error } = await supabase
    .from('trigger_activation_logs')
    .select('*')
    .eq('customer_verification_id', customerVerificationId)
    .order('activation_timestamp', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch customer trigger history: ${error.message}`);
  }

  return data || [];
}

export async function deleteTriggerActivationLogsByTriggerId(
  triggerId: string
): Promise<void> {
  const { error } = await supabase
    .from('trigger_activation_logs')
    .delete()
    .eq('trigger_id', triggerId);

  if (error) {
    throw new Error(`Failed to delete trigger activation logs: ${error.message}`);
  }
}

export async function updateLogEffectivenessScore(
  id: string,
  effectivenessScore: number,
  responseQuality?: number,
  callDurationSeconds?: number
): Promise<void> {
  const updates: UpdateTriggerActivationLogData = {
    effectiveness_score: effectivenessScore
  };

  if (responseQuality !== undefined) {
    updates.response_quality = responseQuality;
  }

  if (callDurationSeconds !== undefined) {
    updates.call_duration_seconds = callDurationSeconds;
  }

  await updateTriggerActivationLog(id, updates);
}

export async function getTriggerPerformanceTrends(
  businessId: string,
  triggerId: string,
  days: number = 30
): Promise<{
  date: string;
  activations: number;
  averageEffectiveness: number;
  successRate: number;
}[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('trigger_activation_logs')
    .select('activation_timestamp, effectiveness_score')
    .eq('business_id', businessId)
    .eq('trigger_id', triggerId)
    .gte('activation_timestamp', startDate.toISOString())
    .order('activation_timestamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch trigger performance trends: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group by date
  const dailyGroups = data.reduce((groups, log) => {
    const date = log.activation_timestamp.split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {} as Record<string, typeof data>);

  return Object.entries(dailyGroups).map(([date, logs]) => {
    const activations = logs.length;
    const validScores = logs
      .map(l => l.effectiveness_score)
      .filter((score): score is number => score !== null);
    
    const averageEffectiveness = validScores.length > 0
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0;
    
    const successRate = validScores.filter(score => score >= 3).length / activations;

    return {
      date,
      activations,
      averageEffectiveness,
      successRate
    };
  });
}