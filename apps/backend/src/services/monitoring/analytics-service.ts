import { FraudDetectionReportModel, FraudDetectionReportData } from '@vocilia/database/monitoring/fraud-detection-reports';
import { RevenueAnalyticsModel, RevenueAnalyticsData } from '@vocilia/database/monitoring/revenue-analytics';
import { BusinessPerformanceMetricsModel, BusinessPerformanceMetricsData } from '@vocilia/database/monitoring/business-performance-metrics';
import { ValidationError, InternalServerError, NotFoundError } from '../../middleware/errorHandler';
import { loggingService } from '../loggingService';

export interface FraudReportFilters {
  store_id?: string;
  start_date?: string;
  end_date?: string;
  min_failure_rate?: number;
  max_failure_rate?: number;
}

export interface RevenueAnalyticsFilters {
  store_id?: string;
  business_type?: string;
  start_date?: string;
  end_date?: string;
  group_by?: 'day' | 'week' | 'month';
  min_revenue?: number;
}

export interface BusinessPerformanceFilters {
  store_id?: string;
  business_id?: string;
  region?: string;
  comparison_period?: 'week' | 'month' | 'quarter';
  min_satisfaction_score?: number;
}

export interface RevenueSummary {
  total_revenue: number;
  period_growth: number;
  top_performing_stores: Array<{
    store_id: string;
    store_name: string;
    revenue: number;
  }>;
}

export interface FraudAnalysisSummary {
  total_reports: number;
  average_failure_rate: number;
  high_risk_stores: number;
  suspicious_patterns_detected: number;
  accuracy_improvement: number;
}

export interface BusinessPerformanceSummary {
  total_stores: number;
  average_satisfaction_score: number;
  top_performing_regions: string[];
  stores_with_declining_performance: number;
}

export class AnalyticsService {
  /**
   * Get fraud detection reports with filtering
   */
  async getFraudDetectionReports(
    filters?: FraudReportFilters,
    page = 1,
    limit = 50
  ): Promise<{
    reports: any[];
    summary: FraudAnalysisSummary;
    total: number;
  }> {
    try {
      // Validate pagination parameters
      this.validatePaginationParams(page, limit);

      // Validate date range if provided
      if (filters?.start_date && filters?.end_date) {
        this.validateDateRange(filters.start_date, filters.end_date);
      }

      // Convert filters to database format
      const dbFilters = {
        storeId: filters?.store_id,
        startDate: filters?.start_date,
        endDate: filters?.end_date,
        minFailureRate: filters?.min_failure_rate,
        maxFailureRate: filters?.max_failure_rate,
      };

      // Get fraud reports from database
      const { reports, total } = await FraudDetectionReportModel.getFraudReports(dbFilters, page, limit);

      // Calculate summary statistics
      const summary = await this.calculateFraudAnalysisSummary(reports, filters);

      return {
        reports: this.formatFraudReportsForResponse(reports),
        summary,
        total,
      };
    } catch (error) {
      loggingService.error('Error fetching fraud detection reports', error as Error, { filters, page, limit });
      throw error;
    }
  }

  /**
   * Create or update fraud detection report
   */
  async recordFraudDetectionReport(reportData: FraudDetectionReportData): Promise<any> {
    try {
      // Validate report data
      this.validateFraudReportData(reportData);

      // Check if report already exists for this date and store
      const existingReport = await FraudDetectionReportModel.getByDateAndStore(
        reportData.reportDate,
        reportData.storeId
      );

      let report;
      if (existingReport) {
        // Update existing report
        report = await FraudDetectionReportModel.update(existingReport.id, reportData);
      } else {
        // Create new report
        report = await FraudDetectionReportModel.create(reportData);
      }

      if (!report) {
        throw new InternalServerError('Failed to record fraud detection report');
      }

      // Log the operation
      loggingService.info('Fraud detection report recorded', {
        reportId: report.id,
        storeId: reportData.storeId,
        reportDate: reportData.reportDate,
        failureRate: reportData.verificationFailureRate,
        operation: existingReport ? 'updated' : 'created',
      });

      return this.formatFraudReportForResponse(report);
    } catch (error) {
      loggingService.error('Error recording fraud detection report', error as Error, { reportData });
      throw error;
    }
  }

  /**
   * Get revenue analytics with filtering and grouping
   */
  async getRevenueAnalytics(
    filters?: RevenueAnalyticsFilters,
    page = 1,
    limit = 50
  ): Promise<{
    analytics: any[];
    summary: RevenueSummary;
    total: number;
  }> {
    try {
      // Validate pagination parameters
      this.validatePaginationParams(page, limit);

      // Validate date range if provided
      if (filters?.start_date && filters?.end_date) {
        this.validateDateRange(filters.start_date, filters.end_date);
      }

      // Convert filters to database format
      const dbFilters = {
        storeId: filters?.store_id,
        businessType: filters?.business_type,
        startDate: filters?.start_date,
        endDate: filters?.end_date,
        groupBy: filters?.group_by || 'day',
        minRevenue: filters?.min_revenue,
      };

      // Get revenue analytics from database
      const { analytics, total } = await RevenueAnalyticsModel.getRevenueAnalytics(dbFilters, page, limit);

      // Calculate summary statistics
      const summary = await this.calculateRevenueSummary(analytics, filters);

      return {
        analytics: this.formatRevenueAnalyticsForResponse(analytics),
        summary,
        total,
      };
    } catch (error) {
      loggingService.error('Error fetching revenue analytics', error as Error, { filters, page, limit });
      throw error;
    }
  }

  /**
   * Record revenue analytics data
   */
  async recordRevenueAnalytics(analyticsData: RevenueAnalyticsData): Promise<any> {
    try {
      // Validate analytics data
      this.validateRevenueAnalyticsData(analyticsData);

      // Check if analytics already exists for this date and store
      const existingAnalytics = await RevenueAnalyticsModel.getByDateAndStore(
        analyticsData.reportDate,
        analyticsData.storeId
      );

      let analytics;
      if (existingAnalytics) {
        // Update existing analytics
        analytics = await RevenueAnalyticsModel.update(existingAnalytics.id, analyticsData);
      } else {
        // Create new analytics
        analytics = await RevenueAnalyticsModel.create(analyticsData);
      }

      if (!analytics) {
        throw new InternalServerError('Failed to record revenue analytics');
      }

      // Log the operation
      loggingService.info('Revenue analytics recorded', {
        analyticsId: analytics.id,
        storeId: analyticsData.storeId,
        reportDate: analyticsData.reportDate,
        totalRewards: analyticsData.totalRewardsPaid,
        netRevenue: analyticsData.netRevenue,
        operation: existingAnalytics ? 'updated' : 'created',
      });

      return this.formatRevenueAnalyticsForResponse([analytics])[0];
    } catch (error) {
      loggingService.error('Error recording revenue analytics', error as Error, { analyticsData });
      throw error;
    }
  }

  /**
   * Get business performance metrics with filtering
   */
  async getBusinessPerformanceMetrics(
    filters?: BusinessPerformanceFilters,
    page = 1,
    limit = 50
  ): Promise<{
    metrics: any[];
    summary: BusinessPerformanceSummary;
    total: number;
  }> {
    try {
      // Validate pagination parameters
      this.validatePaginationParams(page, limit);

      // Convert filters to database format
      const dbFilters = {
        storeId: filters?.store_id,
        businessId: filters?.business_id,
        region: filters?.region,
        comparisonPeriod: filters?.comparison_period || 'month',
        minSatisfactionScore: filters?.min_satisfaction_score,
      };

      // Get performance metrics from database
      const { metrics, total } = await BusinessPerformanceMetricsModel.getPerformanceMetrics(dbFilters, page, limit);

      // Calculate summary statistics
      const summary = await this.calculateBusinessPerformanceSummary(metrics, filters);

      return {
        metrics: this.formatBusinessPerformanceMetricsForResponse(metrics),
        summary,
        total,
      };
    } catch (error) {
      loggingService.error('Error fetching business performance metrics', error as Error, { filters, page, limit });
      throw error;
    }
  }

  /**
   * Record business performance metrics
   */
  async recordBusinessPerformanceMetrics(metricsData: BusinessPerformanceMetricsData): Promise<any> {
    try {
      // Validate metrics data
      this.validateBusinessPerformanceData(metricsData);

      // Check if metrics already exists for this date and store
      const existingMetrics = await BusinessPerformanceMetricsModel.getByDateAndStore(
        metricsData.reportDate,
        metricsData.storeId
      );

      let metrics;
      if (existingMetrics) {
        // Update existing metrics
        metrics = await BusinessPerformanceMetricsModel.update(existingMetrics.id, metricsData);
      } else {
        // Create new metrics
        metrics = await BusinessPerformanceMetricsModel.create(metricsData);
      }

      if (!metrics) {
        throw new InternalServerError('Failed to record business performance metrics');
      }

      // Log the operation
      loggingService.info('Business performance metrics recorded', {
        metricsId: metrics.id,
        storeId: metricsData.storeId,
        businessId: metricsData.businessId,
        reportDate: metricsData.reportDate,
        satisfactionScore: metricsData.customerSatisfactionScore,
        operation: existingMetrics ? 'updated' : 'created',
      });

      return this.formatBusinessPerformanceMetricsForResponse([metrics])[0];
    } catch (error) {
      loggingService.error('Error recording business performance metrics', error as Error, { metricsData });
      throw error;
    }
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  async getAnalyticsDashboard(
    storeId?: string,
    businessId?: string,
    dateRange?: { start_date: string; end_date: string }
  ): Promise<{
    fraud_summary: FraudAnalysisSummary;
    revenue_summary: RevenueSummary;
    performance_summary: BusinessPerformanceSummary;
    recent_alerts: any[];
    trending_metrics: any[];
  }> {
    try {
      // Prepare common filters
      const fraudFilters: FraudReportFilters = {
        store_id: storeId,
        start_date: dateRange?.start_date,
        end_date: dateRange?.end_date,
      };

      const revenueFilters: RevenueAnalyticsFilters = {
        store_id: storeId,
        start_date: dateRange?.start_date,
        end_date: dateRange?.end_date,
      };

      const performanceFilters: BusinessPerformanceFilters = {
        store_id: storeId,
        business_id: businessId,
      };

      // Get data concurrently
      const [fraudResult, revenueResult, performanceResult] = await Promise.all([
        this.getFraudDetectionReports(fraudFilters, 1, 10),
        this.getRevenueAnalytics(revenueFilters, 1, 10),
        this.getBusinessPerformanceMetrics(performanceFilters, 1, 10),
      ]);

      // Get recent high-priority items
      const recentAlerts = await this.getRecentHighPriorityAlerts(storeId);
      const trendingMetrics = await this.getTrendingMetrics(storeId, dateRange);

      return {
        fraud_summary: fraudResult.summary,
        revenue_summary: revenueResult.summary,
        performance_summary: performanceResult.summary,
        recent_alerts: recentAlerts,
        trending_metrics: trendingMetrics,
      };
    } catch (error) {
      loggingService.error('Error fetching analytics dashboard data', error as Error, {
        storeId,
        businessId,
        dateRange,
      });
      throw error;
    }
  }

  /**
   * Generate analytics insights and recommendations
   */
  async generateAnalyticsInsights(
    storeId: string,
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<{
    insights: Array<{
      type: 'fraud' | 'revenue' | 'performance';
      severity: 'info' | 'warning' | 'critical';
      title: string;
      description: string;
      recommendation: string;
      data: Record<string, any>;
    }>;
    score: number; // Overall health score 0-100
  }> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required');
      }

      const insights: any[] = [];
      let totalScore = 100;

      // Analyze fraud patterns
      const fraudInsights = await this.analyzeFraudPatterns(storeId, period);
      insights.push(...fraudInsights.insights);
      totalScore -= fraudInsights.scorePenalty;

      // Analyze revenue trends
      const revenueInsights = await this.analyzeRevenueTrends(storeId, period);
      insights.push(...revenueInsights.insights);
      totalScore -= revenueInsights.scorePenalty;

      // Analyze performance metrics
      const performanceInsights = await this.analyzePerformanceMetrics(storeId, period);
      insights.push(...performanceInsights.insights);
      totalScore -= performanceInsights.scorePenalty;

      // Ensure score doesn't go below 0
      const finalScore = Math.max(0, totalScore);

      return {
        insights,
        score: finalScore,
      };
    } catch (error) {
      loggingService.error('Error generating analytics insights', error as Error, { storeId, period });
      throw error;
    }
  }

  /**
   * Get comparative analytics between stores or time periods
   */
  async getComparativeAnalytics(
    comparison: {
      type: 'stores' | 'time_periods';
      store_ids?: string[];
      time_periods?: Array<{ start_date: string; end_date: string; label: string }>;
    }
  ): Promise<{
    comparison_data: any[];
    insights: string[];
  }> {
    try {
      if (!comparison.type) {
        throw new ValidationError('Comparison type is required');
      }

      let comparisonData: any[] = [];
      let insights: string[] = [];

      if (comparison.type === 'stores' && comparison.store_ids) {
        // Compare multiple stores
        comparisonData = await this.compareStores(comparison.store_ids);
        insights = this.generateStoreComparisonInsights(comparisonData);
      } else if (comparison.type === 'time_periods' && comparison.time_periods) {
        // Compare time periods
        comparisonData = await this.compareTimePeriods(comparison.time_periods);
        insights = this.generateTimePeriodInsights(comparisonData);
      } else {
        throw new ValidationError('Invalid comparison configuration');
      }

      return {
        comparison_data: comparisonData,
        insights,
      };
    } catch (error) {
      loggingService.error('Error generating comparative analytics', error as Error, { comparison });
      throw error;
    }
  }

  // Private validation methods
  private validateFraudReportData(data: FraudDetectionReportData): void {
    if (!data.reportDate) {
      throw new ValidationError('Report date is required');
    }

    if (!data.storeId) {
      throw new ValidationError('Store ID is required');
    }

    if (typeof data.verificationFailureRate !== 'number' || data.verificationFailureRate < 0 || data.verificationFailureRate > 100) {
      throw new ValidationError('Verification failure rate must be between 0 and 100');
    }

    if (typeof data.blockedTransactions !== 'number' || data.blockedTransactions < 0) {
      throw new ValidationError('Blocked transactions must be non-negative');
    }
  }

  private validateRevenueAnalyticsData(data: RevenueAnalyticsData): void {
    if (!data.reportDate) {
      throw new ValidationError('Report date is required');
    }

    if (!data.storeId) {
      throw new ValidationError('Store ID is required');
    }

    if (typeof data.totalRewardsPaid !== 'number' || data.totalRewardsPaid < 0) {
      throw new ValidationError('Total rewards paid must be non-negative');
    }

    if (typeof data.adminFeesCollected !== 'number' || data.adminFeesCollected < 0) {
      throw new ValidationError('Admin fees collected must be non-negative');
    }

    if (typeof data.netRevenue !== 'number') {
      throw new ValidationError('Net revenue must be a number');
    }

    if (typeof data.feedbackVolume !== 'number' || data.feedbackVolume < 0) {
      throw new ValidationError('Feedback volume must be non-negative');
    }
  }

  private validateBusinessPerformanceData(data: BusinessPerformanceMetricsData): void {
    if (!data.reportDate) {
      throw new ValidationError('Report date is required');
    }

    if (!data.storeId) {
      throw new ValidationError('Store ID is required');
    }

    if (!data.businessId) {
      throw new ValidationError('Business ID is required');
    }

    if (data.customerSatisfactionScore !== undefined) {
      if (typeof data.customerSatisfactionScore !== 'number' ||
          data.customerSatisfactionScore < 0 ||
          data.customerSatisfactionScore > 10) {
        throw new ValidationError('Customer satisfaction score must be between 0 and 10');
      }
    }

    if (data.verificationRate !== undefined) {
      if (typeof data.verificationRate !== 'number' ||
          data.verificationRate < 0 ||
          data.verificationRate > 100) {
        throw new ValidationError('Verification rate must be between 0 and 100');
      }
    }
  }

  private validatePaginationParams(page: number, limit: number): void {
    if (page < 1) {
      throw new ValidationError('Page must be greater than 0');
    }

    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }
  }

  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new ValidationError('Start date must be before end date');
    }

    // Limit query range to prevent excessive data retrieval
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new ValidationError('Date range cannot exceed 365 days');
    }
  }

  // Private calculation methods
  private async calculateFraudAnalysisSummary(
    reports: any[],
    filters?: FraudReportFilters
  ): Promise<FraudAnalysisSummary> {
    const totalReports = reports.length;
    const averageFailureRate = reports.length > 0
      ? reports.reduce((sum, r) => sum + r.verification_failure_rate, 0) / reports.length
      : 0;

    const highRiskStores = reports.filter(r => r.verification_failure_rate > 20).length;
    const suspiciousPatterns = reports.reduce((sum, r) =>
      sum + Object.keys(r.suspicious_patterns || {}).length, 0
    );

    // Calculate accuracy improvement (mock calculation)
    const accuracyImprovement = reports.length > 0
      ? reports.reduce((sum, r) => sum + (r.accuracy_metrics?.improvement || 0), 0) / reports.length
      : 0;

    return {
      total_reports: totalReports,
      average_failure_rate: averageFailureRate,
      high_risk_stores: highRiskStores,
      suspicious_patterns_detected: suspiciousPatterns,
      accuracy_improvement: accuracyImprovement,
    };
  }

  private async calculateRevenueSummary(
    analytics: any[],
    filters?: RevenueAnalyticsFilters
  ): Promise<RevenueSummary> {
    const totalRevenue = analytics.reduce((sum, a) => sum + a.net_revenue, 0);

    // Calculate period growth (simplified)
    let periodGrowth = 0;
    if (analytics.length >= 2) {
      const sortedAnalytics = analytics.sort((a, b) =>
        new Date(a.report_date).getTime() - new Date(b.report_date).getTime()
      );
      const firstPeriod = sortedAnalytics.slice(0, Math.floor(sortedAnalytics.length / 2));
      const secondPeriod = sortedAnalytics.slice(Math.floor(sortedAnalytics.length / 2));

      const firstPeriodRevenue = firstPeriod.reduce((sum, a) => sum + a.net_revenue, 0);
      const secondPeriodRevenue = secondPeriod.reduce((sum, a) => sum + a.net_revenue, 0);

      if (firstPeriodRevenue > 0) {
        periodGrowth = ((secondPeriodRevenue - firstPeriodRevenue) / firstPeriodRevenue) * 100;
      }
    }

    // Get top performing stores
    const storeRevenues = new Map<string, number>();
    analytics.forEach(a => {
      const current = storeRevenues.get(a.store_id) || 0;
      storeRevenues.set(a.store_id, current + a.net_revenue);
    });

    const topPerformingStores = Array.from(storeRevenues.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([storeId, revenue]) => ({
        store_id: storeId,
        store_name: `Store ${storeId.slice(-8)}`, // Simplified store name
        revenue,
      }));

    return {
      total_revenue: totalRevenue,
      period_growth: periodGrowth,
      top_performing_stores: topPerformingStores,
    };
  }

  private async calculateBusinessPerformanceSummary(
    metrics: any[],
    filters?: BusinessPerformanceFilters
  ): Promise<BusinessPerformanceSummary> {
    const totalStores = new Set(metrics.map(m => m.store_id)).size;
    const averageSatisfactionScore = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.customer_satisfaction_score || 0), 0) / metrics.length
      : 0;

    // Mock region analysis
    const regions = ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås'];
    const topPerformingRegions = regions.slice(0, 3);

    // Calculate stores with declining performance
    const decliningStores = metrics.filter(m =>
      m.feedback_volume_trend < -10 || m.customer_satisfaction_score < 6
    ).length;

    return {
      total_stores: totalStores,
      average_satisfaction_score: averageSatisfactionScore,
      top_performing_regions: topPerformingRegions,
      stores_with_declining_performance: decliningStores,
    };
  }

  // Private formatting methods
  private formatFraudReportForResponse(report: any): any {
    return {
      id: report.id,
      report_date: report.report_date,
      store_id: report.store_id,
      verification_failure_rate: report.verification_failure_rate,
      suspicious_patterns: report.suspicious_patterns,
      blocked_transactions: report.blocked_transactions,
      false_positive_rate: report.false_positive_rate,
      accuracy_metrics: report.accuracy_metrics,
      created_at: report.created_at,
      updated_at: report.updated_at,
    };
  }

  private formatFraudReportsForResponse(reports: any[]): any[] {
    return reports.map(report => this.formatFraudReportForResponse(report));
  }

  private formatRevenueAnalyticsForResponse(analytics: any[]): any[] {
    return analytics.map(item => ({
      id: item.id,
      report_date: item.report_date,
      store_id: item.store_id,
      total_rewards_paid: item.total_rewards_paid,
      admin_fees_collected: item.admin_fees_collected,
      net_revenue: item.net_revenue,
      feedback_volume: item.feedback_volume,
      customer_engagement_rate: item.customer_engagement_rate,
      reward_distribution: item.reward_distribution,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  private formatBusinessPerformanceMetricsForResponse(metrics: any[]): any[] {
    return metrics.map(item => ({
      id: item.id,
      report_date: item.report_date,
      store_id: item.store_id,
      business_id: item.business_id,
      feedback_volume_trend: item.feedback_volume_trend,
      verification_rate: item.verification_rate,
      customer_satisfaction_score: item.customer_satisfaction_score,
      operational_metrics: item.operational_metrics,
      created_at: item.created_at,
    }));
  }

  // Private utility methods
  private async getRecentHighPriorityAlerts(storeId?: string): Promise<any[]> {
    // TODO: Implement actual alert fetching logic
    // This would integrate with the AlertService to get recent critical alerts
    return [];
  }

  private async getTrendingMetrics(storeId?: string, dateRange?: any): Promise<any[]> {
    // TODO: Implement trending metrics calculation
    // This would analyze metric changes over time to identify trends
    return [];
  }

  private async analyzeFraudPatterns(storeId: string, period: string): Promise<{
    insights: any[];
    scorePenalty: number;
  }> {
    // TODO: Implement fraud pattern analysis
    return { insights: [], scorePenalty: 0 };
  }

  private async analyzeRevenueTrends(storeId: string, period: string): Promise<{
    insights: any[];
    scorePenalty: number;
  }> {
    // TODO: Implement revenue trend analysis
    return { insights: [], scorePenalty: 0 };
  }

  private async analyzePerformanceMetrics(storeId: string, period: string): Promise<{
    insights: any[];
    scorePenalty: number;
  }> {
    // TODO: Implement performance metrics analysis
    return { insights: [], scorePenalty: 0 };
  }

  private async compareStores(storeIds: string[]): Promise<any[]> {
    // TODO: Implement store comparison logic
    return [];
  }

  private async compareTimePeriods(timePeriods: any[]): Promise<any[]> {
    // TODO: Implement time period comparison logic
    return [];
  }

  private generateStoreComparisonInsights(comparisonData: any[]): string[] {
    // TODO: Generate insights from store comparison data
    return [];
  }

  private generateTimePeriodInsights(comparisonData: any[]): string[] {
    // TODO: Generate insights from time period comparison data
    return [];
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService();