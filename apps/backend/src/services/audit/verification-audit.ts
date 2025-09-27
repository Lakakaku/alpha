import { Database } from '@vocilia/database';
import { createClient } from '@supabase/supabase-js';
import { loggingService } from '../loggingService';

export interface AuditEvent {
  id?: string;
  event_type: string;
  event_category: 'preparation' | 'verification' | 'payment' | 'file_operation' | 'admin_action';
  resource_type: 'cycle' | 'database' | 'record' | 'invoice' | 'file' | 'user';
  resource_id: string;
  user_id?: string;
  user_type: 'admin' | 'business' | 'system';
  action: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  timestamp?: string;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface AuditQuery {
  eventType?: string;
  eventCategory?: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  userType?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  successRate: number;
  eventsByCategory: Record<string, number>;
  eventsByType: Record<string, number>;
  topUsers: Array<{ userId: string; eventCount: number }>;
  recentErrors: Array<{ eventType: string; errorMessage: string; timestamp: string }>;
}

class VerificationAuditService {
  private supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Core audit logging methods
  async logPreparationEvent(
    action: string,
    resourceId: string,
    details: Record<string, any>,
    userId?: string,
    success: boolean = true,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event_type: `preparation_${action}`,
      event_category: 'preparation',
      resource_type: action.includes('cycle') ? 'cycle' : 'database',
      resource_id: resourceId,
      user_id: userId,
      user_type: userId ? 'admin' : 'system',
      action,
      details,
      success,
      error_message: error,
      metadata
    });
  }

  async logVerificationEvent(
    action: string,
    resourceId: string,
    details: Record<string, any>,
    userId: string,
    success: boolean = true,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event_type: `verification_${action}`,
      event_category: 'verification',
      resource_type: action.includes('database') ? 'database' : 'record',
      resource_id: resourceId,
      user_id: userId,
      user_type: 'business',
      action,
      details,
      success,
      error_message: error,
      metadata
    });
  }

  async logPaymentEvent(
    action: string,
    resourceId: string,
    details: Record<string, any>,
    userId?: string,
    success: boolean = true,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event_type: `payment_${action}`,
      event_category: 'payment',
      resource_type: 'invoice',
      resource_id: resourceId,
      user_id: userId,
      user_type: userId ? 'admin' : 'system',
      action,
      details,
      success,
      error_message: error,
      metadata
    });
  }

  async logFileOperation(
    action: string,
    resourceId: string,
    details: Record<string, any>,
    userId?: string,
    success: boolean = true,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event_type: `file_${action}`,
      event_category: 'file_operation',
      resource_type: 'file',
      resource_id: resourceId,
      user_id: userId,
      user_type: userId ? 'business' : 'system',
      action,
      details,
      success,
      error_message: error,
      metadata
    });
  }

  async logAdminAction(
    action: string,
    resourceType: 'cycle' | 'database' | 'invoice' | 'user',
    resourceId: string,
    details: Record<string, any>,
    userId: string,
    success: boolean = true,
    error?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      event_type: `admin_${action}`,
      event_category: 'admin_action',
      resource_type: resourceType,
      resource_id: resourceId,
      user_id: userId,
      user_type: 'admin',
      action,
      details,
      success,
      error_message: error,
      metadata
    });
  }

  private async logEvent(event: AuditEvent): Promise<void> {
    try {
      const auditRecord = {
        event_type: event.event_type,
        event_category: event.event_category,
        resource_type: event.resource_type,
        resource_id: event.resource_id,
        user_id: event.user_id,
        user_type: event.user_type,
        action: event.action,
        details: event.details,
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        session_id: event.session_id,
        success: event.success,
        error_message: event.error_message,
        metadata: event.metadata,
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('verification_audit_logs')
        .insert(auditRecord);

      if (error) {
        // Log to application logging service as fallback
        await loggingService.logError('Failed to write audit log', new Error(error.message), {
          auditEvent: event,
          supabaseError: error
        });
      }

    } catch (error) {
      // Critical: Audit logging failure should not break the application
      await loggingService.logError('Audit logging system failure', error as Error, {
        auditEvent: event
      });
    }
  }

  // Query and analysis methods
  async getAuditEvents(query: AuditQuery): Promise<AuditEvent[]> {
    try {
      let supabaseQuery = this.supabase
        .from('verification_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (query.eventType) {
        supabaseQuery = supabaseQuery.eq('event_type', query.eventType);
      }
      if (query.eventCategory) {
        supabaseQuery = supabaseQuery.eq('event_category', query.eventCategory);
      }
      if (query.resourceType) {
        supabaseQuery = supabaseQuery.eq('resource_type', query.resourceType);
      }
      if (query.resourceId) {
        supabaseQuery = supabaseQuery.eq('resource_id', query.resourceId);
      }
      if (query.userId) {
        supabaseQuery = supabaseQuery.eq('user_id', query.userId);
      }
      if (query.userType) {
        supabaseQuery = supabaseQuery.eq('user_type', query.userType);
      }
      if (query.success !== undefined) {
        supabaseQuery = supabaseQuery.eq('success', query.success);
      }
      if (query.startDate) {
        supabaseQuery = supabaseQuery.gte('created_at', query.startDate.toISOString());
      }
      if (query.endDate) {
        supabaseQuery = supabaseQuery.lte('created_at', query.endDate.toISOString());
      }

      // Apply pagination
      if (query.limit) {
        supabaseQuery = supabaseQuery.limit(query.limit);
      }
      if (query.offset) {
        supabaseQuery = supabaseQuery.range(query.offset, (query.offset + (query.limit || 50)) - 1);
      }

      const { data, error } = await supabaseQuery;

      if (error) {
        throw new Error(`Failed to query audit events: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      await loggingService.logError('Failed to query audit events', error as Error, { query });
      throw error;
    }
  }

  async getAuditSummary(startDate?: Date, endDate?: Date): Promise<AuditSummary> {
    try {
      let query = this.supabase
        .from('verification_audit_logs')
        .select('event_type, event_category, user_id, success, error_message, created_at');

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get audit summary: ${error.message}`);
      }

      const events = data || [];

      // Calculate summary statistics
      const totalEvents = events.length;
      const successfulEvents = events.filter(e => e.success).length;
      const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

      // Group by category
      const eventsByCategory: Record<string, number> = {};
      events.forEach(event => {
        eventsByCategory[event.event_category] = (eventsByCategory[event.event_category] || 0) + 1;
      });

      // Group by type
      const eventsByType: Record<string, number> = {};
      events.forEach(event => {
        eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
      });

      // Top users by activity
      const userCounts: Record<string, number> = {};
      events.forEach(event => {
        if (event.user_id) {
          userCounts[event.user_id] = (userCounts[event.user_id] || 0) + 1;
        }
      });

      const topUsers = Object.entries(userCounts)
        .map(([userId, eventCount]) => ({ userId, eventCount }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10);

      // Recent errors
      const recentErrors = events
        .filter(e => !e.success && e.error_message)
        .slice(0, 10)
        .map(e => ({
          eventType: e.event_type,
          errorMessage: e.error_message!,
          timestamp: e.created_at
        }));

      return {
        totalEvents,
        successRate,
        eventsByCategory,
        eventsByType,
        topUsers,
        recentErrors
      };

    } catch (error) {
      await loggingService.logError('Failed to generate audit summary', error as Error);
      throw error;
    }
  }

  async getResourceAuditTrail(
    resourceType: string,
    resourceId: string,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    return this.getAuditEvents({
      resourceType: resourceType as any,
      resourceId,
      limit
    });
  }

  async getUserActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<AuditEvent[]> {
    return this.getAuditEvents({
      userId,
      startDate,
      endDate,
      limit
    });
  }

  async getFailedOperations(
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    return this.getAuditEvents({
      success: false,
      startDate,
      endDate,
      limit
    });
  }

  // Compliance and reporting methods
  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    period: { start: string; end: string };
    summary: AuditSummary;
    criticalEvents: AuditEvent[];
    dataAccess: AuditEvent[];
    paymentOperations: AuditEvent[];
    systemOperations: AuditEvent[];
  }> {
    try {
      const [summary, criticalEvents, dataAccess, paymentOps, systemOps] = await Promise.all([
        this.getAuditSummary(startDate, endDate),
        this.getAuditEvents({
          success: false,
          startDate,
          endDate,
          limit: 100
        }),
        this.getAuditEvents({
          eventCategory: 'verification',
          startDate,
          endDate,
          limit: 1000
        }),
        this.getAuditEvents({
          eventCategory: 'payment',
          startDate,
          endDate,
          limit: 1000
        }),
        this.getAuditEvents({
          userType: 'system',
          startDate,
          endDate,
          limit: 1000
        })
      ]);

      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary,
        criticalEvents,
        dataAccess,
        paymentOperations: paymentOps,
        systemOperations: systemOps
      };

    } catch (error) {
      await loggingService.logError('Failed to generate compliance report', error as Error);
      throw error;
    }
  }

  async cleanupOldAuditLogs(olderThanDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const { data, error } = await this.supabase
        .from('verification_audit_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup audit logs: ${error.message}`);
      }

      const deletedCount = data?.length || 0;

      await loggingService.logInfo('Audit log cleanup completed', {
        cutoffDate: cutoffDate.toISOString(),
        deletedCount,
        retentionDays: olderThanDays
      });

      return deletedCount;

    } catch (error) {
      await loggingService.logError('Failed to cleanup audit logs', error as Error);
      throw error;
    }
  }

  // Security monitoring
  async detectSuspiciousActivity(): Promise<{
    multipleFailedAttempts: Array<{ userId: string; failureCount: number; timeWindow: string }>;
    unusualAccessPatterns: Array<{ userId: string; resourceCount: number; timeWindow: string }>;
    systemErrors: Array<{ eventType: string; errorCount: number; timeWindow: string }>;
  }> {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get recent events for analysis
      const recentEvents = await this.getAuditEvents({
        startDate: last24Hours,
        limit: 10000
      });

      // Detect multiple failed attempts per user
      const failuresByUser: Record<string, number> = {};
      recentEvents.filter(e => !e.success && e.user_id).forEach(event => {
        failuresByUser[event.user_id!] = (failuresByUser[event.user_id!] || 0) + 1;
      });

      const multipleFailedAttempts = Object.entries(failuresByUser)
        .filter(([_, count]) => count >= 5)
        .map(([userId, failureCount]) => ({
          userId,
          failureCount,
          timeWindow: '24 hours'
        }));

      // Detect unusual access patterns
      const accessByUser: Record<string, Set<string>> = {};
      recentEvents.filter(e => e.user_id && e.resource_id).forEach(event => {
        if (!accessByUser[event.user_id!]) {
          accessByUser[event.user_id!] = new Set();
        }
        accessByUser[event.user_id!].add(event.resource_id);
      });

      const unusualAccessPatterns = Object.entries(accessByUser)
        .filter(([_, resources]) => resources.size >= 10)
        .map(([userId, resources]) => ({
          userId,
          resourceCount: resources.size,
          timeWindow: '24 hours'
        }));

      // Detect system errors
      const errorsByType: Record<string, number> = {};
      recentEvents.filter(e => !e.success && e.user_type === 'system').forEach(event => {
        errorsByType[event.event_type] = (errorsByType[event.event_type] || 0) + 1;
      });

      const systemErrors = Object.entries(errorsByType)
        .filter(([_, count]) => count >= 3)
        .map(([eventType, errorCount]) => ({
          eventType,
          errorCount,
          timeWindow: '24 hours'
        }));

      return {
        multipleFailedAttempts,
        unusualAccessPatterns,
        systemErrors
      };

    } catch (error) {
      await loggingService.logError('Failed to detect suspicious activity', error as Error);
      throw error;
    }
  }
}

export const verificationAudit = new VerificationAuditService();
export { VerificationAuditService };