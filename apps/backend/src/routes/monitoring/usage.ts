import { Router, Request, Response } from 'express';
import { requireAdminAuth, AdminRequest } from '../../middleware/admin-auth';
import { monitoringService } from '../../services/monitoring/monitoring-service';
import { ValidationError } from '../../middleware/errorHandler';
import { loggingService } from '../../services/loggingService';

const router = Router();

interface UsageQueryRequest extends AdminRequest {
  query: {
    service?: string;
    start_date?: string;
    end_date?: string;
  };
}

/**
 * GET /api/monitoring/usage
 * Get usage analytics including daily active users and API call volumes
 */
router.get('/', requireAdminAuth, async (req: UsageQueryRequest, res: Response) => {
  try {
    const {
      service,
      start_date,
      end_date
    } = req.query;

    // Validate date parameters if provided
    if (start_date) {
      const startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return res.status(422).json({
          error: 'Validation failed',
          details: [{
            field: 'start_date',
            message: 'Invalid date format. Use YYYY-MM-DD format.'
          }]
        });
      }
    }

    if (end_date) {
      const endDate = new Date(end_date);
      if (isNaN(endDate.getTime())) {
        return res.status(422).json({
          error: 'Validation failed',
          details: [{
            field: 'end_date',
            message: 'Invalid date format. Use YYYY-MM-DD format.'
          }]
        });
      }
    }

    // Validate date range if both dates are provided
    if (start_date && end_date) {
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);

      if (startDate >= endDate) {
        return res.status(422).json({
          error: 'Validation failed',
          details: [{
            field: 'start_date/end_date',
            message: 'Start date must be before end date'
          }]
        });
      }

      // Limit query range to prevent excessive data retrieval
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        return res.status(422).json({
          error: 'Validation failed',
          details: [{
            field: 'start_date/end_date',
            message: 'Date range cannot exceed 365 days'
          }]
        });
      }
    }

    // Build query parameters for service
    const queryParams = {
      service,
      start_date,
      end_date
    };

    // Get usage analytics from monitoring service
    const result = await monitoringService.getUsageAnalytics(queryParams);

    // Log successful usage analytics retrieval
    loggingService.info('Usage analytics retrieved', {
      adminId: req.admin?.id,
      adminUsername: req.admin?.username,
      filters: queryParams,
      resultCount: result.analytics.length,
    });

    res.json(result);
  } catch (error) {
    loggingService.error('Error retrieving usage analytics', error as Error, {
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
      message: 'Failed to retrieve usage analytics'
    });
  }
});

export default router;