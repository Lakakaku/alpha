import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SecurityMonitoringService } from '../../services/security/securityMonitoringService';
import { AuditLoggingService } from '../../services/security/auditLoggingService';
import { adminAuth } from '../../middleware/admin-auth';

const router = Router();
const monitoringService = new SecurityMonitoringService();
const auditService = new AuditLoggingService();

// Validation schemas
const alertQuerySchema = z.object({
  alert_type: z.enum(['security_breach', 'fraud_detection', 'system_anomaly', 'performance_degradation', 'data_integrity']).optional(),
  severity_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['active', 'acknowledged', 'resolved', 'false_positive']).default('active'),
  time_window: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  source_system: z.string().optional(),
  affected_resource: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  order_by: z.enum(['created_at', 'severity_level', 'alert_type', 'status']).default('created_at'),
  order_direction: z.enum(['asc', 'desc']).default('desc')
});

const updateAlertSchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved', 'false_positive']),
  resolution_notes: z.string().optional(),
  acknowledged_by: z.string().uuid().optional(),
  resolved_by: z.string().uuid().optional()
});

const metricsQuerySchema = z.object({
  metric_type: z.enum(['system_health', 'security_events', 'fraud_scores', 'user_activity', 'performance']),
  time_window: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  granularity: z.enum(['minute', 'hour', 'day']).default('hour'),
  aggregation: z.enum(['count', 'avg', 'sum', 'min', 'max']).default('count'),
  filters: z.record(z.any()).optional()
});

/**
 * GET /api/security/monitoring/alerts
 * Get security monitoring alerts with filtering
 */
router.get('/alerts', adminAuth, async (req: Request, res: Response) => {
  try {
    const filters = alertQuerySchema.parse(req.query);
    
    const alerts = await monitoringService.getSecurityAlerts(filters);
    const totalCount = await monitoringService.getAlertCount(filters);

    // Log alert access
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_security_alerts',
      resource_type: 'security_alerts',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      result_status: 'success',
      event_metadata: {
        filters: filters,
        result_count: alerts.length,
        total_count: totalCount
      }
    });

    res.json({
      success: true,
      data: alerts,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: totalCount,
        hasMore: filters.offset + alerts.length < totalCount
      },
      summary: {
        active_alerts: alerts.filter(a => a.status === 'active').length,
        critical_alerts: alerts.filter(a => a.severity_level === 'critical').length,
        high_alerts: alerts.filter(a => a.severity_level === 'high').length
      }
    });
  } catch (error) {
    console.error('Error fetching security alerts:', error);

    // Log error
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_security_alerts',
      resource_type: 'security_alerts',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters: req.query
      }
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch security alerts'
    });
  }
});

/**
 * GET /api/security/monitoring/alerts/:id
 * Get specific security alert by ID
 */
router.get('/alerts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const alertId = req.params.id;
    
    const alert = await monitoringService.getAlertById(alertId);
    
    if (!alert) {
      await auditService.logEvent({
        event_type: 'data_access',
        user_id: req.user?.id,
        user_type: 'admin',
        action_performed: 'view_security_alert',
        resource_type: 'security_alerts',
        resource_id: alertId,
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: { error: 'Alert not found' }
      });

      return res.status(404).json({
        success: false,
        error: 'Security alert not found'
      });
    }

    // Get related events and context
    const relatedData = await monitoringService.getAlertContext(alertId);

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_security_alert',
      resource_type: 'security_alerts',
      resource_id: alertId,
      ip_address: req.ip,
      result_status: 'success'
    });

    res.json({
      success: true,
      data: {
        alert,
        related_events: relatedData.events,
        context: relatedData.context,
        recommendations: relatedData.recommendations
      }
    });
  } catch (error) {
    console.error('Error fetching security alert:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_security_alert',
      resource_type: 'security_alerts',
      resource_id: req.params.id,
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch security alert'
    });
  }
});

/**
 * PATCH /api/security/monitoring/alerts/:id
 * Update security alert status
 */
router.patch('/alerts/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const alertId = req.params.id;
    const updateData = updateAlertSchema.parse(req.body);
    
    // Auto-fill admin fields
    if (updateData.status === 'acknowledged' && !updateData.acknowledged_by) {
      updateData.acknowledged_by = req.user!.id;
    }
    if (updateData.status === 'resolved' && !updateData.resolved_by) {
      updateData.resolved_by = req.user!.id;
    }

    const updatedAlert = await monitoringService.updateAlert(alertId, updateData);
    
    if (!updatedAlert) {
      await auditService.logEvent({
        event_type: 'data_modification',
        user_id: req.user?.id,
        user_type: 'admin',
        action_performed: 'update_security_alert',
        resource_type: 'security_alerts',
        resource_id: alertId,
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: { error: 'Alert not found' }
      });

      return res.status(404).json({
        success: false,
        error: 'Security alert not found'
      });
    }

    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'update_security_alert',
      resource_type: 'security_alerts',
      resource_id: alertId,
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        changes: updateData,
        previous_status: updatedAlert.status,
        updated_by: req.user?.id
      }
    });

    res.json({
      success: true,
      data: updatedAlert
    });
  } catch (error) {
    console.error('Error updating security alert:', error);
    
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'update_security_alert',
      resource_type: 'security_alerts',
      resource_id: req.params.id,
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        request_data: req.body
      }
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid update data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update security alert'
    });
  }
});

/**
 * GET /api/security/monitoring/metrics
 * Get security monitoring metrics and analytics
 */
router.get('/metrics', adminAuth, async (req: Request, res: Response) => {
  try {
    const metricsQuery = metricsQuerySchema.parse(req.query);
    
    const metrics = await monitoringService.getSecurityMetrics(metricsQuery);

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_security_metrics',
      resource_type: 'security_metrics',
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        metric_type: metricsQuery.metric_type,
        time_window: metricsQuery.time_window,
        granularity: metricsQuery.granularity
      }
    });

    res.json({
      success: true,
      data: metrics,
      query_config: metricsQuery,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching security metrics:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_security_metrics',
      resource_type: 'security_metrics',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      }
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid metrics query',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch security metrics'
    });
  }
});

/**
 * GET /api/security/monitoring/dashboard
 * Get comprehensive security monitoring dashboard
 */
router.get('/dashboard', adminAuth, async (req: Request, res: Response) => {
  try {
    const timeWindow = (req.query.time_window as string) || '24h';
    
    const dashboardData = await monitoringService.getSecurityDashboard(timeWindow);

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_security_dashboard',
      resource_type: 'security_dashboard',
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        time_window: timeWindow
      }
    });

    res.json({
      success: true,
      data: dashboardData,
      time_window: timeWindow,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching security dashboard:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_security_dashboard',
      resource_type: 'security_dashboard',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch security dashboard'
    });
  }
});

/**
 * GET /api/security/monitoring/health
 * Get system health and security status
 */
router.get('/health', adminAuth, async (req: Request, res: Response) => {
  try {
    const healthCheck = await monitoringService.getSystemHealth();

    await auditService.logEvent({
      event_type: 'system_event',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'system_health_check',
      resource_type: 'system_health',
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        overall_status: healthCheck.overall_status,
        component_count: healthCheck.components.length
      }
    });

    res.json({
      success: true,
      data: healthCheck,
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    
    await auditService.logEvent({
      event_type: 'system_event',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'system_health_check',
      resource_type: 'system_health',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to check system health'
    });
  }
});

/**
 * POST /api/security/monitoring/test-alert
 * Create test alert for system validation (admin only)
 */
router.post('/test-alert', adminAuth, async (req: Request, res: Response) => {
  try {
    const { alert_type = 'system_anomaly', severity_level = 'low', test_message } = req.body;
    
    const testAlert = await monitoringService.createTestAlert({
      alert_type,
      severity_level,
      message: test_message || 'Test alert generated by admin',
      created_by: req.user!.id,
      metadata: {
        test: true,
        created_at: new Date().toISOString(),
        admin_id: req.user!.id
      }
    });

    await auditService.logEvent({
      event_type: 'admin_action',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'create_test_alert',
      resource_type: 'security_alerts',
      resource_id: testAlert.id,
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        alert_type,
        severity_level,
        test_message,
        created_by: req.user?.id
      }
    });

    res.status(201).json({
      success: true,
      data: testAlert,
      message: 'Test alert created successfully'
    });
  } catch (error) {
    console.error('Error creating test alert:', error);
    
    await auditService.logEvent({
      event_type: 'admin_action',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'create_test_alert',
      resource_type: 'security_alerts',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        request_data: req.body
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create test alert'
    });
  }
});

/**
 * GET /api/security/monitoring/reports/:report_type
 * Generate security monitoring reports
 */
router.get('/reports/:report_type', adminAuth, async (req: Request, res: Response) => {
  try {
    const reportType = req.params.report_type;
    const timeWindow = (req.query.time_window as string) || '7d';
    const format = (req.query.format as string) || 'json';

    if (!['security_summary', 'fraud_analysis', 'system_performance', 'incident_report'].includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report type'
      });
    }

    if (!['json', 'pdf', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Supported formats: json, pdf, csv'
      });
    }

    const report = await monitoringService.generateReport({
      reportType: reportType as any,
      timeWindow,
      format: format as any,
      generatedBy: req.user!.id
    });

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'generate_security_report',
      resource_type: 'security_reports',
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        report_type: reportType,
        time_window: timeWindow,
        format,
        generated_by: req.user?.id
      }
    });

    // Set appropriate headers based on format
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="security-report-${reportType}-${Date.now()}.pdf"`);
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="security-report-${reportType}-${Date.now()}.csv"`);
    }

    if (format === 'json') {
      res.json({
        success: true,
        data: report,
        report_type: reportType,
        time_window: timeWindow,
        generated_at: new Date().toISOString()
      });
    } else {
      res.send(report.content);
    }
  } catch (error) {
    console.error('Error generating security report:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'generate_security_report',
      resource_type: 'security_reports',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        report_type: req.params.report_type,
        time_window: req.query.time_window,
        format: req.query.format,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate security report'
    });
  }
});

export default router;