/**
 * Intrusion Detection Service
 * Task: T045 - Intrusion detection service
 * 
 * Real-time intrusion detection system that monitors for security threats,
 * suspicious activities, and attack patterns across the Vocilia platform.
 */

import { IntrusionEvent, AuditLog } from '@vocilia/database';
import { IntrusionEventEntry, IntrusionType, ThreatLevel, IntrusionStatus, AuditQueryFilters } from '@vocilia/types';
import { AuditLoggingService } from './auditLoggingService';
import { randomUUID } from 'crypto';

export interface ThreatIndicator {
  type: 'ip_reputation' | 'user_agent_pattern' | 'request_frequency' | 'sql_injection' | 'xss_attempt' | 'brute_force' | 'data_exfiltration';
  value: string;
  confidence: number; // 0-100
  severity: ThreatLevel;
  description: string;
}

export interface IntrusionAnalysisRequest {
  ipAddress: string;
  userAgent?: string;
  userId?: string;
  requestPath: string;
  requestMethod: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  sessionId?: string;
  timestamp?: Date;
}

export interface IntrusionAnalysisResult {
  isIntrusion: boolean;
  threatLevel: ThreatLevel;
  intrusionType?: IntrusionType;
  confidence: number;
  indicators: ThreatIndicator[];
  recommendedAction: 'allow' | 'monitor' | 'rate_limit' | 'block' | 'alert';
  eventId?: string;
}

export interface AttackPattern {
  name: string;
  signatures: string[];
  threatLevel: ThreatLevel;
  category: IntrusionType;
}

export interface IPReputationData {
  ip: string;
  reputation: 'clean' | 'suspicious' | 'malicious';
  lastSeen: Date;
  threatCount: number;
  sources: string[];
}

export class IntrusionDetectionService {
  private static instance: IntrusionDetectionService;
  private auditService: AuditLoggingService;
  
  // Known attack patterns
  private readonly attackPatterns: AttackPattern[] = [
    // SQL Injection patterns
    {
      name: 'SQL Injection',
      signatures: [
        /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
        /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
        /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
        /((\%27)|(\'))union/i,
        /exec(\s|\+)+(s|x)p\w+/i
      ],
      threatLevel: 'high',
      category: 'sql_injection'
    },
    
    // XSS patterns
    {
      name: 'Cross-Site Scripting',
      signatures: [
        /<script[^>]*>.*?<\/script>/i,
        /javascript\s*:/i,
        /on\w+\s*=\s*["\'][^"\']*["\']/i,
        /<iframe[^>]*>.*?<\/iframe>/i,
        /eval\s*\(/i
      ],
      threatLevel: 'medium',
      category: 'xss_attempt'
    },
    
    // Path traversal
    {
      name: 'Path Traversal',
      signatures: [
        /(\.\.)|(\.%2e)/i,
        /(\/)|(\\)|(\%2f)|(\%5c)/i,
        /(\/etc\/passwd)|(\%2fetc\%2fpasswd)/i,
        /(\/windows\/system32)|(\%2fwindows\%2fsystem32)/i
      ],
      threatLevel: 'high',
      category: 'directory_traversal'
    },
    
    // Command injection
    {
      name: 'Command Injection',
      signatures: [
        /(\||&|;|\$\(|\`)/,
        /(rm\s|del\s|format\s)/i,
        /(wget\s|curl\s)/i,
        /(nc\s|netcat\s)/i
      ],
      threatLevel: 'critical',
      category: 'command_injection'
    }
  ];

  // Suspicious user agents
  private readonly suspiciousUserAgents: RegExp[] = [
    /sqlmap/i,
    /nmap/i,
    /nikto/i,
    /burpsuite/i,
    /w3af/i,
    /havij/i,
    /python-requests/i,
    /curl\/[\d.]+$/,
    /^$/
  ];

  // IP reputation cache
  private ipReputationCache = new Map<string, IPReputationData>();
  private readonly REPUTATION_CACHE_TTL = 60 * 60 * 1000; // 1 hour

  private constructor() {
    this.auditService = AuditLoggingService.getInstance();
  }

  static getInstance(): IntrusionDetectionService {
    if (!IntrusionDetectionService.instance) {
      IntrusionDetectionService.instance = new IntrusionDetectionService();
    }
    return IntrusionDetectionService.instance;
  }

  /**
   * Analyze incoming request for intrusion indicators
   */
  async analyzeRequest(request: IntrusionAnalysisRequest): Promise<IntrusionAnalysisResult> {
    const indicators: ThreatIndicator[] = [];
    let maxThreatLevel: ThreatLevel = 'low';
    let intrusionType: IntrusionType | undefined;

    try {
      // 1. Check IP reputation
      const ipIndicators = await this.checkIPReputation(request.ipAddress);
      indicators.push(...ipIndicators);

      // 2. Analyze user agent
      const uaIndicators = this.analyzeUserAgent(request.userAgent || '');
      indicators.push(...uaIndicators);

      // 3. Check for attack patterns in request
      const patternIndicators = this.detectAttackPatterns(request);
      indicators.push(...patternIndicators);

      // 4. Analyze request frequency
      const frequencyIndicators = await this.analyzeRequestFrequency(request);
      indicators.push(...frequencyIndicators);

      // 5. Check for brute force patterns
      if (request.userId) {
        const bruteForceIndicators = await this.detectBruteForce(request);
        indicators.push(...bruteForceIndicators);
      }

      // Calculate overall threat assessment
      const confidence = this.calculateConfidence(indicators);
      maxThreatLevel = this.getMaxThreatLevel(indicators);
      intrusionType = this.determineIntrusionType(indicators);

      const isIntrusion = confidence >= 70 || maxThreatLevel === 'critical';
      const recommendedAction = this.determineAction(maxThreatLevel, confidence);

      const result: IntrusionAnalysisResult = {
        isIntrusion,
        threatLevel: maxThreatLevel,
        intrusionType,
        confidence,
        indicators,
        recommendedAction
      };

      // Log intrusion event if detected
      if (isIntrusion) {
        const eventId = await this.logIntrusionEvent(request, result);
        result.eventId = eventId;
      }

      return result;
    } catch (error) {
      // Fail-safe: Allow request but log the error
      await this.auditService.logEvent({
        eventType: 'system_event',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'intrusion_detection_error',
        resourceType: 'security_system',
        resourceId: 'intrusion_detection_service',
        resultStatus: 'failure',
        context: {
          ipAddress: request.ipAddress,
          correlationId: randomUUID()
        },
        eventMetadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          request_path: request.requestPath
        }
      });

      return {
        isIntrusion: false,
        threatLevel: 'low',
        confidence: 0,
        indicators: [],
        recommendedAction: 'allow'
      };
    }
  }

  /**
   * Check IP reputation against known threat databases
   */
  private async checkIPReputation(ipAddress: string): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = [];

    // Check cache first
    const cached = this.ipReputationCache.get(ipAddress);
    if (cached && (Date.now() - cached.lastSeen.getTime()) < this.REPUTATION_CACHE_TTL) {
      if (cached.reputation === 'malicious') {
        indicators.push({
          type: 'ip_reputation',
          value: ipAddress,
          confidence: 90,
          severity: 'critical',
          description: `IP ${ipAddress} is known malicious (${cached.sources.join(', ')})`
        });
      } else if (cached.reputation === 'suspicious') {
        indicators.push({
          type: 'ip_reputation',
          value: ipAddress,
          confidence: 60,
          severity: 'medium',
          description: `IP ${ipAddress} has suspicious activity history`
        });
      }
      return indicators;
    }

    // Check internal threat database
    try {
      const recentThreats = await this.auditService.queryLogs({
        event_type: 'security_violation',
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
        limit: 100
      });

      const ipThreats = recentThreats.logs.filter(log => 
        log.ip_address === ipAddress && log.event_metadata?.threat_detected
      );

      if (ipThreats.length > 10) {
        indicators.push({
          type: 'ip_reputation',
          value: ipAddress,
          confidence: 85,
          severity: 'high',
          description: `IP ${ipAddress} has ${ipThreats.length} security violations in the last 7 days`
        });

        // Cache the result
        this.ipReputationCache.set(ipAddress, {
          ip: ipAddress,
          reputation: 'malicious',
          lastSeen: new Date(),
          threatCount: ipThreats.length,
          sources: ['internal_database']
        });
      } else if (ipThreats.length > 3) {
        indicators.push({
          type: 'ip_reputation',
          value: ipAddress,
          confidence: 60,
          severity: 'medium',
          description: `IP ${ipAddress} has ${ipThreats.length} security violations in the last 7 days`
        });

        this.ipReputationCache.set(ipAddress, {
          ip: ipAddress,
          reputation: 'suspicious',
          lastSeen: new Date(),
          threatCount: ipThreats.length,
          sources: ['internal_database']
        });
      } else {
        // Clean IP
        this.ipReputationCache.set(ipAddress, {
          ip: ipAddress,
          reputation: 'clean',
          lastSeen: new Date(),
          threatCount: ipThreats.length,
          sources: ['internal_database']
        });
      }
    } catch (error) {
      // Continue without IP reputation data if lookup fails
    }

    return indicators;
  }

  /**
   * Analyze user agent for suspicious patterns
   */
  private analyzeUserAgent(userAgent: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];

    for (const pattern of this.suspiciousUserAgents) {
      if (pattern.test(userAgent)) {
        indicators.push({
          type: 'user_agent_pattern',
          value: userAgent,
          confidence: 75,
          severity: 'medium',
          description: `Suspicious user agent detected: ${userAgent}`
        });
        break;
      }
    }

    return indicators;
  }

  /**
   * Detect attack patterns in request content
   */
  private detectAttackPatterns(request: IntrusionAnalysisRequest): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];
    const contentToCheck = [
      request.requestPath,
      JSON.stringify(request.requestHeaders),
      request.requestBody || ''
    ].join(' ');

    for (const pattern of this.attackPatterns) {
      for (const signature of pattern.signatures) {
        if (signature.test(contentToCheck)) {
          indicators.push({
            type: this.mapAttackTypeToIndicatorType(pattern.category),
            value: contentToCheck.substring(0, 200), // Truncate for logging
            confidence: 85,
            severity: pattern.threatLevel,
            description: `${pattern.name} pattern detected in request`
          });
          break; // Only report once per pattern type
        }
      }
    }

    return indicators;
  }

  /**
   * Analyze request frequency for rate-based attacks
   */
  private async analyzeRequestFrequency(request: IntrusionAnalysisRequest): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = [];

    try {
      // Check requests from this IP in the last 5 minutes
      const recentRequests = await this.auditService.queryLogs({
        start_date: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        limit: 1000
      });

      const ipRequests = recentRequests.logs.filter(log => log.ip_address === request.ipAddress);

      if (ipRequests.length > 100) {
        indicators.push({
          type: 'request_frequency',
          value: `${ipRequests.length} requests in 5 minutes`,
          confidence: 90,
          severity: 'high',
          description: `Excessive request rate: ${ipRequests.length} requests in 5 minutes from ${request.ipAddress}`
        });
      } else if (ipRequests.length > 50) {
        indicators.push({
          type: 'request_frequency',
          value: `${ipRequests.length} requests in 5 minutes`,
          confidence: 70,
          severity: 'medium',
          description: `High request rate: ${ipRequests.length} requests in 5 minutes from ${request.ipAddress}`
        });
      }
    } catch (error) {
      // Continue without frequency analysis if lookup fails
    }

    return indicators;
  }

  /**
   * Detect brute force attacks
   */
  private async detectBruteForce(request: IntrusionAnalysisRequest): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = [];

    if (!request.userId || !request.requestPath.includes('auth')) {
      return indicators;
    }

    try {
      // Check failed auth attempts in the last 15 minutes
      const recentAttempts = await this.auditService.queryLogs({
        event_type: 'authentication',
        user_id: request.userId,
        start_date: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        limit: 100
      });

      const failedAttempts = recentAttempts.logs.filter(log => 
        log.result_status === 'failure'
      );

      if (failedAttempts.length > 10) {
        indicators.push({
          type: 'brute_force',
          value: `${failedAttempts.length} failed attempts`,
          confidence: 95,
          severity: 'high',
          description: `Brute force attack detected: ${failedAttempts.length} failed authentication attempts for user ${request.userId}`
        });
      } else if (failedAttempts.length > 5) {
        indicators.push({
          type: 'brute_force',
          value: `${failedAttempts.length} failed attempts`,
          confidence: 75,
          severity: 'medium',
          description: `Potential brute force: ${failedAttempts.length} failed authentication attempts for user ${request.userId}`
        });
      }
    } catch (error) {
      // Continue without brute force detection if lookup fails
    }

    return indicators;
  }

  /**
   * Log intrusion event to database
   */
  private async logIntrusionEvent(request: IntrusionAnalysisRequest, result: IntrusionAnalysisResult): Promise<string> {
    const eventId = randomUUID();

    const intrusionEvent: IntrusionEventEntry = {
      id: eventId,
      intrusion_type: result.intrusionType || 'unknown_threat',
      threat_level: result.threatLevel,
      status: 'detected',
      source_ip: request.ipAddress,
      user_agent: request.userAgent || 'unknown',
      user_id: request.userId,
      request_path: request.requestPath,
      request_method: request.requestMethod,
      event_metadata: {
        confidence: result.confidence,
        indicators: result.indicators.map(i => ({
          type: i.type,
          confidence: i.confidence,
          severity: i.severity,
          description: i.description
        })),
        recommended_action: result.recommendedAction,
        request_headers: request.requestHeaders,
        session_id: request.sessionId
      },
      detected_at: new Date().toISOString()
    };

    await IntrusionEvent.create(intrusionEvent);

    // Also log to audit system
    await this.auditService.logEvent({
      eventType: 'security_violation',
      userId: request.userId || 'unknown',
      userType: 'customer',
      actionPerformed: 'intrusion_detected',
      resourceType: 'security_system',
      resourceId: eventId,
      resultStatus: 'blocked',
      context: {
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        correlationId: eventId
      },
      eventMetadata: {
        intrusion_type: result.intrusionType,
        threat_level: result.threatLevel,
        confidence: result.confidence,
        indicators_count: result.indicators.length,
        recommended_action: result.recommendedAction
      }
    });

    return eventId;
  }

  /**
   * Calculate overall confidence score from indicators
   */
  private calculateConfidence(indicators: ThreatIndicator[]): number {
    if (indicators.length === 0) return 0;

    // Weighted average with diminishing returns
    let totalScore = 0;
    let weight = 1.0;

    const sortedIndicators = indicators.sort((a, b) => b.confidence - a.confidence);

    for (const indicator of sortedIndicators) {
      totalScore += indicator.confidence * weight;
      weight *= 0.8; // Diminishing returns for additional indicators
    }

    return Math.min(Math.round(totalScore), 100);
  }

  /**
   * Get maximum threat level from indicators
   */
  private getMaxThreatLevel(indicators: ThreatIndicator[]): ThreatLevel {
    const levels: ThreatLevel[] = ['low', 'medium', 'high', 'critical'];
    let maxLevel: ThreatLevel = 'low';

    for (const indicator of indicators) {
      if (levels.indexOf(indicator.severity) > levels.indexOf(maxLevel)) {
        maxLevel = indicator.severity;
      }
    }

    return maxLevel;
  }

  /**
   * Determine primary intrusion type from indicators
   */
  private determineIntrusionType(indicators: ThreatIndicator[]): IntrusionType | undefined {
    if (indicators.length === 0) return undefined;

    // Count indicator types
    const typeCounts: Record<string, number> = {};
    for (const indicator of indicators) {
      const mappedType = this.mapIndicatorTypeToIntrusionType(indicator.type);
      typeCounts[mappedType] = (typeCounts[mappedType] || 0) + 1;
    }

    // Return most common type
    const mostCommonType = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)[0];

    return mostCommonType ? mostCommonType[0] as IntrusionType : undefined;
  }

  /**
   * Determine recommended action based on threat assessment
   */
  private determineAction(threatLevel: ThreatLevel, confidence: number): 'allow' | 'monitor' | 'rate_limit' | 'block' | 'alert' {
    if (threatLevel === 'critical' || confidence >= 90) return 'block';
    if (threatLevel === 'high' || confidence >= 80) return 'alert';
    if (threatLevel === 'medium' || confidence >= 60) return 'rate_limit';
    if (confidence >= 30) return 'monitor';
    return 'allow';
  }

  /**
   * Map attack pattern types to threat indicator types
   */
  private mapAttackTypeToIndicatorType(attackType: IntrusionType): ThreatIndicator['type'] {
    const mapping: Record<IntrusionType, ThreatIndicator['type']> = {
      'sql_injection': 'sql_injection',
      'xss_attempt': 'xss_attempt',
      'directory_traversal': 'request_frequency',
      'command_injection': 'sql_injection',
      'brute_force_attack': 'brute_force',
      'data_exfiltration': 'data_exfiltration',
      'unknown_threat': 'request_frequency'
    };

    return mapping[attackType] || 'request_frequency';
  }

  /**
   * Map threat indicator types to intrusion types
   */
  private mapIndicatorTypeToIntrusionType(indicatorType: ThreatIndicator['type']): IntrusionType {
    const mapping: Record<ThreatIndicator['type'], IntrusionType> = {
      'ip_reputation': 'unknown_threat',
      'user_agent_pattern': 'unknown_threat',
      'request_frequency': 'unknown_threat',
      'sql_injection': 'sql_injection',
      'xss_attempt': 'xss_attempt',
      'brute_force': 'brute_force_attack',
      'data_exfiltration': 'data_exfiltration'
    };

    return mapping[indicatorType] || 'unknown_threat';
  }

  /**
   * Get active intrusion events for monitoring dashboard
   */
  async getActiveIntrusions(limit: number = 100): Promise<IntrusionEventEntry[]> {
    try {
      return await IntrusionEvent.getActive(limit);
    } catch (error) {
      throw new Error(`Failed to get active intrusions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update intrusion event status
   */
  async updateIntrusionStatus(eventId: string, status: IntrusionStatus, notes?: string): Promise<void> {
    try {
      await IntrusionEvent.updateStatus(eventId, status, notes);

      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'admin', // Should be passed from request context
        userType: 'admin',
        actionPerformed: 'intrusion_status_updated',
        resourceType: 'intrusion_event',
        resourceId: eventId,
        resultStatus: 'success',
        eventMetadata: {
          new_status: status,
          notes
        }
      });
    } catch (error) {
      throw new Error(`Failed to update intrusion status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get intrusion statistics for monitoring dashboard
   */
  async getIntrusionStatistics(timeWindowHours: number = 24): Promise<{
    totalIntrusions: number;
    intrusionsByType: Record<IntrusionType, number>;
    intrusionsByThreatLevel: Record<ThreatLevel, number>;
    topAttackerIPs: Array<{ ip: string; count: number }>;
    blockedRequests: number;
    alertsGenerated: number;
  }> {
    try {
      const startTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
      const intrusions = await IntrusionEvent.getByTimeRange(startTime, new Date());

      const intrusionsByType: Record<IntrusionType, number> = {} as Record<IntrusionType, number>;
      const intrusionsByThreatLevel: Record<ThreatLevel, number> = {} as Record<ThreatLevel, number>;
      const ipCounts: Record<string, number> = {};
      
      let blockedRequests = 0;
      let alertsGenerated = 0;

      for (const intrusion of intrusions) {
        // Count by type
        intrusionsByType[intrusion.intrusion_type] = (intrusionsByType[intrusion.intrusion_type] || 0) + 1;
        
        // Count by threat level
        intrusionsByThreatLevel[intrusion.threat_level] = (intrusionsByThreatLevel[intrusion.threat_level] || 0) + 1;
        
        // Count by IP
        ipCounts[intrusion.source_ip] = (ipCounts[intrusion.source_ip] || 0) + 1;
        
        // Count actions taken
        const recommendedAction = intrusion.event_metadata?.recommended_action;
        if (recommendedAction === 'block') blockedRequests++;
        if (recommendedAction === 'alert') alertsGenerated++;
      }

      const topAttackerIPs = Object.entries(ipCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }));

      return {
        totalIntrusions: intrusions.length,
        intrusionsByType,
        intrusionsByThreatLevel,
        topAttackerIPs,
        blockedRequests,
        alertsGenerated
      };
    } catch (error) {
      throw new Error(`Failed to get intrusion statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default IntrusionDetectionService;