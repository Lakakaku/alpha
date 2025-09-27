import { QRSessionManager } from './qr/session-management';
import { FraudDetector } from './qr/fraud-detection';
import { VerificationValidator } from './validation-scoring';
import { CustomerVerificationService } from './questions/customer-verification';
import { QRDatabase } from '../config/qr-database';
import type { 
  QRVerificationRequest,
  QRVerificationResponse,
  VerificationSubmissionRequest,
  VerificationSubmissionResponse,
  SessionDetailsResponse
} from '@vocilia/types';

/**
 * QR Verification Manager
 * Coordinates all QR verification services and provides high-level operations
 */
export class QRVerificationManager {
  private database: QRDatabase;
  private sessionManager: QRSessionManager;
  private fraudDetector: FraudDetector;
  private validator: VerificationValidator;
  private verificationService: CustomerVerificationService;

  constructor() {
    this.database = new QRDatabase();
    this.sessionManager = new QRSessionManager(this.database);
    this.fraudDetector = new FraudDetector(this.database);
    this.validator = new VerificationValidator();
    this.verificationService = new CustomerVerificationService(this.database, this.validator);
  }

  /**
   * Handle QR verification request (complete flow)
   */
  async handleQRVerification(
    storeId: string,
    qrParams: { v: string; t: string },
    request: QRVerificationRequest
  ): Promise<QRVerificationResponse> {
    // Validate QR parameters
    if (!qrParams.v || !qrParams.t) {
      throw new Error('Missing QR parameters');
    }

    // Check fraud/rate limiting
    const fraudCheck = await this.fraudDetector.checkAndLogAccess(
      storeId,
      request.ip_address,
      request.user_agent
    );

    if (!fraudCheck.allowed) {
      if (fraudCheck.rate_limit_status.blocked) {
        const error = new Error('Rate limit exceeded');
        (error as any).code = 'RATE_LIMIT_EXCEEDED';
        (error as any).statusCode = 429;
        throw error;
      } else {
        const error = new Error('Access blocked due to suspicious activity');
        (error as any).code = 'FRAUD_DETECTION_BLOCKED';
        (error as any).statusCode = 403;
        throw error;
      }
    }

    // Create session with fraud warning
    const sessionResult = await this.sessionManager.createSessionWithFraudCheck(
      storeId,
      request,
      async (storeId, ip, userAgent) => fraudCheck.risk_assessment
    );

    return {
      success: true,
      session_token: sessionResult.session_token,
      store_info: sessionResult.store_info,
      fraud_warning: sessionResult.fraud_warning
    };
  }

  /**
   * Handle verification submission (complete flow)
   */
  async handleVerificationSubmission(
    sessionToken: string,
    submission: VerificationSubmissionRequest,
    expectedAmount: number
  ): Promise<VerificationSubmissionResponse> {
    // Validate and get session
    const session = await this.sessionManager.validateAndGetSession(sessionToken);

    // Check if verification already exists
    const existingVerification = await this.verificationService.getVerification(sessionToken);
    if (existingVerification) {
      const error = new Error('Verification already submitted for this session');
      (error as any).code = 'VERIFICATION_ALREADY_EXISTS';
      (error as any).statusCode = 409;
      throw error;
    }

    // Submit verification
    const verification = await this.verificationService.submitVerification(
      sessionToken,
      submission,
      expectedAmount
    );

    // Update session status based on verification result
    const newSessionStatus = verification.validation_results.overall_valid ? 'completed' : 'failed';
    await this.sessionManager.updateSessionStatus(sessionToken, newSessionStatus);

    // Prepare response
    if (verification.validation_results.overall_valid) {
      return {
        success: true,
        verification_id: verification.verification_id,
        validation_results: verification.validation_results,
        next_steps: "Your transaction has been successfully verified. Thank you for your submission!"
      };
    } else {
      return {
        success: false,
        validation_results: verification.validation_results,
        next_steps: "Please check your submission and try again with the correct transaction details."
      };
    }
  }

  /**
   * Handle session details request
   */
  async handleSessionDetails(sessionToken: string): Promise<SessionDetailsResponse> {
    // Get session with store info
    const sessionWithStore = await this.sessionManager.getSessionWithStore(sessionToken);
    
    if (!sessionWithStore) {
      const error = new Error('Session not found');
      (error as any).code = 'SESSION_NOT_FOUND';
      (error as any).statusCode = 404;
      throw error;
    }

    const { session, store_info } = sessionWithStore;

    // Check if session is expired
    if (this.sessionManager.isSessionExpired(session)) {
      await this.sessionManager.updateSessionStatus(sessionToken, 'expired');
      const error = new Error('Session has expired');
      (error as any).code = 'SESSION_EXPIRED';
      (error as any).statusCode = 410;
      throw error;
    }

    // Get verification if exists
    const verification = await this.verificationService.getVerification(sessionToken);

    // Calculate remaining time
    const timeRemainingMinutes = this.sessionManager.getSessionRemainingMinutes(session);

    return {
      success: true,
      session: {
        session_token: session.session_token,
        status: session.status,
        created_at: session.created_at.toISOString(),
        expires_at: session.expires_at.toISOString(),
        store_info,
        customer_verification: verification
      },
      time_remaining_minutes: timeRemainingMinutes
    };
  }

  /**
   * Get comprehensive verification stats for a store
   */
  async getStoreVerificationStats(storeId: string): Promise<{
    sessions: {
      total: number;
      pending: number;
      completed: number;
      expired: number;
      failed: number;
    };
    verifications: {
      total_verifications: number;
      successful_verifications: number;
      failed_verifications: number;
      success_rate: number;
      common_failure_reasons: {
        time_failures: number;
        amount_failures: number;
        phone_failures: number;
      };
    };
    fraud: {
      total_fraud_logs: number;
      blocked_attempts: number;
      high_risk_attempts: number;
    };
  }> {
    // Get session stats
    const sessions = await this.sessionManager.getSessionsByStore(storeId, 1000);
    const sessionStats = {
      total: sessions.length,
      pending: sessions.filter(s => s.status === 'pending').length,
      completed: sessions.filter(s => s.status === 'completed').length,
      expired: sessions.filter(s => s.status === 'expired').length,
      failed: sessions.filter(s => s.status === 'failed').length
    };

    // Get verification stats
    const verificationStats = await this.verificationService.getVerificationStats(storeId);

    // For fraud stats, we'd need to add methods to get fraud logs by store
    // This is a simplified version
    const fraudStats = {
      total_fraud_logs: 0,
      blocked_attempts: 0,
      high_risk_attempts: 0
    };

    return {
      sessions: sessionStats,
      verifications: verificationStats,
      fraud: fraudStats
    };
  }

  /**
   * Cleanup expired sessions and old logs (maintenance operation)
   */
  async performMaintenance(): Promise<{
    expired_sessions_cleaned: number;
    operation_timestamp: Date;
  }> {
    const expiredSessionsCleaned = await this.sessionManager.cleanupExpiredSessions();

    return {
      expired_sessions_cleaned: expiredSessionsCleaned,
      operation_timestamp: new Date()
    };
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: {
      database: boolean;
      session_manager: boolean;
      fraud_detector: boolean;
      validator: boolean;
      verification_service: boolean;
    };
    timestamp: Date;
  }> {
    const services = {
      database: true,
      session_manager: true,
      fraud_detector: true,
      validator: true,
      verification_service: true
    };

    try {
      // Test database
      await this.database.getStoreById('test-health-check');
    } catch {
      services.database = false;
    }

    // Other services are dependent on database, so if database fails, they fail too
    if (!services.database) {
      services.session_manager = false;
      services.fraud_detector = false;
      services.verification_service = false;
    }

    const healthy = Object.values(services).every(status => status);

    return {
      healthy,
      services,
      timestamp: new Date()
    };
  }

  /**
   * Get service instances (for advanced usage)
   */
  getServices() {
    return {
      database: this.database,
      sessionManager: this.sessionManager,
      fraudDetector: this.fraudDetector,
      validator: this.validator,
      verificationService: this.verificationService
    };
  }
}

// Singleton instance for application use
export const qrVerificationManager = new QRVerificationManager();