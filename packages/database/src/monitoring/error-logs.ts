import { supabase } from '../client/supabase';
import type { Database } from '../types';

// Note: These types will be properly typed once the monitoring tables are added to the database schema
export type ErrorLog = {
  id: string;
  timestamp: string;
  severity: string;
  error_message: string;
  stack_trace?: string;
  service_name: string;
  endpoint?: string;
  user_context: Record<string, any>;
  resolution_status: string;
  created_at: string;
  updated_at: string;
};

export type ErrorLogInsert = Omit<ErrorLog, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ErrorLogUpdate = Partial<Omit<ErrorLog, 'id' | 'created_at'>>;

export type ErrorSeverity = 'critical' | 'warning' | 'info';
export type ErrorResolutionStatus = 'open' | 'investigating' | 'resolved';
export type ServiceName = 'backend' | 'customer_app' | 'business_app' | 'admin_app';

export interface ErrorLogEntry {
  severity: ErrorSeverity;
  errorMessage: string;
  serviceName: ServiceName;
  stackTrace?: string;
  endpoint?: string;
  userContext?: Record<string, any>;
  timestamp?: string;
}

export interface ErrorLogFilters {
  severity?: ErrorSeverity;
  serviceName?: ServiceName;
  resolutionStatus?: ErrorResolutionStatus;
  startTime?: string;
  endTime?: string;
  endpoint?: string;
}

export class ErrorLogModel {
  /**
   * Log a new error
   */
  static async logError(errorData: ErrorLogEntry): Promise<ErrorLog | null> {
    const { data, error } = await supabase
      .from('error_logs')
      .insert({
        severity: errorData.severity,
        error_message: errorData.errorMessage,
        service_name: errorData.serviceName,
        stack_trace: errorData.stackTrace,
        endpoint: errorData.endpoint,
        user_context: errorData.userContext || {},
        timestamp: errorData.timestamp || new Date().toISOString(),
        resolution_status: 'open'
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging error entry:', error);
      return null;
    }

    return data;
  }

  /**
   * Get error logs with filtering and pagination
   */
  static async getErrorLogs(
    filters?: ErrorLogFilters,
    page = 1,
    limit = 50
  ): Promise<{ errors: ErrorLog[]; total: number }> {
    let query = supabase
      .from('error_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters?.severity) {
      query = query.eq('severity', filters.severity);
    }
    if (filters?.serviceName) {
      query = query.eq('service_name', filters.serviceName);
    }
    if (filters?.resolutionStatus) {
      query = query.eq('resolution_status', filters.resolutionStatus);
    }
    if (filters?.endpoint) {
      query = query.eq('endpoint', filters.endpoint);
    }
    if (filters?.startTime) {
      query = query.gte('timestamp', filters.startTime);
    }
    if (filters?.endTime) {
      query = query.lte('timestamp', filters.endTime);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching error logs:', error);
      return { errors: [], total: 0 };
    }

    return {
      errors: data || [],
      total: count || 0
    };
  }

  /**
   * Get error by ID
   */
  static async getById(id: string): Promise<ErrorLog | null> {
    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching error log by ID:', error);
      return null;
    }

    return data;
  }

  /**
   * Update error resolution status
   */
  static async updateResolutionStatus(
    id: string,
    status: ErrorResolutionStatus
  ): Promise<ErrorLog | null> {
    const { data, error } = await supabase
      .from('error_logs')
      .update({
        resolution_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating resolution status:', error);
      return null;
    }

    return data;
  }

  /**
   * Get critical errors in the last period
   */
  static async getCriticalErrors(hours = 24): Promise<ErrorLog[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .eq('severity', 'critical')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching critical errors:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get unresolved errors count by severity
   */
  static async getUnresolvedErrorStats(): Promise<{
    critical: number;
    warning: number;
    info: number;
    total: number;
  }> {
    const { data, error } = await supabase
      .from('error_logs')
      .select('severity')
      .neq('resolution_status', 'resolved');

    if (error) {
      console.error('Error fetching unresolved error stats:', error);
      return { critical: 0, warning: 0, info: 0, total: 0 };
    }

    const stats = {
      critical: 0,
      warning: 0,
      info: 0,
      total: data?.length || 0
    };

    data?.forEach(error => {
      stats[error.severity as ErrorSeverity]++;
    });

    return stats;
  }

  /**
   * Get error trends by service
   */
  static async getErrorTrendsByService(days = 7): Promise<{
    [serviceName: string]: {
      [severity: string]: number;
    };
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('error_logs')
      .select('service_name, severity')
      .gte('timestamp', since.toISOString());

    if (error) {
      console.error('Error fetching error trends:', error);
      return {};
    }

    const trends: {
      [serviceName: string]: {
        [severity: string]: number;
      };
    } = {};

    data?.forEach(error => {
      if (!trends[error.service_name]) {
        trends[error.service_name] = {
          critical: 0,
          warning: 0,
          info: 0
        };
      }
      trends[error.service_name][error.severity]++;
    });

    return trends;
  }

  /**
   * Get most frequent error patterns
   */
  static async getFrequentErrorPatterns(
    limit = 10,
    hours = 24
  ): Promise<{
    errorMessage: string;
    count: number;
    latestOccurrence: string;
    services: string[];
  }[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const { data, error } = await supabase
      .from('error_logs')
      .select('error_message, service_name, timestamp')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching frequent error patterns:', error);
      return [];
    }

    // Group by error message
    const errorGroups: {
      [errorMessage: string]: {
        count: number;
        latestOccurrence: string;
        services: Set<string>;
      };
    } = {};

    data?.forEach(error => {
      if (!errorGroups[error.error_message]) {
        errorGroups[error.error_message] = {
          count: 0,
          latestOccurrence: error.timestamp,
          services: new Set()
        };
      }

      errorGroups[error.error_message].count++;
      errorGroups[error.error_message].services.add(error.service_name);

      // Update latest occurrence if this is newer
      if (error.timestamp > errorGroups[error.error_message].latestOccurrence) {
        errorGroups[error.error_message].latestOccurrence = error.timestamp;
      }
    });

    // Convert to array and sort by frequency
    return Object.keys(errorGroups)
      .map(errorMessage => ({
        errorMessage,
        count: errorGroups[errorMessage].count,
        latestOccurrence: errorGroups[errorMessage].latestOccurrence,
        services: Array.from(errorGroups[errorMessage].services)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get errors by endpoint
   */
  static async getErrorsByEndpoint(
    endpoint: string,
    hours = 24
  ): Promise<ErrorLog[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .eq('endpoint', endpoint)
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching errors by endpoint:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Log critical error (convenience method)
   */
  static async logCritical(
    serviceName: ServiceName,
    errorMessage: string,
    stackTrace?: string,
    endpoint?: string,
    userContext?: Record<string, any>
  ): Promise<ErrorLog | null> {
    return this.logError({
      severity: 'critical',
      errorMessage,
      serviceName,
      stackTrace,
      endpoint,
      userContext
    });
  }

  /**
   * Log warning error (convenience method)
   */
  static async logWarning(
    serviceName: ServiceName,
    errorMessage: string,
    endpoint?: string,
    userContext?: Record<string, any>
  ): Promise<ErrorLog | null> {
    return this.logError({
      severity: 'warning',
      errorMessage,
      serviceName,
      endpoint,
      userContext
    });
  }

  /**
   * Log info error (convenience method)
   */
  static async logInfo(
    serviceName: ServiceName,
    errorMessage: string,
    endpoint?: string,
    userContext?: Record<string, any>
  ): Promise<ErrorLog | null> {
    return this.logError({
      severity: 'info',
      errorMessage,
      serviceName,
      endpoint,
      userContext
    });
  }

  /**
   * Mark error as investigating
   */
  static async markAsInvestigating(id: string): Promise<ErrorLog | null> {
    return this.updateResolutionStatus(id, 'investigating');
  }

  /**
   * Mark error as resolved
   */
  static async markAsResolved(id: string): Promise<ErrorLog | null> {
    return this.updateResolutionStatus(id, 'resolved');
  }

  /**
   * Clean up old error logs (for data retention)
   */
  static async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from('error_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Error deleting old error logs:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Get error rate over time
   */
  static async getErrorRate(
    serviceName?: ServiceName,
    hours = 24
  ): Promise<{
    timestamp: string;
    errorCount: number;
  }[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    let query = supabase
      .from('error_logs')
      .select('timestamp')
      .gte('timestamp', since.toISOString());

    if (serviceName) {
      query = query.eq('service_name', serviceName);
    }

    const { data, error } = await query.order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching error rate:', error);
      return [];
    }

    // Group by hour
    const hourlyErrors: { [hour: string]: number } = {};

    data?.forEach(error => {
      const hour = new Date(error.timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
      hourlyErrors[hour] = (hourlyErrors[hour] || 0) + 1;
    });

    return Object.keys(hourlyErrors).map(timestamp => ({
      timestamp: timestamp + ':00:00.000Z',
      errorCount: hourlyErrors[timestamp]
    }));
  }
}