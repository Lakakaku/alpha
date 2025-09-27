import { createClient } from '@supabase/supabase-js';
import { ContextChange, ContextChangeType } from './types';

export interface AuditLogEntry {
  id: string;
  storeId: string;
  userId: string;
  userEmail?: string;
  action: string;
  resourceType: 'profile' | 'personnel' | 'layout' | 'inventory' | 'version';
  resourceId: string;
  changes: Record<string, {
    from: unknown;
    to: unknown;
  }>;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    source: 'web' | 'api' | 'mobile' | 'system';
    timestamp: string;
    version?: string;
    correlationId?: string;
  };
  createdAt: string;
}

export interface AuditLogFilter {
  storeId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface AuditLogSummary {
  totalChanges: number;
  changesByAction: Record<string, number>;
  changesByResource: Record<string, number>;
  changesByUser: Record<string, number>;
  changesByDay: Record<string, number>;
  recentActivity: AuditLogEntry[];
  topContributors: Array<{
    userId: string;
    userEmail?: string;
    changeCount: number;
    lastActivity: string;
  }>;
}

export interface ContextChangeTracker {
  trackChange<T>(
    storeId: string,
    userId: string,
    action: string,
    resourceType: AuditLogEntry['resourceType'],
    resourceId: string,
    oldData: T,
    newData: T,
    metadata?: Partial<AuditLogEntry['metadata']>
  ): Promise<AuditLogEntry>;

  getAuditLog(filter: AuditLogFilter): Promise<{
    entries: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }>;

  getAuditSummary(storeId: string, days?: number): Promise<AuditLogSummary>;
  
  exportAuditLog(filter: AuditLogFilter, format: 'json' | 'csv'): Promise<string>;
}

export class ContextAuditService implements ContextChangeTracker {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  /**
   * Track a context change in the audit log
   */
  async trackChange<T>(
    storeId: string,
    userId: string,
    action: string,
    resourceType: AuditLogEntry['resourceType'],
    resourceId: string,
    oldData: T,
    newData: T,
    metadata: Partial<AuditLogEntry['metadata']> = {}
  ): Promise<AuditLogEntry> {
    try {
      // Calculate field-level changes
      const changes = this.calculateChanges(oldData, newData);

      // Get user email for audit trail
      const { data: userData } = await this.supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      const auditEntry: Omit<AuditLogEntry, 'id' | 'createdAt'> = {
        storeId,
        userId,
        userEmail: userData?.email,
        action,
        resourceType,
        resourceId,
        changes,
        metadata: {
          source: 'web',
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      };

      // Insert audit log entry
      const { data, error } = await this.supabase
        .from('context_audit_log')
        .insert(auditEntry)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create audit log: ${error.message}`);
      }

      return data as AuditLogEntry;

    } catch (error) {
      console.error('Audit logging failed:', error);
      throw error;
    }
  }

  /**
   * Get audit log entries with filtering and pagination
   */
  async getAuditLog(filter: AuditLogFilter): Promise<{
    entries: AuditLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let query = this.supabase
        .from('context_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filter.storeId) {
        query = query.eq('store_id', filter.storeId);
      }
      if (filter.userId) {
        query = query.eq('user_id', filter.userId);
      }
      if (filter.action) {
        query = query.eq('action', filter.action);
      }
      if (filter.resourceType) {
        query = query.eq('resource_type', filter.resourceType);
      }
      if (filter.resourceId) {
        query = query.eq('resource_id', filter.resourceId);
      }
      if (filter.dateFrom) {
        query = query.gte('created_at', filter.dateFrom);
      }
      if (filter.dateTo) {
        query = query.lte('created_at', filter.dateTo);
      }
      if (filter.search) {
        query = query.or(`action.ilike.%${filter.search}%,user_email.ilike.%${filter.search}%`);
      }

      // Apply pagination
      const limit = filter.limit || 50;
      const offset = filter.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch audit log: ${error.message}`);
      }

      const total = count || 0;
      const hasMore = total > offset + limit;

      return {
        entries: data as AuditLogEntry[],
        total,
        hasMore,
      };

    } catch (error) {
      console.error('Failed to fetch audit log:', error);
      throw error;
    }
  }

  /**
   * Get audit summary statistics for a store
   */
  async getAuditSummary(storeId: string, days: number = 30): Promise<AuditLogSummary> {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      // Get all audit entries for the period
      const { data: entries, error } = await this.supabase
        .from('context_audit_log')
        .select('*')
        .eq('store_id', storeId)
        .gte('created_at', dateFrom.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch audit summary: ${error.message}`);
      }

      const auditEntries = entries as AuditLogEntry[];

      // Calculate statistics
      const changesByAction: Record<string, number> = {};
      const changesByResource: Record<string, number> = {};
      const changesByUser: Record<string, number> = {};
      const changesByDay: Record<string, number> = {};
      const userContributions: Record<string, { email?: string; count: number; lastActivity: string }> = {};

      auditEntries.forEach(entry => {
        // By action
        changesByAction[entry.action] = (changesByAction[entry.action] || 0) + 1;

        // By resource type
        changesByResource[entry.resourceType] = (changesByResource[entry.resourceType] || 0) + 1;

        // By user
        changesByUser[entry.userId] = (changesByUser[entry.userId] || 0) + 1;

        // By day
        const day = entry.createdAt.split('T')[0];
        changesByDay[day] = (changesByDay[day] || 0) + 1;

        // User contributions
        if (!userContributions[entry.userId]) {
          userContributions[entry.userId] = {
            email: entry.userEmail,
            count: 0,
            lastActivity: entry.createdAt,
          };
        }
        userContributions[entry.userId].count += 1;
        if (entry.createdAt > userContributions[entry.userId].lastActivity) {
          userContributions[entry.userId].lastActivity = entry.createdAt;
        }
      });

      // Top contributors
      const topContributors = Object.entries(userContributions)
        .map(([userId, data]) => ({
          userId,
          userEmail: data.email,
          changeCount: data.count,
          lastActivity: data.lastActivity,
        }))
        .sort((a, b) => b.changeCount - a.changeCount)
        .slice(0, 10);

      // Recent activity (last 10 entries)
      const recentActivity = auditEntries.slice(0, 10);

      return {
        totalChanges: auditEntries.length,
        changesByAction,
        changesByResource,
        changesByUser,
        changesByDay,
        recentActivity,
        topContributors,
      };

    } catch (error) {
      console.error('Failed to generate audit summary:', error);
      throw error;
    }
  }

  /**
   * Export audit log in specified format
   */
  async exportAuditLog(filter: AuditLogFilter, format: 'json' | 'csv'): Promise<string> {
    try {
      // Get all entries (remove pagination for export)
      const exportFilter = { ...filter, limit: undefined, offset: undefined };
      const { entries } = await this.getAuditLog(exportFilter);

      if (format === 'json') {
        return JSON.stringify(entries, null, 2);
      }

      if (format === 'csv') {
        return this.convertToCSV(entries);
      }

      throw new Error(`Unsupported export format: ${format}`);

    } catch (error) {
      console.error('Failed to export audit log:', error);
      throw error;
    }
  }

  /**
   * Calculate field-level changes between old and new data
   */
  private calculateChanges<T>(oldData: T, newData: T): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (!oldData && !newData) {
      return changes;
    }

    if (!oldData) {
      // New record created
      Object.entries(newData as Record<string, unknown>).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          changes[key] = { from: null, to: value };
        }
      });
      return changes;
    }

    if (!newData) {
      // Record deleted
      Object.entries(oldData as Record<string, unknown>).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          changes[key] = { from: value, to: null };
        }
      });
      return changes;
    }

    // Compare fields
    const allKeys = new Set([
      ...Object.keys(oldData as Record<string, unknown>),
      ...Object.keys(newData as Record<string, unknown>),
    ]);

    allKeys.forEach(key => {
      const oldValue = (oldData as Record<string, unknown>)[key];
      const newValue = (newData as Record<string, unknown>)[key];

      if (this.hasChanged(oldValue, newValue)) {
        changes[key] = { from: oldValue, to: newValue };
      }
    });

    return changes;
  }

  /**
   * Check if a value has changed (deep comparison for objects/arrays)
   */
  private hasChanged(oldValue: unknown, newValue: unknown): boolean {
    if (oldValue === newValue) {
      return false;
    }

    if (oldValue === null || oldValue === undefined || 
        newValue === null || newValue === undefined) {
      return oldValue !== newValue;
    }

    if (typeof oldValue !== typeof newValue) {
      return true;
    }

    if (typeof oldValue === 'object') {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }

    return oldValue !== newValue;
  }

  /**
   * Convert audit entries to CSV format
   */
  private convertToCSV(entries: AuditLogEntry[]): string {
    if (entries.length === 0) {
      return 'No data to export';
    }

    const headers = [
      'Date',
      'User Email',
      'Action', 
      'Resource Type',
      'Resource ID',
      'Changes',
      'IP Address',
      'User Agent',
      'Source',
    ];

    const csvRows = [headers.join(',')];

    entries.forEach(entry => {
      const row = [
        `"${entry.createdAt}"`,
        `"${entry.userEmail || 'Unknown'}"`,
        `"${entry.action}"`,
        `"${entry.resourceType}"`,
        `"${entry.resourceId}"`,
        `"${JSON.stringify(entry.changes).replace(/"/g, '""')}"`,
        `"${entry.metadata.ipAddress || 'N/A'}"`,
        `"${entry.metadata.userAgent || 'N/A'}"`,
        `"${entry.metadata.source}"`,
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Cleanup old audit logs (retention policy)
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { count, error } = await this.supabase
        .from('context_audit_log')
        .delete({ count: 'exact' })
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw new Error(`Failed to cleanup audit logs: ${error.message}`);
      }

      return count || 0;

    } catch (error) {
      console.error('Failed to cleanup audit logs:', error);
      throw error;
    }
  }

  /**
   * Get compliance report for specific date range
   */
  async getComplianceReport(
    storeId: string, 
    dateFrom: string, 
    dateTo: string
  ): Promise<{
    period: { from: string; to: string };
    summary: AuditLogSummary;
    criticalActions: AuditLogEntry[];
    dataAccess: AuditLogEntry[];
    suspiciousActivity: AuditLogEntry[];
  }> {
    try {
      const { entries } = await this.getAuditLog({
        storeId,
        dateFrom,
        dateTo,
        limit: 10000, // Large limit for compliance report
      });

      const summary = await this.getAuditSummary(storeId, 
        Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24))
      );

      // Identify critical actions
      const criticalActions = entries.filter(entry => 
        ['delete', 'export', 'restore'].includes(entry.action)
      );

      // Identify data access patterns
      const dataAccess = entries.filter(entry => 
        entry.action === 'view' || entry.action === 'export'
      );

      // Identify suspicious activity (multiple failed attempts, unusual patterns)
      const suspiciousActivity = entries.filter(entry => 
        entry.metadata.source === 'api' && 
        Object.keys(entry.changes).length > 10 // Bulk changes
      );

      return {
        period: { from: dateFrom, to: dateTo },
        summary,
        criticalActions,
        dataAccess,
        suspiciousActivity,
      };

    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }
}

export default ContextAuditService;