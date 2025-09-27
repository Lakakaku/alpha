import { Router, Request, Response } from 'express';
import { requireAdminAuth, AdminRequest } from '../../middleware/admin-auth';
import { exportService } from '../../services/monitoring/export-service';
import { ValidationError } from '../../middleware/errorHandler';
import { loggingService } from '../../services/loggingService';

const router = Router();

interface ExportRequest extends AdminRequest {
  body: {
    data_type: 'system_metrics' | 'fraud_reports' | 'revenue_analytics' | 'business_performance';
    format: 'csv' | 'pdf' | 'json';
    date_range: {
      start_date: string;
      end_date: string;
    };
    filters?: {
      store_ids?: string[];
      service_names?: string[];
    };
  };
}

/**
 * POST /api/monitoring/export
 * Generate and download analytics data in specified format
 */
router.post('/', requireAdminAuth, async (req: ExportRequest, res: Response) => {
  try {
    const {
      data_type,
      format,
      date_range,
      filters
    } = req.body;

    // Validate required fields
    const validationErrors: Array<{ field: string; message: string }> = [];

    if (!data_type) {
      validationErrors.push({
        field: 'data_type',
        message: 'Data type is required'
      });
    } else if (!['system_metrics', 'fraud_reports', 'revenue_analytics', 'business_performance'].includes(data_type)) {
      validationErrors.push({
        field: 'data_type',
        message: 'Invalid data type. Must be system_metrics, fraud_reports, revenue_analytics, or business_performance.'
      });
    }

    if (!format) {
      validationErrors.push({
        field: 'format',
        message: 'Export format is required'
      });
    } else if (!['csv', 'pdf', 'json'].includes(format)) {
      validationErrors.push({
        field: 'format',
        message: 'Invalid format. Must be csv, pdf, or json.'
      });
    }

    if (!date_range) {
      validationErrors.push({
        field: 'date_range',
        message: 'Date range is required'
      });
    } else {
      if (!date_range.start_date) {
        validationErrors.push({
          field: 'date_range.start_date',
          message: 'Start date is required'
        });
      } else {
        const startDate = new Date(date_range.start_date);
        if (isNaN(startDate.getTime())) {
          validationErrors.push({
            field: 'date_range.start_date',
            message: 'Invalid start date format. Use YYYY-MM-DD format.'
          });
        }
      }

      if (!date_range.end_date) {
        validationErrors.push({
          field: 'date_range.end_date',
          message: 'End date is required'
        });
      } else {
        const endDate = new Date(date_range.end_date);
        if (isNaN(endDate.getTime())) {
          validationErrors.push({
            field: 'date_range.end_date',
            message: 'Invalid end date format. Use YYYY-MM-DD format.'
          });
        }
      }

      // Validate date range if both dates are valid
      if (date_range.start_date && date_range.end_date) {
        const startDate = new Date(date_range.start_date);
        const endDate = new Date(date_range.end_date);

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          if (startDate >= endDate) {
            validationErrors.push({
              field: 'date_range',
              message: 'Start date must be before end date'
            });
          }

          // Limit export range to prevent excessive data retrieval
          const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff > 365) {
            validationErrors.push({
              field: 'date_range',
              message: 'Export date range cannot exceed 365 days'
            });
          }
        }
      }
    }

    // Validate filters if provided
    if (filters) {
      if (filters.store_ids && Array.isArray(filters.store_ids)) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const invalidStoreIds = filters.store_ids.filter(id => !uuidRegex.test(id));
        if (invalidStoreIds.length > 0) {
          validationErrors.push({
            field: 'filters.store_ids',
            message: `Invalid store IDs format: ${invalidStoreIds.join(', ')}`
          });
        }
      }

      if (filters.service_names && Array.isArray(filters.service_names)) {
        const validServices = ['backend', 'customer_app', 'business_app', 'admin_app'];
        const invalidServices = filters.service_names.filter(service => !validServices.includes(service));
        if (invalidServices.length > 0) {
          validationErrors.push({
            field: 'filters.service_names',
            message: `Invalid service names: ${invalidServices.join(', ')}`
          });
        }
      }
    }

    if (validationErrors.length > 0) {
      return res.status(422).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Create export using export service
    const result = await exportService.createExport(req.body, req.admin!.id);

    // Log successful export creation
    loggingService.info('Export created', {
      adminId: req.admin?.id,
      adminUsername: req.admin?.username,
      dataType: data_type,
      format,
      dateRange: date_range,
      exportId: result.export_id,
      status: result.status,
    });

    // Return appropriate response based on status
    if (result.status === 'completed') {
      res.status(200).json({
        download_url: result.download_url,
        expires_at: result.expires_at,
        file_size: result.file_size
      });
    } else {
      res.status(202).json({
        export_id: result.export_id,
        status: result.status
      });
    }
  } catch (error) {
    loggingService.error('Error creating export', error as Error, {
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
      message: 'Failed to create export'
    });
  }
});

export default router;