import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types';
import { OpenAIService, WeeklyAnalysisResult } from '../ai/openaiService';
import { 
  WeeklyAnalysisReport, 
  CreateWeeklyAnalysisReportData,
  TrendItem,
  IssueItem,
  BusinessRecommendation,
  PredictiveInsight 
} from '../../models/weeklyAnalysisReport';
import { BusinessContextProfile } from '../../models/businessContextProfile';

export class BusinessIntelligenceService {
  private supabase;
  private openaiService: OpenAIService;
  private redis: any;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.openaiService = new OpenAIService();
    this.initializeRedis();
  }

  async generateWeeklyReport(request: WeeklyReportGenerationRequest): Promise<WeeklyReportJobResult> {
    // Validate store and week
    await this.validateStoreExists(request.store_id);
    
    // Check if report already exists
    const existingReport = await this.getExistingWeeklyReport(request.store_id, request.analysis_week);
    if (existingReport) {
      throw new BusinessIntelligenceError('REPORT_ALREADY_EXISTS', 'Report already exists for this week');
    }

    // Create analysis job
    const jobId = this.generateJobId();
    
    // Store job status
    await this.setJobStatus(jobId, {
      status: 'queued',
      store_id: request.store_id,
      analysis_week: request.analysis_week,
      progress_percentage: 0,
      created_at: new Date().toISOString()
    });

    // Process analysis asynchronously
    this.performWeeklyAnalysisAsync(jobId, request);

    return {
      analysis_job_id: jobId,
      estimated_completion: new Date(Date.now() + 120000), // ~2 minutes
      status: 'queued'
    };
  }

  async getWeeklyReports(
    storeId: string,
    weeksBack: number = 12,
    includeSummaryOnly: boolean = false
  ): Promise<WeeklyReportsResult> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (weeksBack * 7 * 24 * 60 * 60 * 1000));

    let query = this.supabase
      .from('weekly_analysis_reports')
      .select(includeSummaryOnly ? 'id, store_id, analysis_week, total_feedback_count, average_quality_score, generated_at' : '*')
      .eq('store_id', storeId)
      .gte('analysis_week', startDate.toISOString().split('T')[0])
      .order('analysis_week', { ascending: false });

    const { data: reports, error } = await query;

    if (error) {
      throw new BusinessIntelligenceError('REPORTS_FETCH_FAILED', 'Failed to retrieve weekly reports', error);
    }

    return {
      reports: reports as WeeklyAnalysisReport[],
      pagination: {
        total_items: reports?.length || 0,
        items_per_page: reports?.length || 0,
        current_page: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false
      }
    };
  }

  async getSpecificWeeklyReport(storeId: string, analysisWeek: string): Promise<WeeklyAnalysisReport> {
    const { data: report, error } = await this.supabase
      .from('weekly_analysis_reports')
      .select('*')
      .eq('store_id', storeId)
      .eq('analysis_week', analysisWeek)
      .single();

    if (error || !report) {
      throw new BusinessIntelligenceError('REPORT_NOT_FOUND', 'Report not found for specified week');
    }

    return report as WeeklyAnalysisReport;
  }

  async searchFeedbackInsights(request: FeedbackSearchRequest): Promise<FeedbackSearchResult> {
    // Parse natural language query using embeddings
    const searchQuery = await this.buildSearchQuery(request.query, request.search_scope);
    
    // Search across different content types
    const results: SearchResultItem[] = [];

    // Search feedback summaries
    if (request.search_scope.includes('feedback_summaries')) {
      const feedbackResults = await this.searchFeedbackSummaries(
        request.store_id,
        searchQuery,
        request.time_range
      );
      results.push(...feedbackResults);
    }

    // Search weekly reports
    if (request.search_scope.includes('weekly_reports')) {
      const reportResults = await this.searchWeeklyReports(
        request.store_id,
        searchQuery,
        request.time_range
      );
      results.push(...reportResults);
    }

    // Search actionable items
    if (request.search_scope.includes('actionable_items')) {
      const actionableResults = await this.searchActionableItems(
        request.store_id,
        searchQuery,
        request.time_range
      );
      results.push(...actionableResults);
    }

    // Sort by relevance and limit results
    const sortedResults = results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, request.max_results || 20);

    return {
      results: sortedResults,
      total_matches: results.length,
      search_metadata: {
        query_interpretation: await this.interpretQuery(request.query),
        search_time_ms: 0, // Will be calculated
        relevance_threshold: 0.5
      }
    };
  }

  async getTrendAnalysis(
    storeId: string,
    trendPeriod: string = '8_weeks',
    trendTypes: string[] = ['positive_trends', 'negative_trends', 'emerging_issues'],
    includePredictions: boolean = true
  ): Promise<TrendAnalysisResult> {
    const periodWeeks = this.parseTrendPeriod(trendPeriod);
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (periodWeeks * 7 * 24 * 60 * 60 * 1000));

    // Get weekly reports for trend analysis
    const { data: reports, error } = await this.supabase
      .from('weekly_analysis_reports')
      .select('*')
      .eq('store_id', storeId)
      .gte('analysis_week', startDate.toISOString().split('T')[0])
      .order('analysis_week', { ascending: true });

    if (error) {
      throw new BusinessIntelligenceError('TREND_DATA_FETCH_FAILED', 'Failed to retrieve trend data', error);
    }

    const trends = await this.analyzeTrends(reports || [], trendTypes);
    
    let predictiveInsights: PredictiveInsight[] = [];
    if (includePredictions) {
      predictiveInsights = await this.generatePredictiveInsights(reports || []);
    }

    return {
      trend_analysis: trends,
      predictive_insights: predictiveInsights,
      analysis_period: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        weeks_analyzed: periodWeeks
      }
    };
  }

  async getActionableRecommendations(request: RecommendationsRequest): Promise<RecommendationsResult> {
    // Get recent feedback and analysis data
    const recentReports = await this.getRecentReports(request.store_id, 4); // Last 4 weeks
    const businessContext = await this.getBusinessContext(request.store_id);

    // Extract recommendations from reports
    let allRecommendations: BusinessRecommendation[] = [];
    
    recentReports.forEach(report => {
      if (report.actionable_recommendations) {
        allRecommendations.push(...(report.actionable_recommendations as BusinessRecommendation[]));
      }
    });

    // Filter recommendations based on request parameters
    let filteredRecommendations = allRecommendations;

    if (request.priority_filter && request.priority_filter.length > 0) {
      filteredRecommendations = filteredRecommendations.filter(rec => 
        request.priority_filter!.includes(rec.priority)
      );
    }

    if (request.category_filter && request.category_filter.length > 0) {
      filteredRecommendations = filteredRecommendations.filter(rec => 
        request.category_filter!.includes(rec.category)
      );
    }

    if (request.implementation_complexity && request.implementation_complexity.length > 0) {
      filteredRecommendations = filteredRecommendations.filter(rec => 
        rec.implementation_complexity && 
        request.implementation_complexity!.includes(rec.implementation_complexity)
      );
    }

    // Sort by priority and impact
    const priorityWeight = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
    const impactWeight = { 'major': 4, 'significant': 3, 'moderate': 2, 'minor': 1 };

    filteredRecommendations.sort((a, b) => {
      const aPriority = priorityWeight[a.priority] || 1;
      const bPriority = priorityWeight[b.priority] || 1;
      const aImpact = impactWeight[a.estimated_impact || 'minor'] || 1;
      const bImpact = impactWeight[b.estimated_impact || 'minor'] || 1;
      
      const aScore = aPriority * 2 + aImpact; // Priority weighted higher
      const bScore = bPriority * 2 + bImpact;
      
      return bScore - aScore;
    });

    // Limit results
    const limitedRecommendations = filteredRecommendations.slice(0, request.max_recommendations || 20);

    return {
      recommendations: limitedRecommendations,
      summary_stats: this.calculateRecommendationStats(filteredRecommendations),
    };
  }

  private async performWeeklyAnalysisAsync(
    jobId: string,
    request: WeeklyReportGenerationRequest
  ): Promise<void> {
    try {
      // Update status: processing
      await this.setJobStatus(jobId, {
        status: 'processing',
        progress_percentage: 10
      });

      // Get feedback data for the week
      const feedbackData = await this.getFeedbackDataForWeek(request.store_id, request.analysis_week);
      const businessContext = await this.getBusinessContext(request.store_id);
      
      // Get historical data for comparisons if requested
      let historicalData = [];
      if (request.include_comparisons) {
        historicalData = await this.getHistoricalData(request.store_id, request.analysis_week);
      }

      // Update status: analyzing
      await this.setJobStatus(jobId, {
        status: 'processing',
        progress_percentage: 40
      });

      // Perform AI analysis
      const analysisResult = await this.openaiService.generateWeeklyAnalysis(
        feedbackData.summaries,
        businessContext,
        historicalData
      );

      // Update status: generating report
      await this.setJobStatus(jobId, {
        status: 'processing',
        progress_percentage: 70
      });

      // Create comprehensive report data
      const reportData: CreateWeeklyAnalysisReportData = {
        store_id: request.store_id,
        analysis_week: request.analysis_week,
        total_feedback_count: feedbackData.total_count,
        average_quality_score: feedbackData.average_quality,
        positive_trends: analysisResult.positive_trends,
        negative_issues: analysisResult.negative_issues,
        department_insights: analysisResult.department_insights,
        actionable_recommendations: analysisResult.actionable_recommendations,
        predictive_insights: analysisResult.predictive_insights,
        report_metadata: {
          analysis_model_version: 'gpt-4o-mini-weekly-1.0',
          generation_time_ms: Date.now() - Date.now(), // Will be calculated properly
          data_quality_score: feedbackData.data_quality_score || 0.8,
          processing_parameters: {
            include_comparisons: request.include_comparisons,
            analysis_depth: request.analysis_depth,
            custom_focus_areas: request.custom_focus_areas
          }
        }
      };

      // Store report in database
      const { error } = await this.supabase
        .from('weekly_analysis_reports')
        .insert(reportData);

      if (error) {
        throw new Error(`Failed to store weekly report: ${error.message}`);
      }

      // Update status: completed
      await this.setJobStatus(jobId, {
        status: 'completed',
        progress_percentage: 100
      });

    } catch (error: any) {
      await this.setJobStatus(jobId, {
        status: 'failed',
        progress_percentage: 0,
        error_message: error.message
      });
    }
  }

  private async initializeRedis(): Promise<void> {
    const Redis = require('ioredis');
    this.redis = new Redis(process.env.REDIS_URL);
  }

  private async validateStoreExists(storeId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .single();

    if (error || !data) {
      throw new BusinessIntelligenceError('STORE_NOT_FOUND', 'Store not found');
    }
  }

  private async getExistingWeeklyReport(storeId: string, analysisWeek: string): Promise<WeeklyAnalysisReport | null> {
    const { data, error } = await this.supabase
      .from('weekly_analysis_reports')
      .select('*')
      .eq('store_id', storeId)
      .eq('analysis_week', analysisWeek)
      .maybeSingle();

    return error ? null : data as WeeklyAnalysisReport;
  }

  private async getBusinessContext(storeId: string): Promise<BusinessContextProfile> {
    const { data, error } = await this.supabase
      .from('business_context_profiles')
      .select('*')
      .eq('store_id', storeId)
      .order('context_version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new BusinessIntelligenceError('BUSINESS_CONTEXT_NOT_FOUND', 'Business context not found');
    }

    return data as BusinessContextProfile;
  }

  private async getFeedbackDataForWeek(storeId: string, analysisWeek: string): Promise<WeeklyFeedbackData> {
    // Calculate week boundaries
    const weekStart = new Date(analysisWeek);
    const weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000));

    // Get quality assessments for the week
    const { data: assessments, error } = await this.supabase
      .from('quality_assessments')
      .select(`
        *,
        feedback_call_sessions!inner(store_id, created_at)
      `)
      .eq('feedback_call_sessions.store_id', storeId)
      .gte('feedback_call_sessions.created_at', weekStart.toISOString())
      .lt('feedback_call_sessions.created_at', weekEnd.toISOString());

    if (error) {
      throw new BusinessIntelligenceError('FEEDBACK_DATA_FETCH_FAILED', 'Failed to retrieve feedback data', error);
    }

    const summaries = (assessments || [])
      .filter(a => a.analysis_summary)
      .map(a => a.analysis_summary as string);

    const totalCount = assessments?.length || 0;
    const averageQuality = totalCount > 0
      ? assessments!.reduce((sum, a) => sum + (a.overall_quality_score || 0), 0) / totalCount
      : 0;

    return {
      summaries,
      total_count: totalCount,
      average_quality: averageQuality,
      data_quality_score: totalCount >= 5 ? 0.9 : 0.6 // Higher score for more data points
    };
  }

  private async getHistoricalData(storeId: string, currentWeek: string): Promise<any[]> {
    // Get previous 12 weeks for historical comparison
    const currentWeekDate = new Date(currentWeek);
    const historicalStart = new Date(currentWeekDate.getTime() - (12 * 7 * 24 * 60 * 60 * 1000));

    const { data: historicalReports, error } = await this.supabase
      .from('weekly_analysis_reports')
      .select('*')
      .eq('store_id', storeId)
      .gte('analysis_week', historicalStart.toISOString().split('T')[0])
      .lt('analysis_week', currentWeek)
      .order('analysis_week', { ascending: true });

    return historicalReports || [];
  }

  private generateJobId(): string {
    return `weekly_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async setJobStatus(jobId: string, status: any): Promise<void> {
    await this.redis.setex(`weekly_job:${jobId}`, 7200, JSON.stringify(status));
  }

  private async buildSearchQuery(query: string, scope: string[]): Promise<string> {
    // Simple implementation - in production, would use embeddings and vector search
    return query.toLowerCase();
  }

  private async searchFeedbackSummaries(storeId: string, query: string, timeRange?: any): Promise<SearchResultItem[]> {
    // Implementation for searching feedback summaries
    return [];
  }

  private async searchWeeklyReports(storeId: string, query: string, timeRange?: any): Promise<SearchResultItem[]> {
    // Implementation for searching weekly reports
    return [];
  }

  private async searchActionableItems(storeId: string, query: string, timeRange?: any): Promise<SearchResultItem[]> {
    // Implementation for searching actionable items
    return [];
  }

  private async interpretQuery(query: string): Promise<string> {
    return `Searching for feedback and insights related to: "${query}"`;
  }

  private parseTrendPeriod(period: string): number {
    const mapping: Record<string, number> = {
      '4_weeks': 4,
      '8_weeks': 8,
      '12_weeks': 12,
      '26_weeks': 26
    };
    return mapping[period] || 8;
  }

  private async analyzeTrends(reports: any[], trendTypes: string[]): Promise<any> {
    // Analyze trends across weekly reports
    return {
      positive_trends: [],
      negative_trends: [],
      emerging_issues: [],
      improvement_opportunities: []
    };
  }

  private async generatePredictiveInsights(reports: any[]): Promise<PredictiveInsight[]> {
    // Generate predictive insights based on trend analysis
    return [];
  }

  private async getRecentReports(storeId: string, weeks: number): Promise<WeeklyAnalysisReport[]> {
    const { data: reports, error } = await this.supabase
      .from('weekly_analysis_reports')
      .select('*')
      .eq('store_id', storeId)
      .order('analysis_week', { ascending: false })
      .limit(weeks);

    return reports as WeeklyAnalysisReport[] || [];
  }

  private calculateRecommendationStats(recommendations: BusinessRecommendation[]): any {
    const byPriority = recommendations.reduce((acc, rec) => {
      acc[rec.priority] = (acc[rec.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byCategory = recommendations.reduce((acc, rec) => {
      acc[rec.category] = (acc[rec.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_recommendations: recommendations.length,
      by_priority: byPriority,
      by_category: byCategory,
      estimated_impact_score: 7.5 // Placeholder calculation
    };
  }
}

// Type definitions
export interface WeeklyReportGenerationRequest {
  store_id: string;
  analysis_week: string;
  include_comparisons?: boolean;
  analysis_depth?: 'standard' | 'detailed' | 'comprehensive';
  custom_focus_areas?: string[];
}

export interface WeeklyReportJobResult {
  analysis_job_id: string;
  estimated_completion: Date;
  status: 'queued' | 'processing';
}

export interface WeeklyReportsResult {
  reports: WeeklyAnalysisReport[];
  pagination: PaginationInfo;
}

export interface PaginationInfo {
  total_items: number;
  items_per_page: number;
  current_page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface FeedbackSearchRequest {
  store_id: string;
  query: string;
  time_range?: {
    start_date: string;
    end_date: string;
  };
  search_scope: string[];
  max_results?: number;
}

export interface FeedbackSearchResult {
  results: SearchResultItem[];
  total_matches: number;
  search_metadata: {
    query_interpretation: string;
    search_time_ms: number;
    relevance_threshold: number;
  };
}

export interface SearchResultItem {
  result_type: string;
  result_id: string;
  title: string;
  content_excerpt: string;
  relevance_score: number;
  source_date: string;
  source_week?: string;
  department?: string;
  category?: string;
}

export interface TrendAnalysisResult {
  trend_analysis: any;
  predictive_insights: PredictiveInsight[];
  analysis_period: {
    start_date: string;
    end_date: string;
    weeks_analyzed: number;
  };
}

export interface RecommendationsRequest {
  store_id: string;
  priority_filter?: string[];
  category_filter?: string[];
  implementation_complexity?: string[];
  max_recommendations?: number;
}

export interface RecommendationsResult {
  recommendations: BusinessRecommendation[];
  summary_stats: {
    total_recommendations: number;
    by_priority: Record<string, number>;
    by_category: Record<string, number>;
    estimated_impact_score: number;
  };
}

interface WeeklyFeedbackData {
  summaries: string[];
  total_count: number;
  average_quality: number;
  data_quality_score: number;
}

export class BusinessIntelligenceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'BusinessIntelligenceError';
  }
}