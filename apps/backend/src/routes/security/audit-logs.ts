import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuditLoggingService } from '../../services/security/auditLoggingService';
import { adminAuth } from '../../middleware/admin-auth';

const router = Router();
const auditService = new AuditLoggingService();

// Validation schemas
const createAuditLogSchema = z.object({
  event_type: z.enum([
    'authentication', 'authorization', 'data_access', 'data_modification',
    'admin_action', 'security_violation', 'system_event', 'fraud_detection'
  ]),
  user_id: z.string().uuid().optional(),
  user_type: z.enum(['customer', 'business', 'admin', 'system']).optional(),
  action_performed: z.string().min(1).max(255),
  resource_type: z.string().max(100).optional(),
  resource_id: z.string().max(255).optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  correlation_id: z.string().uuid().optional(),
  event_metadata: z.record(z.any()).default({}),
  result_status: z.enum(['success', 'failure', 'blocked', 'warning'])
});

const querySchema = z.object({
  event_type: z.enum([
    'authentication', 'authorization', 'data_access', 'data_modification',
    'admin_action', 'security_violation', 'system_event', 'fraud_detection'
  ]).optional(),
  user_id: z.string().uuid().optional(),
  user_type: z.enum(['customer', 'business', 'admin', 'system']).optional(),
  resource_type: z.string().optional(),
  resource_id: z.string().optional(),
  result_status: z.enum(['success', 'failure', 'blocked', 'warning']).optional(),
  correlation_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  ip_address: z.string().optional(),
  action_performed: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  order_by: z.enum(['created_at', 'event_type', 'user_id', 'result_status']).default('created_at'),
  order_direction: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional()
});

const analysisSchema = z.object({
  analysis_type: z.enum(['security_patterns', 'user_behavior', 'system_health', 'fraud_trends']),
  time_window: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  user_id: z.string().uuid().optional(),
  event_types: z.array(z.enum([
    'authentication', 'authorization', 'data_access', 'data_modification',
    'admin_action', 'security_violation', 'system_event', 'fraud_detection'
  ])).optional(),
  group_by: z.enum(['user_id', 'event_type', 'ip_address', 'resource_type']).optional(),
  include_metadata: z.boolean().default(false)
});

/**
 * GET /api/security/audit-logs
 * Retrieve audit logs with filtering and pagination
 */
router.get('/', adminAuth, async (req: Request, res: Response) => {
  try {
    const filters = querySchema.parse(req.query);
    
    const logs = await auditService.getFilteredLogs(filters);
    const totalCount = await auditService.getLogCount(filters);

    // Log the audit log access (meta-logging)
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_audit_logs',
      resource_type: 'audit_logs',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      result_status: 'success',
      event_metadata: {
        filters: filters,
        result_count: logs.length,
        total_count: totalCount
      }
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: totalCount,
        hasMore: filters.offset + logs.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);

    // Log error accessing audit logs
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_audit_logs',
      resource_type: 'audit_logs',
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
      error: 'Failed to fetch audit logs'
    });
  }
});

/**
 * POST /api/security/audit-logs
 * Create new audit log entry (for system/external integrations)
 */
router.post('/', adminAuth, async (req: Request, res: Response) => {
  try {
    const auditData = createAuditLogSchema.parse(req.body);
    
    // Generate correlation ID if not provided
    if (!auditData.correlation_id) {
      auditData.correlation_id = crypto.randomUUID();
    }

    const auditLog = await auditService.logEvent(auditData);

    // Log the creation of audit log entry (meta-meta-logging)
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'create_audit_log',
      resource_type: 'audit_logs',
      resource_id: auditLog.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      result_status: 'success',
      event_metadata: {
        created_event_type: auditData.event_type,
        created_for_user: auditData.user_id,
        correlation_id: auditData.correlation_id
      }
    });

    res.status(201).json({
      success: true,
      data: auditLog
    });
  } catch (error) {
    console.error('Error creating audit log:', error);

    // Log error creating audit log
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'create_audit_log',
      resource_type: 'audit_logs',
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
        error: 'Invalid audit log data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create audit log'
    });
  }
});

/**
 * GET /api/security/audit-logs/:id
 * Get specific audit log by ID
 */
router.get('/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const auditLogId = req.params.id;
    
    const auditLog = await auditService.getLogById(auditLogId);
    
    if (!auditLog) {
      await auditService.logEvent({
        event_type: 'data_access',
        user_id: req.user?.id,
        user_type: 'admin',
        action_performed: 'view_audit_log',
        resource_type: 'audit_logs',
        resource_id: auditLogId,
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: { error: 'Audit log not found' }
      });

      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_audit_log',
      resource_type: 'audit_logs',
      resource_id: auditLogId,
      ip_address: req.ip,
      result_status: 'success'
    });

    res.json({
      success: true,
      data: auditLog
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_audit_log',
      resource_type: 'audit_logs',
      resource_id: req.params.id,
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log'
    });
  }
});

/**
 * GET /api/security/audit-logs/correlation/:correlation_id
 * Get all audit logs with the same correlation ID
 */
router.get('/correlation/:correlation_id', adminAuth, async (req: Request, res: Response) => {
  try {
    const correlationId = req.params.correlation_id;
    
    const correlatedLogs = await auditService.getLogsByCorrelationId(correlationId);

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_correlated_audit_logs',
      resource_type: 'audit_logs',
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        correlation_id: correlationId,
        result_count: correlatedLogs.length
      }
    });

    res.json({
      success: true,
      data: correlatedLogs,
      correlation_id: correlationId
    });
  } catch (error) {
    console.error('Error fetching correlated audit logs:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_correlated_audit_logs',
      resource_type: 'audit_logs',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        correlation_id: req.params.correlation_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch correlated audit logs'
    });
  }
});

/**
 * POST /api/security/audit-logs/analysis
 * Analyze audit logs for security patterns, trends, or anomalies
 */
router.post('/analysis', adminAuth, async (req: Request, res: Response) => {
  try {
    const analysisConfig = analysisSchema.parse(req.body);
    
    let analysisResult;
    
    switch (analysisConfig.analysis_type) {
      case 'security_patterns':
        analysisResult = await auditService.analyzeSecurityPatterns({
          timeWindow: analysisConfig.time_window,
          userId: analysisConfig.user_id,
          eventTypes: analysisConfig.event_types
        });
        break;
        
      case 'user_behavior':
        analysisResult = await auditService.analyzeUserBehavior({
          timeWindow: analysisConfig.time_window,
          userId: analysisConfig.user_id,
          groupBy: analysisConfig.group_by
        });
        break;
        
      case 'system_health':
        analysisResult = await auditService.analyzeSystemHealth({
          timeWindow: analysisConfig.time_window,
          includeMetadata: analysisConfig.include_metadata
        });
        break;
        
      case 'fraud_trends':
        analysisResult = await auditService.analyzeFraudTrends({
          timeWindow: analysisConfig.time_window,
          groupBy: analysisConfig.group_by
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid analysis type'
        });
    }

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'analyze_audit_logs',
      resource_type: 'audit_logs',
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        analysis_type: analysisConfig.analysis_type,
        time_window: analysisConfig.time_window,
        config: analysisConfig
      }
    });

    res.json({
      success: true,
      data: analysisResult,
      analysis_config: analysisConfig,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error analyzing audit logs:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'analyze_audit_logs',
      resource_type: 'audit_logs',
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
        error: 'Invalid analysis configuration',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to analyze audit logs'
    });
  }
});

/**
 * GET /api/security/audit-logs/export
 * Export audit logs in various formats (CSV, JSON, PDF)
 */
router.get('/export', adminAuth, async (req: Request, res: Response) => {
  try {
    const filters = querySchema.parse(req.query);
    const format = (req.query.format as string) || 'json';
    
    if (!['json', 'csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid export format. Supported formats: json, csv, pdf'
      });
    }

    const exportData = await auditService.exportLogs({
      ...filters,
      format: format as 'json' | 'csv' | 'pdf'
    });

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'export_audit_logs',
      resource_type: 'audit_logs',
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        export_format: format,
        filters: filters,
        exported_count: exportData.count
      }
    });

    // Set appropriate headers based on format
    switch (format) {
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
        break;
      case 'pdf':
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.pdf"`);
        break;
      default:
        res.setHeader('Content-Type', 'application/json');
    }

    res.send(exportData.content);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'export_audit_logs',
      resource_type: 'audit_logs',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        export_format: req.query.format,
        filters: req.query
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs'
    });
  }
});

export default router;