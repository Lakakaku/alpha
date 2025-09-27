import cron from 'node-cron';
import { supabase } from '../../../../packages/database/src/client/supabase';
import { businessIntelligenceService } from '../services/feedback-analysis/businessIntelligenceService';

interface WeeklyReportStats {
  reportsGenerated: number;
  storesProcessed: number;
  totalFeedbackAnalyzed: number;
  averageQualityScore: number;
  errors: Array<{
    storeId: string;
    error: string;
  }>;
  startTime: string;
  endTime: string;
  duration: number;
}

interface StoreWeeklyData {
  storeId: string;
  storeName: string;
  businessId: string;
  feedbackCount: number;
  averageQuality: number;
  weekStart: string;
  weekEnd: string;
}

class WeeklyReportsJob {
  private isRunning = false;
  private cronJob: any = null;

  constructor() {
    this.setupCronJob();
  }

  // Setup cron job to run every Monday at 6 AM
  private setupCronJob(): void {
    // Run every Monday at 6:00 AM Stockholm time
    this.cronJob = cron.schedule('0 6 * * 1', async () => {
      console.log('Starting scheduled weekly business reports generation');
      await this.runWeeklyReports();
    }, {
      scheduled: true,
      timezone: 'Europe/Stockholm'
    });

    console.log('Weekly reports job scheduled to run every Monday at 6:00 AM (Stockholm time)');
  }

  // Main weekly reports execution method
  async runWeeklyReports(): Promise<WeeklyReportStats> {
    if (this.isRunning) {
      console.log('Weekly reports job already running, skipping...');
      throw new Error('Weekly reports job already in progress');
    }

    this.isRunning = true;
    const startTime = new Date().toISOString();
    console.log(`Starting weekly business reports generation at ${startTime}`);

    const stats: WeeklyReportStats = {
      reportsGenerated: 0,
      storesProcessed: 0,
      totalFeedbackAnalyzed: 0,
      averageQualityScore: 0,
      errors: [],
      startTime,
      endTime: '',
      duration: 0
    };

    try {
      const { weekStart, weekEnd } = this.getPreviousWeekDates();
      console.log(`Generating reports for week: ${weekStart} to ${weekEnd}`);

      // Get all active stores with feedback data from the previous week
      const storesWithFeedback = await this.getStoresWithWeeklyFeedback(weekStart, weekEnd);
      console.log(`Found ${storesWithFeedback.length} stores with feedback data`);

      let totalQualityScore = 0;
      let totalFeedbackCount = 0;

      // Generate reports for each store
      for (const storeData of storesWithFeedback) {
        try {
          console.log(`Generating report for store: ${storeData.storeName} (${storeData.storeId})`);
          
          const report = await this.generateStoreWeeklyReport(storeData);
          
          if (report) {
            stats.reportsGenerated++;
            totalFeedbackCount += storeData.feedbackCount;
            totalQualityScore += storeData.averageQuality * storeData.feedbackCount;
          }

        } catch (error) {
          console.error(`Failed to generate report for store ${storeData.storeId}:`, error);
          stats.errors.push({
            storeId: storeData.storeId,
            error: (error as Error).message
          });
        }

        stats.storesProcessed++;
      }

      // Calculate overall averages
      stats.totalFeedbackAnalyzed = totalFeedbackCount;
      stats.averageQualityScore = totalFeedbackCount > 0 ? totalQualityScore / totalFeedbackCount : 0;

      const endTime = new Date().toISOString();
      stats.endTime = endTime;
      stats.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      // Log job completion
      await this.logJobCompletion(stats, weekStart, weekEnd);

      console.log('Weekly business reports generation completed:', stats);
      return stats;

    } catch (error) {
      console.error('Weekly reports job failed:', error);
      
      await this.logJobFailure(error as Error, startTime);
      throw error;
      
    } finally {
      this.isRunning = false;
    }
  }

  // Get previous week's Monday-Sunday date range
  private getPreviousWeekDates(): { weekStart: string; weekEnd: string } {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - daysToLastMonday - 7);
    lastMonday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    return {
      weekStart: lastMonday.toISOString(),
      weekEnd: lastSunday.toISOString()
    };
  }

  // Get stores that have feedback data for the specified week
  private async getStoresWithWeeklyFeedback(
    weekStart: string,
    weekEnd: string
  ): Promise<StoreWeeklyData[]> {
    const { data: feedbackData, error } = await supabase
      .from('feedback_call_sessions')
      .select(`
        store_id,
        stores (
          id,
          name,
          business_id
        ),
        quality_assessments (
          overall_quality_score
        )
      `)
      .eq('session_status', 'completed')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)
      .not('quality_assessments', 'is', null);

    if (error) {
      console.error('Failed to fetch weekly feedback data:', error);
      return [];
    }

    // Group by store and calculate statistics
    const storeMap = new Map<string, StoreWeeklyData>();

    for (const session of (feedbackData || [])) {
      const storeId = session.store_id;
      const store = session.stores;
      const qualityScore = session.quality_assessments?.[0]?.overall_quality_score || 0;

      if (!store) continue;

      if (!storeMap.has(storeId)) {
        storeMap.set(storeId, {
          storeId,
          storeName: store.name,
          businessId: store.business_id,
          feedbackCount: 0,
          averageQuality: 0,
          weekStart,
          weekEnd
        });
      }

      const storeData = storeMap.get(storeId)!;
      const previousTotal = storeData.averageQuality * storeData.feedbackCount;
      storeData.feedbackCount++;
      storeData.averageQuality = (previousTotal + qualityScore) / storeData.feedbackCount;
    }

    return Array.from(storeMap.values()).filter(store => store.feedbackCount > 0);
  }

  // Generate comprehensive weekly report for a specific store
  private async generateStoreWeeklyReport(storeData: StoreWeeklyData): Promise<any> {
    try {
      // Check if report already exists for this week
      const { data: existingReport } = await supabase
        .from('weekly_analysis_reports')
        .select('id')
        .eq('store_id', storeData.storeId)
        .eq('analysis_week', storeData.weekStart.split('T')[0])
        .single();

      if (existingReport) {
        console.log(`Report already exists for store ${storeData.storeId}, week ${storeData.weekStart}`);
        return existingReport;
      }

      // Get detailed feedback data for analysis
      const { data: feedbackSessions, error: feedbackError } = await supabase
        .from('feedback_call_sessions')
        .select(`
          id,
          created_at,
          duration_seconds,
          conversation_transcripts (*),
          quality_assessments (*),
          fraud_detection_results (*)
        `)
        .eq('store_id', storeData.storeId)
        .eq('session_status', 'completed')
        .gte('created_at', storeData.weekStart)
        .lte('created_at', storeData.weekEnd);

      if (feedbackError || !feedbackSessions) {
        throw new Error(`Failed to fetch feedback sessions: ${feedbackError?.message}`);
      }

      // Get previous week's report for comparison
      const previousWeek = new Date(storeData.weekStart);
      previousWeek.setDate(previousWeek.getDate() - 7);
      
      const { data: previousReport } = await supabase
        .from('weekly_analysis_reports')
        .select('*')
        .eq('store_id', storeData.storeId)
        .eq('analysis_week', previousWeek.toISOString().split('T')[0])
        .single();

      // Use business intelligence service to analyze feedback
      const analysis = await businessIntelligenceService.generateWeeklyInsights(
        feedbackSessions,
        previousReport
      );

      // Create comprehensive report structure
      const reportData = {
        store_id: storeData.storeId,
        analysis_week: storeData.weekStart.split('T')[0], // Monday of the week
        total_feedback_count: storeData.feedbackCount,
        average_quality_score: storeData.averageQuality,
        positive_trends: analysis.positiveTrends,
        negative_issues: analysis.negativeIssues,
        new_issues: analysis.newIssues,
        department_insights: analysis.departmentInsights,
        historical_comparison: analysis.historicalComparison,
        predictive_insights: analysis.predictiveInsights,
        actionable_recommendations: analysis.actionableRecommendations,
        report_metadata: {
          generatedAt: new Date().toISOString(),
          analysisEngine: 'GPT-4o-mini',
          feedbackSessionsAnalyzed: feedbackSessions.length,
          averageCallDuration: feedbackSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / feedbackSessions.length,
          fraudDetectionSummary: {
            totalChecks: feedbackSessions.reduce((sum, s) => sum + (s.fraud_detection_results?.length || 0), 0),
            suspiciousCount: feedbackSessions.reduce((sum, s) => sum + (s.fraud_detection_results?.filter((f: any) => f.is_suspicious).length || 0), 0)
          }
        }
      };

      // Save report to database
      const { data: savedReport, error: saveError } = await supabase
        .from('weekly_analysis_reports')
        .insert(reportData)
        .select()
        .single();

      if (saveError) {
        throw new Error(`Failed to save report: ${saveError.message}`);
      }

      console.log(`Successfully generated weekly report for store ${storeData.storeName}`);
      return savedReport;

    } catch (error) {
      console.error(`Error generating report for store ${storeData.storeId}:`, error);
      throw error;
    }
  }

  // Log successful job completion
  private async logJobCompletion(
    stats: WeeklyReportStats,
    weekStart: string,
    weekEnd: string
  ): Promise<void> {
    try {
      await supabase
        .from('job_execution_logs')
        .insert({
          job_type: 'weekly_reports',
          status: 'completed',
          execution_details: {
            reportsGenerated: stats.reportsGenerated,
            storesProcessed: stats.storesProcessed,
            totalFeedbackAnalyzed: stats.totalFeedbackAnalyzed,
            averageQualityScore: stats.averageQualityScore,
            weekRange: { start: weekStart, end: weekEnd },
            errors: stats.errors,
            timing: {
              startTime: stats.startTime,
              endTime: stats.endTime,
              durationMs: stats.duration
            }
          },
          created_at: new Date().toISOString()
        });

      console.log('Weekly reports job completion logged successfully');
    } catch (error) {
      console.error('Failed to log job completion:', error);
    }
  }

  // Log job failure
  private async logJobFailure(error: Error, startTime: string): Promise<void> {
    try {
      await supabase
        .from('job_execution_logs')
        .insert({
          job_type: 'weekly_reports',
          status: 'failed',
          execution_details: {
            error: {
              message: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString()
            },
            timing: {
              startTime,
              failureTime: new Date().toISOString(),
              durationMs: Date.now() - new Date(startTime).getTime()
            }
          },
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Failed to log job failure:', logError);
    }
  }

  // Manual report generation for specific week
  async runManualReports(weekStart?: string): Promise<WeeklyReportStats> {
    console.log('Running manual weekly reports generation');
    
    if (weekStart) {
      // Override the week calculation for manual runs
      const originalMethod = this.getPreviousWeekDates;
      this.getPreviousWeekDates = () => {
        const start = new Date(weekStart);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        
        return {
          weekStart: start.toISOString(),
          weekEnd: end.toISOString()
        };
      };
      
      try {
        const result = await this.runWeeklyReports();
        this.getPreviousWeekDates = originalMethod;
        return result;
      } catch (error) {
        this.getPreviousWeekDates = originalMethod;
        throw error;
      }
    }
    
    return await this.runWeeklyReports();
  }

  // Get job status
  getStatus(): {
    running: boolean;
    nextRun: string | null;
    lastRun: string | null;
  } {
    return {
      running: this.isRunning,
      nextRun: this.cronJob?.nextDate()?.toISOString() || null,
      lastRun: null // Would need to track this separately
    };
  }

  // Stop the cron job
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('Weekly reports cron job stopped');
    }
  }

  // Start the cron job
  start(): void {
    if (this.cronJob) {
      this.cronJob.start();
      console.log('Weekly reports cron job started');
    }
  }

  // Get recent job execution history
  async getJobHistory(limit: number = 10): Promise<any[]> {
    const { data, error } = await supabase
      .from('job_execution_logs')
      .select('*')
      .eq('job_type', 'weekly_reports')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch job history:', error);
      return [];
    }

    return data || [];
  }
}

// Export singleton instance
export const weeklyReportsJob = new WeeklyReportsJob();