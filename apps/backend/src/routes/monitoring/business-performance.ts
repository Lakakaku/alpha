import { Router, Request, Response } from 'express';
import { requireAdminAuth, AdminRequest } from '../../middleware/admin-auth';
import { analyticsService } from '../../services/monitoring/analytics-service';
import { ValidationError } from '../../middleware/errorHandler';
import { loggingService } from '../../services/loggingService';

const router = Router();

interface BusinessPerformanceQueryRequest extends AdminRequest {
  query: {
    store_id?: string;
    region?: string;
    comparison_period?: 'week' | 'month' | 'quarter';
  };
}

/**
 * GET /api/monitoring/business-performance
 * Get comparative business performance analytics
 */
router.get('/', requireAdminAuth, async (req: BusinessPerformanceQueryRequest, res: Response) => {
  try {
    const {
      store_id,
      region,
      comparison_period = 'month'
    } = req.query;

    // Validate store_id UUID format if provided
    if (store_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(store_id)) {
        return res.status(422).json({
          error: 'Validation failed',
          details: [{
            field: 'store_id',
            message: 'Invalid UUID format for store_id'
          }]
        });
      }
    }

    // Validate comparison_period parameter
    if (comparison_period && !['week', 'month', 'quarter'].includes(comparison_period)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'comparison_period',
          message: 'Invalid comparison_period value. Must be week, month, or quarter.'
        }]
      });
    }

    // Validate region parameter (basic string validation)
    if (region && (typeof region !== 'string' || region.trim().length === 0)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'region',
          message: 'Region must be a non-empty string'
        }]
      });
    }

    // Build query filters for service
    const filters = {
      store_id,
      region: region?.trim(),
      comparison_period
    };

    // Get business performance metrics from analytics service
    const result = await analyticsService.getBusinessPerformanceMetrics(filters);

    // Log successful business performance metrics retrieval
    loggingService.info('Business performance metrics retrieved', {
      adminId: req.admin?.id,
      adminUsername: req.admin?.username,
      filters,
      resultCount: result.metrics.length,
      total: result.total,
      averageSatisfactionScore: result.summary.average_satisfaction_score,
    });

    res.json(result);
  } catch (error) {
    loggingService.error('Error retrieving business performance metrics', error as Error, {
      adminId: req.admin?.id,
      query: req.query,
    });

    if (error instanceof ValidationError) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'general',
          message: error.message
        }]
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve business performance metrics'
    });
  }
});

export default router;