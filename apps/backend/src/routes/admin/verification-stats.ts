import { Router } from 'express';
import { QRDatabase } from '../../config/qr-database';
import { adminRateLimit } from '../../middleware/qr-rate-limiter';
import { validateStoreId } from '../../middleware/qr-auth.middleware';
import { securityHeaders, corsHeaders, cacheHeaders } from '../../middleware/security-headers';
import type { VerificationStatsResponse, VerificationDetailsResponse } from '@vocilia/types';

const router = Router();
const db = new QRDatabase();

// Apply security middleware to all admin routes
router.use(securityHeaders());
router.use(corsHeaders());
router.use(cacheHeaders());
router.use(adminRateLimit);

// GET /api/v1/admin/verification/stats/:storeId
router.get('/stats/:storeId', validateStoreId(), async (req, res) => {
  try {
    const { storeId } = req.params;
    const { period = '7d' } = req.query;

    // Parse period parameter
    let days: number;
    switch (period) {
      case '1d':
        days = 1;
        break;
      case '7d':
        days = 7;
        break;
      case '30d':
        days = 30;
        break;
      case '90d':
        days = 90;
        break;
      default:
        return res.status(400).json({
          error: {
            code: 'INVALID_PERIOD',
            message: 'Period must be one of: 1d, 7d, 30d, 90d'
          }
        });
    }

    // Get verification statistics
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await db.getVerificationStats(storeId, startDate, endDate);

    const response: VerificationStatsResponse = {
      success: true,
      store_id: storeId,
      period: {
        days,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      },
      statistics: {
        total_sessions: stats.total_sessions,
        completed_verifications: stats.completed_verifications,
        success_rate: stats.success_rate,
        fraud_detections: stats.fraud_detections,
        average_completion_time_seconds: stats.average_completion_time_seconds,
        most_common_failure_reasons: stats.most_common_failure_reasons,
        hourly_distribution: stats.hourly_distribution,
        daily_trend: stats.daily_trend
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting verification stats:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve verification statistics'
      }
    });
  }
});

// GET /api/v1/admin/verification/details/:storeId
router.get('/details/:storeId', validateStoreId(), async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      limit = '50',
      offset = '0',
      status,
      start_date,
      end_date
    } = req.query;

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be between 1 and 100'
        }
      });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_OFFSET',
          message: 'Offset must be a non-negative number'
        }
      });
    }

    // Parse date filters
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (start_date) {
      startDate = new Date(start_date as string);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          error: {
            code: 'INVALID_START_DATE',
            message: 'Start date must be a valid ISO 8601 date'
          }
        });
      }
    }

    if (end_date) {
      endDate = new Date(end_date as string);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: {
            code: 'INVALID_END_DATE',
            message: 'End date must be a valid ISO 8601 date'
          }
        });
      }
    }

    // Validate status filter
    if (status && !['pending', 'completed', 'expired', 'failed'].includes(status as string)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_STATUS',
          message: 'Status must be one of: pending, completed, expired, failed'
        }
      });
    }

    const details = await db.getVerificationDetails(
      storeId,
      limitNum,
      offsetNum,
      status as string | undefined,
      startDate,
      endDate
    );

    const response: VerificationDetailsResponse = {
      success: true,
      store_id: storeId,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: details.total,
        has_more: (offsetNum + limitNum) < details.total
      },
      filters: {
        status: status as string | undefined,
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString()
      },
      verifications: details.verifications.map(v => ({
        verification_id: v.verification_id,
        session_token: v.session_token,
        phone_number: v.phone_number,
        transaction_amount: v.transaction_amount,
        transaction_time: v.transaction_time,
        status: v.status,
        validation_results: v.validation_results,
        created_at: v.created_at,
        completed_at: v.completed_at,
        ip_address: v.ip_address,
        user_agent: v.user_agent,
        fraud_score: v.fraud_score
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting verification details:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve verification details'
      }
    });
  }
});

// GET /api/v1/admin/verification/export/:storeId
router.get('/export/:storeId', validateStoreId(), async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      format = 'csv',
      start_date,
      end_date,
      status
    } = req.query;

    if (format !== 'csv' && format !== 'json') {
      return res.status(400).json({
        error: {
          code: 'INVALID_FORMAT',
          message: 'Format must be either csv or json'
        }
      });
    }

    // Parse date filters
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (start_date) {
      startDate = new Date(start_date as string);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          error: {
            code: 'INVALID_START_DATE',
            message: 'Start date must be a valid ISO 8601 date'
          }
        });
      }
    }

    if (end_date) {
      endDate = new Date(end_date as string);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: {
            code: 'INVALID_END_DATE',
            message: 'End date must be a valid ISO 8601 date'
          }
        });
      }
    }

    // Get all verification data for export
    const exportData = await db.getVerificationExport(
      storeId,
      status as string | undefined,
      startDate,
      endDate
    );

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'verification_id',
        'session_token',
        'phone_number',
        'transaction_amount',
        'transaction_time',
        'status',
        'time_valid',
        'amount_valid',
        'phone_valid',
        'overall_valid',
        'created_at',
        'completed_at',
        'ip_address',
        'user_agent',
        'fraud_score'
      ];

      const csvRows = exportData.map(v => [
        v.verification_id,
        v.session_token,
        v.phone_number,
        v.transaction_amount,
        v.transaction_time,
        v.status,
        v.validation_results?.time_validation?.status || '',
        v.validation_results?.amount_validation?.status || '',
        v.validation_results?.phone_validation?.status || '',
        v.validation_results?.overall_valid || false,
        v.created_at,
        v.completed_at || '',
        v.ip_address,
        v.user_agent,
        v.fraud_score || ''
      ]);

      const csvContent = [csvHeaders.join(','), ...csvRows.map(row =>
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
      )].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="verification-export-${storeId}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="verification-export-${storeId}-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({
        export_date: new Date().toISOString(),
        store_id: storeId,
        filters: {
          status: status as string | undefined,
          start_date: startDate?.toISOString(),
          end_date: endDate?.toISOString()
        },
        total_records: exportData.length,
        verifications: exportData
      });
    }
  } catch (error) {
    console.error('Error exporting verification data:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to export verification data'
      }
    });
  }
});

export default router;