// QR Scan Tracking Service
// Handles real-time QR code scan tracking, validation, and fraud detection

import { QRDatabase } from '@vocilia/database/qr';
import { QRAnalyticsService } from './qr-analytics.service';
import type {
  QRScanEvent,
  QRScanRequest,
  QRScanResponse,
  QRCodeStore,
  QRValidationError
} from '@vocilia/types/qr';

interface ScanRateLimit {
  sessionId: string;
  count: number;
  firstScan: Date;
  lastScan: Date;
}

interface FraudDetectionResult {
  isFraudulent: boolean;
  riskScore: number;
  reasons: string[];
  action: 'allow' | 'throttle' | 'block';
}

export class ScanTrackerService {
  private database: QRDatabase;
  private analyticsService: QRAnalyticsService;
  private scanRateLimits: Map<string, ScanRateLimit> = new Map();
  private ipRateLimits: Map<string, ScanRateLimit> = new Map();
  private realtimeSubscriptions: Map<string, any> = new Map();

  // Rate limiting configuration
  private readonly MAX_SCANS_PER_SESSION = 5; // Per 10 minutes
  private readonly MAX_SCANS_PER_IP = 20; // Per 10 minutes
  private readonly RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes in ms
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(database: QRDatabase, analyticsService: QRAnalyticsService) {
    this.database = database;
    this.analyticsService = analyticsService;
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Track a QR code scan with fraud detection and rate limiting
   */
  async trackScan(
    scanRequest: QRScanRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<QRScanResponse> {
    try {
      // Validate input
      const validationResult = await this.validateScanRequest(scanRequest);
      if (!validationResult.isValid) {
        return {
          success: false,
          scan_recorded: false,
          message: validationResult.error || 'Invalid scan request'
        };
      }

      // Fraud detection
      const fraudCheck = await this.detectFraud(scanRequest, ipAddress, userAgent);
      
      if (fraudCheck.action === 'block') {
        console.warn('Blocked fraudulent scan attempt:', {
          storeId: scanRequest.store_id,
          sessionId: scanRequest.session_id,
          ipAddress: this.anonymizeIP(ipAddress),
          riskScore: fraudCheck.riskScore,
          reasons: fraudCheck.reasons
        });
        
        return {
          success: false,
          scan_recorded: false,
          message: 'Scan request rejected'
        };
      }

      // Rate limiting
      const rateLimitResult = this.checkRateLimit(scanRequest.session_id, ipAddress);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          scan_recorded: false,
          message: rateLimitResult.message
        };
      }

      // Create scan event
      const scanEvent: Omit<QRScanEvent, 'id' | 'scanned_at'> = {
        store_id: scanRequest.store_id,
        user_agent: userAgent,
        referrer: scanRequest.referrer || null,
        ip_address: ipAddress, // Will be anonymized in analytics service
        qr_version: scanRequest.qr_version,
        session_id: scanRequest.session_id
      };

      // Record scan via analytics service (handles validation and DB operations)
      const result = await this.analyticsService.recordScan(scanEvent, ipAddress);

      // Update rate limiting counters if scan was recorded
      if (result.scan_recorded) {
        this.updateRateLimitCounters(scanRequest.session_id, ipAddress);
        
        // Trigger real-time notifications
        await this.notifyRealtimeSubscribers(scanRequest.store_id, scanEvent);
        
        // Log successful scan
        console.log('QR scan tracked:', {
          storeId: scanRequest.store_id,
          version: scanRequest.qr_version,
          sessionId: scanRequest.session_id,
          fraudScore: fraudCheck.riskScore
        });
      }

      return result;
    } catch (error: any) {
      console.error('Failed to track scan:', error);
      return {
        success: false,
        scan_recorded: false,
        message: 'Internal error while tracking scan'
      };
    }
  }

  /**
   * Get recent scan activity for a store
   */
  async getRecentActivity(
    storeId: string,
    limit: number = 50
  ): Promise<{
    recent_scans: Array<{
      timestamp: string;
      session_id: string;
      qr_version: number;
      user_agent_type: string;
      is_mobile: boolean;
    }>;
    summary: {
      total_today: number;
      unique_sessions_today: number;
      most_active_hour: number;
      device_breakdown: {
        mobile: number;
        desktop: number;
        tablet: number;
        other: number;
      };
    };
  }> {
    try {
      // Get recent scan events
      const recentScans = await this.database.getScanEvents(storeId, limit);
      
      // Process scan data
      const processedScans = recentScans.map(scan => ({
        timestamp: scan.scanned_at,
        session_id: scan.session_id,
        qr_version: scan.qr_version,
        user_agent_type: this.parseUserAgentType(scan.user_agent),
        is_mobile: this.isMobileUserAgent(scan.user_agent)
      }));

      // Calculate today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayScans = recentScans.filter(scan => 
        new Date(scan.scanned_at) >= today
      );

      const uniqueSessionsToday = new Set(todayScans.map(s => s.session_id)).size;

      // Find most active hour
      const hourCounts = new Array(24).fill(0);
      todayScans.forEach(scan => {
        const hour = new Date(scan.scanned_at).getHours();
        hourCounts[hour]++;
      });
      const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));

      // Device breakdown
      const deviceBreakdown = {
        mobile: 0,
        desktop: 0,
        tablet: 0,
        other: 0
      };

      todayScans.forEach(scan => {
        const deviceType = this.getDeviceType(scan.user_agent);
        deviceBreakdown[deviceType]++;
      });

      return {
        recent_scans: processedScans,
        summary: {
          total_today: todayScans.length,
          unique_sessions_today: uniqueSessionsToday,
          most_active_hour: mostActiveHour,
          device_breakdown: deviceBreakdown
        }
      };
    } catch (error: any) {
      throw new QRValidationError(
        'Failed to get recent activity',
        'RECENT_ACTIVITY_FAILED',
        { storeId, originalError: error.message }
      );
    }
  }

  /**
   * Subscribe to real-time scan events for a store
   */
  subscribeToScanEvents(
    storeId: string,
    callback: (scanEvent: QRScanEvent) => void
  ): () => void {
    try {
      // Create subscription using database real-time features
      const subscription = this.database.subscribeToScanEvents(storeId, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          callback(payload.new as QRScanEvent);
        }
      });

      // Store subscription for cleanup
      const subscriptionKey = `scan_${storeId}_${Date.now()}`;
      this.realtimeSubscriptions.set(subscriptionKey, subscription);

      // Return unsubscribe function
      return () => {
        const sub = this.realtimeSubscriptions.get(subscriptionKey);
        if (sub) {
          sub.unsubscribe();
          this.realtimeSubscriptions.delete(subscriptionKey);
        }
      };
    } catch (error: any) {
      console.error('Failed to subscribe to scan events:', error);
      return () => {}; // Return no-op function
    }
  }

  /**
   * Get scan fraud statistics
   */
  async getFraudStatistics(storeId?: string): Promise<{
    total_scans_analyzed: number;
    blocked_scans: number;
    fraud_rate: number;
    top_fraud_reasons: Array<{
      reason: string;
      count: number;
      percentage: number;
    }>;
    risk_score_distribution: {
      low: number;
      medium: number;
      high: number;
    };
  }> {
    // In a real implementation, this would query fraud detection logs
    // For now, return mock data structure
    return {
      total_scans_analyzed: 0,
      blocked_scans: 0,
      fraud_rate: 0,
      top_fraud_reasons: [],
      risk_score_distribution: {
        low: 0,
        medium: 0,
        high: 0
      }
    };
  }

  /**
   * Validate scan request format and content
   */
  private async validateScanRequest(request: QRScanRequest): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    // Check required fields
    if (!request.store_id || !request.session_id || !request.user_agent) {
      return {
        isValid: false,
        error: 'Missing required fields: store_id, session_id, or user_agent'
      };
    }

    // Validate UUID format for store_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(request.store_id)) {
      return {
        isValid: false,
        error: 'Invalid store_id format'
      };
    }

    // Validate QR version
    if (!request.qr_version || request.qr_version < 1 || request.qr_version > 9999999) {
      return {
        isValid: false,
        error: 'Invalid QR version'
      };
    }

    // Validate session_id length and format
    if (request.session_id.length < 10 || request.session_id.length > 100) {
      return {
        isValid: false,
        error: 'Session ID must be between 10 and 100 characters'
      };
    }

    // Validate user_agent length
    if (request.user_agent.length > 500) {
      return {
        isValid: false,
        error: 'User agent string too long'
      };
    }

    // Check if store exists (this also validates permissions)
    try {
      const store = await this.database.getStoreQR(request.store_id);
      if (!store) {
        return {
          isValid: false,
          error: 'Store not found'
        };
      }

      // Check if store is active
      if (store.qr_status === 'inactive') {
        return {
          isValid: false,
          error: 'QR code is inactive'
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Failed to validate store'
      };
    }

    return { isValid: true };
  }

  /**
   * Detect potential fraud in scan requests
   */
  private async detectFraud(
    request: QRScanRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<FraudDetectionResult> {
    const reasons: string[] = [];
    let riskScore = 0;

    // Check for suspicious patterns
    
    // 1. Repetitive session IDs
    if (this.scanRateLimits.has(request.session_id)) {
      const limit = this.scanRateLimits.get(request.session_id)!;
      if (limit.count > 3) {
        reasons.push('High frequency scanning from same session');
        riskScore += 30;
      }
    }

    // 2. Suspicious IP patterns
    if (this.ipRateLimits.has(ipAddress)) {
      const limit = this.ipRateLimits.get(ipAddress)!;
      if (limit.count > 10) {
        reasons.push('High frequency scanning from same IP');
        riskScore += 40;
      }
    }

    // 3. Bot-like user agents
    if (this.isBotUserAgent(userAgent)) {
      reasons.push('Bot-like user agent detected');
      riskScore += 50;
    }

    // 4. Missing or suspicious referrer
    if (!request.referrer) {
      reasons.push('Missing referrer');
      riskScore += 10;
    } else if (this.isSuspiciousReferrer(request.referrer)) {
      reasons.push('Suspicious referrer domain');
      riskScore += 25;
    }

    // 5. Session ID patterns (check for generated/predictable patterns)
    if (this.isSuspiciousSessionId(request.session_id)) {
      reasons.push('Suspicious session ID pattern');
      riskScore += 20;
    }

    // 6. Rapid succession scans
    const now = new Date();
    if (this.scanRateLimits.has(request.session_id)) {
      const limit = this.scanRateLimits.get(request.session_id)!;
      const timeSinceLastScan = now.getTime() - limit.lastScan.getTime();
      if (timeSinceLastScan < 5000) { // Less than 5 seconds
        reasons.push('Rapid succession scanning');
        riskScore += 35;
      }
    }

    // Determine action based on risk score
    let action: 'allow' | 'throttle' | 'block' = 'allow';
    if (riskScore >= 80) {
      action = 'block';
    } else if (riskScore >= 50) {
      action = 'throttle';
    }

    return {
      isFraudulent: riskScore >= 50,
      riskScore,
      reasons,
      action
    };
  }

  /**
   * Check rate limiting for session and IP
   */
  private checkRateLimit(sessionId: string, ipAddress: string): {
    allowed: boolean;
    message: string;
  } {
    const now = new Date();

    // Check session rate limit
    const sessionLimit = this.scanRateLimits.get(sessionId);
    if (sessionLimit) {
      const timeWindow = now.getTime() - sessionLimit.firstScan.getTime();
      if (timeWindow < this.RATE_LIMIT_WINDOW && sessionLimit.count >= this.MAX_SCANS_PER_SESSION) {
        return {
          allowed: false,
          message: 'Too many scans from this session. Please wait before scanning again.'
        };
      }
    }

    // Check IP rate limit
    const ipLimit = this.ipRateLimits.get(ipAddress);
    if (ipLimit) {
      const timeWindow = now.getTime() - ipLimit.firstScan.getTime();
      if (timeWindow < this.RATE_LIMIT_WINDOW && ipLimit.count >= this.MAX_SCANS_PER_IP) {
        return {
          allowed: false,
          message: 'Too many scans from this location. Please wait before scanning again.'
        };
      }
    }

    return { allowed: true, message: '' };
  }

  /**
   * Update rate limiting counters
   */
  private updateRateLimitCounters(sessionId: string, ipAddress: string): void {
    const now = new Date();

    // Update session counter
    const sessionLimit = this.scanRateLimits.get(sessionId);
    if (sessionLimit) {
      const timeWindow = now.getTime() - sessionLimit.firstScan.getTime();
      if (timeWindow < this.RATE_LIMIT_WINDOW) {
        sessionLimit.count++;
        sessionLimit.lastScan = now;
      } else {
        // Reset window
        this.scanRateLimits.set(sessionId, {
          sessionId,
          count: 1,
          firstScan: now,
          lastScan: now
        });
      }
    } else {
      this.scanRateLimits.set(sessionId, {
        sessionId,
        count: 1,
        firstScan: now,
        lastScan: now
      });
    }

    // Update IP counter
    const ipLimit = this.ipRateLimits.get(ipAddress);
    if (ipLimit) {
      const timeWindow = now.getTime() - ipLimit.firstScan.getTime();
      if (timeWindow < this.RATE_LIMIT_WINDOW) {
        ipLimit.count++;
        ipLimit.lastScan = now;
      } else {
        // Reset window
        this.ipRateLimits.set(ipAddress, {
          sessionId: ipAddress,
          count: 1,
          firstScan: now,
          lastScan: now
        });
      }
    } else {
      this.ipRateLimits.set(ipAddress, {
        sessionId: ipAddress,
        count: 1,
        firstScan: now,
        lastScan: now
      });
    }
  }

  /**
   * Notify real-time subscribers of new scan
   */
  private async notifyRealtimeSubscribers(
    storeId: string,
    scanEvent: Omit<QRScanEvent, 'id' | 'scanned_at'>
  ): Promise<void> {
    // This would typically use WebSocket or Server-Sent Events
    // For now, we'll just log the event
    console.log('Real-time scan notification:', {
      storeId,
      sessionId: scanEvent.session_id,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Utility functions for fraud detection
   */
  private isBotUserAgent(userAgent: string): boolean {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /java/i,
      /phantom/i, /headless/i, /selenium/i
    ];
    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  private isSuspiciousReferrer(referrer: string): boolean {
    try {
      const url = new URL(referrer);
      const suspiciousDomains = [
        'localhost', '127.0.0.1', '0.0.0.0',
        'test.com', 'example.com',
        'bit.ly', 'tinyurl.com' // Suspicious shorteners
      ];
      return suspiciousDomains.some(domain => url.hostname.includes(domain));
    } catch {
      return true; // Invalid URL format is suspicious
    }
  }

  private isSuspiciousSessionId(sessionId: string): boolean {
    // Check for patterns that suggest generated/predictable IDs
    const suspiciousPatterns = [
      /^(test|demo|sample)/i,
      /^[0-9]+$/, // Only numbers
      /^[a-f0-9]{8,}$/, // Only hex digits (possibly generated)
      /(.)\\1{5,}/, // Repeated characters
      /^(session|user|client)/i
    ];
    return suspiciousPatterns.some(pattern => pattern.test(sessionId));
  }

  private parseUserAgentType(userAgent: string): string {
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    if (/desktop/i.test(userAgent)) return 'desktop';
    return 'unknown';
  }

  private isMobileUserAgent(userAgent: string): boolean {
    return /mobile|android|iphone|ipad|ipod/i.test(userAgent);
  }

  private getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' | 'other' {
    if (/ipad|tablet/i.test(userAgent)) return 'tablet';
    if (/mobile|android|iphone|ipod/i.test(userAgent)) return 'mobile';
    if (/mozilla|chrome|safari|firefox|opera|edge/i.test(userAgent)) return 'desktop';
    return 'other';
  }

  private anonymizeIP(ip: string): string {
    if (ip.includes(':')) {
      // IPv6 - mask last 4 groups
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + '::';
    } else {
      // IPv4 - mask last octet
      const parts = ip.split('.');
      return parts.slice(0, 3).join('.') + '.xxx';
    }
  }

  /**
   * Start cleanup interval for rate limit maps
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredLimits();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupExpiredLimits(): void {
    const now = new Date();
    const cutoff = now.getTime() - this.RATE_LIMIT_WINDOW;

    // Clean session limits
    for (const [sessionId, limit] of this.scanRateLimits) {
      if (limit.firstScan.getTime() < cutoff) {
        this.scanRateLimits.delete(sessionId);
      }
    }

    // Clean IP limits
    for (const [ip, limit] of this.ipRateLimits) {
      if (limit.firstScan.getTime() < cutoff) {
        this.ipRateLimits.delete(ip);
      }
    }

    console.log(`Cleaned up rate limits. Active sessions: ${this.scanRateLimits.size}, Active IPs: ${this.ipRateLimits.size}`);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Unsubscribe from all real-time subscriptions
    for (const [key, subscription] of this.realtimeSubscriptions) {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.warn(`Failed to unsubscribe from ${key}:`, error);
      }
    }
    this.realtimeSubscriptions.clear();

    // Clear rate limit maps
    this.scanRateLimits.clear();
    this.ipRateLimits.clear();
  }

  /**
   * Health check for scan tracker service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    active_rate_limits: {
      sessions: number;
      ips: number;
    };
    active_subscriptions: number;
    fraud_detection_enabled: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Basic functionality test
      const testRequest: QRScanRequest = {
        store_id: '00000000-0000-0000-0000-000000000000',
        qr_version: 1,
        user_agent: 'test-agent',
        session_id: 'test-session'
      };

      // Test fraud detection (should not throw)
      await this.detectFraud(testRequest, '127.0.0.1', 'test-agent');

      return {
        status,
        active_rate_limits: {
          sessions: this.scanRateLimits.size,
          ips: this.ipRateLimits.size
        },
        active_subscriptions: this.realtimeSubscriptions.size,
        fraud_detection_enabled: true,
        errors
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        active_rate_limits: {
          sessions: this.scanRateLimits.size,
          ips: this.ipRateLimits.size
        },
        active_subscriptions: this.realtimeSubscriptions.size,
        fraud_detection_enabled: false,
        errors: [`Health check failed: ${error.message}`]
      };
    }
  }
}

// Factory function
export function createScanTrackerService(
  database: QRDatabase,
  analyticsService: QRAnalyticsService
): ScanTrackerService {
  return new ScanTrackerService(database, analyticsService);
}