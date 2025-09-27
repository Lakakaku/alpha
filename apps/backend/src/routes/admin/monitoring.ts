import { Router, Request, Response } from 'express';
import { StoreMonitoringService } from '../../services/admin/store-monitoring';
import { AuditService } from '../../services/admin/audit';
import { AdminSessionService } from '../../services/admin/session';
import { adminAuth } from '../../middleware/admin-auth';

const router = Router();

interface AdminRequest extends Request {
  admin?: {
    id: string;
    username: string;
    fullName: string;
    email: string;
  };
}

/**
 * GET /admin/monitoring/dashboard
 * Get monitoring dashboard data
 */
router.get('/dashboard', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const [
      storeMonitoring,
      auditSummary,
      sessionStats
    ] = await Promise.all([
      StoreMonitoringService.getMonitoringDashboard(),
      AuditService.getAuditSummary(),
      AdminSessionService.getSessionStatistics(7)
    ]);

    res.json({
      success: true,
      dashboard: {
        stores: storeMonitoring,
        audit: auditSummary,
        sessions: sessionStats,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/monitoring/alerts
 * Get security and system alerts
 */
router.get('/alerts', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const [
      securityAlerts,
      suspiciousActivity,
      failedActions
    ] = await Promise.all([
      AuditService.generateSecurityAlerts(),
      AdminSessionService.getSuspiciousActivity(),
      AuditService.getFailedActions(24, 20)
    ]);

    res.json({
      success: true,
      alerts: {
        security: securityAlerts,
        suspicious: suspiciousActivity,
        failures: failedActions,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/monitoring/audit
 * Get audit logs with filtering
 */
router.get('/audit', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const adminId = req.query.admin_id as string;
    const actionType = req.query.action_type as any;
    const resourceType = req.query.resource_type as any;
    const success = req.query.success === 'true' ? true : 
                   req.query.success === 'false' ? false : undefined;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const auditLogs = await AuditService.getAuditLogs({
      page,
      limit,
      adminId,
      actionType,
      resourceType,
      success,
      startDate,
      endDate
    });

    res.json({
      success: true,
      ...auditLogs
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/monitoring/audit/:adminId
 * Get audit logs for specific admin
 */
router.get('/audit/:adminId', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { adminId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = await AuditService.getAdminAuditLogs(adminId, limit);

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Get admin audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/monitoring/audit/resource/:resourceType/:resourceId
 * Get audit logs for specific resource
 */
router.get('/audit/resource/:resourceType/:resourceId', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { resourceType, resourceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const logs = await AuditService.getResourceAuditLogs(
      resourceType as any,
      resourceId,
      limit
    );

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Get resource audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/monitoring/audit/statistics
 * Get audit statistics
 */
router.get('/audit/statistics', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const statistics = await AuditService.getAuditStatistics(days);

    res.json({
      success: true,
      statistics,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Get audit statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/monitoring/audit/export
 * Export audit logs to CSV
 */
router.get('/audit/export', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const adminId = req.query.admin_id as string;
    const actionType = req.query.action_type as any;
    const resourceType = req.query.resource_type as any;
    const success = req.query.success === 'true' ? true : 
                   req.query.success === 'false' ? false : undefined;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const csvContent = await AuditService.exportAuditLogs({
      adminId,
      actionType,
      resourceType,
      success,
      startDate,
      endDate
    });

    const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs'
    });
  }
});

/**
 * GET /admin/monitoring/sessions
 * Get active sessions monitoring
 */
router.get('/sessions', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const [
      activeSessions,
      sessionStats,
      expiringSessions
    ] = await Promise.all([
      AdminSessionService.getActiveSessions(),
      AdminSessionService.getSessionStatistics(1), // Today's stats
      AdminSessionService.getExpiringSessionsWarning(15) // Expiring in 15 minutes
    ]);

    res.json({
      success: true,
      sessions: {
        active: activeSessions,
        statistics: sessionStats,
        expiring: expiringSessions,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get sessions monitoring error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /admin/monitoring/sessions/:sessionId
 * Force end a session (admin action)
 */
router.delete('/sessions/:sessionId', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { sessionId } = req.params;
    const success = await AdminSessionService.endSessionById(sessionId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or could not be ended'
      });
    }

    // Log the admin action
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    await AuditService.logAction({
      adminId: req.admin.id,
      actionType: 'delete',
      resourceType: 'session',
      resourceId: sessionId,
      actionDetails: {
        description: 'Force ended admin session',
        target_session_id: sessionId
      },
      ipAddress,
      userAgent,
      success: true
    });

    res.json({
      success: true,
      message: 'Session ended successfully'
    });
  } catch (error) {
    console.error('Force end session error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /admin/monitoring/cleanup
 * Run cleanup operations
 */
router.post('/cleanup', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { type } = req.body; // 'sessions', 'audit', 'metrics'

    let cleanedCount = 0;
    let message = '';

    switch (type) {
      case 'sessions':
        cleanedCount = await AdminSessionService.cleanupExpiredSessions();
        message = `Cleaned up ${cleanedCount} expired sessions`;
        break;
      
      case 'audit':
        const retentionDays = parseInt(req.body.retention_days) || 90;
        cleanedCount = await AuditService.cleanupOldLogs(retentionDays);
        message = `Cleaned up ${cleanedCount} audit logs older than ${retentionDays} days`;
        break;
      
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid cleanup type. Use: sessions, audit'
        });
    }

    // Log the cleanup action
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    await AuditService.logAction({
      adminId: req.admin.id,
      actionType: 'delete',
      resourceType: 'system',
      actionDetails: {
        description: `Cleanup operation: ${type}`,
        cleanup_type: type,
        cleaned_count: cleanedCount
      },
      ipAddress,
      userAgent,
      success: true
    });

    res.json({
      success: true,
      message,
      cleanedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/monitoring/system-health
 * Get overall system health
 */
router.get('/system-health', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const [
      storeStats,
      auditSummary,
      sessionStats,
      securityAlerts
    ] = await Promise.all([
      StoreMonitoringService.getMonitoringDashboard(),
      AuditService.getAuditSummary(),
      AdminSessionService.getSessionStatistics(1),
      AuditService.generateSecurityAlerts()
    ]);

    // Calculate overall health score
    const totalStores = storeStats.statistics.total;
    const onlineStores = storeStats.statistics.online;
    const errorStores = storeStats.errorCount;
    const criticalAlerts = securityAlerts.filter(alert => alert.severity === 'critical').length;

    const healthScore = totalStores > 0 ? 
      Math.max(0, 100 - (errorStores / totalStores * 50) - (criticalAlerts * 20)) : 100;

    const healthStatus = healthScore >= 90 ? 'excellent' :
                        healthScore >= 70 ? 'good' :
                        healthScore >= 50 ? 'warning' : 'critical';

    res.json({
      success: true,
      health: {
        score: Math.round(healthScore),
        status: healthStatus,
        stores: {
          total: totalStores,
          online: onlineStores,
          offline: totalStores - onlineStores,
          withErrors: errorStores
        },
        security: {
          alerts: securityAlerts.length,
          criticalAlerts,
          failedActionsToday: auditSummary.today.failedActions
        },
        sessions: {
          active: sessionStats.activeSessions,
          today: sessionStats.sessionsToday
        },
        lastChecked: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/monitoring/uptime
 * Get uptime monitoring data for all services
 */
router.get('/uptime', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    // In production, this would query actual uptime data from monitoring services
    // For now, simulate uptime metrics
    const services = ['backend', 'customer', 'business', 'admin', 'database'];
    
    const uptimeData = services.map(service => {
      const uptime = Math.random() * 0.5 + 99.5; // 99.5% - 100%
      const incidents = Math.floor(Math.random() * 3);
      const downtimeMinutes = Math.random() * 10;
      
      return {
        service,
        uptime_percent: parseFloat(uptime.toFixed(3)),
        availability_target: 99.5,
        status: uptime >= 99.5 ? 'meeting_sla' : 'below_sla',
        incidents_count: incidents,
        total_downtime_minutes: parseFloat(downtimeMinutes.toFixed(2)),
        last_incident: incidents > 0 ? 
          new Date(Date.now() - Math.random() * hours * 60 * 60 * 1000).toISOString() : 
          null,
        response_times: {
          avg_ms: Math.floor(Math.random() * 500) + 100,
          p95_ms: Math.floor(Math.random() * 1000) + 200,
          p99_ms: Math.floor(Math.random() * 2000) + 500
        }
      };
    });

    // Calculate overall system uptime
    const averageUptime = uptimeData.reduce((sum, service) => 
      sum + service.uptime_percent, 0) / uptimeData.length;
    
    const totalIncidents = uptimeData.reduce((sum, service) => 
      sum + service.incidents_count, 0);

    res.status(200).json({
      success: true,
      uptime: {
        period_hours: hours,
        overall_uptime_percent: parseFloat(averageUptime.toFixed(3)),
        sla_target: 99.5,
        sla_status: averageUptime >= 99.5 ? 'meeting' : 'below_target',
        total_incidents: totalIncidents,
        services: uptimeData,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get uptime monitoring error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get uptime data'
    });
  }
});

/**
 * GET /api/admin/monitoring/backups
 * Get backup status and metrics
 */
router.get('/backups', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    
    // In production, this would query actual backup records from database
    // For now, simulate backup data
    const backupTypes = ['database', 'files', 'configuration'];
    
    const backups = backupTypes.map(type => {
      const successfulBackups = Math.floor(Math.random() * days) + days - 2;
      const failedBackups = Math.floor(Math.random() * 2);
      const totalBackups = successfulBackups + failedBackups;
      
      return {
        backup_type: type,
        total_backups: totalBackups,
        successful_backups: successfulBackups,
        failed_backups: failedBackups,
        success_rate_percent: totalBackups > 0 ? 
          parseFloat(((successfulBackups / totalBackups) * 100).toFixed(1)) : 0,
        last_backup: {
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          status: Math.random() > 0.1 ? 'completed' : 'failed',
          size_mb: parseFloat((Math.random() * 1000 + 100).toFixed(1)),
          duration_minutes: parseFloat((Math.random() * 30 + 5).toFixed(1))
        },
        next_scheduled: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        retention_days: type === 'database' ? 30 : 14,
        storage_used_gb: parseFloat((Math.random() * 10 + 5).toFixed(2))
      };
    });

    // Calculate overall backup health
    const overallSuccessRate = backups.reduce((sum, backup) => 
      sum + backup.success_rate_percent, 0) / backups.length;
    
    const totalFailed = backups.reduce((sum, backup) => 
      sum + backup.failed_backups, 0);

    const backupHealth = overallSuccessRate >= 95 ? 'healthy' : 
                        overallSuccessRate >= 85 ? 'warning' : 'critical';

    // Check for recent backup failures
    const recentFailures = backups.filter(backup => 
      backup.last_backup.status === 'failed' || 
      new Date(backup.last_backup.timestamp).getTime() < Date.now() - 25 * 60 * 60 * 1000
    );

    res.status(200).json({
      success: true,
      backups: {
        period_days: days,
        overall_health: backupHealth,
        overall_success_rate: parseFloat(overallSuccessRate.toFixed(1)),
        total_failed_backups: totalFailed,
        requires_attention: recentFailures.length > 0,
        backup_types: backups,
        alerts: recentFailures.map(backup => ({
          type: backup.backup_type,
          issue: backup.last_backup.status === 'failed' ? 'backup_failed' : 'backup_overdue',
          message: backup.last_backup.status === 'failed' ? 
            `Last ${backup.backup_type} backup failed` :
            `${backup.backup_type} backup is overdue`,
          severity: 'warning'
        })),
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get backup monitoring error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup data'
    });
  }
});

/**
 * GET /admin/monitoring/performance
 * Get system performance metrics
 */
router.get('/performance', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    
    // Get performance data for the specified time range
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    // This would typically include database query times, API response times, etc.
    // For now, we'll return basic system metrics
    const performance = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      period: `${hours} hours`,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      performance
    });
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;