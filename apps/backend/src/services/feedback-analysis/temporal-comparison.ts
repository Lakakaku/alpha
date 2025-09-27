/**
 * TemporalComparison service for trend analysis
 * Feature: 008-step-2-6
 * Task: T024
 */

import { supabase } from '@vocilia/database/client';
import { openaiService } from '../../config/openai';
import type { 
  AnalysisReport, 
  TemporalComparisonData, 
  SentimentBreakdown,
  TrendComparison 
} from '@vocilia/types/feedback-analysis';

export interface WeeklyComparisonData {
  current_week: {
    week_number: number;
    year: number;
    total_feedback_count: number;
    sentiment_breakdown?: SentimentBreakdown;
    department_breakdown?: Record<string, number>;
    report?: AnalysisReport;
  };
  previous_week?: {
    week_number: number;
    year: number;
    total_feedback_count: number;
    sentiment_breakdown?: SentimentBreakdown;
    department_breakdown?: Record<string, number>;
    report?: AnalysisReport;
  };
  comparison: {
    feedback_count_change: number;
    feedback_count_change_percent: number;
    sentiment_distribution_change: {
      positive_change: number;
      negative_change: number;
      neutral_change: number;
      mixed_change: number;
    };
    new_issues: string[];
    resolved_issues: string[];
    trend_direction: 'improving' | 'declining' | 'stable';
    key_changes: string;
    confidence_score: number;
  };
}

export interface TrendAnalysisOptions {
  weeks_back?: number;
  include_department_trends?: boolean;
  ai_analysis?: boolean;
  confidence_threshold?: number;
}

/**
 * Utility functions for temporal calculations
 */
export class TemporalUtils {
  /**
   * Get ISO week number for a date
   */
  static getWeekNumber(date: Date): { week: number; year: number } {
    const firstThursday = new Date(date.getFullYear(), 0, 4);
    const firstThursdayWeek = new Date(firstThursday.getTime() - (firstThursday.getDay() - 1) * 86400000);
    
    const weekStart = new Date(date.getTime() - (date.getDay() - 1) * 86400000);
    const weekNumber = Math.floor((weekStart.getTime() - firstThursdayWeek.getTime()) / (7 * 86400000)) + 1;
    
    return {
      week: weekNumber,
      year: date.getFullYear()
    };
  }

  /**
   * Calculate previous week/year accounting for year boundaries
   */
  static getPreviousWeek(currentWeek: number, currentYear: number, weeksBack: number = 1): { week: number; year: number } {
    let targetWeek = currentWeek - weeksBack;
    let targetYear = currentYear;

    while (targetWeek <= 0) {
      targetYear -= 1;
      const weeksInPreviousYear = this.getWeeksInYear(targetYear);
      targetWeek = weeksInPreviousYear + targetWeek;
    }

    return { week: targetWeek, year: targetYear };
  }

  /**
   * Get number of weeks in a year
   */
  static getWeeksInYear(year: number): number {
    const firstDay = new Date(year, 0, 1);
    const lastDay = new Date(year, 11, 31);
    
    // Check if year has 53 weeks
    const firstDayOfWeek = firstDay.getDay();
    const lastDayOfWeek = lastDay.getDay();
    
    return (firstDayOfWeek === 4 || (firstDayOfWeek === 3 && lastDayOfWeek === 5)) ? 53 : 52;
  }

  /**
   * Calculate percentage change
   */
  static calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100 * 100) / 100; // Round to 2 decimals
  }

  /**
   * Normalize sentiment breakdown for comparison
   */
  static normalizeSentimentBreakdown(breakdown: SentimentBreakdown, total: number): SentimentBreakdown {
    if (total === 0) {
      return { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    }

    return {
      positive: Math.round((breakdown.positive / total) * 100 * 100) / 100,
      negative: Math.round((breakdown.negative / total) * 100 * 100) / 100,
      neutral: Math.round((breakdown.neutral / total) * 100 * 100) / 100,
      mixed: Math.round((breakdown.mixed / total) * 100 * 100) / 100,
    };
  }
}

/**
 * Main temporal comparison service
 */
export class TemporalComparisonService {
  /**
   * Get comprehensive temporal comparison data for a store
   */
  static async getTemporalComparison(
    storeId: string,
    options: TrendAnalysisOptions = {}
  ): Promise<WeeklyComparisonData> {
    const {
      weeks_back = 1,
      include_department_trends = true,
      ai_analysis = true,
      confidence_threshold = 0.7
    } = options;

    // Get current week
    const currentDate = new Date();
    const { week: currentWeek, year: currentYear } = TemporalUtils.getWeekNumber(currentDate);

    // Get previous week
    const { week: previousWeek, year: previousYear } = TemporalUtils.getPreviousWeek(
      currentWeek, 
      currentYear, 
      weeks_back
    );

    // Fetch current and previous week data
    const [currentData, previousData] = await Promise.all([
      this.getWeekData(storeId, currentWeek, currentYear, include_department_trends),
      this.getWeekData(storeId, previousWeek, previousYear, include_department_trends)
    ]);

    // Calculate comparison metrics
    const comparison = await this.calculateComparison(
      currentData,
      previousData,
      ai_analysis,
      confidence_threshold
    );

    return {
      current_week: currentData,
      previous_week: previousData.total_feedback_count > 0 ? previousData : undefined,
      comparison
    };
  }

  /**
   * Get week data for analysis
   */
  private static async getWeekData(
    storeId: string,
    weekNumber: number,
    year: number,
    includeDepartmentBreakdown: boolean
  ): Promise<WeeklyComparisonData['current_week']> {
    // Get analysis report for the week
    const { data: report, error: reportError } = await supabase
      .from('analysis_reports')
      .select('*')
      .eq('store_id', storeId)
      .eq('week_number', weekNumber)
      .eq('year', year)
      .single();

    if (reportError && reportError.code !== 'PGRST116') {
      throw new Error(`Failed to get week data: ${reportError.message}`);
    }

    // If we have a report, use its data
    if (report) {
      return {
        week_number: weekNumber,
        year: year,
        total_feedback_count: report.total_feedback_count,
        sentiment_breakdown: report.sentiment_breakdown,
        department_breakdown: includeDepartmentBreakdown ? report.department_breakdown : undefined,
        report: report as AnalysisReport
      };
    }

    // Fallback: calculate data from raw feedback
    const startOfWeek = this.getStartOfWeek(weekNumber, year);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback_records')
      .select('sentiment, department_tags')
      .eq('store_id', storeId)
      .gte('created_at', startOfWeek.toISOString())
      .lt('created_at', endOfWeek.toISOString());

    if (feedbackError) {
      throw new Error(`Failed to get feedback data: ${feedbackError.message}`);
    }

    // Calculate sentiment breakdown
    const sentimentBreakdown = this.calculateSentimentBreakdown(feedback || []);
    const departmentBreakdown = includeDepartmentBreakdown 
      ? this.calculateDepartmentBreakdown(feedback || [])
      : undefined;

    return {
      week_number: weekNumber,
      year: year,
      total_feedback_count: feedback?.length || 0,
      sentiment_breakdown: sentimentBreakdown,
      department_breakdown: departmentBreakdown
    };
  }

  /**
   * Calculate comparison between current and previous week
   */
  private static async calculateComparison(
    currentData: WeeklyComparisonData['current_week'],
    previousData: WeeklyComparisonData['current_week'],
    useAI: boolean,
    confidenceThreshold: number
  ): Promise<WeeklyComparisonData['comparison']> {
    const currentCount = currentData.total_feedback_count;
    const previousCount = previousData.total_feedback_count;

    // Calculate basic metrics
    const feedbackCountChange = currentCount - previousCount;
    const feedbackCountChangePercent = TemporalUtils.calculatePercentageChange(currentCount, previousCount);

    // Calculate sentiment distribution changes
    const currentSentiment = currentData.sentiment_breakdown;
    const previousSentiment = previousData.sentiment_breakdown;

    const sentimentDistributionChange = {
      positive_change: 0,
      negative_change: 0,
      neutral_change: 0,
      mixed_change: 0
    };

    if (currentSentiment && previousSentiment && currentCount > 0 && previousCount > 0) {
      const currentNormalized = TemporalUtils.normalizeSentimentBreakdown(currentSentiment, currentCount);
      const previousNormalized = TemporalUtils.normalizeSentimentBreakdown(previousSentiment, previousCount);

      sentimentDistributionChange.positive_change = currentNormalized.positive - previousNormalized.positive;
      sentimentDistributionChange.negative_change = currentNormalized.negative - previousNormalized.negative;
      sentimentDistributionChange.neutral_change = currentNormalized.neutral - previousNormalized.neutral;
      sentimentDistributionChange.mixed_change = currentNormalized.mixed - previousNormalized.mixed;
    }

    // Determine trend direction
    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    if (sentimentDistributionChange.positive_change > 5 || sentimentDistributionChange.negative_change < -5) {
      trendDirection = 'improving';
    } else if (sentimentDistributionChange.positive_change < -5 || sentimentDistributionChange.negative_change > 5) {
      trendDirection = 'declining';
    }

    let newIssues: string[] = [];
    let resolvedIssues: string[] = [];
    let keyChanges = 'Ingen signifikant förändring upptäckt.';
    let confidenceScore = 0.5;

    // Use AI analysis if enabled and we have report data
    if (useAI && currentData.report && previousData.report) {
      try {
        const aiAnalysis = await this.performAITemporalAnalysis(
          currentData.report,
          previousData.report
        );

        if (aiAnalysis.confidence >= confidenceThreshold) {
          newIssues = aiAnalysis.new_issues;
          resolvedIssues = aiAnalysis.resolved_issues;
          keyChanges = aiAnalysis.key_changes;
          confidenceScore = aiAnalysis.confidence;

          // Override trend direction if AI has high confidence
          if (aiAnalysis.confidence > 0.8) {
            trendDirection = aiAnalysis.trend_direction;
          }
        }
      } catch (error) {
        console.warn('AI temporal analysis failed, using fallback:', error);
      }
    }

    // Fallback analysis based on basic metrics
    if (!useAI || confidenceScore < confidenceThreshold) {
      keyChanges = this.generateBasicKeyChanges(
        feedbackCountChange,
        feedbackCountChangePercent,
        sentimentDistributionChange,
        trendDirection
      );
      confidenceScore = Math.min(confidenceScore + 0.3, 0.9);
    }

    return {
      feedback_count_change: feedbackCountChange,
      feedback_count_change_percent: feedbackCountChangePercent,
      sentiment_distribution_change: sentimentDistributionChange,
      new_issues: newIssues,
      resolved_issues: resolvedIssues,
      trend_direction: trendDirection,
      key_changes: keyChanges,
      confidence_score: confidenceScore
    };
  }

  /**
   * Perform AI-powered temporal analysis
   */
  private static async performAITemporalAnalysis(
    currentReport: AnalysisReport,
    previousReport: AnalysisReport
  ): Promise<{
    new_issues: string[];
    resolved_issues: string[];
    trend_direction: 'improving' | 'declining' | 'stable';
    key_changes: string;
    confidence: number;
  }> {
    const currentData = {
      week: `${currentReport.year}-W${currentReport.week_number}`,
      feedback_count: currentReport.total_feedback_count,
      sentiment_breakdown: currentReport.sentiment_breakdown,
      department_breakdown: currentReport.department_breakdown,
      negative_summary: currentReport.negative_summary,
      new_critiques: currentReport.new_critiques,
    };

    const previousData = {
      week: `${previousReport.year}-W${previousReport.week_number}`,
      feedback_count: previousReport.total_feedback_count,
      sentiment_breakdown: previousReport.sentiment_breakdown,
      department_breakdown: previousReport.department_breakdown,
      negative_summary: previousReport.negative_summary,
      new_critiques: previousReport.new_critiques,
    };

    const response = await openaiService.analyzeTemporalComparison(currentData, previousData);

    return {
      ...response,
      confidence: 0.85 // High confidence for AI analysis
    };
  }

  /**
   * Generate basic key changes description
   */
  private static generateBasicKeyChanges(
    feedbackCountChange: number,
    feedbackCountChangePercent: number,
    sentimentChange: WeeklyComparisonData['comparison']['sentiment_distribution_change'],
    trendDirection: 'improving' | 'declining' | 'stable'
  ): string {
    const changes: string[] = [];

    // Feedback volume changes
    if (Math.abs(feedbackCountChangePercent) >= 20) {
      if (feedbackCountChange > 0) {
        changes.push(`${feedbackCountChangePercent}% ökning av feedback-volym`);
      } else {
        changes.push(`${Math.abs(feedbackCountChangePercent)}% minskning av feedback-volym`);
      }
    }

    // Sentiment changes
    if (Math.abs(sentimentChange.positive_change) >= 5) {
      if (sentimentChange.positive_change > 0) {
        changes.push(`${sentimentChange.positive_change.toFixed(1)}% ökning av positiv feedback`);
      } else {
        changes.push(`${Math.abs(sentimentChange.positive_change).toFixed(1)}% minskning av positiv feedback`);
      }
    }

    if (Math.abs(sentimentChange.negative_change) >= 5) {
      if (sentimentChange.negative_change > 0) {
        changes.push(`${sentimentChange.negative_change.toFixed(1)}% ökning av negativ feedback`);
      } else {
        changes.push(`${Math.abs(sentimentChange.negative_change).toFixed(1)}% minskning av negativ feedback`);
      }
    }

    // Overall trend
    const trendMessages = {
      improving: 'Övergripande förbättring av kundnöjdhet',
      declining: 'Nedgång i kundnöjdhet kräver uppmärksamhet',
      stable: 'Stabil kundnöjdhetsnivå'
    };

    if (changes.length > 0) {
      return `${changes.join(', ')}. ${trendMessages[trendDirection]}.`;
    }

    return trendMessages[trendDirection];
  }

  /**
   * Get start of week date
   */
  private static getStartOfWeek(weekNumber: number, year: number): Date {
    const firstThursday = new Date(year, 0, 4);
    const firstWeekStart = new Date(firstThursday.getTime() - (firstThursday.getDay() - 1) * 86400000);
    
    return new Date(firstWeekStart.getTime() + (weekNumber - 1) * 7 * 86400000);
  }

  /**
   * Calculate sentiment breakdown from feedback data
   */
  private static calculateSentimentBreakdown(feedback: Array<{ sentiment?: string }>): SentimentBreakdown {
    const breakdown = { positive: 0, negative: 0, neutral: 0, mixed: 0 };

    feedback.forEach(item => {
      if (item.sentiment) {
        switch (item.sentiment) {
          case 'positive':
            breakdown.positive++;
            break;
          case 'negative':
            breakdown.negative++;
            break;
          case 'neutral':
            breakdown.neutral++;
            break;
          case 'mixed':
            breakdown.mixed++;
            break;
        }
      }
    });

    return breakdown;
  }

  /**
   * Calculate department breakdown from feedback data
   */
  private static calculateDepartmentBreakdown(feedback: Array<{ department_tags?: string[] }>): Record<string, number> {
    const breakdown: Record<string, number> = {};

    feedback.forEach(item => {
      if (item.department_tags) {
        item.department_tags.forEach(department => {
          breakdown[department] = (breakdown[department] || 0) + 1;
        });
      }
    });

    return breakdown;
  }

  /**
   * Get multi-week trend analysis
   */
  static async getMultiWeekTrend(
    storeId: string,
    weeksCount: number = 8
  ): Promise<{
    weeks: Array<{
      week_number: number;
      year: number;
      total_feedback_count: number;
      sentiment_score: number; // 0-100, higher is better
    }>;
    overall_trend: 'improving' | 'declining' | 'stable';
    trend_strength: number; // 0-1
    insights: string[];
  }> {
    const currentDate = new Date();
    const { week: currentWeek, year: currentYear } = TemporalUtils.getWeekNumber(currentDate);

    const weeklyData: Array<{
      week_number: number;
      year: number;
      total_feedback_count: number;
      sentiment_score: number;
    }> = [];

    // Collect data for each week
    for (let i = 0; i < weeksCount; i++) {
      const { week, year } = TemporalUtils.getPreviousWeek(currentWeek, currentYear, i);
      const weekData = await this.getWeekData(storeId, week, year, false);
      
      // Calculate sentiment score (0-100)
      let sentimentScore = 50; // Neutral baseline
      if (weekData.sentiment_breakdown && weekData.total_feedback_count > 0) {
        const { positive, negative, neutral, mixed } = weekData.sentiment_breakdown;
        const total = positive + negative + neutral + mixed;
        
        if (total > 0) {
          sentimentScore = Math.round(
            ((positive * 100) + (neutral * 50) + (mixed * 50)) / total
          );
        }
      }

      weeklyData.push({
        week_number: week,
        year: year,
        total_feedback_count: weekData.total_feedback_count,
        sentiment_score: sentimentScore
      });
    }

    // Analyze overall trend
    const trendAnalysis = this.analyzeTrendDirection(weeklyData);

    return {
      weeks: weeklyData.reverse(), // Return in chronological order
      overall_trend: trendAnalysis.direction,
      trend_strength: trendAnalysis.strength,
      insights: trendAnalysis.insights
    };
  }

  /**
   * Analyze trend direction from weekly data
   */
  private static analyzeTrendDirection(weeklyData: Array<{ sentiment_score: number; total_feedback_count: number }>): {
    direction: 'improving' | 'declining' | 'stable';
    strength: number;
    insights: string[];
  } {
    if (weeklyData.length < 3) {
      return {
        direction: 'stable',
        strength: 0,
        insights: ['Otillräckligt data för trendanalys']
      };
    }

    const sentimentScores = weeklyData.map(w => w.sentiment_score);
    const feedbackCounts = weeklyData.map(w => w.total_feedback_count);

    // Calculate linear regression for sentiment trend
    const sentimentTrend = this.calculateLinearTrend(sentimentScores);
    const volumeTrend = this.calculateLinearTrend(feedbackCounts);

    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    let strength = Math.abs(sentimentTrend.slope) / 10; // Normalize to 0-1

    if (sentimentTrend.slope > 1 && sentimentTrend.correlation > 0.3) {
      direction = 'improving';
    } else if (sentimentTrend.slope < -1 && sentimentTrend.correlation > 0.3) {
      direction = 'declining';
    }

    // Generate insights
    const insights: string[] = [];
    
    if (strength > 0.5) {
      insights.push(`Stark ${direction === 'improving' ? 'positiv' : direction === 'declining' ? 'negativ' : 'stabil'} trend`);
    }

    if (Math.abs(volumeTrend.slope) > 2) {
      if (volumeTrend.slope > 0) {
        insights.push('Ökande feedback-volym över tid');
      } else {
        insights.push('Minskande feedback-volym över tid');
      }
    }

    if (insights.length === 0) {
      insights.push('Stabila sentiment- och volymnivåer');
    }

    return { direction, strength, insights };
  }

  /**
   * Calculate linear trend (simple linear regression)
   */
  private static calculateLinearTrend(values: number[]): { slope: number; correlation: number } {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = values.reduce((sum, yi) => sum + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const correlation = denominator === 0 ? 0 : numerator / denominator;

    return { slope: slope || 0, correlation: correlation || 0 };
  }
}

export default TemporalComparisonService;