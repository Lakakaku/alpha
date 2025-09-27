import { Router, Request, Response } from 'express';
import { requireAdminAuth, AdminRequest } from '../../middleware/admin-auth';
import { monitoringService } from '../../services/monitoring/monitoring-service';
import { ValidationError } from '../../middleware/errorHandler';
import { loggingService } from '../../services/loggingService';

const router = Router();

interface ErrorLogQueryRequest extends AdminRequest {
  query: {
    severity?: 'critical' | 'warning' | 'info';
    service?: string;
    search?: string;
    status?: 'open' | 'investigating' | 'resolved';
    limit?: string;
    offset?: string;
  };
}

interface UpdateErrorStatusRequest extends AdminRequest {
  body: {
    error_id: string;
    resolution_status: 'open' | 'investigating' | 'resolved';
  };
}

/**
 * GET /api/monitoring/errors
 * Get application error logs with filtering and search
 */
router.get('/', requireAdminAuth, async (req: ErrorLogQueryRequest, res: Response) => {
  try {
    const {
      severity,
      service,
      search,
      status,
      limit = '50',
      offset = '0'
    } = req.query;

    // Validate query parameters
    if (severity && !['critical', 'warning', 'info'].includes(severity)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'severity',
          message: 'Invalid severity level'
        }]
      });
    }

    if (status && !['open', 'investigating', 'resolved'].includes(status)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'status',
          message: 'Invalid status value'
        }]
      });
    }

    // Validate pagination parameters
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'limit',
          message: 'Limit must be between 1 and 100'
        }]
      });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'offset',
          message: 'Offset must be non-negative'
        }]
      });
    }

    // Build query parameters for service
    const queryParams = {
      severity,
      service,
      search,
      status,
      limit: limitNum,
      offset: offsetNum
    };

    // Get error logs from monitoring service
    const result = await monitoringService.getErrorLogs(queryParams);

    // Log successful error logs retrieval
    loggingService.info('Error logs retrieved', {
      adminId: req.admin?.id,
      adminUsername: req.admin?.username,
      filters: queryParams,
      resultCount: result.errors.length,
      total: result.pagination.total,
    });

    res.json(result);
  } catch (error) {
    loggingService.error('Error retrieving error logs', error as Error, {
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
      message: 'Failed to retrieve error logs'
    });
  }
});

/**
 * PATCH /api/monitoring/errors
 * Update error resolution status
 */
router.patch('/', requireAdminAuth, async (req: UpdateErrorStatusRequest, res: Response) => {
  try {
    const { error_id, resolution_status } = req.body;

    // Validate request body
    if (!error_id) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'error_id',
          message: 'Error ID is required'
        }]
      });
    }

    if (!resolution_status) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'resolution_status',
          message: 'Resolution status is required'
        }]
      });
    }

    if (!['open', 'investigating', 'resolved'].includes(resolution_status)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'resolution_status',
          message: 'Invalid resolution status'
        }]
      });
    }

    // Validate UUID format for error_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(error_id)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'error_id',
          message: 'Invalid UUID format'
        }]
      });
    }

    try {
      // Update error status using monitoring service
      await monitoringService.updateErrorStatus(error_id, resolution_status);

      // Log successful error status update
      loggingService.info('Error status updated', {
        adminId: req.admin?.id,
        adminUsername: req.admin?.username,
        errorId: error_id,
        newStatus: resolution_status,
      });

      res.json({
        success: true,
        message: 'Error status updated successfully'
      });
    } catch (serviceError: any) {
      if (serviceError.message && serviceError.message.includes('not found')) {
        return res.status(404).json({
          error: 'Error log not found',
          message: 'The specified error log could not be found'
        });
      }
      throw serviceError;
    }
  } catch (error) {
    loggingService.error('Error updating error status', error as Error, {
      adminId: req.admin?.id,
      body: req.body,
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
      message: 'Failed to update error status'
    });
  }
});

export default router;