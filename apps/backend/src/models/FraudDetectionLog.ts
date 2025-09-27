import type { 
  FraudDetectionLog, 
  FraudDetectionType, 
  FraudActionTaken 
} from '@vocilia/types';

/**
 * FraudDetectionLog model for database operations
 * Represents fraud detection and security event logs
 */
export class FraudDetectionLogModel {
  public readonly id: string;
  public readonly session_id: string | null;
  public readonly detection_type: FraudDetectionType;
  public readonly risk_score: number; // 1-100
  public readonly ip_address: string | null;
  public readonly user_agent: string | null;
  public readonly detection_details: any | null; // JSONB fraud indicators
  public readonly action_taken: FraudActionTaken;
  public readonly detected_at: Date;

  constructor(data: FraudDetectionLog) {
    this.id = data.id;
    this.session_id = data.session_id;
    this.detection_type = data.detection_type;
    this.risk_score = data.risk_score;
    this.ip_address = data.ip_address;
    this.user_agent = data.user_agent;
    this.detection_details = data.detection_details;
    this.action_taken = data.action_taken;
    this.detected_at = new Date(data.detected_at);
  }

  /**
   * Check if log indicates high risk activity (score >= 70)
   */
  public isHighRisk(): boolean {
    return this.risk_score >= 70;
  }

  /**
   * Check if log indicates medium risk activity (score 40-69)
   */
  public isMediumRisk(): boolean {
    return this.risk_score >= 40 && this.risk_score < 70;
  }

  /**
   * Check if log indicates low risk activity (score < 40)
   */
  public isLowRisk(): boolean {
    return this.risk_score < 40;
  }

  /**
   * Check if log is within specified time window (in minutes)
   */
  public isWithinTimeWindow(windowMinutes: number): boolean {
    const now = new Date();
    const windowMs = windowMinutes * 60 * 1000;
    const timeDiff = now.getTime() - this.detected_at.getTime();
    
    return timeDiff <= windowMs;
  }

  /**
   * Get age of log in minutes
   */
  public getAgeInMinutes(): number {
    const now = new Date();
    const ageMs = now.getTime() - this.detected_at.getTime();
    return Math.floor(ageMs / (1000 * 60));
  }

  /**
   * Check if action was taken (not 'none')
   */
  public wasActionTaken(): boolean {
    return this.action_taken !== 'none';
  }

  /**
   * Check if access was blocked
   */
  public wasBlocked(): boolean {
    return this.action_taken === 'block';
  }

  /**
   * Check if flagged for review
   */
  public wasFlaggedForReview(): boolean {
    return this.action_taken === 'flag_for_review';
  }

  /**
   * Get risk level description
   */
  public getRiskLevelDescription(): string {
    if (this.isHighRisk()) return 'High Risk';
    if (this.isMediumRisk()) return 'Medium Risk';
    return 'Low Risk';
  }

  /**
   * Get detection type description
   */
  public getDetectionTypeDescription(): string {
    switch (this.detection_type) {
      case 'rate_limit':
        return 'Rate Limit Exceeded';
      case 'invalid_qr':
        return 'Invalid QR Code';
      case 'suspicious_pattern':
        return 'Suspicious Access Pattern';
      case 'duplicate_attempt':
        return 'Duplicate Attempt';
      default:
        return 'Unknown Detection Type';
    }
  }

  /**
   * Get action taken description
   */
  public getActionDescription(): string {
    switch (this.action_taken) {
      case 'none':
        return 'No Action Taken';
      case 'warning':
        return 'Warning Issued';
      case 'block':
        return 'Access Blocked';
      case 'flag_for_review':
        return 'Flagged for Review';
      default:
        return 'Unknown Action';
    }
  }

  /**
   * Convert to plain object for database operations
   */
  public toObject(): FraudDetectionLog {
    return {
      id: this.id,
      session_id: this.session_id,
      detection_type: this.detection_type,
      risk_score: this.risk_score,
      ip_address: this.ip_address,
      user_agent: this.user_agent,
      detection_details: this.detection_details,
      action_taken: this.action_taken,
      detected_at: this.detected_at.toISOString()
    };
  }

  /**
   * Create from database row
   */
  public static fromDatabaseRow(row: any): FraudDetectionLogModel {
    return new FraudDetectionLogModel({
      id: row.id,
      session_id: row.session_id,
      detection_type: row.detection_type,
      risk_score: row.risk_score,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      detection_details: row.detection_details,
      action_taken: row.action_taken,
      detected_at: row.detected_at
    });
  }

  /**
   * Create new fraud detection log
   */
  public static createNew(
    sessionId: string | null,
    detectionType: FraudDetectionType,
    riskScore: number,
    ipAddress: string | null,
    userAgent: string | null,
    detectionDetails: any = null,
    actionTaken: FraudActionTaken = 'none'
  ): FraudDetectionLogModel {
    // Validate risk score
    const validatedRiskScore = Math.max(1, Math.min(100, riskScore));

    return new FraudDetectionLogModel({
      id: '', // Will be generated by database
      session_id: sessionId,
      detection_type: detectionType,
      risk_score: validatedRiskScore,
      ip_address: ipAddress,
      user_agent: userAgent,
      detection_details: detectionDetails,
      action_taken: actionTaken,
      detected_at: new Date().toISOString()
    });
  }

  /**
   * Create log for database insertion (without ID)
   */
  public toInsertObject(): Omit<FraudDetectionLog, 'id'> {
    return {
      session_id: this.session_id,
      detection_type: this.detection_type,
      risk_score: this.risk_score,
      ip_address: this.ip_address,
      user_agent: this.user_agent,
      detection_details: this.detection_details,
      action_taken: this.action_taken,
      detected_at: this.detected_at.toISOString()
    };
  }

  /**
   * Filter logs by time window
   */
  public static filterByTimeWindow(
    logs: FraudDetectionLogModel[], 
    windowMinutes: number
  ): FraudDetectionLogModel[] {
    return logs.filter(log => log.isWithinTimeWindow(windowMinutes));
  }

  /**
   * Get logs by risk level
   */
  public static filterByRiskLevel(
    logs: FraudDetectionLogModel[],
    level: 'low' | 'medium' | 'high'
  ): FraudDetectionLogModel[] {
    return logs.filter(log => {
      switch (level) {
        case 'high': return log.isHighRisk();
        case 'medium': return log.isMediumRisk();
        case 'low': return log.isLowRisk();
        default: return false;
      }
    });
  }

  /**
   * Get logs by detection type
   */
  public static filterByDetectionType(
    logs: FraudDetectionLogModel[],
    detectionType: FraudDetectionType
  ): FraudDetectionLogModel[] {
    return logs.filter(log => log.detection_type === detectionType);
  }

  /**
   * Get unique IP addresses from logs
   */
  public static getUniqueIPs(logs: FraudDetectionLogModel[]): string[] {
    const ips = logs
      .map(log => log.ip_address)
      .filter((ip): ip is string => ip !== null);
    return [...new Set(ips)];
  }

  /**
   * Calculate average risk score
   */
  public static getAverageRiskScore(logs: FraudDetectionLogModel[]): number {
    if (logs.length === 0) return 0;
    const total = logs.reduce((sum, log) => sum + log.risk_score, 0);
    return Math.round(total / logs.length);
  }

  /**
   * Count logs by action taken
   */
  public static countByAction(
    logs: FraudDetectionLogModel[]
  ): Record<FraudActionTaken, number> {
    const counts: Record<FraudActionTaken, number> = {
      'none': 0,
      'warning': 0,
      'block': 0,
      'flag_for_review': 0
    };

    logs.forEach(log => {
      counts[log.action_taken]++;
    });

    return counts;
  }
}