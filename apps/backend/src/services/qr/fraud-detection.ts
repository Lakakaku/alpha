import { QRDatabase } from '../../config/qr-database';
import { FraudDetectionLogModel } from '../../models/fraud-detection-log.model';
import { DatabaseValidator } from '../../utils/database-validation';
import type { FraudDetectionLog } from '@vocilia/types';

/**
 * Fraud Detection Service
 * Handles fraud detection, rate limiting, and risk assessment
 */
export class FraudDetector {
  private database: QRDatabase;
  private readonly rateLimitWindow: number; // minutes
  private readonly rateLimitMax: number; // requests
  private readonly fraudDetectionWindow: number; // minutes

  constructor(database?: QRDatabase) {
    this.database = database || new QRDatabase();
    
    // Configuration from environment variables
    this.rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000') / (1000 * 60); // Convert to minutes
    this.rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10');
    this.fraudDetectionWindow = parseInt(process.env.FRAUD_DETECTION_WINDOW_MINUTES || '60');
  }

  /**
   * Check fraud risk for a store access attempt
   */
  async checkFraudRisk(
    storeId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    risk_level: 'low' | 'medium' | 'high' | 'blocked';
    risk_score: number;
    factors: string[];
    warning: boolean;
  }> {
    // Validate inputs
    if (!DatabaseValidator.validateStoreId(storeId)) {
      throw new Error('Invalid store ID format');
    }

    if (!DatabaseValidator.validateIpAddress(ipAddress)) {
      throw new Error('Invalid IP address format');
    }

    // Get recent logs for this IP and store
    const recentLogs = await this.database.getFraudDetectionLogs(
      storeId,
      ipAddress,
      this.fraudDetectionWindow
    );

    // Convert to models for easier analysis
    const logModels = recentLogs.map(log => new FraudDetectionLogModel(log));

    // Analyze risk factors
    const riskFactors = this.analyzeRiskFactors(logModels, userAgent);
    const riskScore = this.calculateRiskScore(riskFactors);
    const riskLevel = this.getRiskLevel(riskScore, riskFactors);

    return {
      risk_level: riskLevel,
      risk_score: riskScore,
      factors: riskFactors,
      warning: riskLevel === 'high' || riskLevel === 'blocked'
    };
  }

  /**
   * Check if IP should be blocked
   */
  async isBlocked(storeId: string, ipAddress: string): Promise<boolean> {
    const riskAssessment = await this.checkFraudRisk(storeId, ipAddress, '');
    return riskAssessment.risk_level === 'blocked';
  }

  /**
   * Log a fraud detection attempt
   */
  async logFraudAttempt(
    storeId: string,
    ipAddress: string,
    userAgent: string,
    sessionToken: string | null,
    riskFactors: string[]
  ): Promise<void> {
    try {
      const logModel = FraudDetectionLogModel.createNew(
        storeId,
        ipAddress,
        userAgent,
        sessionToken,
        riskFactors
      );

      await this.database.createFraudDetectionLog(logModel.toCreateObject());
    } catch (error) {
      // Log error but don't throw - fraud logging shouldn't break the main flow
      console.error('Failed to log fraud attempt:', error);
    }
  }

  /**
   * Analyze risk factors from logs and user agent
   */
  private analyzeRiskFactors(logs: FraudDetectionLogModel[], userAgent: string): string[] {
    const factors: string[] = [];

    // Check for repeated IP access
    if (logs.length >= 5) {
      factors.push('repeated_ip_access');
    }

    // Check for excessive attempts (rate limiting)
    const recentLogs = logs.filter(log => log.isWithinTimeWindow(this.rateLimitWindow));
    if (recentLogs.length >= this.rateLimitMax) {
      factors.push('rate_limit_exceeded');
    }

    if (recentLogs.length >= this.rateLimitMax * 1.5) {
      factors.push('excessive_attempts');
    }

    // Check for rapid succession
    if (logs.length >= 3) {
      const times = logs.map(log => log.access_timestamp.getTime()).sort((a, b) => b - a);
      const rapidSuccession = times.some((time, index) => {
        if (index === 0) return false;
        return (times[index - 1] - time) < (2 * 60 * 1000); // Less than 2 minutes apart
      });

      if (rapidSuccession) {
        factors.push('rapid_succession');
      }
    }

    // Check for suspicious user agent
    if (this.isSuspiciousUserAgent(userAgent)) {
      factors.push('suspicious_user_agent');
    }

    // Check for time-based patterns (outside business hours might be suspicious)
    const now = new Date();
    const hour = now.getHours();
    if (hour < 6 || hour > 23) {
      factors.push('unusual_time_access');
    }

    return factors;
  }

  /**
   * Calculate risk score based on factors
   */
  calculateRiskScore(riskFactors: string[]): number {
    const weights: Record<string, number> = {
      'rate_limit_exceeded': 50,
      'excessive_attempts': 40,
      'repeated_ip_access': 20,
      'rapid_succession': 15,
      'suspicious_user_agent': 25,
      'unusual_time_access': 10
    };

    let score = 0;
    riskFactors.forEach(factor => {
      score += weights[factor] || 5; // Default weight for unknown factors
    });

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Get risk level from score and factors
   */
  private getRiskLevel(
    score: number, 
    factors: string[]
  ): 'low' | 'medium' | 'high' | 'blocked' {
    // Immediate blocking conditions
    if (factors.includes('rate_limit_exceeded')) {
      return 'blocked';
    }

    if (factors.includes('excessive_attempts')) {
      return 'high';
    }

    // Score-based assessment
    if (score >= 70) {
      return 'high';
    }

    if (score >= 30) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Check if user agent appears suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    if (!userAgent || userAgent.length < 10) {
      return true;
    }

    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /automated/i,
      /python/i,
      /curl/i,
      /wget/i,
      /test/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Get rate limit status for IP
   */
  async getRateLimitStatus(
    storeId: string,
    ipAddress: string
  ): Promise<{
    requests_made: number;
    requests_allowed: number;
    window_minutes: number;
    blocked: boolean;
    reset_time: Date;
  }> {
    const logs = await this.database.getFraudDetectionLogs(
      storeId,
      ipAddress,
      this.rateLimitWindow
    );

    const requestsMade = logs.length;
    const blocked = requestsMade >= this.rateLimitMax;
    
    // Calculate reset time (when the oldest request in window expires)
    let resetTime = new Date(Date.now() + this.rateLimitWindow * 60 * 1000);
    if (logs.length > 0) {
      const oldestLog = logs.reduce((oldest, log) => 
        log.access_timestamp < oldest.access_timestamp ? log : oldest
      );
      resetTime = new Date(oldestLog.access_timestamp.getTime() + this.rateLimitWindow * 60 * 1000);
    }

    return {
      requests_made: requestsMade,
      requests_allowed: this.rateLimitMax,
      window_minutes: this.rateLimitWindow,
      blocked,
      reset_time: resetTime
    };
  }

  /**
   * Check and log access attempt with comprehensive analysis
   */
  async checkAndLogAccess(
    storeId: string,
    ipAddress: string,
    userAgent: string,
    sessionToken: string | null = null
  ): Promise<{
    allowed: boolean;
    risk_assessment: {
      risk_level: 'low' | 'medium' | 'high' | 'blocked';
      risk_score: number;
      factors: string[];
      warning: boolean;
    };
    rate_limit_status: {
      requests_made: number;
      requests_allowed: number;
      window_minutes: number;
      blocked: boolean;
      reset_time: Date;
    };
  }> {
    // Get fraud risk assessment
    const riskAssessment = await this.checkFraudRisk(storeId, ipAddress, userAgent);
    
    // Get rate limit status
    const rateLimitStatus = await this.getRateLimitStatus(storeId, ipAddress);

    // Determine if access should be allowed
    const allowed = riskAssessment.risk_level !== 'blocked' && !rateLimitStatus.blocked;

    // Log the attempt
    await this.logFraudAttempt(
      storeId,
      ipAddress,
      userAgent,
      sessionToken,
      riskAssessment.factors
    );

    return {
      allowed,
      risk_assessment: riskAssessment,
      rate_limit_status: rateLimitStatus
    };
  }
}