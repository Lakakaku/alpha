/**
 * Feedback Analysis Insights API Routes
 * Feature: 008-step-2-6
 * 
 * Provides insights management capabilities including status updates,
 * actionable insights retrieval, and bulk operations.
 */

import express from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { FeedbackInsightService } from '@vocilia/database/feedback-analysis/feedback-insights';
import type { FeedbackInsight, InsightStatusUpdate, InsightStatus, InsightPriority } from '@vocilia/types/feedback-analysis';

const router = express.Router();

// Rate limiting for insights endpoints
const insightsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // More permissive for management operations
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'För många förfrågningar. Försök igen om en minut.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const storeIdSchema = z.string().uuid('Ogiltigt store ID format');
const insightIdSchema = z.string().uuid('Ogiltigt insight ID format');

const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'dismissed'], {
    errorMap: () => ({ message: 'Status måste vara pending, in_progress, completed eller dismissed' })
  }),
  notes: z.string()
    .max(1000, 'Anteckningar kan inte vara längre än 1000 tecken')
    .optional(),
  assigned_to: z.string()
    .max(255, 'Tilldelad till kan inte vara längre än 255 tecken')
    .optional(),
  due_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Förfallodatum måste vara i format YYYY-MM-DD')
    .optional()
    .refine((date) => {
      if (!date) return true;
      const dueDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return dueDate >= today;
    }, 'Förfallodatum kan inte vara i det förflutna'),
});

const bulkStatusUpdateSchema = z.object({
  insight_ids: z.array(z.string().uuid())
    .min(1, 'Minst en insight måste anges')
    .max(50, 'Maximalt 50 insights kan uppdateras samtidigt'),
  status_update: statusUpdateSchema,
});

const insightsQuerySchema = z.object({
  limit: z.coerce.number()
    .int('Limit måste vara ett heltal')
    .min(1, 'Limit måste vara minst 1')
    .max(100, 'Limit kan inte vara större än 100')
    .default(20),
  offset: z.coerce.number()
    .int('Offset måste vara ett heltal')
    .min(0, 'Offset kan inte vara negativt')
    .default(0),
  status: z.enum(['pending', 'in_progress', 'completed', 'dismissed', 'all'])
    .default('all'),
  priority: z.enum(['low', 'medium', 'high', 'critical', 'all'])
    .default('all'),
  department: z.string()
    .max(100, 'Avdelning kan inte vara längre än 100 tecken')
    .optional(),
  assigned_to: z.string()
    .max(255, 'Tilldelad till kan inte vara längre än 255 tecken')
    .optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'priority', 'due_date'])
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc'])
    .default('desc'),
});

/**
 * GET /feedback-analysis/insights/{storeId}
 * 
 * Get actionable insights for a store with filtering and pagination
 */
router.get('/insights/:storeId', insightsRateLimit, async (req, res) => {
  const startTime = Date.now();

  try {
    // Validate store ID
    const storeIdResult = storeIdSchema.safeParse(req.params.storeId);
    if (!storeIdResult.success) {
      return res.status(400).json({
        code: 'INVALID_STORE_ID',
        message: storeIdResult.error.errors[0]?.message || 'Ogiltigt store ID',
      });
    }

    const storeId = storeIdResult.data;

    // Validate query parameters
    const queryResult = insightsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: queryResult.error.errors[0]?.message || 'Ogiltiga parametrar',
        details: queryResult.error.errors,
      });
    }

    const queryParams = queryResult.data;

    // Check authentication
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Autentisering krävs',
      });
    }

    // TODO: Validate store belongs to business (will be implemented with store access middleware)

    // Get insights with filtering
    const insights = await FeedbackInsightService.getActionableInsights(
      storeId,
      queryParams.limit,
      {
        offset: queryParams.offset,
        status: queryParams.status === 'all' ? undefined : queryParams.status as InsightStatus,
        priority: queryParams.priority === 'all' ? undefined : queryParams.priority as InsightPriority,
        department: queryParams.department,
        assigned_to: queryParams.assigned_to,
        sort_by: queryParams.sort_by,
        sort_order: queryParams.sort_order,
      }
    );

    // Get total count for pagination
    const totalCount = await FeedbackInsightService.getInsightsCount(storeId, {
      status: queryParams.status === 'all' ? undefined : queryParams.status as InsightStatus,
      priority: queryParams.priority === 'all' ? undefined : queryParams.priority as InsightPriority,
      department: queryParams.department,
      assigned_to: queryParams.assigned_to,
    });

    const duration = Date.now() - startTime;

    // Add performance and pagination headers
    res.set({
      'X-Response-Time': duration.toString(),
      'X-Total-Count': totalCount.toString(),
      'X-Limit': queryParams.limit.toString(),
      'X-Offset': queryParams.offset.toString(),
      'X-Has-More': (queryParams.offset + queryParams.limit < totalCount).toString(),
    });

    return res.status(200).json({
      insights,
      pagination: {
        total_count: totalCount,
        limit: queryParams.limit,
        offset: queryParams.offset,
        has_more: queryParams.offset + queryParams.limit < totalCount,
      },
      filters: {
        status: queryParams.status,
        priority: queryParams.priority,
        department: queryParams.department,
        assigned_to: queryParams.assigned_to,
      },
      sort: {
        by: queryParams.sort_by,
        order: queryParams.sort_order,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Insights retrieval error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId: req.params.storeId,
      duration,
    });

    if (error instanceof Error) {
      if (error.message.includes('Store not found')) {
        return res.status(404).json({
          code: 'STORE_NOT_FOUND',
          message: 'Butik hittades inte',
        });
      }

      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          code: 'STORE_ACCESS_DENIED',
          message: 'Åtkomst till butik nekad',
        });
      }
    }

    return res.status(500).json({
      code: 'INSIGHTS_RETRIEVAL_ERROR',
      message: 'Ett fel uppstod vid hämtning av insights',
    });
  }
});

/**
 * GET /feedback-analysis/insights/{storeId}/summary
 * 
 * Get insights summary with counts by status and priority
 */
router.get('/insights/:storeId/summary', insightsRateLimit, async (req, res) => {
  try {
    // Validate store ID
    const storeIdResult = storeIdSchema.safeParse(req.params.storeId);
    if (!storeIdResult.success) {
      return res.status(400).json({
        code: 'INVALID_STORE_ID',
        message: storeIdResult.error.errors[0]?.message || 'Ogiltigt store ID',
      });
    }

    const storeId = storeIdResult.data;

    // Check authentication
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Autentisering krävs',
      });
    }

    const summary = await FeedbackInsightService.getInsightsSummary(storeId);

    return res.status(200).json(summary);

  } catch (error) {
    console.error('Insights summary error:', error);
    return res.status(500).json({
      code: 'INSIGHTS_SUMMARY_ERROR',
      message: 'Ett fel uppstod vid hämtning av insights-sammanfattning',
    });
  }
});

/**
 * PATCH /feedback-analysis/insights/{insightId}/status
 * 
 * Update status of a specific insight
 */
router.patch('/insights/:insightId/status', insightsRateLimit, async (req, res) => {
  const startTime = Date.now();

  try {
    // Validate insight ID
    const insightIdResult = insightIdSchema.safeParse(req.params.insightId);
    if (!insightIdResult.success) {
      return res.status(400).json({
        code: 'INVALID_INSIGHT_ID',
        message: insightIdResult.error.errors[0]?.message || 'Ogiltigt insight ID',
      });
    }

    const insightId = insightIdResult.data;

    // Validate status update
    const statusUpdateResult = statusUpdateSchema.safeParse(req.body);
    if (!statusUpdateResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: statusUpdateResult.error.errors[0]?.message || 'Ogiltiga statusuppdateringsparametrar',
        details: statusUpdateResult.error.errors,
      });
    }

    const statusUpdate = statusUpdateResult.data;

    // Check authentication
    const userId = req.user?.id;
    const businessId = req.user?.businessId;
    if (!userId || !businessId) {
      return res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Autentisering krävs',
      });
    }

    // Update insight status
    const updatedInsight = await FeedbackInsightService.updateStatus(
      insightId,
      statusUpdate,
      userId
    );

    const duration = Date.now() - startTime;

    // Add performance headers
    res.set({
      'X-Response-Time': duration.toString(),
      'X-Updated-By': userId,
    });

    return res.status(200).json({
      insight: updatedInsight,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Insight status update error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      insightId: req.params.insightId,
      duration,
    });

    if (error instanceof Error) {
      if (error.message.includes('Insight not found')) {
        return res.status(404).json({
          code: 'INSIGHT_NOT_FOUND',
          message: 'Insight hittades inte',
        });
      }

      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          code: 'INSIGHT_ACCESS_DENIED',
          message: 'Åtkomst till insight nekad',
        });
      }

      if (error.message.includes('Invalid status transition')) {
        return res.status(400).json({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'Ogiltig statusövergång',
        });
      }
    }

    return res.status(500).json({
      code: 'STATUS_UPDATE_ERROR',
      message: 'Ett fel uppstod vid uppdatering av insight-status',
    });
  }
});

/**
 * PATCH /feedback-analysis/insights/bulk/status
 * 
 * Bulk update status for multiple insights
 */
router.patch('/insights/bulk/status', insightsRateLimit, async (req, res) => {
  const startTime = Date.now();

  try {
    // Validate bulk update request
    const bulkUpdateResult = bulkStatusUpdateSchema.safeParse(req.body);
    if (!bulkUpdateResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: bulkUpdateResult.error.errors[0]?.message || 'Ogiltiga bulk-uppdateringsparametrar',
        details: bulkUpdateResult.error.errors,
      });
    }

    const { insight_ids, status_update } = bulkUpdateResult.data;

    // Check authentication
    const userId = req.user?.id;
    const businessId = req.user?.businessId;
    if (!userId || !businessId) {
      return res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Autentisering krävs',
      });
    }

    // Perform bulk update
    const result = await FeedbackInsightService.bulkUpdateStatus(
      insight_ids,
      status_update,
      userId
    );

    const duration = Date.now() - startTime;

    // Add performance headers
    res.set({
      'X-Response-Time': duration.toString(),
      'X-Updated-By': userId,
      'X-Total-Insights': insight_ids.length.toString(),
      'X-Updated-Count': result.updated_count.toString(),
      'X-Failed-Count': result.failed_count.toString(),
    });

    return res.status(200).json({
      updated_count: result.updated_count,
      failed_count: result.failed_count,
      failed_insights: result.failed_insights,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Bulk insight status update error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      insightCount: req.body?.insight_ids?.length || 0,
      duration,
    });

    return res.status(500).json({
      code: 'BULK_STATUS_UPDATE_ERROR',
      message: 'Ett fel uppstod vid bulk-uppdatering av insight-status',
    });
  }
});

/**
 * GET /feedback-analysis/insights/{insightId}/history
 * 
 * Get status change history for a specific insight
 */
router.get('/insights/:insightId/history', insightsRateLimit, async (req, res) => {
  try {
    // Validate insight ID
    const insightIdResult = insightIdSchema.safeParse(req.params.insightId);
    if (!insightIdResult.success) {
      return res.status(400).json({
        code: 'INVALID_INSIGHT_ID',
        message: insightIdResult.error.errors[0]?.message || 'Ogiltigt insight ID',
      });
    }

    const insightId = insightIdResult.data;

    // Check authentication
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Autentisering krävs',
      });
    }

    const history = await FeedbackInsightService.getStatusHistory(insightId);

    return res.status(200).json({
      insight_id: insightId,
      history,
      total_changes: history.length,
    });

  } catch (error) {
    console.error('Insight history error:', error);

    if (error instanceof Error && error.message.includes('Insight not found')) {
      return res.status(404).json({
        code: 'INSIGHT_NOT_FOUND',
        message: 'Insight hittades inte',
      });
    }

    return res.status(500).json({
      code: 'INSIGHT_HISTORY_ERROR',
      message: 'Ett fel uppstod vid hämtning av insight-historik',
    });
  }
});

export default router;