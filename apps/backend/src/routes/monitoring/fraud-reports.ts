import { Router, Request, Response } from 'express';
import { requireAdminAuth, AdminRequest } from '../../middleware/admin-auth';
import { analyticsService } from '../../services/monitoring/analytics-service';
import { ValidationError } from '../../middleware/errorHandler';
import { loggingService } from '../../services/loggingService';

const router = Router();

interface FraudReportsQueryRequest extends AdminRequest {
  query: {
    store_id?: string;
    start_date?: string;
    end_date?: string;
  };
}

/**
 * GET /api/monitoring/fraud-reports
 * Get fraud detection reports with filtering by store and time period
 */
router.get('/', requireAdminAuth, async (req: FraudReportsQueryRequest, res: Response) => {
  try {
    const {
      store_id,
      start_date,
      end_date
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

    // Build query filters for service
    const filters = {
      store_id,
      start_date,
      end_date
    };

    // Get fraud detection reports from analytics service
    const result = await analyticsService.getFraudDetectionReports(filters);

    // Log successful fraud reports retrieval
    loggingService.info('Fraud detection reports retrieved', {
      adminId: req.admin?.id,
      adminUsername: req.admin?.username,
      filters,
      resultCount: result.reports.length,
      total: result.total,
    });

    res.json(result);
  } catch (error) {
    loggingService.error('Error retrieving fraud detection reports', error as Error, {
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
      message: 'Failed to retrieve fraud detection reports'
    });
  }
});

export default router;