import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { IntrusionDetectionService } from '../../services/security/intrusionDetectionService';
import { AuditLoggingService } from '../../services/security/auditLoggingService';
import { adminAuth } from '../../middleware/admin-auth';

const router = Router();
const intrusionService = new IntrusionDetectionService();
const auditService = new AuditLoggingService();

// Validation schemas
const createIntrusionEventSchema = z.object({
  event_type: z.enum([
    'brute_force', 'sql_injection', 'unusual_access', 'privilege_escalation',
    'data_exfiltration', 'rate_limit_violation', 'authentication_bypass'
  ]),
  source_ip: z.string().ip(),
  target_resource: z.string().optional(),
  attack_pattern: z.string().optional(),
  severity_level: z.number().min(1).max(10),
  detection_method: z.string().min(1).max(100),
  automated_response: z.record(z.any()).default({}),
  admin_notified: z.boolean().default(false),
  incident_status: z.enum(['detected', 'investigating', 'contained', 'resolved', 'false_positive']).default('detected'),
  resolution_notes: z.string().optional()
});

const updateIntrusionEventSchema = z.object({
  incident_status: z.enum(['detected', 'investigating', 'contained', 'resolved', 'false_positive']).optional(),
  resolution_notes: z.string().optional(),
  admin_notified: z.boolean().optional(),
  automated_response: z.record(z.any()).optional()
});

const querySchema = z.object({
  event_type: z.enum([
    'brute_force', 'sql_injection', 'unusual_access', 'privilege_escalation',
    'data_exfiltration', 'rate_limit_violation', 'authentication_bypass'
  ]).optional(),
  source_ip: z.string().ip().optional(),
  severity_level_min: z.coerce.number().min(1).max(10).optional(),
  severity_level_max: z.coerce.number().min(1).max(10).optional(),
  incident_status: z.enum(['detected', 'investigating', 'contained', 'resolved', 'false_positive']).optional(),
  admin_notified: z.coerce.boolean().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  target_resource: z.string().optional(),
  detection_method: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
  order_by: z.enum(['first_detected_at', 'severity_level', 'incident_status', 'source_ip']).default('first_detected_at'),
  order_direction: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional()
});

const analysisSchema = z.object({
  analysis_type: z.enum(['threat_patterns', 'ip_reputation', 'attack_timeline', 'severity_trends']),
  time_window: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  source_ip: z.string().ip().optional(),
  event_types: z.array(z.enum([
    'brute_force', 'sql_injection', 'unusual_access', 'privilege_escalation',
    'data_exfiltration', 'rate_limit_violation', 'authentication_bypass'
  ])).optional(),
  severity_threshold: z.number().min(1).max(10).default(5),
  group_by: z.enum(['source_ip', 'event_type', 'target_resource', 'detection_method']).optional()
});

/**
 * GET /api/security/intrusion-events
 * Retrieve intrusion events with filtering and pagination
 */
router.get('/', adminAuth, async (req: Request, res: Response) => {
  try {
    const filters = querySchema.parse(req.query);
    
    const events = await intrusionService.getIntrusionEvents(filters);
    const totalCount = await intrusionService.getIntrusionEventCount(filters);

    // Log data access
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_intrusion_events',
      resource_type: 'intrusion_events',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      result_status: 'success',
      event_metadata: {
        filters: filters,
        result_count: events.length,
        total_count: totalCount
      }
    });

    res.json({
      success: true,
      data: events,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: totalCount,
        hasMore: filters.offset + events.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching intrusion events:', error);

    // Log error
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_intrusion_events',
      resource_type: 'intrusion_events',
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
      error: 'Failed to fetch intrusion events'
    });
  }
});

/**
 * POST /api/security/intrusion-events
 * Create new intrusion event (typically from automated detection)
 */
router.post('/', adminAuth, async (req: Request, res: Response) => {
  try {
    const eventData = createIntrusionEventSchema.parse(req.body);
    
    const intrusionEvent = await intrusionService.createIntrusionEvent(eventData);

    // Log intrusion event creation
    await auditService.logEvent({
      event_type: 'security_violation',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'create_intrusion_event',
      resource_type: 'intrusion_events',
      resource_id: intrusionEvent.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      result_status: 'success',
      event_metadata: {
        event_type: eventData.event_type,
        source_ip: eventData.source_ip,
        severity_level: eventData.severity_level,
        detection_method: eventData.detection_method
      }
    });

    // Auto-escalate high-severity events
    if (eventData.severity_level >= 8) {
      await intrusionService.escalateEvent(intrusionEvent.id, {
        escalation_reason: 'High severity automatic escalation',
        notified_admins: true,
        immediate_actions: ['ip_block', 'admin_alert']
      });
    }

    res.status(201).json({
      success: true,
      data: intrusionEvent
    });
  } catch (error) {
    console.error('Error creating intrusion event:', error);

    // Log error
    await auditService.logEvent({
      event_type: 'security_violation',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'create_intrusion_event',
      resource_type: 'intrusion_events',
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
        error: 'Invalid intrusion event data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create intrusion event'
    });
  }
});

/**
 * GET /api/security/intrusion-events/:id
 * Get specific intrusion event by ID
 */
router.get('/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    
    const intrusionEvent = await intrusionService.getIntrusionEventById(eventId);
    
    if (!intrusionEvent) {
      await auditService.logEvent({
        event_type: 'data_access',
        user_id: req.user?.id,
        user_type: 'admin',
        action_performed: 'view_intrusion_event',
        resource_type: 'intrusion_events',
        resource_id: eventId,
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: { error: 'Intrusion event not found' }
      });

      return res.status(404).json({
        success: false,
        error: 'Intrusion event not found'
      });
    }

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_intrusion_event',
      resource_type: 'intrusion_events',
      resource_id: eventId,
      ip_address: req.ip,
      result_status: 'success'
    });

    res.json({
      success: true,
      data: intrusionEvent
    });
  } catch (error) {
    console.error('Error fetching intrusion event:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_intrusion_event',
      resource_type: 'intrusion_events',
      resource_id: req.params.id,
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch intrusion event'
    });
  }
});

/**
 * PATCH /api/security/intrusion-events/:id
 * Update intrusion event status and resolution notes
 */
router.patch('/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const updateData = updateIntrusionEventSchema.parse(req.body);
    
    const updatedEvent = await intrusionService.updateIntrusionEvent(eventId, updateData);
    
    if (!updatedEvent) {
      await auditService.logEvent({
        event_type: 'data_modification',
        user_id: req.user?.id,
        user_type: 'admin',
        action_performed: 'update_intrusion_event',
        resource_type: 'intrusion_events',
        resource_id: eventId,
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: { error: 'Intrusion event not found' }
      });

      return res.status(404).json({
        success: false,
        error: 'Intrusion event not found'
      });
    }

    // Log successful update
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'update_intrusion_event',
      resource_type: 'intrusion_events',
      resource_id: eventId,
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        changes: updateData,
        previous_status: updatedEvent.incident_status,
        updated_by: req.user?.id
      }
    });

    // Handle status transitions
    if (updateData.incident_status === 'resolved' && updatedEvent.resolved_at) {
      await intrusionService.finalizeEventResolution(eventId, {
        resolved_by: req.user!.id,
        resolution_summary: updateData.resolution_notes || 'Event resolved by admin'
      });
    }

    res.json({
      success: true,
      data: updatedEvent
    });
  } catch (error) {
    console.error('Error updating intrusion event:', error);
    
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'update_intrusion_event',
      resource_type: 'intrusion_events',
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
      error: 'Failed to update intrusion event'
    });
  }
});

/**
 * POST /api/security/intrusion-events/:id/escalate
 * Escalate intrusion event for immediate attention
 */
router.post('/:id/escalate', adminAuth, async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const { escalation_reason, immediate_actions, notify_admins = true } = req.body;
    
    const escalationResult = await intrusionService.escalateEvent(eventId, {
      escalation_reason: escalation_reason || 'Manual escalation by admin',
      notified_admins: notify_admins,
      immediate_actions: immediate_actions || [],
      escalated_by: req.user!.id
    });

    await auditService.logEvent({
      event_type: 'admin_action',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'escalate_intrusion_event',
      resource_type: 'intrusion_events',
      resource_id: eventId,
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        escalation_reason,
        immediate_actions,
        notify_admins,
        escalated_by: req.user?.id
      }
    });

    res.json({
      success: true,
      data: escalationResult,
      message: 'Event escalated successfully'
    });
  } catch (error) {
    console.error('Error escalating intrusion event:', error);
    
    await auditService.logEvent({
      event_type: 'admin_action',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'escalate_intrusion_event',
      resource_type: 'intrusion_events',
      resource_id: req.params.id,
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        request_data: req.body
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to escalate intrusion event'
    });
  }
});

/**
 * POST /api/security/intrusion-events/bulk-action
 * Perform bulk actions on multiple intrusion events
 */
router.post('/bulk-action', adminAuth, async (req: Request, res: Response) => {
  try {
    const { event_ids, action, action_data } = req.body;
    
    if (!Array.isArray(event_ids) || event_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'event_ids array is required and must not be empty'
      });
    }

    if (!['update_status', 'escalate', 'resolve', 'mark_false_positive'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bulk action'
      });
    }

    const results = await intrusionService.bulkUpdateEvents(event_ids, action, {
      ...action_data,
      updated_by: req.user!.id
    });

    await auditService.logEvent({
      event_type: 'admin_action',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'bulk_action_intrusion_events',
      resource_type: 'intrusion_events',
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        action,
        event_count: event_ids.length,
        successful_updates: results.successful,
        failed_updates: results.failed,
        action_data
      }
    });

    res.json({
      success: true,
      data: results,
      message: `Bulk action "${action}" completed`
    });
  } catch (error) {
    console.error('Error performing bulk action on intrusion events:', error);
    
    await auditService.logEvent({
      event_type: 'admin_action',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'bulk_action_intrusion_events',
      resource_type: 'intrusion_events',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        request_data: req.body
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk action'
    });
  }
});

/**
 * POST /api/security/intrusion-events/analysis
 * Analyze intrusion events for patterns and trends
 */
router.post('/analysis', adminAuth, async (req: Request, res: Response) => {
  try {
    const analysisConfig = analysisSchema.parse(req.body);
    
    let analysisResult;
    
    switch (analysisConfig.analysis_type) {
      case 'threat_patterns':
        analysisResult = await intrusionService.analyzeThreatPatterns({
          timeWindow: analysisConfig.time_window,
          eventTypes: analysisConfig.event_types,
          severityThreshold: analysisConfig.severity_threshold
        });
        break;
        
      case 'ip_reputation':
        analysisResult = await intrusionService.analyzeIpReputation({
          timeWindow: analysisConfig.time_window,
          sourceIp: analysisConfig.source_ip,
          severityThreshold: analysisConfig.severity_threshold
        });
        break;
        
      case 'attack_timeline':
        analysisResult = await intrusionService.generateAttackTimeline({
          timeWindow: analysisConfig.time_window,
          sourceIp: analysisConfig.source_ip,
          eventTypes: analysisConfig.event_types
        });
        break;
        
      case 'severity_trends':
        analysisResult = await intrusionService.analyzeSeverityTrends({
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
      action_performed: 'analyze_intrusion_events',
      resource_type: 'intrusion_events',
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
    console.error('Error analyzing intrusion events:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'analyze_intrusion_events',
      resource_type: 'intrusion_events',
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
      error: 'Failed to analyze intrusion events'
    });
  }
});

/**
 * GET /api/security/intrusion-events/dashboard
 * Get dashboard summary of intrusion events
 */
router.get('/dashboard', adminAuth, async (req: Request, res: Response) => {
  try {
    const timeWindow = (req.query.time_window as string) || '24h';
    
    const dashboardData = await intrusionService.getDashboardSummary(timeWindow);

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_intrusion_dashboard',
      resource_type: 'intrusion_events',
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
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching intrusion dashboard:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'view_intrusion_dashboard',
      resource_type: 'intrusion_events',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

export default router;