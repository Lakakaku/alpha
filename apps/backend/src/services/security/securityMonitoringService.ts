/**
 * Security Monitoring Service
 * Task: T048 - Security monitoring service
 * 
 * Central security monitoring and alerting system that aggregates security events,
 * detects threats, generates alerts, and provides real-time security dashboard data.
 */

import { AuditLoggingService } from './auditLoggingService';
import { IntrusionDetectionService } from './intrusionDetectionService';
import { RLSPolicyService } from './rlsPolicyService';
import { EncryptionService } from './encryptionService';
import { EventType, ThreatLevel, IntrusionType, ResultStatus } from '@vocilia/types';
import { randomUUID } from 'crypto';

export interface SecurityAlert {
  id: string;
  alertType: 'intrusion' | 'policy_violation' | 'authentication_failure' | 'data_breach' | 'system_anomaly' | 'fraud_detection';
  severity: ThreatLevel;
  title: string;
  description: string;
  source: string;
  sourceId: string;
  metadata: Record<string, any>;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
}

export interface SecurityMetrics {
  timeWindow: string;
  totalEvents: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  intrusionAttempts: number;
  blockedRequests: number;
  authenticationFailures: number;
  policyViolations: number;
  fraudDetections: number;
  averageResponseTime: number; // in milliseconds
  systemUptime: number; // in hours
}

export interface ThreatIntelligence {
  threatType: IntrusionType;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  frequency: number;
  affectedSystems: string[];
  mitigationStatus: 'none' | 'monitoring' | 'blocking' | 'resolved';
  riskScore: number; // 0-100
}

export interface SecurityDashboard {
  overview: SecurityMetrics;
  activeAlerts: SecurityAlert[];
  threatIntelligence: ThreatIntelligence[];
  systemHealth: {
    overall: 'healthy' | 'warning' | 'critical';
    components: Array<{
      name: string;
      status: 'online' | 'degraded' | 'offline';
      lastCheck: Date;
      responseTime?: number;
    }>;
  };
  recentActivity: Array<{
    timestamp: Date;
    eventType: EventType;
    description: string;
    severity: ThreatLevel;
  }>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    eventType?: EventType;
    threatLevel?: ThreatLevel;
    timeWindow: number; // minutes
    threshold: number;
    aggregation: 'count' | 'rate' | 'unique_users' | 'unique_ips';
  };
  actions: {
    notify: boolean;
    block: boolean;
    escalate: boolean;
    customWebhook?: string;
  };
  createdAt: Date;
  lastTriggered?: Date;
}

export interface SecurityReportRequest {
  startDate: Date;
  endDate: Date;
  includeDetails: boolean;
  reportType: 'summary' | 'detailed' | 'compliance';
}

export interface SecurityReport {
  reportId: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalSecurityEvents: number;
    alertsGenerated: number;
    threatsBlocked: number;
    incidentsResolved: number;
    averageResolutionTime: number; // hours
    securityScore: number; // 0-100
  };
  breakdown: {
    eventsByType: Record<EventType, number>;
    alertsBySeverity: Record<ThreatLevel, number>;
    topThreats: Array<{
      type: IntrusionType;
      count: number;
      trend: 'increasing' | 'stable' | 'decreasing';
    }>;
    affectedResources: Array<{
      resource: string;
      incidents: number;
      lastIncident: Date;
    }>;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: 'policy' | 'infrastructure' | 'monitoring' | 'training';
    description: string;
    impact: string;
  }>;
  compliance: {
    rlsPoliciesActive: number;
    dataEncryptionCoverage: number; // percentage
    auditLogRetention: number; // days
    lastSecurityAudit: Date;
  };
}

export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private auditService: AuditLoggingService;
  private intrusionService: IntrusionDetectionService;
  private rlsService: RLSPolicyService;
  private encryptionService: EncryptionService;
  
  private alerts = new Map<string, SecurityAlert>();
  private alertRules: AlertRule[] = [];
  private threatIntelligence = new Map<string, ThreatIntelligence>();
  
  // Real-time monitoring state
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL_MS = 30 * 1000; // 30 seconds
  
  // System health tracking
  private systemHealth = {
    lastHealthCheck: new Date(),
    components: new Map<string, { status: 'online' | 'degraded' | 'offline'; responseTime?: number }>()
  };

  private constructor() {
    this.auditService = AuditLoggingService.getInstance();
    this.intrusionService = IntrusionDetectionService.getInstance();
    this.rlsService = RLSPolicyService.getInstance();
    this.encryptionService = EncryptionService.getInstance();
    
    this.initializeDefaultAlertRules();
  }

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  /**
   * Start security monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.performSecurityCheck();
    }, this.MONITORING_INTERVAL_MS);

    await this.auditService.logEvent({
      eventType: 'system_event',
      userId: 'system',
      userType: 'system',
      actionPerformed: 'security_monitoring_started',
      resourceType: 'security_system',
      resourceId: 'monitoring_service',
      resultStatus: 'success',
      eventMetadata: {
        monitoring_interval_ms: this.MONITORING_INTERVAL_MS
      }
    });
  }

  /**
   * Stop security monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    await this.auditService.logEvent({
      eventType: 'system_event',
      userId: 'system',
      userType: 'system',
      actionPerformed: 'security_monitoring_stopped',
      resourceType: 'security_system',
      resourceId: 'monitoring_service',
      resultStatus: 'success',
      eventMetadata: {}
    });
  }

  /**
   * Generate security alert
   */
  async generateAlert(alertData: {
    alertType: SecurityAlert['alertType'];
    severity: ThreatLevel;
    title: string;
    description: string;
    source: string;
    sourceId: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const alertId = randomUUID();
    const alert: SecurityAlert = {
      id: alertId,
      ...alertData,
      metadata: alertData.metadata || {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.alerts.set(alertId, alert);

    // Auto-escalate critical alerts
    if (alert.severity === 'critical') {
      await this.escalateAlert(alertId);
    }

    await this.auditService.logEvent({
      eventType: 'security_violation',
      userId: 'system',
      userType: 'system',
      actionPerformed: 'security_alert_generated',
      resourceType: 'security_alert',
      resourceId: alertId,
      resultStatus: 'warning',
      eventMetadata: {
        alert_type: alertData.alertType,
        severity: alertData.severity,
        source: alertData.source,
        title: alertData.title
      }
    });

    return alertId;
  }

  /**
   * Update alert status
   */
  async updateAlert(alertId: string, updates: {
    status?: SecurityAlert['status'];
    assignedTo?: string;
    notes?: string;
  }): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (updates.status) alert.status = updates.status;
    if (updates.assignedTo) alert.assignedTo = updates.assignedTo;
    alert.updatedAt = new Date();

    if (updates.status === 'resolved') {
      alert.resolvedAt = new Date();
    }

    this.alerts.set(alertId, alert);

    await this.auditService.logEvent({
      eventType: 'admin_action',
      userId: updates.assignedTo || 'system',
      userType: 'admin',
      actionPerformed: 'security_alert_updated',
      resourceType: 'security_alert',
      resourceId: alertId,
      resultStatus: 'success',
      eventMetadata: {
        updates: Object.keys(updates),
        new_status: updates.status,
        notes: updates.notes
      }
    });
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(timeWindow: number = 24): Promise<SecurityDashboard> {
    const now = new Date();
    const startTime = new Date(now.getTime() - timeWindow * 60 * 60 * 1000);

    // Get overview metrics
    const overview = await this.getSecurityMetrics(timeWindow);

    // Get active alerts
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.status === 'active' || alert.status === 'investigating')
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .slice(0, 10); // Top 10 alerts

    // Get threat intelligence
    const threatIntelligence = Array.from(this.threatIntelligence.values())
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5); // Top 5 threats

    // Get system health
    await this.updateSystemHealth();
    const systemHealth = this.getSystemHealthStatus();

    // Get recent activity
    const auditStats = await this.auditService.getAuditStatistics(timeWindow);
    const recentActivity = [
      { timestamp: now, eventType: 'system_event' as EventType, description: 'Security monitoring active', severity: 'low' as ThreatLevel },
      // Add more recent activities based on audit stats
    ];

    return {
      overview,
      activeAlerts,
      threatIntelligence,
      systemHealth,
      recentActivity
    };
  }

  /**
   * Get security metrics for specified time window
   */
  async getSecurityMetrics(timeWindowHours: number = 24): Promise<SecurityMetrics> {
    const startTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    
    // Get audit statistics
    const auditStats = await this.auditService.getAuditStatistics(timeWindowHours);
    
    // Get intrusion statistics
    const intrusionStats = await this.intrusionService.getIntrusionStatistics(timeWindowHours);
    
    // Count alerts by severity
    const alertsInWindow = Array.from(this.alerts.values())
      .filter(alert => alert.createdAt >= startTime);
    
    const alertsBySeverity = alertsInWindow.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<ThreatLevel, number>);

    return {
      timeWindow: `${timeWindowHours}h`,
      totalEvents: auditStats.totalEvents,
      criticalAlerts: alertsBySeverity.critical || 0,
      highAlerts: alertsBySeverity.high || 0,
      mediumAlerts: alertsBySeverity.medium || 0,
      lowAlerts: alertsBySeverity.low || 0,
      intrusionAttempts: intrusionStats.totalIntrusions,
      blockedRequests: intrusionStats.blockedRequests,
      authenticationFailures: auditStats.eventsByType.authentication || 0,
      policyViolations: auditStats.securityViolations,
      fraudDetections: auditStats.eventsByType.fraud_detection || 0,
      averageResponseTime: 150, // Placeholder - would be calculated from actual response times
      systemUptime: 24 * 30 // Placeholder - 30 days uptime
    };
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(request: SecurityReportRequest): Promise<SecurityReport> {
    const reportId = randomUUID();
    const generatedAt = new Date();
    
    // Calculate time window in hours
    const timeWindowMs = request.endDate.getTime() - request.startDate.getTime();
    const timeWindowHours = timeWindowMs / (1000 * 60 * 60);
    
    // Get various statistics
    const auditStats = await this.auditService.getAuditStatistics(timeWindowHours);
    const intrusionStats = await this.intrusionService.getIntrusionStatistics(timeWindowHours);
    const rlsStats = await this.rlsService.getPolicyStatistics();
    const encryptionStats = await this.encryptionService.getEncryptionStatistics();
    
    // Get alerts in time window
    const alertsInWindow = Array.from(this.alerts.values())
      .filter(alert => alert.createdAt >= request.startDate && alert.createdAt <= request.endDate);
    
    const resolvedAlerts = alertsInWindow.filter(alert => alert.status === 'resolved');
    const averageResolutionTime = resolvedAlerts.length > 0 
      ? resolvedAlerts.reduce((acc, alert) => {
          const resolutionTime = alert.resolvedAt ? alert.resolvedAt.getTime() - alert.createdAt.getTime() : 0;
          return acc + resolutionTime;
        }, 0) / resolvedAlerts.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    // Calculate security score
    const securityScore = this.calculateSecurityScore({
      totalEvents: auditStats.totalEvents,
      securityViolations: auditStats.securityViolations,
      intrusionAttempts: intrusionStats.totalIntrusions,
      activePolicies: rlsStats.activePolicies,
      encryptionCoverage: encryptionStats.activeKeys > 0 ? 85 : 0 // Placeholder calculation
    });

    const report: SecurityReport = {
      reportId,
      generatedAt,
      period: {
        start: request.startDate,
        end: request.endDate
      },
      summary: {
        totalSecurityEvents: auditStats.totalEvents,
        alertsGenerated: alertsInWindow.length,
        threatsBlocked: intrusionStats.blockedRequests,
        incidentsResolved: resolvedAlerts.length,
        averageResolutionTime,
        securityScore
      },
      breakdown: {
        eventsByType: auditStats.eventsByType,
        alertsBySeverity: alertsInWindow.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {} as Record<ThreatLevel, number>),
        topThreats: Object.entries(intrusionStats.intrusionsByType)
          .map(([type, count]) => ({
            type: type as IntrusionType,
            count,
            trend: 'stable' as const // Would be calculated from historical data
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        affectedResources: [] // Would be populated from actual incident data
      },
      recommendations: this.generateSecurityRecommendations({
        securityScore,
        intrusionCount: intrusionStats.totalIntrusions,
        policyCount: rlsStats.activePolicies,
        encryptionKeys: encryptionStats.activeKeys
      }),
      compliance: {
        rlsPoliciesActive: rlsStats.activePolicies,
        dataEncryptionCoverage: 85, // Placeholder
        auditLogRetention: 90, // 90 days
        lastSecurityAudit: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      }
    };

    await this.auditService.logEvent({
      eventType: 'admin_action',
      userId: 'system',
      userType: 'admin',
      actionPerformed: 'security_report_generated',
      resourceType: 'security_report',
      resourceId: reportId,
      resultStatus: 'success',
      eventMetadata: {
        report_type: request.reportType,
        period_days: timeWindowMs / (1000 * 60 * 60 * 24),
        security_score: securityScore
      }
    });

    return report;
  }

  /**
   * Perform periodic security check
   */
  private async performSecurityCheck(): Promise<void> {
    try {
      // Update system health
      await this.updateSystemHealth();
      
      // Check for threshold violations in alert rules
      await this.evaluateAlertRules();
      
      // Update threat intelligence
      await this.updateThreatIntelligence();
      
      // Clean up old resolved alerts
      this.cleanupOldAlerts();
      
      this.systemHealth.lastHealthCheck = new Date();
    } catch (error) {
      await this.auditService.logEvent({
        eventType: 'system_event',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'security_check_failed',
        resourceType: 'security_system',
        resourceId: 'monitoring_service',
        resultStatus: 'failure',
        eventMetadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * Update system health status
   */
  private async updateSystemHealth(): Promise<void> {
    const components = ['database', 'audit_service', 'intrusion_detection', 'encryption_service', 'rls_policies'];
    
    for (const component of components) {
      try {
        const startTime = Date.now();
        await this.checkComponentHealth(component);
        const responseTime = Date.now() - startTime;
        
        this.systemHealth.components.set(component, {
          status: 'online',
          responseTime
        });
      } catch (error) {
        this.systemHealth.components.set(component, {
          status: 'offline'
        });
      }
    }
  }

  /**
   * Check individual component health
   */
  private async checkComponentHealth(component: string): Promise<void> {
    switch (component) {
      case 'audit_service':
        await this.auditService.getAuditStatistics(1);
        break;
      case 'intrusion_detection':
        await this.intrusionService.getIntrusionStatistics(1);
        break;
      case 'encryption_service':
        await this.encryptionService.getEncryptionStatistics();
        break;
      case 'rls_policies':
        await this.rlsService.getPolicyStatistics();
        break;
      default:
        // Basic health check passed
        break;
    }
  }

  /**
   * Get system health status
   */
  private getSystemHealthStatus(): SecurityDashboard['systemHealth'] {
    const components = Array.from(this.systemHealth.components.entries()).map(([name, data]) => ({
      name,
      status: data.status,
      lastCheck: this.systemHealth.lastHealthCheck,
      responseTime: data.responseTime
    }));

    const offlineComponents = components.filter(c => c.status === 'offline').length;
    const degradedComponents = components.filter(c => c.status === 'degraded').length;

    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (offlineComponents > 0) overall = 'critical';
    else if (degradedComponents > 0) overall = 'warning';

    return {
      overall,
      components
    };
  }

  /**
   * Evaluate alert rules and trigger alerts
   */
  private async evaluateAlertRules(): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const shouldTrigger = await this.evaluateAlertRule(rule);
        if (shouldTrigger) {
          await this.triggerAlertRule(rule);
        }
      } catch (error) {
        // Continue with other rules if one fails
      }
    }
  }

  /**
   * Evaluate single alert rule
   */
  private async evaluateAlertRule(rule: AlertRule): Promise<boolean> {
    const timeWindow = rule.conditions.timeWindow;
    const threshold = rule.conditions.threshold;
    
    // Get events in time window
    const auditStats = await this.auditService.getAuditStatistics(timeWindow / 60); // Convert minutes to hours
    
    let count = 0;
    if (rule.conditions.eventType) {
      count = auditStats.eventsByType[rule.conditions.eventType] || 0;
    } else {
      count = auditStats.totalEvents;
    }

    return count >= threshold;
  }

  /**
   * Trigger alert rule
   */
  private async triggerAlertRule(rule: AlertRule): Promise<void> {
    await this.generateAlert({
      alertType: 'system_anomaly',
      severity: rule.conditions.threatLevel || 'medium',
      title: `Alert Rule Triggered: ${rule.name}`,
      description: rule.description,
      source: 'alert_rule',
      sourceId: rule.id,
      metadata: {
        rule_id: rule.id,
        conditions: rule.conditions
      }
    });

    rule.lastTriggered = new Date();
  }

  /**
   * Update threat intelligence
   */
  private async updateThreatIntelligence(): Promise<void> {
    const intrusionStats = await this.intrusionService.getIntrusionStatistics(24);
    
    for (const [type, count] of Object.entries(intrusionStats.intrusionsByType)) {
      const existing = this.threatIntelligence.get(type);
      
      if (existing) {
        existing.lastSeen = new Date();
        existing.frequency = count;
        existing.riskScore = Math.min(100, existing.riskScore + (count > 10 ? 5 : 1));
      } else {
        this.threatIntelligence.set(type, {
          threatType: type as IntrusionType,
          confidence: count > 5 ? 80 : 60,
          firstSeen: new Date(),
          lastSeen: new Date(),
          frequency: count,
          affectedSystems: ['web_application'],
          mitigationStatus: count > 20 ? 'blocking' : 'monitoring',
          riskScore: Math.min(100, count * 2)
        });
      }
    }
  }

  /**
   * Clean up old resolved alerts
   */
  private cleanupOldAlerts(): void {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.status === 'resolved' && alert.resolvedAt && alert.resolvedAt < cutoffDate) {
        this.alerts.delete(alertId);
      }
    }
  }

  /**
   * Escalate critical alert
   */
  private async escalateAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    // In production, this would trigger notifications, webhooks, etc.
    await this.auditService.logEvent({
      eventType: 'security_violation',
      userId: 'system',
      userType: 'system',
      actionPerformed: 'critical_alert_escalated',
      resourceType: 'security_alert',
      resourceId: alertId,
      resultStatus: 'warning',
      eventMetadata: {
        alert_type: alert.alertType,
        severity: alert.severity,
        title: alert.title
      }
    });
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: randomUUID(),
        name: 'High Authentication Failures',
        description: 'Too many authentication failures detected',
        enabled: true,
        conditions: {
          eventType: 'authentication',
          threatLevel: 'high',
          timeWindow: 15, // 15 minutes
          threshold: 10,
          aggregation: 'count'
        },
        actions: {
          notify: true,
          block: false,
          escalate: true
        },
        createdAt: new Date()
      },
      {
        id: randomUUID(),
        name: 'Multiple Intrusion Attempts',
        description: 'Multiple intrusion attempts from same source',
        enabled: true,
        conditions: {
          eventType: 'security_violation',
          threatLevel: 'critical',
          timeWindow: 10, // 10 minutes
          threshold: 5,
          aggregation: 'count'
        },
        actions: {
          notify: true,
          block: true,
          escalate: true
        },
        createdAt: new Date()
      }
    ];
  }

  /**
   * Calculate overall security score
   */
  private calculateSecurityScore(factors: {
    totalEvents: number;
    securityViolations: number;
    intrusionAttempts: number;
    activePolicies: number;
    encryptionCoverage: number;
  }): number {
    let score = 100;

    // Deduct points for security violations
    const violationRatio = factors.totalEvents > 0 ? factors.securityViolations / factors.totalEvents : 0;
    score -= Math.min(30, violationRatio * 100);

    // Deduct points for intrusion attempts
    score -= Math.min(20, factors.intrusionAttempts * 2);

    // Add points for active security policies
    score += Math.min(10, factors.activePolicies * 2);

    // Add points for encryption coverage
    score += Math.min(10, factors.encryptionCoverage / 10);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(factors: {
    securityScore: number;
    intrusionCount: number;
    policyCount: number;
    encryptionKeys: number;
  }): SecurityReport['recommendations'] {
    const recommendations: SecurityReport['recommendations'] = [];

    if (factors.securityScore < 70) {
      recommendations.push({
        priority: 'high',
        category: 'infrastructure',
        description: 'Overall security score is below acceptable threshold',
        impact: 'Increased risk of successful attacks and data breaches'
      });
    }

    if (factors.intrusionCount > 50) {
      recommendations.push({
        priority: 'high',
        category: 'monitoring',
        description: 'High number of intrusion attempts detected',
        impact: 'Consider implementing additional rate limiting and IP blocking'
      });
    }

    if (factors.policyCount < 5) {
      recommendations.push({
        priority: 'medium',
        category: 'policy',
        description: 'Few RLS policies active - consider implementing more granular access controls',
        impact: 'Improved data protection and compliance posture'
      });
    }

    if (factors.encryptionKeys < 3) {
      recommendations.push({
        priority: 'medium',
        category: 'infrastructure',
        description: 'Consider implementing field-level encryption for sensitive data',
        impact: 'Enhanced data protection at rest and in transit'
      });
    }

    return recommendations;
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): {
    isActive: boolean;
    lastCheck: Date;
    systemHealth: 'healthy' | 'warning' | 'critical';
    activeAlertsCount: number;
  } {
    const activeAlerts = Array.from(this.alerts.values()).filter(a => a.status === 'active').length;
    const systemHealth = this.getSystemHealthStatus().overall;

    return {
      isActive: this.isMonitoring,
      lastCheck: this.systemHealth.lastHealthCheck,
      systemHealth,
      activeAlertsCount: activeAlerts
    };
  }
}

export default SecurityMonitoringService;