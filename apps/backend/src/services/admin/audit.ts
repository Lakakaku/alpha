import { AuditLogModel, ActionType, ResourceType, AuditLogEntry } from '@vocilia/database/admin/audit-log';

export interface AuditLogFilter {
  adminId?: string;
  actionType?: ActionType;
  resourceType?: ResourceType;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  logs: Array<{
    id: string;
    adminId: string;
    actionType: ActionType;
    resourceType: ResourceType;
    resourceId?: string;
    actionDetails: any;
    ipAddress: string;
    userAgent: string;
    performedAt: string;
    success: boolean;
    errorMessage?: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuditStatistics {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  successRate: number;
  actionsByType: Record<ActionType, number>;
  actionsByResource: Record<ResourceType, number>;
  adminActivity: Array<{
    adminId: string;
    actionCount: number;
  }>;
  recentActivity: Array<{
    adminId: string;
    actionType: ActionType;
    resourceType: ResourceType;
    performedAt: string;
    success: boolean;
  }>;
}

export interface SecurityAlert {
  id: string;
  type: 'failed_login' | 'suspicious_activity' | 'bulk_changes' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  adminId?: string;
  ipAddress?: string;
  timestamp: string;
  details: any;
}

export class AuditService {
  /**
   * Get audit logs with filtering and pagination
   */
  static async getAuditLogs(filters: AuditLogFilter = {}): Promise<AuditLogResponse> {
    try {
      const {
        page = 1,
        limit = 50,
        adminId,
        actionType,
        resourceType,
        success,
        startDate,
        endDate
      } = filters;

      const { logs, total } = await AuditLogModel.getAll(
        page,
        limit,
        {
          adminId,
          actionType,
          resourceType,
          success,
          startDate,
          endDate
        }
      );

      return {
        logs: logs.map(log => ({
          id: log.id,
          adminId: log.admin_id,
          actionType: log.action_type,
          resourceType: log.resource_type,
          resourceId: log.resource_id,
          actionDetails: log.action_details,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          performedAt: log.performed_at,
          success: log.success,
          errorMessage: log.error_message
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return {
        logs: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 }
      };
    }
  }

  /**
   * Get audit logs for specific admin
   */
  static async getAdminAuditLogs(adminId: string, limit = 100) {
    try {
      const logs = await AuditLogModel.getByAdmin(adminId, limit);
      return logs.map(log => ({
        id: log.id,
        actionType: log.action_type,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        actionDetails: log.action_details,
        ipAddress: log.ip_address,
        performedAt: log.performed_at,
        success: log.success,
        errorMessage: log.error_message
      }));
    } catch (error) {
      console.error('Error getting admin audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for specific resource
   */
  static async getResourceAuditLogs(
    resourceType: ResourceType,
    resourceId: string,
    limit = 50
  ) {
    try {
      const logs = await AuditLogModel.getByResource(resourceType, resourceId, limit);
      return logs.map(log => ({
        id: log.id,
        adminId: log.admin_id,
        actionType: log.action_type,
        actionDetails: log.action_details,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        performedAt: log.performed_at,
        success: log.success,
        errorMessage: log.error_message
      }));
    } catch (error) {
      console.error('Error getting resource audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  static async getAuditStatistics(days = 7): Promise<AuditStatistics> {
    try {
      const stats = await AuditLogModel.getStatistics(days);
      
      // Get admin activity breakdown
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const recentLogs = await AuditLogModel.getAll(1, 1000, {
        startDate: since.toISOString()
      });

      // Group by admin
      const adminActivity = new Map<string, number>();
      const recentActivity: any[] = [];

      recentLogs.logs.forEach(log => {
        adminActivity.set(log.admin_id, (adminActivity.get(log.admin_id) || 0) + 1);
        
        if (recentActivity.length < 10) {
          recentActivity.push({
            adminId: log.admin_id,
            actionType: log.action_type,
            resourceType: log.resource_type,
            performedAt: log.performed_at,
            success: log.success
          });
        }
      });

      const adminActivityArray = Array.from(adminActivity.entries()).map(([adminId, count]) => ({
        adminId,
        actionCount: count
      })).sort((a, b) => b.actionCount - a.actionCount);

      return {
        totalActions: stats.totalActions,
        successfulActions: stats.successfulActions,
        failedActions: stats.failedActions,
        successRate: stats.totalActions > 0 ? (stats.successfulActions / stats.totalActions) * 100 : 0,
        actionsByType: stats.actionsByType,
        actionsByResource: stats.actionsByResource,
        adminActivity: adminActivityArray,
        recentActivity
      };
    } catch (error) {
      console.error('Error getting audit statistics:', error);
      return {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        successRate: 0,
        actionsByType: {} as Record<ActionType, number>,
        actionsByResource: {} as Record<ResourceType, number>,
        adminActivity: [],
        recentActivity: []
      };
    }
  }

  /**
   * Get failed actions (potential security issues)
   */
  static async getFailedActions(hours = 24, limit = 100) {
    try {
      const failedLogs = await AuditLogModel.getRecentFailures(hours, limit);
      return failedLogs.map(log => ({
        id: log.id,
        adminId: log.admin_id,
        actionType: log.action_type,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        actionDetails: log.action_details,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        performedAt: log.performed_at,
        errorMessage: log.error_message
      }));
    } catch (error) {
      console.error('Error getting failed actions:', error);
      return [];
    }
  }

  /**
   * Log admin action
   */
  static async logAction(entry: AuditLogEntry): Promise<boolean> {
    try {
      const result = await AuditLogModel.log(entry);
      return result !== null;
    } catch (error) {
      console.error('Error logging audit action:', error);
      return false;
    }
  }

  /**
   * Generate security alerts based on audit patterns
   */
  static async generateSecurityAlerts(): Promise<SecurityAlert[]> {
    try {
      const alerts: SecurityAlert[] = [];
      const now = new Date();

      // Check for multiple failed logins
      const failedLogins = await AuditLogModel.getRecentFailures(1); // Last hour
      const loginFailures = failedLogins.filter(log => 
        log.action_type === 'login' && !log.success
      );

      if (loginFailures.length >= 5) {
        alerts.push({
          id: `failed_logins_${now.getTime()}`,
          type: 'failed_login',
          severity: 'high',
          description: `Multiple failed login attempts detected (${loginFailures.length} in last hour)`,
          timestamp: now.toISOString(),
          details: {
            count: loginFailures.length,
            attempts: loginFailures.map(log => ({
              adminId: log.admin_id,
              ipAddress: log.ip_address,
              timestamp: log.performed_at
            }))
          }
        });
      }

      // Check for bulk changes
      const recentLogs = await AuditLogModel.getAll(1, 1000, {
        startDate: new Date(now.getTime() - 60 * 60 * 1000).toISOString() // Last hour
      });

      const bulkActions = new Map<string, number>();
      recentLogs.logs.forEach(log => {
        if (['create', 'update', 'delete'].includes(log.action_type)) {
          const key = `${log.admin_id}_${log.action_type}_${log.resource_type}`;
          bulkActions.set(key, (bulkActions.get(key) || 0) + 1);
        }
      });

      bulkActions.forEach((count, key) => {
        if (count >= 10) {
          const [adminId, actionType, resourceType] = key.split('_');
          alerts.push({
            id: `bulk_${key}_${now.getTime()}`,
            type: 'bulk_changes',
            severity: 'medium',
            description: `Bulk ${actionType} operations detected for ${resourceType} (${count} actions in last hour)`,
            adminId,
            timestamp: now.toISOString(),
            details: {
              actionType,
              resourceType,
              count
            }
          });
        }
      });

      // Check for suspicious IP activity
      const ipActivity = new Map<string, Set<string>>();
      recentLogs.logs.forEach(log => {
        if (!ipActivity.has(log.ip_address)) {
          ipActivity.set(log.ip_address, new Set());
        }
        ipActivity.get(log.ip_address)!.add(log.admin_id);
      });

      ipActivity.forEach((admins, ip) => {
        if (admins.size > 1) {
          alerts.push({
            id: `suspicious_ip_${ip}_${now.getTime()}`,
            type: 'suspicious_activity',
            severity: 'medium',
            description: `Multiple admin accounts accessed from same IP address`,
            ipAddress: ip,
            timestamp: now.toISOString(),
            details: {
              ipAddress: ip,
              adminIds: Array.from(admins),
              adminCount: admins.size
            }
          });
        }
      });

      return alerts;
    } catch (error) {
      console.error('Error generating security alerts:', error);
      return [];
    }
  }

  /**
   * Export audit logs to CSV
   */
  static async exportAuditLogs(filters: AuditLogFilter = {}): Promise<string> {
    try {
      // Get all matching logs (without pagination for export)
      const { logs } = await AuditLogModel.getAll(1, 10000, {
        adminId: filters.adminId,
        actionType: filters.actionType,
        resourceType: filters.resourceType,
        success: filters.success,
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      // Create CSV headers
      const headers = [
        'ID',
        'Admin ID',
        'Action Type',
        'Resource Type',
        'Resource ID',
        'Action Details',
        'IP Address',
        'User Agent',
        'Performed At',
        'Success',
        'Error Message'
      ];

      // Create CSV rows
      const rows = logs.map(log => [
        log.id,
        log.admin_id,
        log.action_type,
        log.resource_type,
        log.resource_id || '',
        JSON.stringify(log.action_details),
        log.ip_address,
        log.user_agent,
        log.performed_at,
        log.success ? 'TRUE' : 'FALSE',
        log.error_message || ''
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      throw new Error('Failed to export audit logs');
    }
  }

  /**
   * Get audit log summary for dashboard
   */
  static async getAuditSummary() {
    try {
      const [
        todayStats,
        weekStats,
        recentFailures,
        securityAlerts
      ] = await Promise.all([
        AuditLogModel.getStatistics(1),
        AuditLogModel.getStatistics(7),
        this.getFailedActions(24, 10),
        this.generateSecurityAlerts()
      ]);

      return {
        today: {
          totalActions: todayStats.totalActions,
          successfulActions: todayStats.successfulActions,
          failedActions: todayStats.failedActions,
          successRate: todayStats.totalActions > 0 
            ? (todayStats.successfulActions / todayStats.totalActions) * 100 
            : 0
        },
        week: {
          totalActions: weekStats.totalActions,
          successfulActions: weekStats.successfulActions,
          failedActions: weekStats.failedActions,
          successRate: weekStats.totalActions > 0 
            ? (weekStats.successfulActions / weekStats.totalActions) * 100 
            : 0
        },
        recentFailures: recentFailures.length,
        securityAlerts: securityAlerts.length,
        criticalAlerts: securityAlerts.filter(alert => alert.severity === 'critical').length
      };
    } catch (error) {
      console.error('Error getting audit summary:', error);
      return {
        today: { totalActions: 0, successfulActions: 0, failedActions: 0, successRate: 0 },
        week: { totalActions: 0, successfulActions: 0, failedActions: 0, successRate: 0 },
        recentFailures: 0,
        securityAlerts: 0,
        criticalAlerts: 0
      };
    }
  }

  /**
   * Cleanup old audit logs
   */
  static async cleanupOldLogs(retentionDays = 90): Promise<number> {
    try {
      return await AuditLogModel.deleteOlderThan(retentionDays);
    } catch (error) {
      console.error('Error cleaning up old audit logs:', error);
      return 0;
    }
  }
}