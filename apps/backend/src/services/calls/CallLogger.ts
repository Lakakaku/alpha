import { CallEvent } from '../../models/CallEvent';
import { CallSession } from '../../models/CallSession';
import { CallResponse } from '../../models/CallResponse';
import { supabase } from '../../config/supabase';

export interface LogEntry {
  sessionId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  timestamp?: Date;
  providerId?: string;
  eventType?: string;
}

export interface CallLogFilter {
  sessionId?: string;
  businessId?: string;
  level?: string[];
  eventType?: string[];
  providerId?: string[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface CallLogStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageDuration: number;
  totalCost: number;
  averageCost: number;
  providerStats: {
    fortyelks: { calls: number; cost: number; successRate: number };
    twilio: { calls: number; cost: number; successRate: number };
  };
  questionStats: {
    totalQuestions: number;
    averageResponseTime: number;
    responseRate: number;
  };
}

export class CallLogger {
  private static instance: CallLogger;
  private logBuffer: LogEntry[] = [];
  private bufferSize = 100;
  private flushInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startAutoFlush();
  }

  static getInstance(): CallLogger {
    if (!CallLogger.instance) {
      CallLogger.instance = new CallLogger();
    }
    return CallLogger.instance;
  }

  /**
   * Log an info message
   */
  async info(sessionId: string, message: string, data?: any, providerId?: string): Promise<void> {
    await this.log({
      sessionId,
      level: 'info',
      message,
      data,
      providerId
    });
  }

  /**
   * Log a warning message
   */
  async warn(sessionId: string, message: string, data?: any, providerId?: string): Promise<void> {
    await this.log({
      sessionId,
      level: 'warn',
      message,
      data,
      providerId
    });
  }

  /**
   * Log an error message
   */
  async error(sessionId: string, message: string, data?: any, providerId?: string): Promise<void> {
    await this.log({
      sessionId,
      level: 'error',
      message,
      data,
      providerId
    });
  }

  /**
   * Log a debug message
   */
  async debug(sessionId: string, message: string, data?: any, providerId?: string): Promise<void> {
    await this.log({
      sessionId,
      level: 'debug',
      message,
      data,
      providerId
    });
  }

  /**
   * Log a call event
   */
  async logCallEvent(sessionId: string, eventType: string, message: string, data?: any, providerId?: string): Promise<void> {
    await this.log({
      sessionId,
      level: 'info',
      message,
      data,
      providerId,
      eventType
    });

    // Also create a CallEvent record
    await CallEvent.create({
      sessionId,
      eventType,
      providerId: providerId || 'system',
      eventData: {
        message,
        ...data,
        logged_by: 'call-logger'
      }
    });
  }

  /**
   * Log a call lifecycle event
   */
  async logCallLifecycle(sessionId: string, phase: string, details?: any): Promise<void> {
    await this.logCallEvent(
      sessionId,
      `call_lifecycle_${phase}`,
      `Call ${phase}`,
      details,
      'system'
    );
  }

  /**
   * Log telephony provider interaction
   */
  async logTelephonyInteraction(sessionId: string, providerId: string, action: string, result: any): Promise<void> {
    await this.logCallEvent(
      sessionId,
      'telephony_interaction',
      `${providerId} ${action}`,
      {
        provider: providerId,
        action,
        result,
        timestamp: new Date().toISOString()
      },
      providerId
    );
  }

  /**
   * Log AI service interaction
   */
  async logAIInteraction(sessionId: string, action: string, result: any): Promise<void> {
    await this.logCallEvent(
      sessionId,
      'ai_interaction',
      `AI ${action}`,
      {
        action,
        result,
        timestamp: new Date().toISOString()
      },
      'openai'
    );
  }

  /**
   * Get logs for a specific call session
   */
  async getCallLogs(sessionId: string): Promise<CallEvent[]> {
    return await CallEvent.findBySessionId(sessionId);
  }

  /**
   * Search logs with filters
   */
  async searchLogs(filter: CallLogFilter): Promise<CallEvent[]> {
    let query = supabase
      .from('call_events')
      .select('*');

    if (filter.sessionId) {
      query = query.eq('session_id', filter.sessionId);
    }

    if (filter.eventType && filter.eventType.length > 0) {
      query = query.in('event_type', filter.eventType);
    }

    if (filter.providerId && filter.providerId.length > 0) {
      query = query.in('provider_id', filter.providerId);
    }

    if (filter.startDate) {
      query = query.gte('created_at', filter.startDate.toISOString());
    }

    if (filter.endDate) {
      query = query.lte('created_at', filter.endDate.toISOString());
    }

    if (filter.businessId) {
      // Join with call_sessions to filter by business
      query = query
        .select('*, call_sessions!inner(business_id)')
        .eq('call_sessions.business_id', filter.businessId);
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(filter.limit || 100);

    if (filter.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to search logs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Generate call statistics
   */
  async generateCallStats(businessId?: string, startDate?: Date, endDate?: Date): Promise<CallLogStats> {
    try {
      // Build session query
      let sessionQuery = supabase
        .from('call_sessions')
        .select('*');

      if (businessId) {
        sessionQuery = sessionQuery.eq('business_id', businessId);
      }

      if (startDate) {
        sessionQuery = sessionQuery.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        sessionQuery = sessionQuery.lte('created_at', endDate.toISOString());
      }

      const { data: sessions, error: sessionError } = await sessionQuery;

      if (sessionError || !sessions) {
        throw new Error('Failed to fetch call sessions');
      }

      // Calculate basic stats
      const totalCalls = sessions.length;
      const successfulCalls = sessions.filter(s => s.status === 'completed').length;
      const failedCalls = sessions.filter(s => ['failed', 'timeout'].includes(s.status)).length;
      
      const completedSessions = sessions.filter(s => s.actual_duration);
      const averageDuration = completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + (s.actual_duration || 0), 0) / completedSessions.length
        : 0;

      const sessionsWithCost = sessions.filter(s => s.actual_cost);
      const totalCost = sessionsWithCost.reduce((sum, s) => sum + (s.actual_cost || 0), 0);
      const averageCost = sessionsWithCost.length > 0 ? totalCost / sessionsWithCost.length : 0;

      // Provider stats
      const fortyElksSessions = sessions.filter(s => s.provider_id === 'fortyelks');
      const twilioSessions = sessions.filter(s => s.provider_id === 'twilio');

      const fortyElksStats = {
        calls: fortyElksSessions.length,
        cost: fortyElksSessions.reduce((sum, s) => sum + (s.actual_cost || 0), 0),
        successRate: fortyElksSessions.length > 0 
          ? fortyElksSessions.filter(s => s.status === 'completed').length / fortyElksSessions.length
          : 0
      };

      const twilioStats = {
        calls: twilioSessions.length,
        cost: twilioSessions.reduce((sum, s) => sum + (s.actual_cost || 0), 0),
        successRate: twilioSessions.length > 0
          ? twilioSessions.filter(s => s.status === 'completed').length / twilioSessions.length
          : 0
      };

      // Question stats
      const sessionIds = sessions.map(s => s.id);
      let responsesQuery = supabase
        .from('call_responses')
        .select('*');

      if (sessionIds.length > 0) {
        responsesQuery = responsesQuery.in('session_id', sessionIds);
      }

      const { data: responses } = await responsesQuery;
      const totalQuestions = sessions.reduce((sum, s) => sum + (s.expected_questions || 0), 0);
      const responseRate = totalQuestions > 0 ? (responses?.length || 0) / totalQuestions : 0;

      return {
        totalCalls,
        successfulCalls,
        failedCalls,
        averageDuration,
        totalCost,
        averageCost,
        providerStats: {
          fortyelks: fortyElksStats,
          twilio: twilioStats
        },
        questionStats: {
          totalQuestions,
          averageResponseTime: 15, // Placeholder - would need event timing analysis
          responseRate
        }
      };

    } catch (error) {
      console.error('Failed to generate call stats:', error);
      throw error;
    }
  }

  /**
   * Export call logs to CSV format
   */
  async exportLogs(filter: CallLogFilter): Promise<string> {
    const logs = await this.searchLogs(filter);
    
    const csvHeaders = 'Session ID,Event Type,Provider,Message,Timestamp,Data\n';
    const csvRows = logs.map(log => {
      const data = log.eventData ? JSON.stringify(log.eventData).replace(/"/g, '""') : '';
      return `"${log.sessionId}","${log.eventType}","${log.providerId}","${log.eventData?.message || ''}","${log.createdAt}","${data}"`;
    }).join('\n');

    return csvHeaders + csvRows;
  }

  /**
   * Private log method
   */
  private async log(entry: LogEntry): Promise<void> {
    entry.timestamp = entry.timestamp || new Date();
    
    // Add to buffer
    this.logBuffer.push(entry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      await this.flushLogs();
    }

    // Also log to console for development
    const timestamp = entry.timestamp.toISOString();
    const message = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.sessionId}] ${entry.message}`;
    
    switch (entry.level) {
      case 'error':
        console.error(message, entry.data);
        break;
      case 'warn':
        console.warn(message, entry.data);
        break;
      case 'debug':
        console.debug(message, entry.data);
        break;
      default:
        console.log(message, entry.data);
    }
  }

  /**
   * Flush buffered logs to database
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Create call events for each log entry
      for (const log of logsToFlush) {
        await CallEvent.create({
          sessionId: log.sessionId,
          eventType: log.eventType || `log_${log.level}`,
          providerId: log.providerId || 'system',
          eventData: {
            level: log.level,
            message: log.message,
            data: log.data,
            timestamp: log.timestamp?.toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Failed to flush logs:', error);
      // Add logs back to buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushLogs();
    }, this.flushInterval);
  }

  /**
   * Stop the logger and flush remaining logs
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flushLogs();
  }
}

// Export singleton instance
export const callLogger = CallLogger.getInstance();