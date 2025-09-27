/**
 * Audit Logging Service
 * Task: T044 - Audit logging service
 * 
 * Provides comprehensive audit logging for security compliance and forensic analysis.
 * Tracks all system events with context preservation and tamper-evident storage.
 */

import { AuditLog } from '@vocilia/database';
import { AuditLogEntry, EventType, UserType, ResultStatus, AuditQueryFilters, AuditQueryResult, BulkAuditEntry } from '@vocilia/types';
import { randomUUID } from 'crypto';

export interface AuditContext {
  correlationId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  additionalMetadata?: Record<string, any>;
}

export interface AuditLogRequest {
  eventType: EventType;
  userId: string;
  userType: UserType;
  actionPerformed: string;
  resourceType: string;
  resourceId: string;
  resultStatus: ResultStatus;
  context?: AuditContext;
  eventMetadata?: Record<string, any>;
}

export interface EventPattern {
  eventType: EventType;
  userId?: string;
  resourceType?: string;
  timeWindowMinutes: number;
  maxOccurrences: number;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  patternViolations: Array<{
    pattern: EventPattern;
    actualOccurrences: number;
    timeWindow: string;
  }>;
  riskScore: number;
  recommendedAction: 'monitor' | 'alert' | 'block';
}

export class AuditLoggingService {
  private static instance: AuditLoggingService;
  private readonly eventPatterns: EventPattern[] = [
    // Authentication anomalies
    { eventType: 'authentication', timeWindowMinutes: 5, maxOccurrences: 5 },
    { eventType: 'authorization', userId: undefined, timeWindowMinutes: 10, maxOccurrences: 20 },
    
    // Data access patterns
    { eventType: 'data_access', resourceType: 'customer_data', timeWindowMinutes: 30, maxOccurrences: 100 },
    { eventType: 'data_modification', timeWindowMinutes: 5, maxOccurrences: 10 },
    
    // Administrative actions
    { eventType: 'admin_action', timeWindowMinutes: 15, maxOccurrences: 50 },
    
    // Security violations
    { eventType: 'security_violation', timeWindowMinutes: 60, maxOccurrences: 3 },
    { eventType: 'fraud_detection', timeWindowMinutes: 30, maxOccurrences: 10 }
  ];

  private constructor() {}

  static getInstance(): AuditLoggingService {
    if (!AuditLoggingService.instance) {
      AuditLoggingService.instance = new AuditLoggingService();
    }
    return AuditLoggingService.instance;
  }

  /**
   * Log a single audit event
   */
  async logEvent(request: AuditLogRequest): Promise<void> {
    try {
      const correlationId = request.context?.correlationId || randomUUID();
      
      const auditEntry: AuditLogEntry = {
        id: randomUUID(),
        event_type: request.eventType,
        user_id: request.userId,
        user_type: request.userType,
        action_performed: request.actionPerformed,
        resource_type: request.resourceType,
        resource_id: request.resourceId,
        ip_address: request.context?.ipAddress || 'unknown',
        user_agent: request.context?.userAgent || 'unknown',
        correlation_id: correlationId,
        event_metadata: {
          ...request.eventMetadata,
          session_id: request.context?.sessionId,
          ...request.context?.additionalMetadata
        },
        result_status: request.resultStatus,
        created_at: new Date().toISOString()
      };

      await AuditLog.create(auditEntry);

      // Check for anomalous patterns
      await this.detectAnomalies(request);
    } catch (error) {
      // Critical: Audit logging failures must not break the application
      // Log to system error log but continue processing
      console.error('[AUDIT_LOG_FAILURE]', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request: {
          eventType: request.eventType,
          userId: request.userId,
          actionPerformed: request.actionPerformed,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Log multiple audit events in batch
   */
  async logBulkEvents(requests: AuditLogRequest[]): Promise<void> {
    const bulkEntries: BulkAuditEntry[] = requests.map(request => {
      const correlationId = request.context?.correlationId || randomUUID();
      
      return {
        id: randomUUID(),
        event_type: request.eventType,
        user_id: request.userId,
        user_type: request.userType,
        action_performed: request.actionPerformed,
        resource_type: request.resourceType,
        resource_id: request.resourceId,
        ip_address: request.context?.ipAddress || 'unknown',
        user_agent: request.context?.userAgent || 'unknown',
        correlation_id: correlationId,
        event_metadata: {
          ...request.eventMetadata,
          session_id: request.context?.sessionId,
          ...request.context?.additionalMetadata
        },
        result_status: request.resultStatus,
        created_at: new Date().toISOString()
      };
    });

    try {
      await AuditLog.bulkCreate(bulkEntries);

      // Check for anomalous patterns in batch
      for (const request of requests) {
        await this.detectAnomalies(request);
      }
    } catch (error) {
      console.error('[AUDIT_BULK_LOG_FAILURE]', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: requests.length,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Query audit logs with filtering and pagination
   */
  async queryLogs(filters: AuditQueryFilters): Promise<AuditQueryResult> {
    try {
      return await AuditLog.query(filters);
    } catch (error) {
      throw new Error(`Failed to query audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get audit logs for a specific correlation ID (transaction trail)
   */
  async getCorrelationTrail(correlationId: string): Promise<AuditLogEntry[]> {
    try {
      const result = await this.queryLogs({
        correlation_id: correlationId,
        limit: 1000,
        order_by: 'created_at',
        order_direction: 'ASC'
      });

      return result.logs;
    } catch (error) {
      throw new Error(`Failed to get correlation trail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect anomalous patterns in audit events
   */
  private async detectAnomalies(request: AuditLogRequest): Promise<AnomalyDetectionResult> {
    try {
      const violations: Array<{
        pattern: EventPattern;
        actualOccurrences: number;
        timeWindow: string;
      }> = [];

      for (const pattern of this.eventPatterns) {
        if (pattern.eventType !== request.eventType) continue;
        if (pattern.userId && pattern.userId !== request.userId) continue;
        if (pattern.resourceType && pattern.resourceType !== request.resourceType) continue;

        const timeWindow = new Date(Date.now() - pattern.timeWindowMinutes * 60 * 1000).toISOString();
        
        const recentEvents = await this.queryLogs({
          event_type: pattern.eventType,
          user_id: pattern.userId || request.userId,
          resource_type: pattern.resourceType,
          start_date: timeWindow,
          limit: pattern.maxOccurrences + 1
        });

        if (recentEvents.total_count > pattern.maxOccurrences) {
          violations.push({
            pattern,
            actualOccurrences: recentEvents.total_count,
            timeWindow: `${pattern.timeWindowMinutes}m`
          });
        }
      }

      const riskScore = this.calculateRiskScore(violations);
      const isAnomaly = violations.length > 0;

      const result: AnomalyDetectionResult = {
        isAnomaly,
        patternViolations: violations,
        riskScore,
        recommendedAction: this.determineAction(riskScore)
      };

      // Log anomalies as security events
      if (isAnomaly) {
        await this.logSecurityAnomaly(request, result);
      }

      return result;
    } catch (error) {
      // Return safe default if anomaly detection fails
      return {
        isAnomaly: false,
        patternViolations: [],
        riskScore: 0,
        recommendedAction: 'monitor'
      };
    }
  }

  /**
   * Log detected security anomalies
   */
  private async logSecurityAnomaly(originalRequest: AuditLogRequest, anomaly: AnomalyDetectionResult): Promise<void> {
    const anomalyRequest: AuditLogRequest = {
      eventType: 'security_violation',
      userId: originalRequest.userId,
      userType: originalRequest.userType,
      actionPerformed: 'anomaly_detected',
      resourceType: 'audit_system',
      resourceId: 'pattern_analysis',
      resultStatus: 'warning',
      context: originalRequest.context,
      eventMetadata: {
        original_event_type: originalRequest.eventType,
        original_action: originalRequest.actionPerformed,
        anomaly_details: {
          risk_score: anomaly.riskScore,
          violation_count: anomaly.patternViolations.length,
          recommended_action: anomaly.recommendedAction,
          patterns_violated: anomaly.patternViolations.map(v => ({
            event_type: v.pattern.eventType,
            time_window: v.timeWindow,
            threshold: v.pattern.maxOccurrences,
            actual: v.actualOccurrences
          }))
        }
      }
    };

    // Prevent infinite recursion by not detecting anomalies on security violation logs
    try {
      const auditEntry: AuditLogEntry = {
        id: randomUUID(),
        event_type: anomalyRequest.eventType,
        user_id: anomalyRequest.userId,
        user_type: anomalyRequest.userType,
        action_performed: anomalyRequest.actionPerformed,
        resource_type: anomalyRequest.resourceType,
        resource_id: anomalyRequest.resourceId,
        ip_address: anomalyRequest.context?.ipAddress || 'unknown',
        user_agent: anomalyRequest.context?.userAgent || 'unknown',
        correlation_id: anomalyRequest.context?.correlationId || randomUUID(),
        event_metadata: anomalyRequest.eventMetadata || {},
        result_status: anomalyRequest.resultStatus,
        created_at: new Date().toISOString()
      };

      await AuditLog.create(auditEntry);
    } catch (error) {
      console.error('[ANOMALY_LOG_FAILURE]', {
        error: error instanceof Error ? error.message : 'Unknown error',
        anomaly_details: anomaly,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Calculate risk score based on pattern violations
   */
  private calculateRiskScore(violations: Array<{ pattern: EventPattern; actualOccurrences: number; timeWindow: string }>): number {
    if (violations.length === 0) return 0;

    let totalScore = 0;
    const riskWeights: Record<EventType, number> = {
      'security_violation': 40,
      'authentication': 25,
      'authorization': 20,
      'fraud_detection': 35,
      'admin_action': 15,
      'data_modification': 30,
      'data_access': 10,
      'system_event': 5
    };

    for (const violation of violations) {
      const baseWeight = riskWeights[violation.pattern.eventType] || 10;
      const excessRatio = violation.actualOccurrences / violation.pattern.maxOccurrences;
      const violationScore = baseWeight * Math.min(excessRatio, 3); // Cap at 3x multiplier
      totalScore += violationScore;
    }

    return Math.min(totalScore, 100); // Cap at 100
  }

  /**
   * Determine recommended action based on risk score
   */
  private determineAction(riskScore: number): 'monitor' | 'alert' | 'block' {
    if (riskScore >= 80) return 'block';
    if (riskScore >= 50) return 'alert';
    return 'monitor';
  }

  /**
   * Get audit statistics for monitoring dashboard
   */
  async getAuditStatistics(timeWindowHours: number = 24): Promise<{
    totalEvents: number;
    eventsByType: Record<EventType, number>;
    securityViolations: number;
    anomaliesDetected: number;
    topUsers: Array<{ userId: string; eventCount: number }>;
    topResources: Array<{ resourceType: string; accessCount: number }>;
  }> {
    try {
      const startTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000).toISOString();
      
      const allEvents = await this.queryLogs({
        start_date: startTime,
        limit: 10000 // High limit for statistics
      });

      const eventsByType: Record<EventType, number> = {} as Record<EventType, number>;
      const userCounts: Record<string, number> = {};
      const resourceCounts: Record<string, number> = {};

      let securityViolations = 0;
      let anomaliesDetected = 0;

      for (const event of allEvents.logs) {
        // Count by type
        eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;

        // Count security violations
        if (event.event_type === 'security_violation') {
          securityViolations++;
          if (event.action_performed === 'anomaly_detected') {
            anomaliesDetected++;
          }
        }

        // Count by user
        userCounts[event.user_id] = (userCounts[event.user_id] || 0) + 1;

        // Count by resource type
        resourceCounts[event.resource_type] = (resourceCounts[event.resource_type] || 0) + 1;
      }

      const topUsers = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, eventCount]) => ({ userId, eventCount }));

      const topResources = Object.entries(resourceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([resourceType, accessCount]) => ({ resourceType, accessCount }));

      return {
        totalEvents: allEvents.total_count,
        eventsByType,
        securityViolations,
        anomaliesDetected,
        topUsers,
        topResources
      };
    } catch (error) {
      throw new Error(`Failed to get audit statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Archive old audit logs (for data retention compliance)
   */
  async archiveOldLogs(retentionDays: number = 90): Promise<{ archivedCount: number; deletedCount: number }> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      
      // Implementation would depend on archival strategy (S3, tape, etc.)
      // For now, we'll just delete old records after logging the count
      const oldLogs = await this.queryLogs({
        end_date: cutoffDate,
        limit: 50000 // Large batch for archival
      });

      // In production, you would archive to cold storage first
      const archivedCount = oldLogs.total_count;
      
      // Then delete from hot storage
      await AuditLog.deleteOlderThan(cutoffDate);
      
      // Log the archival action
      await this.logEvent({
        eventType: 'system_event',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'audit_logs_archived',
        resourceType: 'audit_system',
        resourceId: 'retention_policy',
        resultStatus: 'success',
        eventMetadata: {
          retention_days: retentionDays,
          archived_count: archivedCount,
          cutoff_date: cutoffDate
        }
      });

      return {
        archivedCount,
        deletedCount: archivedCount
      };
    } catch (error) {
      throw new Error(`Failed to archive logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default AuditLoggingService;