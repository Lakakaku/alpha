/**
 * Feedback analysis reports API routes
 * Feature: 008-step-2-6
 * Task: T026
 */

import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AnalysisReportService } from '@vocilia/database/feedback-analysis/analysis-reports';
import { TemporalComparisonService } from '../../services/feedback-analysis/temporal-comparison';
import { authMiddleware } from '../../middleware/auth';
import { storeAccessMiddleware } from '../../middleware/store-access';
import { validateRequest } from '../../middleware/validation';
import { rateLimiterMiddleware } from '../../middleware/rateLimiter';
import type { 
  AnalysisReport, 
  ReportGenerationRequest, 
  ReportGenerationResponse,
  JobStatusResponse 
} from '@vocilia/types/feedback-analysis';

const router = express.Router();

// Input validation schemas
const storeIdSchema = z.object({
  storeId: z.string().uuid('Invalid store ID format')
});

const historicalQuerySchema = z.object({
  weeks: z.coerce.number().min(1).max(52).default(4)
});

const reportGenerationSchema = z.object({
  week_number: z.number().min(1).max(53).optional(),
  year: z.number().min(2020).max(2050).optional(),
  force_regenerate: z.boolean().default(false)
});

const jobIdSchema = z.object({
  jobId: z.string().uuid('Invalid job ID format')
});

/**
 * GET /feedback-analysis/reports/{storeId}/current
 * Get current week analysis report for a store
 */
router.get('/reports/:storeId/current',
  authMiddleware,
  validateRequest({ params: storeIdSchema }),
  storeAccessMiddleware,
  rateLimiterMiddleware({ windowMs: 60000, max: 60 }), // 60 requests per minute
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storeId } = req.params;
      const startTime = Date.now();

      // Get current week report
      const report = await AnalysisReportService.getCurrentWeekReport(storeId);

      if (!report) {
        return res.status(404).json({
          code: 'REPORT_NOT_FOUND',
          message: 'No analysis report available for current week'
        });
      }

      const responseTime = Date.now() - startTime;

      // Add performance metadata to headers
      res.set({
        'X-Response-Time': responseTime.toString(),
        'X-Cache-Status': 'miss', // TODO: Implement caching
        'Content-Type': 'application/json'
      });

      // Ensure response time meets performance target (<2s)
      if (responseTime > 2000) {
        console.warn(`Current report response time exceeded target: ${responseTime}ms for store ${storeId}`);
      }

      res.json(report);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /feedback-analysis/reports/{storeId}/historical
 * Get historical analysis reports for a store
 */
router.get('/reports/:storeId/historical',
  authMiddleware,
  validateRequest({ 
    params: storeIdSchema,
    query: historicalQuerySchema 
  }),
  storeAccessMiddleware,
  rateLimiterMiddleware({ windowMs: 60000, max: 60 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storeId } = req.params;
      const { weeks } = req.query as { weeks: number };
      const startTime = Date.now();

      // Get historical reports
      const reports = await AnalysisReportService.getHistoricalReports(storeId, weeks);

      const responseTime = Date.now() - startTime;

      // Add metadata to headers
      res.set({
        'X-Total-Count': reports.length.toString(),
        'X-Weeks-Requested': weeks.toString(),
        'X-Response-Time': responseTime.toString(),
        'Content-Type': 'application/json'
      });

      // Ensure response time meets performance target (<200ms for DB queries)
      if (responseTime > 200) {
        console.warn(`Historical reports query exceeded target: ${responseTime}ms for store ${storeId}`);
      }

      res.json(reports);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /feedback-analysis/reports/{storeId}/generate
 * Trigger generation of analysis report (async job)
 */
router.post('/reports/:storeId/generate',
  authMiddleware,
  validateRequest({ 
    params: storeIdSchema,
    body: reportGenerationSchema
  }),
  storeAccessMiddleware,
  rateLimiterMiddleware({ windowMs: 300000, max: 10 }), // 10 requests per 5 minutes
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storeId } = req.params;
      const { week_number, year, force_regenerate } = req.body as ReportGenerationRequest;
      const userId = (req as any).user?.id;

      // Default to current week if not specified
      const currentDate = new Date();
      const targetWeek = week_number || getWeekNumber(currentDate);
      const targetYear = year || currentDate.getFullYear();

      // Check if report already exists
      const existingReport = await AnalysisReportService.reportExists(storeId, targetWeek, targetYear);
      
      if (existingReport && !force_regenerate) {
        return res.status(409).json({
          code: 'REPORT_ALREADY_EXISTS',
          message: `Report for week ${targetWeek}/${targetYear} already exists. Use force_regenerate=true to recreate.`
        });
      }

      // Create background job for report generation
      const jobId = await createReportGenerationJob({
        storeId,
        week_number: targetWeek,
        year: targetYear,
        force_regenerate,
        requested_by: userId
      });

      const response: ReportGenerationResponse = {
        job_id: jobId,
        estimated_completion: new Date(Date.now() + 30000).toISOString(), // 30 seconds estimate
      };

      // Return job details
      res.status(202).json({
        job_id: jobId,
        store_id: storeId,
        status: 'queued',
        estimated_completion_ms: 30000,
        status_url: `/feedback-analysis/status/${jobId}`,
        week_number: targetWeek,
        year: targetYear
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /feedback-analysis/status/{jobId}
 * Get status of report generation job
 */
router.get('/status/:jobId',
  authMiddleware,
  validateRequest({ params: jobIdSchema }),
  rateLimiterMiddleware({ windowMs: 60000, max: 120 }), // 120 requests per minute
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      // Get job status from background job system
      const jobStatus = await getJobStatus(jobId);

      if (!jobStatus) {
        return res.status(404).json({
          code: 'JOB_NOT_FOUND',
          message: 'Job ID not found'
        });
      }

      const response: JobStatusResponse = {
        job_id: jobId,
        status: jobStatus.status,
        progress: jobStatus.progress,
        estimated_completion: jobStatus.estimated_completion,
        error_message: jobStatus.error_message
      };

      // Add real-time update headers for polling
      res.set({
        'Cache-Control': 'no-cache',
        'X-Job-Status': jobStatus.status,
        'X-Progress': jobStatus.progress.toString()
      });

      // Include additional details for processing status
      if (jobStatus.status === 'processing') {
        res.json({
          ...response,
          progress_percentage: jobStatus.progress,
          current_step: jobStatus.current_step,
          estimated_completion_ms: jobStatus.estimated_completion_ms
        });
      } else {
        res.json(response);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /feedback-analysis/temporal/{storeId}
 * Get temporal comparison data for trend analysis
 */
router.get('/temporal/:storeId',
  authMiddleware,
  validateRequest({ params: storeIdSchema }),
  storeAccessMiddleware,
  rateLimiterMiddleware({ windowMs: 60000, max: 30 }), // 30 requests per minute
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storeId } = req.params;
      const { weeks_back } = req.query as { weeks_back?: string };
      const startTime = Date.now();

      const weeksBackNumber = weeks_back ? parseInt(weeks_back, 10) : 1;
      
      // Validate weeks_back parameter
      if (weeksBackNumber < 1 || weeksBackNumber > 52) {
        return res.status(400).json({
          code: 'INVALID_WEEKS_BACK',
          message: 'weeks_back must be between 1 and 52'
        });
      }

      // Get temporal comparison data
      const comparisonData = await TemporalComparisonService.getTemporalComparison(storeId, {
        weeks_back: weeksBackNumber,
        include_department_trends: true,
        ai_analysis: true
      });

      const responseTime = Date.now() - startTime;

      // Add performance metadata
      res.set({
        'X-Response-Time': responseTime.toString(),
        'X-Weeks-Back': weeksBackNumber.toString(),
        'X-AI-Analysis': 'enabled'
      });

      res.json(comparisonData);
    } catch (error) {
      next(error);
    }
  }
);

// Utility functions

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date: Date): number {
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstThursdayWeek = new Date(firstThursday.getTime() - (firstThursday.getDay() - 1) * 86400000);
  
  const weekStart = new Date(date.getTime() - (date.getDay() - 1) * 86400000);
  const weekNumber = Math.floor((weekStart.getTime() - firstThursdayWeek.getTime()) / (7 * 86400000)) + 1;
  
  return weekNumber;
}

/**
 * Create background job for report generation
 */
async function createReportGenerationJob(params: {
  storeId: string;
  week_number: number;
  year: number;
  force_regenerate: boolean;
  requested_by?: string;
}): Promise<string> {
  // TODO: Implement actual job queue (e.g., Bull, Agenda, or cloud-based)
  // For now, create a mock job ID and store job details
  
  const jobId = generateUUID();
  const jobData = {
    id: jobId,
    type: 'report_generation',
    status: 'queued',
    progress: 0,
    created_at: new Date().toISOString(),
    ...params
  };

  // Store job in database (mock implementation)
  await storeJobData(jobId, jobData);

  // Trigger background processing (mock implementation)
  setTimeout(() => processReportGeneration(jobId), 1000);

  return jobId;
}

/**
 * Get job status from storage
 */
async function getJobStatus(jobId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  estimated_completion?: string;
  estimated_completion_ms?: number;
  current_step?: string;
  error_message?: string;
} | null> {
  // TODO: Implement actual job status lookup
  // For now, return mock data
  
  const mockStatuses = {
    processing: {
      status: 'processing' as const,
      progress: 65,
      current_step: 'Analyzing sentiment patterns',
      estimated_completion_ms: 15000
    },
    completed: {
      status: 'completed' as const,
      progress: 100
    },
    failed: {
      status: 'failed' as const,
      progress: 30,
      error_message: 'Insufficient feedback data for analysis'
    }
  };

  // Return random status for demo
  const statuses = Object.values(mockStatuses);
  return statuses[Math.floor(Math.random() * statuses.length)];
}

/**
 * Store job data (mock implementation)
 */
async function storeJobData(jobId: string, jobData: any): Promise<void> {
  // TODO: Store in Redis, database, or job queue
  console.log(`Storing job ${jobId}:`, jobData);
}

/**
 * Process report generation in background (mock implementation)
 */
async function processReportGeneration(jobId: string): Promise<void> {
  // TODO: Implement actual report generation logic
  console.log(`Processing report generation job ${jobId}`);
  
  // Mock processing steps:
  // 1. Fetch feedback data
  // 2. Run sentiment analysis
  // 3. Generate insights
  // 4. Create report
  // 5. Store results
}

/**
 * Generate UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Error handling middleware for this router
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Feedback analysis reports API error:', error);

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: error.message
    });
  }

  if (error.message?.includes('not found')) {
    return res.status(404).json({
      code: 'RESOURCE_NOT_FOUND',
      message: error.message
    });
  }

  if (error.message?.includes('permission') || error.message?.includes('access')) {
    return res.status(403).json({
      code: 'ACCESS_DENIED',
      message: error.message
    });
  }

  // Default server error
  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred while processing the request'
  });
});

export { router as feedbackAnalysisReportsRouter };