import { Database } from '@vocilia/types';

export type WeeklyAnalysisReport = Database['public']['Tables']['weekly_analysis_reports']['Row'];
export type WeeklyAnalysisReportInsert = Database['public']['Tables']['weekly_analysis_reports']['Insert'];
export type WeeklyAnalysisReportUpdate = Database['public']['Tables']['weekly_analysis_reports']['Update'];

export interface CreateWeeklyAnalysisReportData {
  store_id: string;
  analysis_week: string; // Monday of analysis week (YYYY-MM-DD)
  total_feedback_count: number;
  average_quality_score?: number;
  positive_trends?: TrendItem[];
  negative_issues?: IssueItem[];
  new_issues?: IssueItem[];
  department_insights?: Record<string, DepartmentInsight>;
  historical_comparison?: HistoricalComparison;
  predictive_insights?: PredictiveInsight[];
  actionable_recommendations?: BusinessRecommendation[];
  report_metadata?: ReportMetadata;
}

export interface TrendItem {
  category: 'customer_service' | 'product_quality' | 'store_environment' | 'pricing' | 'accessibility';
  description: string;
  trend_strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
  supporting_feedback_count?: number;
  confidence_level?: number;
  trend_direction?: 'improving' | 'stable' | 'declining';
  departments_affected?: string[];
}

export interface IssueItem {
  category: 'customer_service' | 'product_quality' | 'store_environment' | 'pricing' | 'accessibility';
  description: string;
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  frequency?: number;
  impact_assessment?: 'low' | 'medium' | 'high' | 'very_high';
  departments_affected?: string[];
  first_mentioned?: string;
}

export interface DepartmentInsight {
  department_name: string;
  feedback_count?: number;
  average_satisfaction?: number;
  top_positive_aspects?: string[];
  top_concerns?: string[];
  improvement_trend?: 'improving' | 'stable' | 'declining';
  specific_recommendations?: BusinessRecommendation[];
}

export interface HistoricalComparison {
  previous_week?: WeekComparisonMetrics;
  four_week_average?: WeekComparisonMetrics;
  twelve_week_average?: WeekComparisonMetrics;
  year_over_year?: WeekComparisonMetrics;
}

export interface WeekComparisonMetrics {
  feedback_count_change?: number;
  quality_score_change?: number;
  satisfaction_trend?: 'improving' | 'stable' | 'declining';
  notable_changes?: string[];
}

export interface PredictiveInsight {
  insight_type: 'opportunity' | 'risk' | 'trend_continuation' | 'seasonal_prediction';
  description: string;
  confidence_level: number;
  time_horizon: 'next_week' | 'next_month' | 'next_quarter';
  potential_impact: 'low' | 'medium' | 'high' | 'very_high';
  supporting_data_points?: string[];
  recommended_actions?: string[];
}

export interface BusinessRecommendation {
  recommendation_id?: string;
  category: 'product' | 'service' | 'environment' | 'staff' | 'pricing' | 'accessibility';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  implementation_complexity?: 'simple' | 'moderate' | 'complex';
  estimated_impact?: 'minor' | 'moderate' | 'significant' | 'major';
  departments_involved?: string[];
  estimated_cost_range?: 'minimal' | 'low' | 'medium' | 'high' | 'very_high';
  timeline_estimate?: 'immediate' | 'days' | 'weeks' | 'months';
  supporting_feedback_count?: number;
  related_issues?: string[];
  success_metrics?: string[];
}

export interface ReportMetadata {
  analysis_model_version?: string;
  generation_time_ms?: number;
  data_quality_score?: number;
  processing_parameters?: Record<string, any>;
}

export const ANALYSIS_CATEGORIES = [
  'customer_service',
  'product_quality', 
  'store_environment',
  'pricing',
  'accessibility'
] as const;

export const TREND_STRENGTHS = ['weak', 'moderate', 'strong', 'very_strong'] as const;
export const SEVERITY_LEVELS = ['minor', 'moderate', 'serious', 'critical'] as const;
export const PRIORITY_LEVELS = ['low', 'medium', 'high', 'urgent'] as const;