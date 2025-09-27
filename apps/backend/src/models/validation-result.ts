import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { ValidationResult, ValidationResultCreate, ValidationResultUpdate } from '@vocilia/types/ai-assistant';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class ValidationResultModel {
  async create(data: ValidationResultCreate): Promise<ValidationResult> {
    const resultData = {
      ...data,
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('validation_results')
      .insert(resultData)
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create validation result: ${error.message}`);
    }

    return result as ValidationResult;
  }

  async getById(id: string, businessId: string): Promise<ValidationResult | null> {
    const { data: result, error } = await supabase
      .from('validation_results')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get validation result: ${error.message}`);
    }

    return result as ValidationResult;
  }

  async getLatestByStoreId(
    storeId: string,
    businessId: string
  ): Promise<ValidationResult | null> {
    const { data: result, error } = await supabase
      .from('validation_results')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get latest validation result: ${error.message}`);
    }

    return result as ValidationResult;
  }

  async getByStoreId(
    storeId: string,
    businessId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<ValidationResult[]> {
    let query = supabase
      .from('validation_results')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .order('created_at', { ascending: false });

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: results, error } = await query;

    if (error) {
      throw new Error(`Failed to get validation results for store: ${error.message}`);
    }

    return results as ValidationResult[];
  }

  async update(
    id: string,
    businessId: string,
    data: ValidationResultUpdate
  ): Promise<ValidationResult> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('validation_results')
      .update(updateData)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update validation result: ${error.message}`);
    }

    return result as ValidationResult;
  }

  async updateMetadata(
    id: string,
    businessId: string,
    metadata: Record<string, any>
  ): Promise<ValidationResult> {
    const { data: current, error: fetchError } = await supabase
      .from('validation_results')
      .select('metadata')
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch validation result metadata: ${fetchError.message}`);
    }

    const updatedMetadata = {
      ...current.metadata,
      ...metadata
    };

    return this.update(id, businessId, { metadata: updatedMetadata });
  }

  async delete(id: string, businessId: string): Promise<void> {
    const { error } = await supabase
      .from('validation_results')
      .delete()
      .eq('id', id)
      .eq('stores.business_id', businessId);

    if (error) {
      throw new Error(`Failed to delete validation result: ${error.message}`);
    }
  }

  async getScoreHistory(
    storeId: string,
    businessId: string,
    days: number = 30
  ): Promise<{
    date: string;
    score: number;
    missing_categories: string[];
  }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.getByStoreId(storeId, businessId, {
      startDate: startDate.toISOString(),
      limit: 100
    });

    return results.map(result => ({
      date: result.created_at,
      score: result.overall_score,
      missing_categories: result.missing_categories
    }));
  }

  async getScoreTrend(
    storeId: string,
    businessId: string,
    days: number = 7
  ): Promise<{
    currentScore: number;
    previousScore: number;
    change: number;
    trend: 'improving' | 'declining' | 'stable';
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentResults = await this.getByStoreId(storeId, businessId, {
      limit: 2
    });

    if (recentResults.length === 0) {
      return {
        currentScore: 0,
        previousScore: 0,
        change: 0,
        trend: 'stable'
      };
    }

    const currentScore = recentResults[0].overall_score;
    const previousScore = recentResults.length > 1 ? recentResults[1].overall_score : currentScore;
    const change = currentScore - previousScore;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (change > 5) trend = 'improving';
    else if (change < -5) trend = 'declining';

    return {
      currentScore,
      previousScore,
      change,
      trend
    };
  }

  async getCompletionStats(
    storeId: string,
    businessId: string
  ): Promise<{
    totalCategories: number;
    completedCategories: number;
    completionRate: number;
    categoryBreakdown: Record<string, {
      completed: boolean;
      score: number;
      weight: number;
    }>;
  }> {
    const latest = await this.getLatestByStoreId(storeId, businessId);

    if (!latest) {
      return {
        totalCategories: 0,
        completedCategories: 0,
        completionRate: 0,
        categoryBreakdown: {}
      };
    }

    const categoryBreakdown = latest.category_scores;
    const totalCategories = Object.keys(categoryBreakdown).length;
    const completedCategories = Object.values(categoryBreakdown).filter(
      (cat: any) => cat.completed
    ).length;

    return {
      totalCategories,
      completedCategories,
      completionRate: totalCategories > 0 ? (completedCategories / totalCategories) * 100 : 0,
      categoryBreakdown
    };
  }

  async createOrUpdateLatest(
    storeId: string,
    businessId: string,
    validationData: Omit<ValidationResultCreate, 'store_id'>
  ): Promise<ValidationResult> {
    const existing = await this.getLatestByStoreId(storeId, businessId);
    
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 5); // 5 minute threshold

    if (existing && new Date(existing.created_at) > cutoffTime) {
      return this.update(existing.id, businessId, validationData);
    } else {
      return this.create({
        ...validationData,
        store_id: storeId
      });
    }
  }

  async getAverageScoreByPeriod(
    storeId: string,
    businessId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    period: string;
    averageScore: number;
    count: number;
  }[]> {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const periodCount = period === 'day' ? 30 : period === 'week' ? 12 : 12;

    const results: { period: string; averageScore: number; count: number; }[] = [];

    for (let i = 0; i < periodCount; i++) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - (i * days));
      
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      const periodResults = await this.getByStoreId(storeId, businessId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const averageScore = periodResults.length > 0
        ? periodResults.reduce((sum, r) => sum + r.overall_score, 0) / periodResults.length
        : 0;

      results.unshift({
        period: endDate.toISOString().split('T')[0],
        averageScore: Math.round(averageScore * 100) / 100,
        count: periodResults.length
      });
    }

    return results;
  }

  async getMissingCategoriesFrequency(
    storeId: string,
    businessId: string,
    days: number = 30
  ): Promise<Record<string, number>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.getByStoreId(storeId, businessId, {
      startDate: startDate.toISOString()
    });

    const frequency: Record<string, number> = {};

    results.forEach(result => {
      result.missing_categories.forEach(category => {
        frequency[category] = (frequency[category] || 0) + 1;
      });
    });

    return frequency;
  }

  async getValidationInsights(
    storeId: string,
    businessId: string
  ): Promise<{
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    topStrengths: string[];
    topWeaknesses: string[];
    recommendations: string[];
    scoreDistribution: Record<string, number>;
  }> {
    const latest = await this.getLatestByStoreId(storeId, businessId);
    
    if (!latest) {
      return {
        overallHealth: 'poor',
        topStrengths: [],
        topWeaknesses: [],
        recommendations: ['Start building your store context'],
        scoreDistribution: {}
      };
    }

    const score = latest.overall_score;
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (score >= 90) overallHealth = 'excellent';
    else if (score >= 75) overallHealth = 'good';
    else if (score >= 50) overallHealth = 'fair';
    else overallHealth = 'poor';

    const categoryScores = latest.category_scores;
    const strengths = Object.entries(categoryScores)
      .filter(([_, data]: [string, any]) => data.score >= 80)
      .map(([category, _]) => category)
      .slice(0, 3);

    const weaknesses = Object.entries(categoryScores)
      .filter(([_, data]: [string, any]) => data.score < 50)
      .map(([category, _]) => category)
      .slice(0, 3);

    const recommendations = [
      ...latest.missing_categories.slice(0, 2).map(cat => `Add information about ${cat}`),
      ...weaknesses.slice(0, 2).map(cat => `Improve ${cat} details`)
    ].slice(0, 3);

    const scoreDistribution = Object.fromEntries(
      Object.entries(categoryScores).map(([category, data]: [string, any]) => [
        category,
        data.score
      ])
    );

    return {
      overallHealth,
      topStrengths: strengths,
      topWeaknesses: weaknesses,
      recommendations,
      scoreDistribution
    };
  }

  async cleanupOldResults(
    storeId: string,
    businessId: string,
    keepDays: number = 90
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    const { data: deletedResults, error } = await supabase
      .from('validation_results')
      .delete()
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to cleanup old validation results: ${error.message}`);
    }

    return deletedResults.length;
  }
}