/**
 * Background job processing for weekly reports
 * Feature: 008-step-2-6 (T034)
 * Created: 2025-09-22
 */

import { z } from 'zod';
import { AnalysisReportService } from '../services/feedback-analysis/analysis-reports';
import { FeedbackInsightService } from '../services/feedback-analysis/feedback-insights';
import { openaiService } from '../config/openai';
import { Database } from '@vocilia/types/database';
import { createClient } from '@supabase/supabase-js';

// Job configuration
export const JOB_CONFIG = {
  CRON_SCHEDULE: '0 2 * * 1', // Every Monday at 2 AM
  BATCH_SIZE: 100,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  PROCESSING_TIMEOUT_MS: 300000, // 5 minutes per store
} as const;

// Job status tracking
export interface JobExecution {
  id: string;
  job_type: 'weekly_report_generation';
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stores_processed: number;
  stores_total: number;
  errors: Array<{
    store_id: string;
    error_message: string;
    retry_count: number;
  }>;
  performance_metrics: {
    avg_processing_time_ms: number;
    total_feedback_processed: number;
    total_insights_generated: number;
  };
}

// Validation schemas
const WeeklyReportJobParams = z.object({
  week_number: z.number().min(1).max(53),
  year: z.number().min(2020).max(2050),
  force_regenerate: z.boolean().optional().default(false),
  store_ids: z.array(z.string().uuid()).optional(),
  business_ids: z.array(z.string().uuid()).optional(),
});

type WeeklyReportJobParams = z.infer<typeof WeeklyReportJobParams>;

export class WeeklyReportJobProcessor {
  private supabase: ReturnType<typeof createClient<Database>>;
  private isProcessing = false;
  private currentJobId: string | null = null;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Start weekly report generation job
   */
  async startWeeklyReportGeneration(params: WeeklyReportJobParams): Promise<string> {
    if (this.isProcessing) {
      throw new Error('Weekly report generation job is already running');
    }

    const validatedParams = WeeklyReportJobParams.parse(params);
    
    // Create job execution record
    const jobExecution: Omit<JobExecution, 'id'> = {
      job_type: 'weekly_report_generation',
      started_at: new Date().toISOString(),
      status: 'running',
      stores_processed: 0,
      stores_total: 0,
      errors: [],
      performance_metrics: {
        avg_processing_time_ms: 0,
        total_feedback_processed: 0,
        total_insights_generated: 0,
      },
    };

    const { data: job, error } = await this.supabase
      .from('job_executions')
      .insert(jobExecution)
      .select()
      .single();

    if (error || !job) {
      throw new Error(`Failed to create job execution: ${error?.message}`);
    }

    this.currentJobId = job.id;
    this.isProcessing = true;

    // Start processing in background
    this.processWeeklyReports(validatedParams, job.id)
      .catch(error => {
        console.error('Weekly report generation failed:', error);
        this.updateJobStatus(job.id, 'failed');
      })
      .finally(() => {
        this.isProcessing = false;
        this.currentJobId = null;
      });

    return job.id;
  }

  /**
   * Process weekly reports for all eligible stores
   */
  private async processWeeklyReports(params: WeeklyReportJobParams, jobId: string): Promise<void> {
    const startTime = Date.now();
    let totalStoresProcessed = 0;
    let totalFeedbackProcessed = 0;
    let totalInsightsGenerated = 0;
    const processingTimes: number[] = [];
    const errors: JobExecution['errors'] = [];

    try {
      // Get list of stores to process
      const storesToProcess = await this.getStoresToProcess(params);
      
      await this.updateJobProgress(jobId, {
        stores_total: storesToProcess.length,
      });

      console.log(`Processing weekly reports for ${storesToProcess.length} stores`);

      // Process stores in batches
      for (let i = 0; i < storesToProcess.length; i += JOB_CONFIG.BATCH_SIZE) {
        const batch = storesToProcess.slice(i, i + JOB_CONFIG.BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(async (store) => {
            const storeStartTime = Date.now();
            let retryCount = 0;

            while (retryCount < JOB_CONFIG.MAX_RETRIES) {
              try {
                const result = await this.processStoreReport(store, params);
                
                totalFeedbackProcessed += result.feedbackProcessed;
                totalInsightsGenerated += result.insightsGenerated;
                processingTimes.push(Date.now() - storeStartTime);
                totalStoresProcessed++;
                
                break; // Success, exit retry loop
                
              } catch (error) {
                retryCount++;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                
                if (retryCount >= JOB_CONFIG.MAX_RETRIES) {
                  errors.push({
                    store_id: store.id,
                    error_message: errorMessage,
                    retry_count: retryCount,
                  });
                  console.error(`Failed to process store ${store.id} after ${retryCount} retries:`, errorMessage);
                } else {
                  console.warn(`Retry ${retryCount}/${JOB_CONFIG.MAX_RETRIES} for store ${store.id}:`, errorMessage);
                  await new Promise(resolve => setTimeout(resolve, JOB_CONFIG.RETRY_DELAY_MS * retryCount));
                }
              }
            }
          })
        );

        // Update progress
        await this.updateJobProgress(jobId, {
          stores_processed: totalStoresProcessed,
          errors,
          performance_metrics: {
            avg_processing_time_ms: processingTimes.length > 0 
              ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
              : 0,
            total_feedback_processed: totalFeedbackProcessed,
            total_insights_generated: totalInsightsGenerated,
          },
        });

        console.log(`Processed batch ${Math.floor(i / JOB_CONFIG.BATCH_SIZE) + 1}, total stores: ${totalStoresProcessed}`);
      }

      // Mark job as completed
      await this.updateJobStatus(jobId, 'completed');
      
      const totalTime = Date.now() - startTime;
      console.log(`Weekly report generation completed in ${totalTime}ms. Processed ${totalStoresProcessed} stores.`);

    } catch (error) {
      console.error('Weekly report generation job failed:', error);
      await this.updateJobStatus(jobId, 'failed');
      throw error;
    }
  }

  /**
   * Get list of stores that need weekly report processing
   */
  private async getStoresToProcess(params: WeeklyReportJobParams): Promise<Array<{
    id: string;
    business_id: string;
    name: string;
  }>> {
    let query = this.supabase
      .from('stores')
      .select('id, business_id, name')
      .eq('is_active', true);

    // Filter by specific store IDs if provided
    if (params.store_ids && params.store_ids.length > 0) {
      query = query.in('id', params.store_ids);
    }

    // Filter by business IDs if provided
    if (params.business_ids && params.business_ids.length > 0) {
      query = query.in('business_id', params.business_ids);
    }

    const { data: stores, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch stores: ${error.message}`);
    }

    // Filter out stores that already have reports for this week (unless force regenerate)
    if (!params.force_regenerate) {
      const filteredStores = [];
      
      for (const store of stores || []) {
        const { data: existingReport } = await this.supabase
          .from('analysis_reports')
          .select('id')
          .eq('store_id', store.id)
          .eq('week_number', params.week_number)
          .eq('year', params.year)
          .limit(1)
          .single();

        if (!existingReport) {
          filteredStores.push(store);
        }
      }

      return filteredStores;
    }

    return stores || [];
  }

  /**
   * Process weekly report for a single store
   */
  private async processStoreReport(
    store: { id: string; business_id: string; name: string },
    params: WeeklyReportJobParams
  ): Promise<{
    feedbackProcessed: number;
    insightsGenerated: number;
  }> {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Store processing timeout')), JOB_CONFIG.PROCESSING_TIMEOUT_MS)
    );

    const processing = this.processStoreReportCore(store, params);
    
    return Promise.race([processing, timeout]);
  }

  /**
   * Core processing logic for a single store report
   */
  private async processStoreReportCore(
    store: { id: string; business_id: string; name: string },
    params: WeeklyReportJobParams
  ): Promise<{
    feedbackProcessed: number;
    insightsGenerated: number;
  }> {
    // Calculate week date range
    const { startDate, endDate } = this.getWeekDateRange(params.week_number, params.year);

    // Fetch feedback for the week
    const { data: feedback, error: feedbackError } = await this.supabase
      .from('feedback')
      .select(`
        id, content, created_at, sentiment, department_tags, priority_score,
        ai_summary, user_id, session_id
      `)
      .eq('store_id', store.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (feedbackError) {
      throw new Error(`Failed to fetch feedback for store ${store.id}: ${feedbackError.message}`);
    }

    if (!feedback || feedback.length === 0) {
      console.log(`No feedback found for store ${store.id} in week ${params.week_number}/${params.year}`);
      return { feedbackProcessed: 0, insightsGenerated: 0 };
    }

    // Generate weekly report using AI
    const reportData = await openaiService.generateWeeklyReport(
      feedback.map(f => ({
        content: f.content,
        sentiment: f.sentiment || 'neutral',
        department_tags: f.department_tags || [],
      }))
    );

    // Create or update analysis report
    const reportRecord = {
      store_id: store.id,
      business_id: store.business_id,
      week_number: params.week_number,
      year: params.year,
      total_feedback_count: feedback.length,
      positive_summary: reportData.positive_summary,
      negative_summary: reportData.negative_summary,
      general_opinions: reportData.general_opinions,
      new_critiques: reportData.new_critiques,
      actionable_insights: reportData.actionable_insights.map(insight => insight.title),
      ai_generated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (params.force_regenerate) {
      // Update existing report
      const { error: updateError } = await this.supabase
        .from('analysis_reports')
        .update({
          ...reportRecord,
          created_at: undefined, // Don't update created_at on regenerate
        })
        .eq('store_id', store.id)
        .eq('week_number', params.week_number)
        .eq('year', params.year);

      if (updateError) {
        throw new Error(`Failed to update analysis report: ${updateError.message}`);
      }
    } else {
      // Create new report
      const { error: insertError } = await this.supabase
        .from('analysis_reports')
        .insert(reportRecord);

      if (insertError) {
        throw new Error(`Failed to create analysis report: ${insertError.message}`);
      }
    }

    // Generate and store actionable insights
    let insightsGenerated = 0;
    for (const insight of reportData.actionable_insights) {
      try {
        await FeedbackInsightService.createInsight({
          store_id: store.id,
          business_id: store.business_id,
          title: insight.title,
          description: insight.description,
          priority: insight.priority,
          department: insight.department,
          suggested_actions: insight.suggested_actions,
          source_week: params.week_number,
          source_year: params.year,
          status: 'pending',
        });
        insightsGenerated++;
      } catch (error) {
        console.warn(`Failed to create insight for store ${store.id}:`, error);
      }
    }

    console.log(`Generated report for store ${store.name}: ${feedback.length} feedback, ${insightsGenerated} insights`);

    return {
      feedbackProcessed: feedback.length,
      insightsGenerated,
    };
  }

  /**
   * Get date range for a specific week number and year
   */
  private getWeekDateRange(weekNumber: number, year: number): {
    startDate: Date;
    endDate: Date;
  } {
    // Week 1 is the first week of January that contains at least 4 days
    const jan4 = new Date(year, 0, 4);
    const jan4DayOfWeek = jan4.getDay() || 7; // Sunday = 7, Monday = 1
    
    // Find the Monday of week 1
    const week1Monday = new Date(jan4.getTime() - (jan4DayOfWeek - 1) * 24 * 60 * 60 * 1000);
    
    // Calculate the Monday of the target week
    const targetMonday = new Date(week1Monday.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
    
    // Week ends on Sunday
    const targetSunday = new Date(targetMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
    targetSunday.setHours(23, 59, 59, 999);

    return {
      startDate: targetMonday,
      endDate: targetSunday,
    };
  }

  /**
   * Update job execution progress
   */
  private async updateJobProgress(jobId: string, updates: Partial<JobExecution>): Promise<void> {
    const { error } = await this.supabase
      .from('job_executions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.error(`Failed to update job progress: ${error.message}`);
    }
  }

  /**
   * Update job execution status
   */
  private async updateJobStatus(jobId: string, status: JobExecution['status']): Promise<void> {
    const updates: Partial<JobExecution> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('job_executions')
      .update(updates)
      .eq('id', jobId);

    if (error) {
      console.error(`Failed to update job status: ${error.message}`);
    }
  }

  /**
   * Get current job status
   */
  async getJobStatus(jobId: string): Promise<JobExecution | null> {
    const { data, error } = await this.supabase
      .from('job_executions')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as JobExecution;
  }

  /**
   * Cancel running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (this.currentJobId === jobId && this.isProcessing) {
      await this.updateJobStatus(jobId, 'cancelled');
      this.isProcessing = false;
      this.currentJobId = null;
      return true;
    }

    return false;
  }

  /**
   * Get job execution history
   */
  async getJobHistory(limit: number = 50): Promise<JobExecution[]> {
    const { data, error } = await this.supabase
      .from('job_executions')
      .select('*')
      .eq('job_type', 'weekly_report_generation')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch job history: ${error.message}`);
    }

    return (data as JobExecution[]) || [];
  }
}

// Singleton instance
export const weeklyReportJobProcessor = new WeeklyReportJobProcessor();

// Utility functions for manual job triggering
export async function triggerWeeklyReportGeneration(params: {
  week_number?: number;
  year?: number;
  force_regenerate?: boolean;
  store_ids?: string[];
  business_ids?: string[];
}): Promise<string> {
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentYear = now.getFullYear();

  const jobParams: WeeklyReportJobParams = {
    week_number: params.week_number || currentWeek,
    year: params.year || currentYear,
    force_regenerate: params.force_regenerate || false,
    store_ids: params.store_ids,
    business_ids: params.business_ids,
  };

  return weeklyReportJobProcessor.startWeeklyReportGeneration(jobParams);
}

// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Express route handler for manual job triggering (for testing/admin use)
export function createWeeklyReportJobRoutes() {
  const express = require('express');
  const router = express.Router();

  router.post('/trigger', async (req, res) => {
    try {
      const jobId = await triggerWeeklyReportGeneration(req.body);
      res.json({ job_id: jobId, status: 'started' });
    } catch (error) {
      res.status(500).json({
        code: 'JOB_START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start job',
      });
    }
  });

  router.get('/status/:jobId', async (req, res) => {
    try {
      const status = await weeklyReportJobProcessor.getJobStatus(req.params.jobId);
      if (!status) {
        return res.status(404).json({
          code: 'JOB_NOT_FOUND',
          message: 'Job not found',
        });
      }
      res.json(status);
    } catch (error) {
      res.status(500).json({
        code: 'STATUS_FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch status',
      });
    }
  });

  router.post('/cancel/:jobId', async (req, res) => {
    try {
      const cancelled = await weeklyReportJobProcessor.cancelJob(req.params.jobId);
      res.json({ cancelled });
    } catch (error) {
      res.status(500).json({
        code: 'CANCEL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to cancel job',
      });
    }
  });

  router.get('/history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await weeklyReportJobProcessor.getJobHistory(limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({
        code: 'HISTORY_FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch history',
      });
    }
  });

  return router;
}