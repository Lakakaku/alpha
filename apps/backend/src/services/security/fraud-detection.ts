import { DatabaseService } from '../database';
import { FraudDetectionLogModel } from '../../models/FraudDetectionLog';

export interface FraudAssessmentInput {
  store_id: string;
  phone: string;
  amount: number;
  client_ip?: string;
  timestamp: Date;
  user_agent?: string;
  metadata?: Record<string, any>;
}

export interface FraudAssessmentResult {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_score: number; // 1-100
  risk_factors: string[];
  action: 'ALLOW' | 'CHALLENGE' | 'BLOCK';
  assessment_id: string;
  timestamp: Date;
  details: {
    rate_limit_triggered: boolean;
    suspicious_patterns: string[];
    historical_analysis: {
      previous_attempts: number;
      success_rate: number;
      recent_failures: number;
    };
    geo_analysis?: {
      country?: string;
      suspicious_location: boolean;
    };
    amount_analysis: {
      unusual_amount: boolean;
      amount_percentile: number;
    };
  };
}

export class FraudDetectionService {
  private static readonly HIGH_RISK_THRESHOLD = 70;
  private static readonly MEDIUM_RISK_THRESHOLD = 40;
  private static readonly MAX_ATTEMPTS_PER_PHONE_PER_HOUR = 5;
  private static readonly MAX_ATTEMPTS_PER_IP_PER_HOUR = 10;
  private static readonly SUSPICIOUS_AMOUNT_MULTIPLIER = 10; // Amount > 10x median is suspicious
  private static readonly RECENT_FAILURE_WINDOW_MINUTES = 30;

  /**
   * Assesses fraud risk for a verification attempt
   * @param input Assessment input parameters
   * @returns Fraud assessment result
   */
  public static async assessRisk(input: FraudAssessmentInput): Promise<FraudAssessmentResult> {
    try {
      // Initialize assessment
      const assessmentId = this.generateAssessmentId();
      const timestamp = new Date();
      let riskScore = 0;
      const riskFactors: string[] = [];
      const suspiciousPatterns: string[] = [];

      // Rate limiting analysis
      const rateLimitAnalysis = await this.analyzeRateLimit(input);
      if (rateLimitAnalysis.phone_exceeded) {
        riskScore += 25;
        riskFactors.push('RATE_LIMIT_PHONE_EXCEEDED');
        suspiciousPatterns.push(`Phone ${input.phone} exceeded rate limit`);
      }
      if (rateLimitAnalysis.ip_exceeded && input.client_ip) {
        riskScore += 20;
        riskFactors.push('RATE_LIMIT_IP_EXCEEDED');
        suspiciousPatterns.push(`IP ${input.client_ip} exceeded rate limit`);
      }

      // Historical analysis
      const historicalAnalysis = await this.analyzeHistoricalBehavior(input);
      if (historicalAnalysis.recent_failures > 3) {
        riskScore += 15;
        riskFactors.push('HIGH_RECENT_FAILURES');
        suspiciousPatterns.push(`${historicalAnalysis.recent_failures} recent failures`);
      }
      if (historicalAnalysis.success_rate < 0.3 && historicalAnalysis.previous_attempts > 5) {
        riskScore += 10;
        riskFactors.push('LOW_SUCCESS_RATE');
        suspiciousPatterns.push(`Low success rate: ${(historicalAnalysis.success_rate * 100).toFixed(1)}%`);
      }

      // Amount analysis
      const amountAnalysis = await this.analyzeAmount(input);
      if (amountAnalysis.unusual_amount) {
        riskScore += 15;
        riskFactors.push('UNUSUAL_AMOUNT');
        suspiciousPatterns.push(`Unusual amount: ${input.amount} SEK`);
      }
      if (amountAnalysis.amount_percentile > 95) {
        riskScore += 10;
        riskFactors.push('HIGH_AMOUNT_PERCENTILE');
      }

      // Geographic analysis (if IP provided)
      let geoAnalysis: any = undefined;
      if (input.client_ip) {
        geoAnalysis = await this.analyzeGeolocation(input.client_ip);
        if (geoAnalysis.suspicious_location) {
          riskScore += 20;
          riskFactors.push('SUSPICIOUS_LOCATION');
          suspiciousPatterns.push(`Suspicious location: ${geoAnalysis.country}`);
        }
      }

      // Time-based patterns
      const timeAnalysis = this.analyzeTimePatterns(input.timestamp);
      if (timeAnalysis.suspicious_time) {
        riskScore += 5;
        riskFactors.push('SUSPICIOUS_TIME');
      }

      // Store-specific analysis
      const storeAnalysis = await this.analyzeStorePatterns(input);
      if (storeAnalysis.first_time_store && input.amount > 1000) {
        riskScore += 10;
        riskFactors.push('FIRST_TIME_HIGH_AMOUNT');
      }

      // Cap risk score at 100
      riskScore = Math.min(riskScore, 100);

      // Determine risk level and action
      const { riskLevel, action } = this.determineRiskLevelAndAction(riskScore);

      const result: FraudAssessmentResult = {
        risk_level: riskLevel,
        risk_score: riskScore,
        risk_factors: riskFactors,
        action,
        assessment_id: assessmentId,
        timestamp,
        details: {
          rate_limit_triggered: rateLimitAnalysis.phone_exceeded || rateLimitAnalysis.ip_exceeded,
          suspicious_patterns: suspiciousPatterns,
          historical_analysis: historicalAnalysis,
          geo_analysis: geoAnalysis,
          amount_analysis: amountAnalysis
        }
      };

      // Log the fraud assessment
      await this.logFraudAssessment(input, result);

      return result;

    } catch (error) {
      console.error('Fraud detection error:', error);
      
      // Return safe default in case of error
      return {
        risk_level: 'MEDIUM',
        risk_score: 50,
        risk_factors: ['ASSESSMENT_ERROR'],
        action: 'CHALLENGE',
        assessment_id: this.generateAssessmentId(),
        timestamp: new Date(),
        details: {
          rate_limit_triggered: false,
          suspicious_patterns: ['Error during assessment'],
          historical_analysis: {
            previous_attempts: 0,
            success_rate: 1,
            recent_failures: 0
          },
          amount_analysis: {
            unusual_amount: false,
            amount_percentile: 50
          }
        }
      };
    }
  }

  /**
   * Analyzes rate limiting for phone and IP
   * @param input Assessment input
   * @returns Rate limit analysis
   */
  private static async analyzeRateLimit(input: FraudAssessmentInput): Promise<{
    phone_exceeded: boolean;
    ip_exceeded: boolean;
    phone_count: number;
    ip_count: number;
  }> {
    const db = DatabaseService.getClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check phone rate limit
    const { count: phoneCount } = await db
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('customer_phone', input.phone)
      .gte('created_at', oneHourAgo.toISOString());

    // Check IP rate limit (if IP provided)
    let ipCount = 0;
    if (input.client_ip) {
      const { count } = await db
        .from('fraud_detection_logs')
        .select('*', { count: 'exact', head: true })
        .eq('client_ip', input.client_ip)
        .gte('created_at', oneHourAgo.toISOString());
      ipCount = count || 0;
    }

    return {
      phone_exceeded: (phoneCount || 0) >= this.MAX_ATTEMPTS_PER_PHONE_PER_HOUR,
      ip_exceeded: ipCount >= this.MAX_ATTEMPTS_PER_IP_PER_HOUR,
      phone_count: phoneCount || 0,
      ip_count: ipCount
    };
  }

  /**
   * Analyzes historical behavior patterns
   * @param input Assessment input
   * @returns Historical analysis
   */
  private static async analyzeHistoricalBehavior(input: FraudAssessmentInput): Promise<{
    previous_attempts: number;
    success_rate: number;
    recent_failures: number;
  }> {
    const db = DatabaseService.getClient();
    const recentWindow = new Date(Date.now() - this.RECENT_FAILURE_WINDOW_MINUTES * 60 * 1000);

    // Get all previous attempts for this phone
    const { data: allAttempts } = await db
      .from('verification_sessions')
      .select('status')
      .eq('customer_phone', input.phone);

    // Get recent failed attempts
    const { count: recentFailures } = await db
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('customer_phone', input.phone)
      .in('status', ['failed', 'expired', 'fraud_blocked'])
      .gte('created_at', recentWindow.toISOString());

    const previousAttempts = allAttempts?.length || 0;
    const successfulAttempts = allAttempts?.filter(a => a.status === 'completed').length || 0;
    const successRate = previousAttempts > 0 ? successfulAttempts / previousAttempts : 1;

    return {
      previous_attempts: previousAttempts,
      success_rate: successRate,
      recent_failures: recentFailures || 0
    };
  }

  /**
   * Analyzes amount patterns for unusualness
   * @param input Assessment input
   * @returns Amount analysis
   */
  private static async analyzeAmount(input: FraudAssessmentInput): Promise<{
    unusual_amount: boolean;
    amount_percentile: number;
  }> {
    const db = DatabaseService.getClient();
    
    // Get recent amounts for this store to establish baseline
    const { data: recentAmounts } = await db
      .from('verification_sessions')
      .select('expected_amount')
      .eq('store_id', input.store_id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false })
      .limit(100);

    if (!recentAmounts || recentAmounts.length < 5) {
      // Not enough data for comparison
      return {
        unusual_amount: false,
        amount_percentile: 50
      };
    }

    const amounts = recentAmounts.map(r => r.expected_amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const percentileIndex = amounts.findIndex(a => a >= input.amount);
    const percentile = percentileIndex === -1 ? 100 : (percentileIndex / amounts.length) * 100;

    const unusualAmount = input.amount > median * this.SUSPICIOUS_AMOUNT_MULTIPLIER;

    return {
      unusual_amount: unusualAmount,
      amount_percentile: percentile
    };
  }

  /**
   * Analyzes geolocation patterns (simplified implementation)
   * @param clientIP Client IP address
   * @returns Geographic analysis
   */
  private static async analyzeGeolocation(clientIP: string): Promise<{
    country?: string;
    suspicious_location: boolean;
  }> {
    // Simplified implementation - in production this would use a real IP geolocation service
    
    // Check for obviously suspicious IPs (private ranges, localhost, etc.)
    const suspiciousPatterns = [
      /^127\./, // localhost
      /^192\.168\./, // private
      /^10\./, // private
      /^172\.(1[6-9]|2\d|3[01])\./, // private
      /^0\.0\.0\.0$/, // invalid
      /^255\.255\.255\.255$/ // broadcast
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(clientIP));

    return {
      country: 'SE', // Default to Sweden for now
      suspicious_location: isSuspicious
    };
  }

  /**
   * Analyzes time-based patterns
   * @param timestamp Transaction timestamp
   * @returns Time analysis
   */
  private static analyzeTimePatterns(timestamp: Date): {
    suspicious_time: boolean;
  } {
    const hour = timestamp.getHours();
    
    // Flag transactions during very late/early hours (2 AM - 5 AM) as slightly suspicious
    const suspiciousTime = hour >= 2 && hour <= 5;

    return {
      suspicious_time: suspiciousTime
    };
  }

  /**
   * Analyzes store-specific patterns
   * @param input Assessment input
   * @returns Store analysis
   */
  private static async analyzeStorePatterns(input: FraudAssessmentInput): Promise<{
    first_time_store: boolean;
  }> {
    const db = DatabaseService.getClient();

    // Check if this phone has used this store before
    const { count } = await db
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('customer_phone', input.phone)
      .eq('store_id', input.store_id);

    return {
      first_time_store: (count || 0) === 0
    };
  }

  /**
   * Determines risk level and recommended action based on score
   * @param riskScore Risk score (1-100)
   * @returns Risk level and action
   */
  private static determineRiskLevelAndAction(riskScore: number): {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    action: 'ALLOW' | 'CHALLENGE' | 'BLOCK';
  } {
    if (riskScore >= this.HIGH_RISK_THRESHOLD) {
      return { riskLevel: 'HIGH', action: 'BLOCK' };
    } else if (riskScore >= this.MEDIUM_RISK_THRESHOLD) {
      return { riskLevel: 'MEDIUM', action: 'CHALLENGE' };
    } else {
      return { riskLevel: 'LOW', action: 'ALLOW' };
    }
  }

  /**
   * Logs fraud assessment to database
   * @param input Original input
   * @param result Assessment result
   */
  private static async logFraudAssessment(
    input: FraudAssessmentInput,
    result: FraudAssessmentResult
  ): Promise<void> {
    try {
      const db = DatabaseService.getClient();

      const logData = {
        id: result.assessment_id,
        store_id: input.store_id,
        customer_phone: input.phone,
        client_ip: input.client_ip,
        risk_score: result.risk_score,
        risk_level: result.risk_level,
        action_taken: result.action,
        risk_factors: result.risk_factors,
        assessment_details: result.details,
        amount: input.amount,
        user_agent: input.user_agent,
        metadata: {
          ...input.metadata,
          original_timestamp: input.timestamp
        },
        created_at: new Date()
      };

      await db.from('fraud_detection_logs').insert(logData);

    } catch (error) {
      console.error('Error logging fraud assessment:', error);
      // Don't throw - logging failures shouldn't break the fraud detection flow
    }
  }

  /**
   * Generates a unique assessment ID
   * @returns Assessment ID string
   */
  private static generateAssessmentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `fraud_${timestamp}_${random}`;
  }

  /**
   * Gets fraud detection service configuration
   * @returns Service configuration
   */
  public static getConfig(): {
    highRiskThreshold: number;
    mediumRiskThreshold: number;
    maxAttemptsPerPhonePerHour: number;
    maxAttemptsPerIpPerHour: number;
    suspiciousAmountMultiplier: number;
    recentFailureWindowMinutes: number;
  } {
    return {
      highRiskThreshold: this.HIGH_RISK_THRESHOLD,
      mediumRiskThreshold: this.MEDIUM_RISK_THRESHOLD,
      maxAttemptsPerPhonePerHour: this.MAX_ATTEMPTS_PER_PHONE_PER_HOUR,
      maxAttemptsPerIpPerHour: this.MAX_ATTEMPTS_PER_IP_PER_HOUR,
      suspiciousAmountMultiplier: this.SUSPICIOUS_AMOUNT_MULTIPLIER,
      recentFailureWindowMinutes: this.RECENT_FAILURE_WINDOW_MINUTES
    };
  }

  /**
   * Gets fraud statistics for monitoring
   * @param storeId Optional store ID to filter by
   * @returns Fraud statistics
   */
  public static async getFraudStatistics(storeId?: string): Promise<{
    total_assessments: number;
    high_risk_count: number;
    blocked_count: number;
    recent_trend: string;
  }> {
    try {
      const db = DatabaseService.getClient();
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      let query = db.from('fraud_detection_logs').select('*', { count: 'exact', head: true });
      
      if (storeId) {
        query = query.eq('store_id', storeId);
      }
      
      const { count: totalAssessments } = await query.gte('created_at', last24Hours.toISOString());
      
      // Get high risk assessments
      let highRiskQuery = db.from('fraud_detection_logs').select('*', { count: 'exact', head: true })
        .eq('risk_level', 'HIGH');
      
      if (storeId) {
        highRiskQuery = highRiskQuery.eq('store_id', storeId);
      }
      
      const { count: highRiskCount } = await highRiskQuery.gte('created_at', last24Hours.toISOString());
      
      // Get blocked assessments
      let blockedQuery = db.from('fraud_detection_logs').select('*', { count: 'exact', head: true })
        .eq('action_taken', 'BLOCK');
      
      if (storeId) {
        blockedQuery = blockedQuery.eq('store_id', storeId);
      }
      
      const { count: blockedCount } = await blockedQuery.gte('created_at', last24Hours.toISOString());

      // Simple trend calculation
      const riskRate = (totalAssessments || 0) > 0 ? ((highRiskCount || 0) / (totalAssessments || 1)) * 100 : 0;
      const recentTrend = riskRate > 20 ? 'INCREASING' : riskRate > 10 ? 'STABLE' : 'DECREASING';

      return {
        total_assessments: totalAssessments || 0,
        high_risk_count: highRiskCount || 0,
        blocked_count: blockedCount || 0,
        recent_trend: recentTrend
      };

    } catch (error) {
      console.error('Error getting fraud statistics:', error);
      return {
        total_assessments: 0,
        high_risk_count: 0,
        blocked_count: 0,
        recent_trend: 'UNKNOWN'
      };
    }
  }
}