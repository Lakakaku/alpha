/**
 * FeedbackInsight model with status management
 * Feature: 008-step-2-6
 * Task: T023
 */

import { supabase } from '../client';
import type { FeedbackInsight, InsightType, PriorityLevel, InsightStatus, InsightStatusUpdate } from '@vocilia/types/feedback-analysis';

export interface CreateFeedbackInsightData {
  store_id: string;
  business_id: string;
  feedback_id?: string;
  insight_type: InsightType;
  title: string;
  description: string;
  priority_level: PriorityLevel;
  department?: string;
  suggested_actions?: string[];
  confidence_score?: number;
  status?: InsightStatus;
}

export interface UpdateFeedbackInsightData {
  insight_type?: InsightType;
  title?: string;
  description?: string;
  priority_level?: PriorityLevel;
  department?: string;
  suggested_actions?: string[];
  confidence_score?: number;
  status?: InsightStatus;
}

export interface FeedbackInsightFilters {
  store_id?: string;
  business_id?: string;
  insight_type?: InsightType;
  priority_level?: PriorityLevel;
  status?: InsightStatus;
  department?: string;
  confidence_threshold?: number;
  date_range?: {
    start_date: string;
    end_date: string;
  };
  limit?: number;
  offset?: number;
}

/**
 * Validation functions
 */
export function validateFeedbackInsightData(data: CreateFeedbackInsightData): string[] {
  const errors: string[] = [];

  // Required fields validation
  if (!data.store_id || typeof data.store_id !== 'string') {
    errors.push('store_id is required and must be a string');
  }

  if (!data.business_id || typeof data.business_id !== 'string') {
    errors.push('business_id is required and must be a string');
  }

  if (!data.insight_type || !['improvement', 'issue', 'opportunity', 'trend'].includes(data.insight_type)) {
    errors.push('insight_type must be one of: improvement, issue, opportunity, trend');
  }

  if (!data.title || typeof data.title !== 'string') {
    errors.push('title is required and must be a string');
  } else if (data.title.length < 5 || data.title.length > 200) {
    errors.push('title must be between 5 and 200 characters');
  }

  if (!data.description || typeof data.description !== 'string') {
    errors.push('description is required and must be a string');
  } else if (data.description.length < 10 || data.description.length > 2000) {
    errors.push('description must be between 10 and 2000 characters');
  }

  if (!data.priority_level || !['low', 'medium', 'high', 'critical'].includes(data.priority_level)) {
    errors.push('priority_level must be one of: low, medium, high, critical');
  }

  // Optional fields validation
  if (data.feedback_id && typeof data.feedback_id !== 'string') {
    errors.push('feedback_id must be a string');
  }

  if (data.department && typeof data.department !== 'string') {
    errors.push('department must be a string');
  }

  if (data.suggested_actions) {
    if (!Array.isArray(data.suggested_actions)) {
      errors.push('suggested_actions must be an array');
    } else {
      data.suggested_actions.forEach((action, index) => {
        if (typeof action !== 'string') {
          errors.push(`suggested_actions[${index}] must be a string`);
        } else if (action.length < 5 || action.length > 500) {
          errors.push(`suggested_actions[${index}] must be between 5 and 500 characters`);
        }
      });
    }
  }

  if (data.confidence_score !== undefined) {
    if (typeof data.confidence_score !== 'number' || data.confidence_score < 0 || data.confidence_score > 1) {
      errors.push('confidence_score must be a number between 0 and 1');
    }
  }

  if (data.status && !['new', 'acknowledged', 'in_progress', 'resolved', 'dismissed'].includes(data.status)) {
    errors.push('status must be one of: new, acknowledged, in_progress, resolved, dismissed');
  }

  return errors;
}

export function validateInsightStatusUpdate(update: InsightStatusUpdate): string[] {
  const errors: string[] = [];

  if (!update.status || !['new', 'acknowledged', 'in_progress', 'resolved', 'dismissed'].includes(update.status)) {
    errors.push('status is required and must be one of: new, acknowledged, in_progress, resolved, dismissed');
  }

  if (update.notes && typeof update.notes !== 'string') {
    errors.push('notes must be a string');
  } else if (update.notes && update.notes.length > 1000) {
    errors.push('notes must be 1000 characters or less');
  }

  return errors;
}

/**
 * Status transition validation
 */
export function validateStatusTransition(
  currentStatus: InsightStatus,
  newStatus: InsightStatus
): { isValid: boolean; error?: string } {
  const validTransitions: Record<InsightStatus, InsightStatus[]> = {
    'new': ['acknowledged', 'dismissed'],
    'acknowledged': ['in_progress', 'resolved', 'dismissed'],
    'in_progress': ['resolved', 'acknowledged', 'dismissed'],
    'resolved': ['in_progress'], // Can reopen if needed
    'dismissed': ['new'], // Can be un-dismissed
  };

  if (!validTransitions[currentStatus].includes(newStatus)) {
    return {
      isValid: false,
      error: `Invalid status transition from '${currentStatus}' to '${newStatus}'. Valid transitions are: ${validTransitions[currentStatus].join(', ')}`,
    };
  }

  return { isValid: true };
}

/**
 * Insight generation utilities
 */
export class InsightGenerator {
  /**
   * Generate insights from feedback analysis
   */
  static async generateInsightsFromAnalysis(
    storeId: string,
    businessId: string,
    analysisData: {
      negativeFeeback: Array<{ content: string; department_tags?: string[]; sentiment: string }>;
      newIssues: string[];
      actionableInsights: Array<{
        title: string;
        description: string;
        priority: PriorityLevel;
        department?: string;
        suggested_actions?: string[];
      }>;
    }
  ): Promise<FeedbackInsight[]> {
    const insights: CreateFeedbackInsightData[] = [];

    // Convert actionable insights to FeedbackInsight format
    analysisData.actionableInsights.forEach(insight => {
      insights.push({
        store_id: storeId,
        business_id: businessId,
        insight_type: insight.priority === 'critical' ? 'issue' : 'improvement',
        title: insight.title,
        description: insight.description,
        priority_level: insight.priority,
        department: insight.department,
        suggested_actions: insight.suggested_actions,
        confidence_score: 0.8, // Default confidence for AI-generated insights
        status: 'new',
      });
    });

    // Generate insights for new issues
    analysisData.newIssues.forEach(issue => {
      insights.push({
        store_id: storeId,
        business_id: businessId,
        insight_type: 'issue',
        title: `Nytt problem upptäckt: ${issue.substring(0, 50)}...`,
        description: issue,
        priority_level: 'medium',
        suggested_actions: [
          'Undersök problemet närmare',
          'Implementera åtgärder för att lösa problemet',
          'Följ upp med kunder för att bekräfta förbättring',
        ],
        confidence_score: 0.7,
        status: 'new',
      });
    });

    // Generate trend insights based on negative feedback patterns
    const departmentIssues = this.analyzeDepartmentPatterns(analysisData.negativeFeeback);
    Object.entries(departmentIssues).forEach(([department, issueCount]) => {
      if (issueCount >= 3) { // Threshold for generating department insight
        insights.push({
          store_id: storeId,
          business_id: businessId,
          insight_type: 'trend',
          title: `Ökande problem inom ${department}`,
          description: `Flera negativa kommentarer har identifierats för ${department} avdelningen (${issueCount} st). Detta kan indikera ett systematiskt problem.`,
          priority_level: issueCount >= 5 ? 'high' : 'medium',
          department,
          suggested_actions: [
            `Granska rutiner och processer inom ${department}`,
            'Utbilda personal om identifierade problemområden',
            'Implementera kvalitetskontroller',
            'Följ upp kundnöjdhet specifikt för denna avdelning',
          ],
          confidence_score: 0.85,
          status: 'new',
        });
      }
    });

    // Create insights in database
    const createdInsights: FeedbackInsight[] = [];
    for (const insightData of insights) {
      try {
        const created = await FeedbackInsightService.create(insightData);
        createdInsights.push(created);
      } catch (error) {
        console.error('Failed to create insight:', error);
      }
    }

    return createdInsights;
  }

  /**
   * Analyze department patterns in feedback
   */
  private static analyzeDepartmentPatterns(
    feedback: Array<{ content: string; department_tags?: string[]; sentiment: string }>
  ): Record<string, number> {
    const departmentCounts: Record<string, number> = {};

    feedback.forEach(item => {
      if (item.sentiment === 'negative' && item.department_tags) {
        item.department_tags.forEach(department => {
          departmentCounts[department] = (departmentCounts[department] || 0) + 1;
        });
      }
    });

    return departmentCounts;
  }
}

/**
 * Database operations
 */
export class FeedbackInsightService {
  /**
   * Create a new feedback insight
   */
  static async create(data: CreateFeedbackInsightData): Promise<FeedbackInsight> {
    const errors = validateFeedbackInsightData(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const insightData = {
      ...data,
      status: data.status || 'new',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insight, error } = await supabase
      .from('feedback_insights')
      .insert([insightData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create feedback insight: ${error.message}`);
    }

    return insight as FeedbackInsight;
  }

  /**
   * Get feedback insight by ID
   */
  static async getById(id: string): Promise<FeedbackInsight | null> {
    const { data: insight, error } = await supabase
      .from('feedback_insights')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No rows found
      }
      throw new Error(`Failed to get feedback insight: ${error.message}`);
    }

    return insight as FeedbackInsight;
  }

  /**
   * Update feedback insight status
   */
  static async updateStatus(
    id: string,
    statusUpdate: InsightStatusUpdate,
    updatedBy?: string
  ): Promise<FeedbackInsight> {
    const errors = validateInsightStatusUpdate(statusUpdate);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Get current insight to validate status transition
    const currentInsight = await this.getById(id);
    if (!currentInsight) {
      throw new Error('Insight not found');
    }

    const transition = validateStatusTransition(currentInsight.status, statusUpdate.status);
    if (!transition.isValid) {
      throw new Error(transition.error);
    }

    // Create status history record
    if (currentInsight.status !== statusUpdate.status) {
      await supabase.from('insight_status_history').insert([{
        insight_id: id,
        previous_status: currentInsight.status,
        new_status: statusUpdate.status,
        notes: statusUpdate.notes,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      }]);
    }

    const { data: insight, error } = await supabase
      .from('feedback_insights')
      .update({
        status: statusUpdate.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update insight status: ${error.message}`);
    }

    return insight as FeedbackInsight;
  }

  /**
   * Update feedback insight
   */
  static async update(id: string, data: UpdateFeedbackInsightData): Promise<FeedbackInsight> {
    const { data: insight, error } = await supabase
      .from('feedback_insights')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update feedback insight: ${error.message}`);
    }

    return insight as FeedbackInsight;
  }

  /**
   * Delete feedback insight
   */
  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('feedback_insights')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete feedback insight: ${error.message}`);
    }
  }

  /**
   * List feedback insights with filters
   */
  static async list(filters: FeedbackInsightFilters = {}): Promise<FeedbackInsight[]> {
    let query = supabase
      .from('feedback_insights')
      .select('*');

    // Apply filters
    if (filters.store_id) {
      query = query.eq('store_id', filters.store_id);
    }

    if (filters.business_id) {
      query = query.eq('business_id', filters.business_id);
    }

    if (filters.insight_type) {
      query = query.eq('insight_type', filters.insight_type);
    }

    if (filters.priority_level) {
      query = query.eq('priority_level', filters.priority_level);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.department) {
      query = query.eq('department', filters.department);
    }

    if (filters.confidence_threshold) {
      query = query.gte('confidence_score', filters.confidence_threshold);
    }

    if (filters.date_range) {
      query = query
        .gte('created_at', filters.date_range.start_date)
        .lte('created_at', filters.date_range.end_date);
    }

    // Apply ordering and pagination
    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 25) - 1);
    }

    const { data: insights, error } = await query;

    if (error) {
      throw new Error(`Failed to list feedback insights: ${error.message}`);
    }

    return insights as FeedbackInsight[];
  }

  /**
   * Get insights by store with aggregated statistics
   */
  static async getStoreInsights(
    storeId: string,
    options: {
      status?: InsightStatus;
      priority?: PriorityLevel;
      department?: string;
      limit?: number;
    } = {}
  ): Promise<{
    insights: FeedbackInsight[];
    stats: {
      total: number;
      byStatus: Record<InsightStatus, number>;
      byPriority: Record<PriorityLevel, number>;
      byDepartment: Record<string, number>;
    };
  }> {
    const filters: FeedbackInsightFilters = {
      store_id: storeId,
      ...options,
    };

    const insights = await this.list(filters);

    // Get aggregated statistics
    const { data: stats, error: statsError } = await supabase
      .rpc('get_insight_stats', { store_id_param: storeId });

    if (statsError) {
      throw new Error(`Failed to get insight stats: ${statsError.message}`);
    }

    return {
      insights,
      stats: stats || {
        total: 0,
        byStatus: { new: 0, acknowledged: 0, in_progress: 0, resolved: 0, dismissed: 0 },
        byPriority: { low: 0, medium: 0, high: 0, critical: 0 },
        byDepartment: {},
      },
    };
  }

  /**
   * Get status history for an insight
   */
  static async getStatusHistory(insightId: string): Promise<Array<{
    id: string;
    previous_status: InsightStatus;
    new_status: InsightStatus;
    notes?: string;
    updated_by?: string;
    updated_at: string;
  }>> {
    const { data: history, error } = await supabase
      .from('insight_status_history')
      .select('*')
      .eq('insight_id', insightId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get status history: ${error.message}`);
    }

    return history || [];
  }

  /**
   * Bulk update insight statuses
   */
  static async bulkUpdateStatus(
    insightIds: string[],
    statusUpdate: InsightStatusUpdate,
    updatedBy?: string
  ): Promise<FeedbackInsight[]> {
    const errors = validateInsightStatusUpdate(statusUpdate);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const updatedInsights: FeedbackInsight[] = [];

    for (const id of insightIds) {
      try {
        const updated = await this.updateStatus(id, statusUpdate, updatedBy);
        updatedInsights.push(updated);
      } catch (error) {
        console.error(`Failed to update insight ${id}:`, error);
      }
    }

    return updatedInsights;
  }

  /**
   * Get insights requiring action (high priority and new/acknowledged status)
   */
  static async getActionableInsights(
    storeId: string,
    limit: number = 10
  ): Promise<FeedbackInsight[]> {
    const { data: insights, error } = await supabase
      .from('feedback_insights')
      .select('*')
      .eq('store_id', storeId)
      .in('status', ['new', 'acknowledged'])
      .in('priority_level', ['high', 'critical'])
      .order('priority_level', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get actionable insights: ${error.message}`);
    }

    return insights as FeedbackInsight[];
  }
}

export default FeedbackInsightService;