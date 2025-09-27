import { QRDatabase } from '../../config/qr-database';
import { VerificationSessionModel } from '../../models/verification-session.model';
import { DatabaseValidator } from '../../utils/database-validation';
import type { 
  VerificationSession, 
  VerificationSessionStatus,
  QRVerificationRequest 
} from '@vocilia/types';

/**
 * QR Session Management Service
 * Handles verification session lifecycle and operations
 */
export class QRSessionManager {
  private database: QRDatabase;

  constructor(database?: QRDatabase) {
    this.database = database || new QRDatabase();
  }

  /**
   * Create a new verification session
   */
  async createSession(
    storeId: string, 
    request: QRVerificationRequest
  ): Promise<{
    session_token: string;
    expires_at: Date;
    store_info: {
      store_id: string;
      store_name: string;
      business_name: string;
    };
  }> {
    // Validate inputs
    if (!DatabaseValidator.validateStoreId(storeId)) {
      throw new Error('Invalid store ID format');
    }

    if (!DatabaseValidator.validateIpAddress(request.ip_address)) {
      throw new Error('Invalid IP address format');
    }

    // Verify store exists and is active
    const storeInfo = await this.database.getStoreById(storeId);
    if (!storeInfo) {
      throw new Error('Store not found');
    }

    // Create new session
    const sessionModel = VerificationSessionModel.createNew(
      storeId,
      request.ip_address,
      request.user_agent
    );

    // Save to database
    const result = await this.database.createVerificationSession(
      sessionModel.store_id,
      sessionModel.session_token,
      sessionModel.ip_address,
      sessionModel.user_agent
    );

    return {
      session_token: result.session_token,
      expires_at: result.expires_at,
      store_info: storeInfo
    };
  }

  /**
   * Get session by token
   */
  async getSession(sessionToken: string): Promise<VerificationSession | null> {
    // Validate session token format
    if (!DatabaseValidator.validateSessionToken(sessionToken)) {
      return null;
    }

    return await this.database.getVerificationSession(sessionToken);
  }

  /**
   * Get session with store information
   */
  async getSessionWithStore(sessionToken: string): Promise<{
    session: VerificationSession;
    store_info: {
      store_id: string;
      store_name: string;
      business_name: string;
    };
  } | null> {
    const session = await this.getSession(sessionToken);
    if (!session) {
      return null;
    }

    const storeInfo = await this.database.getStoreById(session.store_id);
    if (!storeInfo) {
      return null;
    }

    return {
      session,
      store_info: storeInfo
    };
  }

  /**
   * Check if session is valid (not expired and in pending status)
   */
  isSessionValid(session: VerificationSession): boolean {
    const sessionModel = new VerificationSessionModel(session);
    return sessionModel.isValid();
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(session: VerificationSession): boolean {
    const sessionModel = new VerificationSessionModel(session);
    return sessionModel.isExpired();
  }

  /**
   * Get remaining time for session in minutes
   */
  getSessionRemainingMinutes(session: VerificationSession): number {
    const sessionModel = new VerificationSessionModel(session);
    return sessionModel.getRemainingMinutes();
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionToken: string, 
    status: VerificationSessionStatus
  ): Promise<boolean> {
    // Validate inputs
    if (!DatabaseValidator.validateSessionToken(sessionToken)) {
      throw new Error('Invalid session token format');
    }

    return await this.database.updateSessionStatus(sessionToken, status);
  }

  /**
   * Generate a new session token
   */
  generateSessionToken(): string {
    return VerificationSessionModel.generateSessionToken();
  }

  /**
   * Validate session token format
   */
  validateSessionToken(token: string): boolean {
    return DatabaseValidator.validateSessionToken(token);
  }

  /**
   * Get sessions by store (for admin/debugging)
   */
  async getSessionsByStore(storeId: string, limit: number = 50): Promise<VerificationSession[]> {
    if (!DatabaseValidator.validateStoreId(storeId)) {
      throw new Error('Invalid store ID format');
    }

    return await this.database.getSessionsByStore(storeId, limit);
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    return await this.database.cleanupExpiredSessions();
  }

  /**
   * Validate and get session (throws if invalid)
   */
  async validateAndGetSession(sessionToken: string): Promise<VerificationSession> {
    const session = await this.getSession(sessionToken);
    
    if (!session) {
      throw new Error('Session not found');
    }

    if (this.isSessionExpired(session)) {
      // Update status to expired
      await this.updateSessionStatus(sessionToken, 'expired');
      throw new Error('Session expired');
    }

    if (!this.isSessionValid(session)) {
      throw new Error('Session not valid');
    }

    return session;
  }

  /**
   * Create session with fraud check integration
   */
  async createSessionWithFraudCheck(
    storeId: string,
    request: QRVerificationRequest,
    fraudCheckCallback?: (storeId: string, ip: string, userAgent: string) => Promise<{
      risk_level: string;
      warning: boolean;
    }>
  ): Promise<{
    session_token: string;
    expires_at: Date;
    store_info: {
      store_id: string;
      store_name: string;
      business_name: string;
    };
    fraud_warning: boolean;
  }> {
    // Create session first
    const sessionResult = await this.createSession(storeId, request);

    // Run fraud check if callback provided
    let fraudWarning = false;
    if (fraudCheckCallback) {
      try {
        const fraudResult = await fraudCheckCallback(
          storeId,
          request.ip_address,
          request.user_agent
        );
        fraudWarning = fraudResult.warning;
      } catch (error) {
        console.error('Fraud check failed:', error);
        // Continue without fraud warning rather than failing the request
      }
    }

    return {
      ...sessionResult,
      fraud_warning: fraudWarning
    };
  }
}