import { supabase } from '../client/supabase';
import type { Database } from '../types';

// Note: These types will be properly typed once the monitoring tables are added to the database schema
export type RevenueAnalytics = {
  id: string;
  report_date: string;
  store_id: string;
  total_rewards_paid: number;
  admin_fees_collected: number;
  net_revenue: number;
  feedback_volume: number;
  customer_engagement_rate?: number;
  reward_distribution: Record<string, number>;
  created_at: string;
  updated_at: string;
};

export type RevenueAnalyticsInsert = Omit<RevenueAnalytics, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type RevenueAnalyticsUpdate = Partial<Omit<RevenueAnalytics, 'id' | 'created_at'>>;

export interface RevenueData {
  reportDate: string; // YYYY-MM-DD format
  storeId: string;
  totalRewardsPaid: number;
  adminFeesCollected: number;
  netRevenue: number;
  feedbackVolume: number;
  customerEngagementRate?: number;
  rewardDistribution?: Record<string, number>; // grade distribution
}

export interface RevenueFilters {
  storeId?: string;
  startDate?: string;
  endDate?: string;
  minRevenue?: number;
  maxRevenue?: number;
}

export interface RewardGradeDistribution {
  grade_a: number;
  grade_b: number;
  grade_c: number;
  grade_d: number;
  [gradeName: string]: number;
}

export class RevenueAnalyticsModel {
  /**
   * Create or update revenue analytics for a store and date
   */
  static async upsertRevenue(revenueData: RevenueData): Promise<RevenueAnalytics | null> {
    // First try to get existing record
    const { data: existing } = await supabase
      .from('revenue_analytics')
      .select('id')
      .eq('report_date', revenueData.reportDate)
      .eq('store_id', revenueData.storeId)
      .single();

    let result;

    if (existing) {
      // Update existing record
      result = await supabase
        .from('revenue_analytics')
        .update({
          total_rewards_paid: revenueData.totalRewardsPaid,
          admin_fees_collected: revenueData.adminFeesCollected,
          net_revenue: revenueData.netRevenue,
          feedback_volume: revenueData.feedbackVolume,
          customer_engagement_rate: revenueData.customerEngagementRate,
          reward_distribution: revenueData.rewardDistribution || {},
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new record
      result = await supabase
        .from('revenue_analytics')
        .insert({
          report_date: revenueData.reportDate,
          store_id: revenueData.storeId,
          total_rewards_paid: revenueData.totalRewardsPaid,
          admin_fees_collected: revenueData.adminFeesCollected,
          net_revenue: revenueData.netRevenue,
          feedback_volume: revenueData.feedbackVolume,
          customer_engagement_rate: revenueData.customerEngagementRate,
          reward_distribution: revenueData.rewardDistribution || {}
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error upserting revenue analytics:', result.error);
      return null;
    }

    return result.data;
  }

  /**
   * Get revenue analytics with filtering
   */
  static async getRevenueAnalytics(
    filters?: RevenueFilters,
    page = 1,
    limit = 50
  ): Promise<{ analytics: RevenueAnalytics[]; total: number }> {
    let query = supabase
      .from('revenue_analytics')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters?.storeId) {
      query = query.eq('store_id', filters.storeId);
    }
    if (filters?.startDate) {
      query = query.gte('report_date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('report_date', filters.endDate);
    }
    if (filters?.minRevenue !== undefined) {
      query = query.gte('net_revenue', filters.minRevenue);
    }
    if (filters?.maxRevenue !== undefined) {
      query = query.lte('net_revenue', filters.maxRevenue);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('report_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching revenue analytics:', error);
      return { analytics: [], total: 0 };
    }

    return {
      analytics: data || [],
      total: count || 0
    };
  }

  /**
   * Get revenue analytics by store and date
   */
  static async getByStoreAndDate(
    storeId: string,
    reportDate: string
  ): Promise<RevenueAnalytics | null> {
    const { data, error } = await supabase
      .from('revenue_analytics')
      .select('*')
      .eq('store_id', storeId)
      .eq('report_date', reportDate)
      .single();

    if (error) {
      console.error('Error fetching revenue analytics by store and date:', error);
      return null;
    }

    return data;
  }

  /**
   * Get revenue trends for a store
   */
  static async getStoreRevenueTrends(
    storeId: string,
    days = 30
  ): Promise<{
    trends: {
      date: string;
      totalRewardsPaid: number;
      adminFeesCollected: number;
      netRevenue: number;
      feedbackVolume: number;
      customerEngagementRate: number;
    }[];
    summary: {
      totalRevenue: number;
      avgDailyRevenue: number;
      totalFeedback: number;
      avgEngagementRate: number;
      revenueGrowth: number; // percentage
    };
  }> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('revenue_analytics')
      .select('*')
      .eq('store_id', storeId)
      .gte('report_date', startDateStr)
      .lte('report_date', endDate)
      .order('report_date', { ascending: true });

    if (error) {
      console.error('Error fetching store revenue trends:', error);
      return {
        trends: [],
        summary: {
          totalRevenue: 0,
          avgDailyRevenue: 0,
          totalFeedback: 0,
          avgEngagementRate: 0,
          revenueGrowth: 0
        }
      };
    }

    const trends = (data || []).map(record => ({
      date: record.report_date,
      totalRewardsPaid: record.total_rewards_paid,
      adminFeesCollected: record.admin_fees_collected,
      netRevenue: record.net_revenue,
      feedbackVolume: record.feedback_volume,
      customerEngagementRate: record.customer_engagement_rate || 0
    }));

    // Calculate summary statistics
    const totalRevenue = trends.reduce((sum, t) => sum + t.netRevenue, 0);
    const avgDailyRevenue = trends.length > 0 ? totalRevenue / trends.length : 0;
    const totalFeedback = trends.reduce((sum, t) => sum + t.feedbackVolume, 0);
    const avgEngagementRate = trends.length > 0
      ? trends.reduce((sum, t) => sum + t.customerEngagementRate, 0) / trends.length
      : 0;

    // Calculate revenue growth (first half vs second half)
    let revenueGrowth = 0;
    if (trends.length >= 4) {
      const halfPoint = Math.floor(trends.length / 2);
      const firstHalfAvg = trends.slice(0, halfPoint)
        .reduce((sum, t) => sum + t.netRevenue, 0) / halfPoint;
      const secondHalfAvg = trends.slice(halfPoint)
        .reduce((sum, t) => sum + t.netRevenue, 0) / (trends.length - halfPoint);

      revenueGrowth = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;
    }

    return {
      trends,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
        totalFeedback,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100
      }
    };
  }

  /**
   * Get aggregated revenue statistics
   */
  static async getAggregatedStats(
    storeIds?: string[],
    days = 30
  ): Promise<{
    totalRevenue: number;
    totalRewardsPaid: number;
    totalAdminFees: number;
    totalFeedbackVolume: number;
    avgEngagementRate: number;
    topPerformingStores: {
      storeId: string;
      revenue: number;
      feedbackVolume: number;
    }[];
    rewardDistributionSummary: RewardGradeDistribution;
  }> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    let query = supabase
      .from('revenue_analytics')
      .select('*')
      .gte('report_date', startDateStr)
      .lte('report_date', endDate);

    if (storeIds && storeIds.length > 0) {
      query = query.in('store_id', storeIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching aggregated revenue stats:', error);
      return {
        totalRevenue: 0,
        totalRewardsPaid: 0,
        totalAdminFees: 0,
        totalFeedbackVolume: 0,
        avgEngagementRate: 0,
        topPerformingStores: [],
        rewardDistributionSummary: {
          grade_a: 0,
          grade_b: 0,
          grade_c: 0,
          grade_d: 0
        }
      };
    }

    const totalRevenue = data?.reduce((sum, r) => sum + r.net_revenue, 0) || 0;
    const totalRewardsPaid = data?.reduce((sum, r) => sum + r.total_rewards_paid, 0) || 0;
    const totalAdminFees = data?.reduce((sum, r) => sum + r.admin_fees_collected, 0) || 0;
    const totalFeedbackVolume = data?.reduce((sum, r) => sum + r.feedback_volume, 0) || 0;

    const avgEngagementRate = data && data.length > 0
      ? data.reduce((sum, r) => sum + (r.customer_engagement_rate || 0), 0) / data.length
      : 0;

    // Calculate top performing stores
    const storePerformance: { [storeId: string]: { revenue: number; feedbackVolume: number } } = {};

    data?.forEach(record => {
      if (!storePerformance[record.store_id]) {
        storePerformance[record.store_id] = { revenue: 0, feedbackVolume: 0 };
      }
      storePerformance[record.store_id].revenue += record.net_revenue;
      storePerformance[record.store_id].feedbackVolume += record.feedback_volume;
    });

    const topPerformingStores = Object.keys(storePerformance)
      .map(storeId => ({
        storeId,
        revenue: storePerformance[storeId].revenue,
        feedbackVolume: storePerformance[storeId].feedbackVolume
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Aggregate reward distribution
    const rewardDistributionSummary: RewardGradeDistribution = {
      grade_a: 0,
      grade_b: 0,
      grade_c: 0,
      grade_d: 0
    };

    data?.forEach(record => {
      if (record.reward_distribution) {
        const distribution = record.reward_distribution as any;
        Object.keys(distribution).forEach(grade => {
          if (rewardDistributionSummary.hasOwnProperty(grade)) {
            rewardDistributionSummary[grade] += distribution[grade] || 0;
          }
        });
      }
    });

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalRewardsPaid: Math.round(totalRewardsPaid * 100) / 100,
      totalAdminFees: Math.round(totalAdminFees * 100) / 100,
      totalFeedbackVolume,
      avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
      topPerformingStores,
      rewardDistributionSummary
    };
  }

  /**
   * Get revenue comparison between periods
   */
  static async getRevenueComparison(
    storeId?: string,
    currentPeriodDays = 30,
    previousPeriodDays = 30
  ): Promise<{
    currentPeriod: {
      revenue: number;
      rewardsPaid: number;
      feedbackVolume: number;
      avgDailyRevenue: number;
    };
    previousPeriod: {
      revenue: number;
      rewardsPaid: number;
      feedbackVolume: number;
      avgDailyRevenue: number;
    };
    growth: {
      revenue: number; // percentage
      rewardsPaid: number; // percentage
      feedbackVolume: number; // percentage
    };
  }> {
    const today = new Date();

    // Current period
    const currentEnd = new Date(today);
    currentEnd.setDate(currentEnd.getDate() - 1); // Yesterday
    const currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - currentPeriodDays + 1);

    // Previous period
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - previousPeriodDays + 1);

    // Build queries
    let currentQuery = supabase
      .from('revenue_analytics')
      .select('net_revenue, total_rewards_paid, feedback_volume')
      .gte('report_date', currentStart.toISOString().split('T')[0])
      .lte('report_date', currentEnd.toISOString().split('T')[0]);

    let previousQuery = supabase
      .from('revenue_analytics')
      .select('net_revenue, total_rewards_paid, feedback_volume')
      .gte('report_date', previousStart.toISOString().split('T')[0])
      .lte('report_date', previousEnd.toISOString().split('T')[0]);

    if (storeId) {
      currentQuery = currentQuery.eq('store_id', storeId);
      previousQuery = previousQuery.eq('store_id', storeId);
    }

    const [currentResult, previousResult] = await Promise.all([
      currentQuery,
      previousQuery
    ]);

    const currentData = currentResult.data || [];
    const previousData = previousResult.data || [];

    // Calculate current period metrics
    const currentRevenue = currentData.reduce((sum, r) => sum + r.net_revenue, 0);
    const currentRewardsPaid = currentData.reduce((sum, r) => sum + r.total_rewards_paid, 0);
    const currentFeedbackVolume = currentData.reduce((sum, r) => sum + r.feedback_volume, 0);

    // Calculate previous period metrics
    const previousRevenue = previousData.reduce((sum, r) => sum + r.net_revenue, 0);
    const previousRewardsPaid = previousData.reduce((sum, r) => sum + r.total_rewards_paid, 0);
    const previousFeedbackVolume = previousData.reduce((sum, r) => sum + r.feedback_volume, 0);

    // Calculate growth percentages
    const revenueGrowth = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;
    const rewardsPaidGrowth = previousRewardsPaid > 0
      ? ((currentRewardsPaid - previousRewardsPaid) / previousRewardsPaid) * 100
      : 0;
    const feedbackVolumeGrowth = previousFeedbackVolume > 0
      ? ((currentFeedbackVolume - previousFeedbackVolume) / previousFeedbackVolume) * 100
      : 0;

    return {
      currentPeriod: {
        revenue: Math.round(currentRevenue * 100) / 100,
        rewardsPaid: Math.round(currentRewardsPaid * 100) / 100,
        feedbackVolume: currentFeedbackVolume,
        avgDailyRevenue: Math.round((currentRevenue / currentPeriodDays) * 100) / 100
      },
      previousPeriod: {
        revenue: Math.round(previousRevenue * 100) / 100,
        rewardsPaid: Math.round(previousRewardsPaid * 100) / 100,
        feedbackVolume: previousFeedbackVolume,
        avgDailyRevenue: Math.round((previousRevenue / previousPeriodDays) * 100) / 100
      },
      growth: {
        revenue: Math.round(revenueGrowth * 100) / 100,
        rewardsPaid: Math.round(rewardsPaidGrowth * 100) / 100,
        feedbackVolume: Math.round(feedbackVolumeGrowth * 100) / 100
      }
    };
  }

  /**
   * Get reward distribution analysis
   */
  static async getRewardDistributionAnalysis(
    storeId?: string,
    days = 30
  ): Promise<{
    totalRewards: number;
    gradeDistribution: RewardGradeDistribution & { percentage: RewardGradeDistribution };
    avgRewardPerFeedback: number;
    engagementTrends: {
      date: string;
      engagementRate: number;
      feedbackVolume: number;
    }[];
  }> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    let query = supabase
      .from('revenue_analytics')
      .select('*')
      .gte('report_date', startDateStr)
      .lte('report_date', endDate)
      .order('report_date', { ascending: true });

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reward distribution analysis:', error);
      return {
        totalRewards: 0,
        gradeDistribution: {
          grade_a: 0,
          grade_b: 0,
          grade_c: 0,
          grade_d: 0,
          percentage: {
            grade_a: 0,
            grade_b: 0,
            grade_c: 0,
            grade_d: 0
          }
        },
        avgRewardPerFeedback: 0,
        engagementTrends: []
      };
    }

    const totalRewards = data?.reduce((sum, r) => sum + r.total_rewards_paid, 0) || 0;
    const totalFeedback = data?.reduce((sum, r) => sum + r.feedback_volume, 0) || 0;

    // Aggregate grade distribution
    const gradeDistribution: RewardGradeDistribution = {
      grade_a: 0,
      grade_b: 0,
      grade_c: 0,
      grade_d: 0
    };

    data?.forEach(record => {
      if (record.reward_distribution) {
        const distribution = record.reward_distribution as any;
        Object.keys(distribution).forEach(grade => {
          if (gradeDistribution.hasOwnProperty(grade)) {
            gradeDistribution[grade] += distribution[grade] || 0;
          }
        });
      }
    });

    // Calculate percentages
    const totalGrades = Object.values(gradeDistribution).reduce((sum, count) => sum + count, 0);
    const percentageDistribution: RewardGradeDistribution = {
      grade_a: totalGrades > 0 ? (gradeDistribution.grade_a / totalGrades) * 100 : 0,
      grade_b: totalGrades > 0 ? (gradeDistribution.grade_b / totalGrades) * 100 : 0,
      grade_c: totalGrades > 0 ? (gradeDistribution.grade_c / totalGrades) * 100 : 0,
      grade_d: totalGrades > 0 ? (gradeDistribution.grade_d / totalGrades) * 100 : 0
    };

    // Calculate engagement trends
    const engagementTrends = (data || []).map(record => ({
      date: record.report_date,
      engagementRate: record.customer_engagement_rate || 0,
      feedbackVolume: record.feedback_volume
    }));

    return {
      totalRewards: Math.round(totalRewards * 100) / 100,
      gradeDistribution: {
        ...gradeDistribution,
        percentage: percentageDistribution
      },
      avgRewardPerFeedback: totalFeedback > 0 ? Math.round((totalRewards / totalFeedback) * 100) / 100 : 0,
      engagementTrends
    };
  }

  /**
   * Get profitability analysis
   */
  static async getProfitabilityAnalysis(
    storeId?: string,
    days = 30
  ): Promise<{
    totalRevenue: number;
    totalCosts: number; // rewards paid
    netProfit: number;
    profitMargin: number; // percentage
    costPerFeedback: number;
    revenuePerFeedback: number;
    breakEvenPoint: number; // feedback volume needed to break even
    profitabilityTrend: 'improving' | 'declining' | 'stable';
  }> {
    const stats = await this.getAggregatedStats(storeId ? [storeId] : undefined, days);

    const totalRevenue = stats.totalRevenue;
    const totalCosts = stats.totalRewardsPaid;
    const netProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const costPerFeedback = stats.totalFeedbackVolume > 0
      ? totalCosts / stats.totalFeedbackVolume
      : 0;

    const revenuePerFeedback = stats.totalFeedbackVolume > 0
      ? totalRevenue / stats.totalFeedbackVolume
      : 0;

    // Break-even analysis: how much feedback volume needed to cover current costs
    const breakEvenPoint = revenuePerFeedback > 0
      ? Math.ceil(totalCosts / revenuePerFeedback)
      : 0;

    // Simple trend analysis - compare recent vs older data
    const halfPeriod = Math.floor(days / 2);
    const recentStats = await this.getAggregatedStats(storeId ? [storeId] : undefined, halfPeriod);
    const recentMargin = recentStats.totalRevenue > 0
      ? ((recentStats.totalRevenue - recentStats.totalRewardsPaid) / recentStats.totalRevenue) * 100
      : 0;

    let profitabilityTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentMargin > profitMargin + 2) {
      profitabilityTrend = 'improving';
    } else if (recentMargin < profitMargin - 2) {
      profitabilityTrend = 'declining';
    }

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCosts: Math.round(totalCosts * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      costPerFeedback: Math.round(costPerFeedback * 100) / 100,
      revenuePerFeedback: Math.round(revenuePerFeedback * 100) / 100,
      breakEvenPoint,
      profitabilityTrend
    };
  }

  /**
   * Generate revenue insights
   */
  static async generateRevenueInsights(days = 30): Promise<{
    keyMetrics: {
      totalRevenue: number;
      revenueGrowth: number;
      avgDailyRevenue: number;
      topStore: { storeId: string; revenue: number } | null;
    };
    insights: string[];
    recommendations: string[];
  }> {
    const stats = await this.getAggregatedStats(undefined, days);
    const comparison = await this.getRevenueComparison(undefined, days, days);

    const keyMetrics = {
      totalRevenue: stats.totalRevenue,
      revenueGrowth: comparison.growth.revenue,
      avgDailyRevenue: comparison.currentPeriod.avgDailyRevenue,
      topStore: stats.topPerformingStores.length > 0 ? stats.topPerformingStores[0] : null
    };

    const insights: string[] = [];
    const recommendations: string[] = [];

    if (comparison.growth.revenue > 10) {
      insights.push('Strong revenue growth indicates successful customer engagement');
    } else if (comparison.growth.revenue < -5) {
      insights.push('Revenue decline may indicate engagement or operational issues');
    }

    if (stats.avgEngagementRate > 80) {
      insights.push('High customer engagement rate supports sustainable revenue');
    } else if (stats.avgEngagementRate < 50) {
      insights.push('Low engagement rate may limit revenue potential');
      recommendations.push('Review reward structure and customer experience');
    }

    if (stats.totalFeedbackVolume > comparison.previousPeriod.feedbackVolume * 1.2) {
      insights.push('Significant increase in feedback volume driving revenue growth');
    }

    // Profitability insights
    const profitability = await this.getProfitabilityAnalysis(undefined, days);
    if (profitability.profitMargin < 20) {
      recommendations.push('Consider optimizing reward costs to improve profitability');
    }

    if (profitability.profitabilityTrend === 'declining') {
      recommendations.push('Monitor cost trends and adjust pricing strategy');
    }

    return {
      keyMetrics,
      insights,
      recommendations
    };
  }

  /**
   * Clean up old revenue analytics (for data retention)
   */
  static async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from('revenue_analytics')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Error deleting old revenue analytics:', error);
      return 0;
    }

    return data?.length || 0;
  }
}