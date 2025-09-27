/**
 * AuditLog Database Model
 * Task: T035 - AuditLog model
 * 
 * Database operations for audit_logs table
 * Handles comprehensive security audit logging:
 * - Authentication events
 * - Authorization violations
 * - Data access and modifications
 * - System events and security violations
 * - IMMUTABLE records for compliance
 */

import { supabase } from '../client/supabase';
import type { 
  AuditLog,
  AuditLogRequest,
  AuditLogResponse,
  AuditLogQuery,
  AuditEventType,
  UserType,
  ResultStatus,
  ErrorDetails
} from '@vocilia/types';

export class AuditLogModel {
  private static readonly TABLE_NAME = 'audit_logs';
  
  /**
   * Create a new audit log record (IMMUTABLE)
   * Once created, audit logs cannot be modified for compliance
   */
  static async create(data: AuditLogRequest): Promise<AuditLog> {
    const auditLog = {
      event_type: data.event_type,
      user_id: data.user_id,
      user_type: data.user_type,
      action_performed: data.action_performed,
      resource_type: data.resource_type,
      resource_id: data.resource_id,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      correlation_id: data.correlation_id,
      event_metadata: data.event_metadata || {},
      result_status: data.result_status,
      session_id: data.session_id || null,
      request_id: data.request_id || null,
      duration_ms: data.duration_ms || null,
      error_details: data.error_details || null
    };

    const { data: result, error } = await supabase
      .from(this.TABLE_NAME)
      .insert(auditLog)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create audit log: ${error.message}`);
    }

    return result;
  }

  /**
   * Bulk create audit logs for batch operations
   */
  static async createBatch(logs: AuditLogRequest[]): Promise<{ 
    created: number; 
    errors: Array<{ log: AuditLogRequest; error: string }> 
  }> {
    if (logs.length === 0) {
      return { created: 0, errors: [] };
    }

    const auditLogs = logs.map(data => ({
      event_type: data.event_type,
      user_id: data.user_id,
      user_type: data.user_type,
      action_performed: data.action_performed,
      resource_type: data.resource_type,
      resource_id: data.resource_id,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      correlation_id: data.correlation_id,
      event_metadata: data.event_metadata || {},
      result_status: data.result_status,
      session_id: data.session_id || null,
      request_id: data.request_id || null,
      duration_ms: data.duration_ms || null,
      error_details: data.error_details || null
    }));

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .insert(auditLogs)
      .select('id');

    if (error) {
      // If bulk insert fails, try individual inserts to identify problematic records
      let created = 0;
      const errors: Array<{ log: AuditLogRequest; error: string }> = [];

      for (const log of logs) {
        try {
          await this.create(log);
          created++;
        } catch (createError) {
          errors.push({
            log,
            error: (createError as Error).message
          });
        }
      }

      return { created, errors };
    }

    return { 
      created: data?.length || 0, 
      errors: [] 
    };
  }

  /**
   * Query audit logs with comprehensive filtering
   */
  static async query(queryParams: AuditLogQuery): Promise<AuditLogResponse> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact' });

    // Apply filters
    if (queryParams.event_type) {
      if (Array.isArray(queryParams.event_type)) {
        query = query.in('event_type', queryParams.event_type);
      } else {
        query = query.eq('event_type', queryParams.event_type);
      }
    }

    if (queryParams.user_id) {
      query = query.eq('user_id', queryParams.user_id);
    }

    if (queryParams.user_type) {
      query = query.eq('user_type', queryParams.user_type);
    }

    if (queryParams.resource_type) {
      query = query.eq('resource_type', queryParams.resource_type);
    }

    if (queryParams.result_status) {
      query = query.eq('result_status', queryParams.result_status);
    }

    if (queryParams.correlation_id) {
      query = query.eq('correlation_id', queryParams.correlation_id);
    }

    if (queryParams.start_date) {
      query = query.gte('created_at', queryParams.start_date);
    }

    if (queryParams.end_date) {
      query = query.lte('created_at', queryParams.end_date);
    }

    // Apply pagination
    const limit = Math.min(queryParams.limit || 50, 1000); // Max 1000 records
    const offset = queryParams.offset || 0;

    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to query audit logs: ${error.message}`);
    }

    const totalCount = count || 0;
    const hasNext = offset + limit < totalCount;
    const hasPrevious = offset > 0;

    // Generate summary statistics
    let summary;
    if (data && data.length > 0) {
      const eventTypeDistribution: Record<AuditEventType, number> = {
        authentication: 0,
        authorization: 0,
        data_access: 0,
        data_modification: 0,
        admin_action: 0,
        security_violation: 0,
        system_event: 0,
        fraud_detection: 0
      };

      const resultStatusDistribution: Record<ResultStatus, number> = {
        success: 0,
        failure: 0,
        blocked: 0,
        warning: 0
      };

      const uniqueUsers = new Set<string>();
      let earliest = data[0].created_at;
      let latest = data[0].created_at;

      data.forEach(log => {
        eventTypeDistribution[log.event_type as AuditEventType]++;
        resultStatusDistribution[log.result_status as ResultStatus]++;
        uniqueUsers.add(log.user_id);
        
        if (log.created_at < earliest) earliest = log.created_at;
        if (log.created_at > latest) latest = log.created_at;
      });

      summary = {
        event_type_distribution: eventTypeDistribution,
        result_status_distribution: resultStatusDistribution,
        unique_users: uniqueUsers.size,
        time_range: {
          earliest,
          latest
        }
      };
    }

    return {
      logs: data || [],
      pagination: {
        total_count: totalCount,
        has_next: hasNext,
        has_previous: hasPrevious,
        current_offset: offset,
        limit
      },
      summary
    };
  }

  /**
   * Get audit logs by correlation ID (for request tracing)
   */
  static async getByCorrelationId(correlationId: string): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('correlation_id', correlationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get audit logs by correlation ID: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get recent audit logs for monitoring
   */
  static async getRecent(options: {
    minutes?: number;
    eventTypes?: AuditEventType[];
    resultStatuses?: ResultStatus[];
    limit?: number;
  } = {}): Promise<AuditLog[]> {
    const minutes = options.minutes || 60;
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .gte('created_at', since);

    if (options.eventTypes && options.eventTypes.length > 0) {
      query = query.in('event_type', options.eventTypes);
    }

    if (options.resultStatuses && options.resultStatuses.length > 0) {
      query = query.in('result_status', options.resultStatuses);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get recent audit logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get security violation logs
   */
  static async getSecurityViolations(options: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    ipAddress?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ violations: AuditLog[]; totalCount: number }> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact' })
      .eq('event_type', 'security_violation');

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    if (options.ipAddress) {
      query = query.eq('ip_address', options.ipAddress);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get security violations: ${error.message}`);
    }

    return {
      violations: data || [],
      totalCount: count || 0
    };
  }

  /**
   * Get audit logs by user
   */
  static async getByUser(userId: string, options: {
    eventTypes?: AuditEventType[];
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: AuditLog[]; totalCount: number }> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (options.eventTypes && options.eventTypes.length > 0) {
      query = query.in('event_type', options.eventTypes);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get audit logs by user: ${error.message}`);
    }

    return {
      logs: data || [],
      totalCount: count || 0
    };
  }

  /**
   * Get audit logs by IP address
   */
  static async getByIpAddress(ipAddress: string, options: {
    eventTypes?: AuditEventType[];
    resultStatuses?: ResultStatus[];
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<AuditLog[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('ip_address', ipAddress);

    if (options.eventTypes && options.eventTypes.length > 0) {
      query = query.in('event_type', options.eventTypes);
    }

    if (options.resultStatuses && options.resultStatuses.length > 0) {
      query = query.in('result_status', options.resultStatuses);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get audit logs by IP address: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get audit log statistics
   */
  static async getStatistics(options: {
    startDate?: string;
    endDate?: string;
    eventType?: AuditEventType;
  } = {}): Promise<{
    totalLogs: number;
    eventTypeDistribution: Record<AuditEventType, number>;
    resultStatusDistribution: Record<ResultStatus, number>;
    userTypeDistribution: Record<UserType, number>;
    topUsers: Array<{ user_id: string; count: number }>;
    topIpAddresses: Array<{ ip_address: string; count: number }>;
    averageDuration: number;
    errorRate: number;
    securityViolations: number;
    failedAuthentications: number;
    uniqueUsers: number;
    recentTrends: Array<{
      hour: string;
      count: number;
      success_rate: number;
    }>;
  }> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('event_type, result_status, user_type, user_id, ip_address, duration_ms, created_at');

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get audit log statistics: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalLogs: 0,
        eventTypeDistribution: { authentication: 0, authorization: 0, data_access: 0, data_modification: 0, admin_action: 0, security_violation: 0, system_event: 0, fraud_detection: 0 },
        resultStatusDistribution: { success: 0, failure: 0, blocked: 0, warning: 0 },
        userTypeDistribution: { customer: 0, business: 0, admin: 0, system: 0 },
        topUsers: [],
        topIpAddresses: [],
        averageDuration: 0,
        errorRate: 0,
        securityViolations: 0,
        failedAuthentications: 0,
        uniqueUsers: 0,
        recentTrends: []
      };
    }

    const totalLogs = data.length;

    // Event type distribution
    const eventTypeDistribution: Record<AuditEventType, number> = {
      authentication: 0, authorization: 0, data_access: 0, data_modification: 0,
      admin_action: 0, security_violation: 0, system_event: 0, fraud_detection: 0
    };
    data.forEach(log => {
      eventTypeDistribution[log.event_type as AuditEventType]++;
    });

    // Result status distribution
    const resultStatusDistribution: Record<ResultStatus, number> = { success: 0, failure: 0, blocked: 0, warning: 0 };
    data.forEach(log => {
      resultStatusDistribution[log.result_status as ResultStatus]++;
    });

    // User type distribution
    const userTypeDistribution: Record<UserType, number> = { customer: 0, business: 0, admin: 0, system: 0 };
    data.forEach(log => {
      userTypeDistribution[log.user_type as UserType]++;
    });

    // Top users
    const userCounts: Record<string, number> = {};
    data.forEach(log => {
      userCounts[log.user_id] = (userCounts[log.user_id] || 0) + 1;
    });
    const topUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([user_id, count]) => ({ user_id, count }));

    // Top IP addresses
    const ipCounts: Record<string, number> = {};
    data.forEach(log => {
      ipCounts[log.ip_address] = (ipCounts[log.ip_address] || 0) + 1;
    });
    const topIpAddresses = Object.entries(ipCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ip_address, count]) => ({ ip_address, count }));

    // Average duration
    const durationsValid = data.filter(log => log.duration_ms && log.duration_ms > 0);
    const averageDuration = durationsValid.length > 0 
      ? durationsValid.reduce((sum, log) => sum + log.duration_ms, 0) / durationsValid.length 
      : 0;

    // Error rate
    const failureCount = resultStatusDistribution.failure + resultStatusDistribution.blocked;
    const errorRate = totalLogs > 0 ? (failureCount / totalLogs) * 100 : 0;

    // Security violations
    const securityViolations = eventTypeDistribution.security_violation;

    // Failed authentications
    const failedAuthentications = data.filter(log => 
      log.event_type === 'authentication' && log.result_status === 'failure'
    ).length;

    // Unique users
    const uniqueUsers = new Set(data.map(log => log.user_id)).size;

    // Recent trends (hourly)
    const hourlyTrends: Record<string, { total: number; success: number }> = {};
    data.forEach(log => {
      const hour = log.created_at.substring(0, 13) + ':00:00.000Z'; // Round to hour
      if (!hourlyTrends[hour]) {
        hourlyTrends[hour] = { total: 0, success: 0 };
      }
      hourlyTrends[hour].total++;
      if (log.result_status === 'success') {
        hourlyTrends[hour].success++;
      }
    });

    const recentTrends = Object.entries(hourlyTrends)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24) // Last 24 hours
      .map(([hour, stats]) => ({
        hour,
        count: stats.total,
        success_rate: stats.total > 0 ? (stats.success / stats.total) * 100 : 0
      }));

    return {
      totalLogs,
      eventTypeDistribution,
      resultStatusDistribution,
      userTypeDistribution,
      topUsers,
      topIpAddresses,
      averageDuration,
      errorRate,
      securityViolations,
      failedAuthentications,
      uniqueUsers,
      recentTrends
    };
  }

  /**
   * Delete old audit logs (for data retention compliance)
   */
  static async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .lt('created_at', cutoffDate)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old audit logs: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Export audit logs for compliance reporting
   */
  static async exportLogs(options: {
    startDate: string;
    endDate: string;
    eventTypes?: AuditEventType[];
    format?: 'json' | 'csv';
    limit?: number;
  }): Promise<{ 
    logs: AuditLog[]; 
    totalExported: number; 
    exportTimestamp: string 
  }> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .gte('created_at', options.startDate)
      .lte('created_at', options.endDate);

    if (options.eventTypes && options.eventTypes.length > 0) {
      query = query.in('event_type', options.eventTypes);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to export audit logs: ${error.message}`);
    }

    return {
      logs: data || [],
      totalExported: data?.length || 0,
      exportTimestamp: new Date().toISOString()
    };
  }

  /**
   * Helper method to log common events
   */
  static async logEvent(eventData: {
    eventType: AuditEventType;
    userId: string;
    userType: UserType;
    action: string;
    resourceType: string;
    resourceId: string;
    ipAddress: string;
    userAgent: string;
    correlationId: string;
    resultStatus: ResultStatus;
    sessionId?: string;
    requestId?: string;
    durationMs?: number;
    errorDetails?: ErrorDetails;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    return this.create({
      event_type: eventData.eventType,
      user_id: eventData.userId,
      user_type: eventData.userType,
      action_performed: eventData.action,
      resource_type: eventData.resourceType,
      resource_id: eventData.resourceId,
      ip_address: eventData.ipAddress,
      user_agent: eventData.userAgent,
      correlation_id: eventData.correlationId,
      result_status: eventData.resultStatus,
      session_id: eventData.sessionId,
      request_id: eventData.requestId,
      duration_ms: eventData.durationMs,
      error_details: eventData.errorDetails,
      event_metadata: eventData.metadata
    });
  }
}