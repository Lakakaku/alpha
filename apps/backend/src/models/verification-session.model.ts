import type { 
  VerificationSession, 
  VerificationSessionStatus 
} from '@vocilia/types';

/**
 * VerificationSession model for database operations
 * Represents a QR verification session with 30-minute expiry
 */
export class VerificationSessionModel {
  public readonly session_token: string;
  public readonly store_id: string;
  public status: VerificationSessionStatus;
  public readonly created_at: Date;
  public readonly expires_at: Date;
  public readonly ip_address: string;
  public readonly user_agent: string;

  constructor(data: VerificationSession) {
    this.session_token = data.session_token;
    this.store_id = data.store_id;
    this.status = data.status;
    this.created_at = data.created_at;
    this.expires_at = data.expires_at;
    this.ip_address = data.ip_address;
    this.user_agent = data.user_agent;
  }

  /**
   * Check if the session is still valid (not expired and in pending status)
   */
  public isValid(): boolean {
    const now = new Date();
    return this.expires_at > now && this.status === 'pending';
  }

  /**
   * Check if the session has expired
   */
  public isExpired(): boolean {
    return new Date() > this.expires_at;
  }

  /**
   * Get remaining time in minutes
   */
  public getRemainingMinutes(): number {
    const now = new Date();
    const remainingMs = this.expires_at.getTime() - now.getTime();
    return Math.max(0, Math.floor(remainingMs / (1000 * 60)));
  }

  /**
   * Update session status
   */
  public updateStatus(status: VerificationSessionStatus): void {
    this.status = status;
  }

  /**
   * Convert to plain object for database operations
   */
  public toObject(): VerificationSession {
    return {
      session_token: this.session_token,
      store_id: this.store_id,
      status: this.status,
      created_at: this.created_at,
      expires_at: this.expires_at,
      ip_address: this.ip_address,
      user_agent: this.user_agent
    };
  }

  /**
   * Create from database row
   */
  public static fromDatabaseRow(row: any): VerificationSessionModel {
    return new VerificationSessionModel({
      session_token: row.session_token,
      store_id: row.store_id,
      status: row.status,
      created_at: new Date(row.created_at),
      expires_at: new Date(row.expires_at),
      ip_address: row.ip_address,
      user_agent: row.user_agent
    });
  }

  /**
   * Generate session token (64 characters, lowercase alphanumeric)
   */
  public static generateSessionToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create new session with 30-minute expiry
   */
  public static createNew(
    storeId: string, 
    ipAddress: string, 
    userAgent: string
  ): VerificationSessionModel {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    return new VerificationSessionModel({
      session_token: this.generateSessionToken(),
      store_id: storeId,
      status: 'pending',
      created_at: now,
      expires_at: expiresAt,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }
}