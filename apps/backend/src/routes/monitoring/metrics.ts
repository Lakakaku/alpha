import { Router, Request, Response } from 'express';
import { requireAdminAuth, AdminRequest } from '../../middleware/admin-auth';
import { monitoringService } from '../../services/monitoring/monitoring-service';
import { ValidationError } from '../../middleware/errorHandler';
import { loggingService } from '../../services/loggingService';

const router = Router();

interface MetricsQueryRequest extends AdminRequest {
  query: {
    service?: 'backend' | 'customer_app' | 'business_app' | 'admin_app';
    metric_type?: 'api_response_time' | 'cpu_usage' | 'memory_usage' | 'error_rate';
    start_time?: string;
    end_time?: string;
    granularity?: 'minute' | 'hour' | 'day';
  };
}

/**
 * GET /api/monitoring/metrics
 * Get system performance metrics with filtering and aggregation
 */
router.get('/', requireAdminAuth, async (req: MetricsQueryRequest, res: Response) => {
  try {
    const {
      service,
      metric_type,
      start_time,
      end_time,
      granularity = 'minute'
    } = req.query;

    // Validate query parameters
    if (service && !['backend', 'customer_app', 'business_app', 'admin_app'].includes(service)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'service',
          message: 'Invalid service name'
        }]
      });
    }

    if (metric_type && !['api_response_time', 'cpu_usage', 'memory_usage', 'error_rate'].includes(metric_type)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'metric_type',
          message: 'Invalid metric type'
        }]
      });
    }

    if (granularity && !['minute', 'hour', 'day'].includes(granularity)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'granularity',
          message: 'Invalid granularity value'
        }]
      });
    }

    // Validate date range
    if (start_time && end_time) {
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(422).json({
          error: 'Validation failed',
          details: [{
            field: 'start_time/end_time',
            message: 'Invalid date format. Use ISO 8601 format.'
          }]
        });
      }

      if (startDate >= endDate) {
        return res.status(422).json({
          error: 'Validation failed',
          details: [{
            field: 'start_time/end_time',
            message: 'Start time must be before end time'
          }]
        });
      }
    }

    // Build query parameters for service
    const queryParams = {
      service: service as any,
      metric_type: metric_type as any,
      start_time,
      end_time,
      granularity
    };

    // Get metrics from monitoring service
    const result = await monitoringService.getMetrics(queryParams);

    // Log successful metrics retrieval
    loggingService.info('System metrics retrieved', {
      adminId: req.admin?.id,
      adminUsername: req.admin?.username,
      filters: queryParams,
      resultCount: result.metrics.length,
    });

    res.json(result);
  } catch (error) {
    loggingService.error('Error retrieving system metrics', error as Error, {
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
      message: 'Failed to retrieve system metrics'
    });
  }
});

export default router;