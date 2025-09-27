import { v4 as uuidv4 } from 'uuid';
import { VerificationSessionModel } from '../../models/VerificationSession';
import { StoreModel } from '../../models/Store';
import { DatabaseService } from '../database';
import { FraudDetectionService } from '../security/fraud-detection';
import { PhoneValidatorService } from '../validation/phone-validator';
import { TimeToleranceValidatorService } from '../validation/time-tolerance-validator';
import { AmountToleranceValidatorService } from '../validation/amount-tolerance-validator';

export interface QRVerificationParams {
  store_id: string;
  amount: number | string;
  timestamp: number | string | Date;
  phone: string;
  qr_version?: number;
  metadata?: Record<string, any>;
}

export interface QRVerificationResult {
  success: boolean;
  session_id?: string;
  session_token?: string;
  verification_url?: string;
  expires_at?: Date;
  store_name?: string;
  validation_results?: {
    phone: any;
    time: any;
    amount: any;
  };
  fraud_assessment?: any;
  error_code?: string;
  error_message?: string;
}

export class QRVerificationService {
  private static readonly SESSION_EXPIRY_MINUTES = 30;
  private static readonly QR_VERSION = 1;
  private static readonly MAX_SESSIONS_PER_STORE_PER_HOUR = 100;

  /**
   * Creates a new verification session from QR parameters
   * @param params QR verification parameters
   * @param clientIP Client IP address for fraud detection
   * @returns Verification session result
   */
  public static async createVerificationSession(
    params: QRVerificationParams,
    clientIP?: string
  ): Promise<QRVerificationResult> {
    try {
      // Validate input parameters
      const validationResult = this.validateQRParameters(params);
      if (!validationResult.isValid) {
        return {
          success: false,
          error_code: 'INVALID_PARAMETERS',
          error_message: validationResult.errorMessage || 'Invalid QR parameters'
        };
      }

      // Validate store exists and is active
      const store = await this.validateStore(params.store_id);
      if (!store) {
        return {
          success: false,
          error_code: 'STORE_NOT_FOUND',
          error_message: 'Store not found or inactive'
        };
      }

      // Perform validation checks
      const phoneValidation = PhoneValidatorService.validateSwedishPhone(params.phone);
      const timeValidation = TimeToleranceValidatorService.validateCurrentTimeTolerance(params.timestamp);
      const amountValidation = AmountToleranceValidatorService.isValidSwedishAmount(params.amount);

      // Collect validation results
      const validation_results = {
        phone: phoneValidation,
        time: timeValidation,
        amount: { isValid: amountValidation }
      };

      // Check if all validations passed
      if (!phoneValidation.isValid || !timeValidation.isValid || !amountValidation) {
        return {
          success: false,
          error_code: 'VALIDATION_FAILED',
          error_message: 'One or more validation checks failed',
          validation_results
        };
      }

      // Perform fraud detection
      const fraudAssessment = await FraudDetectionService.assessRisk({
        store_id: params.store_id,
        phone: phoneValidation.e164Format!,
        amount: typeof params.amount === 'string' ? parseFloat(params.amount) : params.amount,
        client_ip: clientIP,
        timestamp: new Date(params.timestamp)
      });

      // Check fraud risk
      if (fraudAssessment.risk_level === 'HIGH') {
        return {
          success: false,
          error_code: 'FRAUD_DETECTED',
          error_message: 'Transaction blocked due to high fraud risk',
          fraud_assessment: fraudAssessment
        };
      }

      // Check rate limiting
      const rateLimitCheck = await this.checkRateLimit(params.store_id);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error_code: 'RATE_LIMITED',
          error_message: 'Too many verification attempts. Please try again later.',
          fraud_assessment: fraudAssessment
        };
      }

      // Generate session
      const sessionData = await this.generateVerificationSession(
        params,
        store,
        phoneValidation.e164Format!,
        fraudAssessment
      );

      return {
        success: true,
        session_id: sessionData.id,
        session_token: sessionData.session_token,
        verification_url: sessionData.verification_url,
        expires_at: sessionData.expires_at,
        store_name: store.name,
        validation_results,
        fraud_assessment: fraudAssessment
      };

    } catch (error) {
      console.error('QR Verification Service Error:', error);
      return {
        success: false,
        error_code: 'INTERNAL_ERROR',
        error_message: 'Internal server error during verification session creation'
      };
    }
  }

  /**
   * Retrieves an active verification session by token
   * @param sessionToken Session token
   * @returns Verification session or null
   */
  public static async getVerificationSession(sessionToken: string): Promise<VerificationSessionModel | null> {
    try {
      const db = DatabaseService.getClient();
      
      const { data, error } = await db
        .from('verification_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        return null;
      }

      const session = new VerificationSessionModel(data);
      
      // Check if session is still valid
      if (!session.isValid()) {
        // Mark session as expired
        await this.expireSession(session.id);
        return null;
      }

      return session;

    } catch (error) {
      console.error('Error retrieving verification session:', error);
      return null;
    }
  }

  /**
   * Validates QR parameters format and requirements
   * @param params QR parameters to validate
   * @returns Validation result
   */
  private static validateQRParameters(params: QRVerificationParams): {
    isValid: boolean;
    errorMessage?: string;
  } {
    // Check required fields
    if (!params.store_id || typeof params.store_id !== 'string') {
      return { isValid: false, errorMessage: 'Valid store_id is required' };
    }

    if (!params.amount || (typeof params.amount !== 'number' && typeof params.amount !== 'string')) {
      return { isValid: false, errorMessage: 'Valid amount is required' };
    }

    if (!params.timestamp) {
      return { isValid: false, errorMessage: 'Valid timestamp is required' };
    }

    if (!params.phone || typeof params.phone !== 'string') {
      return { isValid: false, errorMessage: 'Valid phone number is required' };
    }

    // Validate QR version if provided
    if (params.qr_version && params.qr_version !== this.QR_VERSION) {
      return { isValid: false, errorMessage: `Unsupported QR version: ${params.qr_version}` };
    }

    return { isValid: true };
  }

  /**
   * Validates store exists and can accept verifications
   * @param storeId Store ID to validate
   * @returns Store model or null
   */
  private static async validateStore(storeId: string): Promise<StoreModel | null> {
    try {
      const db = DatabaseService.getClient();
      
      const { data, error } = await db
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .eq('active', true)
        .eq('verification_enabled', true)
        .single();

      if (error || !data) {
        return null;
      }

      return new StoreModel(data);

    } catch (error) {
      console.error('Error validating store:', error);
      return null;
    }
  }

  /**
   * Checks rate limiting for store
   * @param storeId Store ID to check
   * @returns Rate limit result
   */
  private static async checkRateLimit(storeId: string): Promise<{
    allowed: boolean;
    current_count?: number;
    limit?: number;
  }> {
    try {
      const db = DatabaseService.getClient();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { count, error } = await db
        .from('verification_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .gte('created_at', oneHourAgo.toISOString());

      if (error) {
        console.error('Rate limit check error:', error);
        return { allowed: true }; // Allow on error to prevent blocking legitimate requests
      }

      const currentCount = count || 0;
      
      return {
        allowed: currentCount < this.MAX_SESSIONS_PER_STORE_PER_HOUR,
        current_count: currentCount,
        limit: this.MAX_SESSIONS_PER_STORE_PER_HOUR
      };

    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true };
    }
  }

  /**
   * Generates a new verification session in database
   * @param params Original QR parameters
   * @param store Store model
   * @param normalizedPhone Validated phone number
   * @param fraudAssessment Fraud assessment result
   * @returns Session data
   */
  private static async generateVerificationSession(
    params: QRVerificationParams,
    store: StoreModel,
    normalizedPhone: string,
    fraudAssessment: any
  ): Promise<{
    id: string;
    session_token: string;
    verification_url: string;
    expires_at: Date;
  }> {
    const db = DatabaseService.getClient();
    
    const sessionId = uuidv4();
    const sessionToken = this.generateSessionToken();
    const expiresAt = new Date(Date.now() + this.SESSION_EXPIRY_MINUTES * 60 * 1000);
    
    // Parse amount properly
    const amount = typeof params.amount === 'string' ? parseFloat(params.amount) : params.amount;
    
    const sessionData = {
      id: sessionId,
      store_id: params.store_id,
      session_token: sessionToken,
      customer_phone: normalizedPhone,
      expected_amount: amount,
      expected_timestamp: new Date(params.timestamp),
      qr_version: params.qr_version || this.QR_VERSION,
      status: 'pending' as const,
      expires_at: expiresAt,
      fraud_risk_score: fraudAssessment.risk_score,
      metadata: {
        original_qr_params: params,
        fraud_assessment: fraudAssessment,
        created_from_ip: fraudAssessment.client_ip
      },
      created_at: new Date(),
      updated_at: new Date()
    };

    const { error } = await db
      .from('verification_sessions')
      .insert(sessionData);

    if (error) {
      throw new Error(`Failed to create verification session: ${error.message}`);
    }

    // Generate verification URL
    const verificationUrl = this.generateVerificationUrl(sessionToken);

    return {
      id: sessionId,
      session_token: sessionToken,
      verification_url: verificationUrl,
      expires_at: expiresAt
    };
  }

  /**
   * Generates a cryptographically secure session token
   * @returns Session token string
   */
  private static generateSessionToken(): string {
    // Generate a secure random token
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    const uuid = uuidv4().replace(/-/g, '');
    
    return `qr_${timestamp}_${random}_${uuid}`.substring(0, 64);
  }

  /**
   * Generates verification URL for customer
   * @param sessionToken Session token
   * @returns Full verification URL
   */
  private static generateVerificationUrl(sessionToken: string): string {
    // This should be configurable via environment variables
    const baseUrl = process.env.CUSTOMER_APP_URL || 'https://customer.vocilia.com';
    return `${baseUrl}/verification?token=${sessionToken}`;
  }

  /**
   * Marks a session as expired
   * @param sessionId Session ID to expire
   */
  private static async expireSession(sessionId: string): Promise<void> {
    try {
      const db = DatabaseService.getClient();
      
      await db
        .from('verification_sessions')
        .update({ 
          status: 'expired',
          updated_at: new Date()
        })
        .eq('id', sessionId);

    } catch (error) {
      console.error('Error expiring session:', error);
    }
  }

  /**
   * Gets current service configuration
   * @returns Service configuration
   */
  public static getConfig(): {
    sessionExpiryMinutes: number;
    qrVersion: number;
    maxSessionsPerStorePerHour: number;
  } {
    return {
      sessionExpiryMinutes: this.SESSION_EXPIRY_MINUTES,
      qrVersion: this.QR_VERSION,
      maxSessionsPerStorePerHour: this.MAX_SESSIONS_PER_STORE_PER_HOUR
    };
  }
}