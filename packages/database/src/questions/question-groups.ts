import { supabase } from '../client/supabase';

export interface QuestionGroup {
  id: string;
  business_id: string;
  group_name: string;
  topic_category: string;
  compatibility_score: number;
  estimated_duration_seconds: number;
  priority_boost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateQuestionGroupData {
  business_id: string;
  group_name: string;
  topic_category: string;
  compatibility_score: number;
  estimated_duration_seconds: number;
  priority_boost?: number;
  is_active?: boolean;
}

export interface UpdateQuestionGroupData {
  group_name?: string;
  topic_category?: string;
  compatibility_score?: number;
  estimated_duration_seconds?: number;
  priority_boost?: number;
  is_active?: boolean;
}

export async function getQuestionGroups(
  businessId: string,
  options?: {
    topicCategory?: string;
    isActive?: boolean;
  }
): Promise<QuestionGroup[]> {
  let query = supabase
    .from('question_groups')
    .select('*')
    .eq('business_id', businessId)
    .order('group_name', { ascending: true });

  if (options?.topicCategory) {
    query = query.eq('topic_category', options.topicCategory);
  }

  if (options?.isActive !== undefined) {
    query = query.eq('is_active', options.isActive);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch question groups: ${error.message}`);
  }

  return data || [];
}

export async function getQuestionGroupById(
  id: string
): Promise<QuestionGroup | null> {
  const { data, error } = await supabase
    .from('question_groups')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch question group: ${error.message}`);
  }

  return data;
}

export async function createQuestionGroup(
  groupData: CreateQuestionGroupData
): Promise<QuestionGroup> {
  const { data, error } = await supabase
    .from('question_groups')
    .insert([groupData])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create question group: ${error.message}`);
  }

  return data;
}

export async function updateQuestionGroup(
  id: string,
  updates: UpdateQuestionGroupData
): Promise<QuestionGroup> {
  const { data, error } = await supabase
    .from('question_groups')
    .update({ 
      ...updates, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update question group: ${error.message}`);
  }

  return data;
}

export async function deleteQuestionGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from('question_groups')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete question group: ${error.message}`);
  }
}

export async function getQuestionGroupsByCompatibility(
  businessId: string,
  minCompatibilityScore: number
): Promise<QuestionGroup[]> {
  const { data, error } = await supabase
    .from('question_groups')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .gte('compatibility_score', minCompatibilityScore)
    .order('compatibility_score', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch compatible question groups: ${error.message}`);
  }

  return data || [];
}

export async function getQuestionGroupsByDuration(
  businessId: string,
  maxDurationSeconds: number
): Promise<QuestionGroup[]> {
  const { data, error } = await supabase
    .from('question_groups')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .lte('estimated_duration_seconds', maxDurationSeconds)
    .order('estimated_duration_seconds', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch question groups by duration: ${error.message}`);
  }

  return data || [];
}

export async function updateQuestionGroupEffectiveness(
  id: string,
  compatibilityScore: number
): Promise<void> {
  const { error } = await supabase
    .from('question_groups')
    .update({ 
      compatibility_score: compatibilityScore,
      updated_at: new Date().toISOString() 
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update question group effectiveness: ${error.message}`);
  }
}