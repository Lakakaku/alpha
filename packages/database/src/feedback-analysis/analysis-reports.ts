/**
 * AnalysisReport model with validation
 * Feature: 008-step-2-6
 * Task: T021
 */

import { supabase } from '../client';
import type { AnalysisReport, SentimentBreakdown, DepartmentBreakdown, TrendComparison, ActionableInsight } from '@vocilia/types/feedback-analysis';

export interface CreateAnalysisReportData {
  store_id: string;
  business_id: string;
  week_number: number;
  year: number;
  positive_summary?: string;
  negative_summary?: string;
  general_opinions?: string;
  new_critiques?: string[];
  actionable_insights?: ActionableInsight[];
  total_feedback_count: number;
  sentiment_breakdown?: SentimentBreakdown;
  department_breakdown?: DepartmentBreakdown;
  trend_comparison?: TrendComparison;
  generated_at?: string;
}

export interface UpdateAnalysisReportData {
  positive_summary?: string;
  negative_summary?: string;
  general_opinions?: string;
  new_critiques?: string[];
  actionable_insights?: ActionableInsight[];
  total_feedback_count?: number;
  sentiment_breakdown?: SentimentBreakdown;
  department_breakdown?: DepartmentBreakdown;
  trend_comparison?: TrendComparison;
  generated_at?: string;
}

export interface AnalysisReportFilters {
  business_id?: string;
  store_id?: string;
  week_number?: number;
  year?: number;
  weeks_back?: number;
  limit?: number;
  offset?: number;
}

/**
 * Validation functions
 */
export function validateAnalysisReportData(data: CreateAnalysisReportData): string[] {
  const errors: string[] = [];

  // Required fields validation
  if (!data.store_id || typeof data.store_id !== 'string') {
    errors.push('store_id is required and must be a string');
  }

  if (!data.business_id || typeof data.business_id !== 'string') {
    errors.push('business_id is required and must be a string');
  }

  if (!data.week_number || typeof data.week_number !== 'number') {
    errors.push('week_number is required and must be a number');
  } else if (data.week_number < 1 || data.week_number > 53) {
    errors.push('week_number must be between 1 and 53');
  }

  if (!data.year || typeof data.year !== 'number') {
    errors.push('year is required and must be a number');
  } else if (data.year < 2020 || data.year > 2050) {
    errors.push('year must be between 2020 and 2050');
  }

  if (typeof data.total_feedback_count !== 'number' || data.total_feedback_count < 0) {
    errors.push('total_feedback_count must be a non-negative number');
  }

  // Optional field validation
  if (data.positive_summary && typeof data.positive_summary !== 'string') {
    errors.push('positive_summary must be a string');
  }

  if (data.negative_summary && typeof data.negative_summary !== 'string') {
    errors.push('negative_summary must be a string');
  }

  if (data.general_opinions && typeof data.general_opinions !== 'string') {
    errors.push('general_opinions must be a string');
  }

  if (data.new_critiques && !Array.isArray(data.new_critiques)) {
    errors.push('new_critiques must be an array');
  } else if (data.new_critiques) {
    data.new_critiques.forEach((critique, index) => {
      if (typeof critique !== 'string') {
        errors.push(`new_critiques[${index}] must be a string`);
      }
    });
  }

  if (data.actionable_insights && !Array.isArray(data.actionable_insights)) {
    errors.push('actionable_insights must be an array');
  } else if (data.actionable_insights) {
    data.actionable_insights.forEach((insight, index) => {
      if (!insight.title || typeof insight.title !== 'string') {
        errors.push(`actionable_insights[${index}].title is required and must be a string`);
      }
      if (!insight.description || typeof insight.description !== 'string') {
        errors.push(`actionable_insights[${index}].description is required and must be a string`);
      }
      if (!insight.priority || !['low', 'medium', 'high', 'critical'].includes(insight.priority)) {
        errors.push(`actionable_insights[${index}].priority must be one of: low, medium, high, critical`);
      }
    });
  }

  // Sentiment breakdown validation
  if (data.sentiment_breakdown) {
    const { positive, negative, neutral, mixed } = data.sentiment_breakdown;
    if (typeof positive !== 'number' || positive < 0) {
      errors.push('sentiment_breakdown.positive must be a non-negative number');
    }
    if (typeof negative !== 'number' || negative < 0) {
      errors.push('sentiment_breakdown.negative must be a non-negative number');
    }
    if (typeof neutral !== 'number' || neutral < 0) {
      errors.push('sentiment_breakdown.neutral must be a non-negative number');
    }
    if (typeof mixed !== 'number' || mixed < 0) {
      errors.push('sentiment_breakdown.mixed must be a non-negative number');
    }
  }

  return errors;
}

/**
 * Database operations
 */
export class AnalysisReportService {
  /**
   * Create a new analysis report
   */
  static async create(data: CreateAnalysisReportData): Promise<AnalysisReport> {
    const errors = validateAnalysisReportData(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const { data: report, error } = await supabase
      .from('analysis_reports')
      .insert([{
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create analysis report: ${error.message}`);
    }

    return report as AnalysisReport;
  }

  /**
   * Get analysis report by ID
   */
  static async getById(id: string): Promise<AnalysisReport | null> {
    const { data: report, error } = await supabase
      .from('analysis_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No rows found
      }
      throw new Error(`Failed to get analysis report: ${error.message}`);
    }

    return report as AnalysisReport;
  }

  /**
   * Get current week analysis report for a store
   */
  static async getCurrentWeekReport(
    storeId: string,
    weekNumber?: number,
    year?: number
  ): Promise<AnalysisReport | null> {
    const currentDate = new Date();
    const targetWeek = weekNumber || this.getWeekNumber(currentDate);
    const targetYear = year || currentDate.getFullYear();

    const { data: report, error } = await supabase
      .from('analysis_reports')
      .select('*')
      .eq('store_id', storeId)
      .eq('week_number', targetWeek)
      .eq('year', targetYear)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No rows found
      }
      throw new Error(`Failed to get current week report: ${error.message}`);
    }

    return report as AnalysisReport;
  }

  /**
   * Get historical analysis reports for a store
   */
  static async getHistoricalReports(
    storeId: string,
    weeks: number = 4
  ): Promise<AnalysisReport[]> {
    const { data: reports, error } = await supabase
      .from('analysis_reports')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(weeks);

    if (error) {
      throw new Error(`Failed to get historical reports: ${error.message}`);
    }

    return reports as AnalysisReport[];
  }

  /**
   * Update an existing analysis report
   */
  static async update(id: string, data: UpdateAnalysisReportData): Promise<AnalysisReport> {
    const { data: report, error } = await supabase
      .from('analysis_reports')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update analysis report: ${error.message}`);
    }

    return report as AnalysisReport;
  }

  /**
   * Delete an analysis report
   */
  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('analysis_reports')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete analysis report: ${error.message}`);
    }
  }

  /**
   * List analysis reports with filters
   */
  static async list(filters: AnalysisReportFilters = {}): Promise<AnalysisReport[]> {
    let query = supabase
      .from('analysis_reports')
      .select('*');

    // Apply filters
    if (filters.business_id) {
      query = query.eq('business_id', filters.business_id);
    }

    if (filters.store_id) {
      query = query.eq('store_id', filters.store_id);
    }

    if (filters.week_number) {
      query = query.eq('week_number', filters.week_number);
    }

    if (filters.year) {
      query = query.eq('year', filters.year);
    }

    // Apply ordering and pagination
    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 25) - 1);
    }

    const { data: reports, error } = await query;

    if (error) {
      throw new Error(`Failed to list analysis reports: ${error.message}`);
    }

    return reports as AnalysisReport[];
  }

  /**
   * Check if a report exists for a specific week/year
   */
  static async reportExists(
    storeId: string,
    weekNumber: number,
    year: number
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('analysis_reports')
      .select('id')
      .eq('store_id', storeId)
      .eq('week_number', weekNumber)
      .eq('year', year)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check report existence: ${error.message}`);
    }

    return data !== null;
  }

  /**
   * Get reports for temporal comparison
   */
  static async getReportsForComparison(
    storeId: string,
    currentWeek: number,
    currentYear: number,
    weeksBack: number = 1
  ): Promise<{ current: AnalysisReport | null; previous: AnalysisReport | null }> {
    // Calculate previous week/year
    let previousWeek = currentWeek - weeksBack;
    let previousYear = currentYear;

    if (previousWeek <= 0) {
      previousYear -= 1;
      previousWeek = 52 + previousWeek; // Handle year boundary
    }

    const [currentReport, previousReport] = await Promise.all([
      this.getCurrentWeekReport(storeId, currentWeek, currentYear),
      this.getCurrentWeekReport(storeId, previousWeek, previousYear),
    ]);

    return {
      current: currentReport,
      previous: previousReport,
    };
  }

  /**
   * Utility: Get ISO week number for a date
   */
  private static getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Get aggregated statistics for a business
   */
  static async getBusinessStats(businessId: string, weeks: number = 4): Promise<{
    totalReports: number;
    averageFeedbackCount: number;
    sentimentTrend: 'improving' | 'declining' | 'stable';
    topDepartments: Array<{ department: string; count: number }>;
  }> {
    const { data: reports, error } = await supabase
      .from('analysis_reports')
      .select('total_feedback_count, sentiment_breakdown, department_breakdown')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(weeks);

    if (error) {
      throw new Error(`Failed to get business stats: ${error.message}`);
    }

    const totalReports = reports.length;
    const averageFeedbackCount = totalReports > 0 
      ? reports.reduce((sum, r) => sum + r.total_feedback_count, 0) / totalReports 
      : 0;

    // Calculate sentiment trend (simplified)
    let sentimentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (reports.length >= 2) {
      const latest = reports[0].sentiment_breakdown;
      const previous = reports[1].sentiment_breakdown;
      
      if (latest && previous) {
        const latestPositive = latest.positive / (latest.positive + latest.negative + latest.neutral + latest.mixed);
        const previousPositive = previous.positive / (previous.positive + previous.negative + previous.neutral + previous.mixed);
        
        if (latestPositive > previousPositive + 0.05) {
          sentimentTrend = 'improving';
        } else if (latestPositive < previousPositive - 0.05) {
          sentimentTrend = 'declining';
        }
      }
    }

    // Aggregate department counts
    const departmentCounts: Record<string, number> = {};
    reports.forEach(report => {
      if (report.department_breakdown) {
        Object.entries(report.department_breakdown).forEach(([dept, count]) => {
          departmentCounts[dept] = (departmentCounts[dept] || 0) + count;
        });
      }
    });

    const topDepartments = Object.entries(departmentCounts)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalReports,
      averageFeedbackCount,
      sentimentTrend,
      topDepartments,
    };
  }
}

export default AnalysisReportService;