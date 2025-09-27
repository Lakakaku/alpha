import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { 
  VerificationSession,
  CustomerVerification, 
  FraudDetectionLog,
  VerificationSessionStatus,
  ValidationStatus,
  PhoneValidationStatus,
  FraudDetectionType,
  FraudActionTaken
} from '@vocilia/types';

/**
 * QR Database Adapter for Supabase operations
 * Handles all database interactions for the QR verification system
 */
export class QRDatabase {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // ==================== STORE OPERATIONS ====================

  /**
   * Get store information by ID
   */
  async getStoreById(storeId: string): Promise<{
    store_id: string;
    store_name: string;
    business_name: string;
    logo_url?: string;
  } | null> {
    const { data, error } = await this.supabase
      .from('stores')
      .select(`
        id,
        name,
        businesses!inner(name)
      `)
      .eq('id', storeId)
      .eq('active', true)
      .eq('verification_enabled', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      store_id: data.id,
      store_name: data.name,
      business_name: (data.businesses as any)?.name || 'Unknown Business',
      logo_url: undefined // TODO: Add logo support
    };
  }

  // ==================== VERIFICATION SESSION OPERATIONS ====================

  /**
   * Create a new verification session
   */
  async createVerificationSession(
    storeId: string,
    qrVersion: number,
    sessionToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<VerificationSession> {
    const now = new Date();
    const scanTimestamp = now.toISOString();

    const { data, error } = await this.supabase
      .from('verification_sessions')
      .insert({
        store_id: storeId,
        qr_version: qrVersion,
        scan_timestamp: scanTimestamp,
        session_token: sessionToken,
        status: 'pending' as VerificationSessionStatus,
        ip_address: ipAddress,
        user_agent: userAgent
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create verification session: ${error?.message}`);
    }

    return {
      id: data.id,
      store_id: data.store_id,
      qr_version: data.qr_version,
      scan_timestamp: data.scan_timestamp,
      session_token: data.session_token,
      status: data.status as VerificationSessionStatus,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  /**
   * Get verification session by token
   */
  async getVerificationSession(sessionToken: string): Promise<VerificationSession | null> {
    const { data, error } = await this.supabase
      .from('verification_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      store_id: data.store_id,
      qr_version: data.qr_version,
      scan_timestamp: data.scan_timestamp,
      session_token: data.session_token,
      status: data.status as VerificationSessionStatus,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionToken: string, 
    status: VerificationSessionStatus
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('verification_sessions')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('session_token', sessionToken)
      .select('id')
      .single();

    return !error && !!data;
  }

  // ==================== CUSTOMER VERIFICATION OPERATIONS ====================

  /**
   * Create customer verification record
   */
  async createCustomerVerification(
    sessionId: string,
    transactionTime: string,
    transactionAmount: number,
    phoneNumberE164: string,
    phoneNumberNational: string,
    timeValidationStatus: ValidationStatus,
    amountValidationStatus: ValidationStatus,
    phoneValidationStatus: PhoneValidationStatus,
    toleranceCheckTimeDiff: number | null,
    toleranceCheckAmountDiff: number | null
  ): Promise<CustomerVerification> {
    const { data, error } = await this.supabase
      .from('customer_verifications')
      .insert({
        session_id: sessionId,
        transaction_time: transactionTime,
        transaction_amount: transactionAmount,
        phone_number_e164: phoneNumberE164,
        phone_number_national: phoneNumberNational,
        time_validation_status: timeValidationStatus,
        amount_validation_status: amountValidationStatus,
        phone_validation_status: phoneValidationStatus,
        tolerance_check_time_diff: toleranceCheckTimeDiff,
        tolerance_check_amount_diff: toleranceCheckAmountDiff
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create customer verification: ${error?.message}`);
    }

    return {
      id: data.id,
      session_id: data.session_id,
      transaction_time: data.transaction_time,
      transaction_amount: data.transaction_amount,
      phone_number_e164: data.phone_number_e164,
      phone_number_national: data.phone_number_national,
      time_validation_status: data.time_validation_status as ValidationStatus,
      amount_validation_status: data.amount_validation_status as ValidationStatus,
      phone_validation_status: data.phone_validation_status as PhoneValidationStatus,
      tolerance_check_time_diff: data.tolerance_check_time_diff,
      tolerance_check_amount_diff: data.tolerance_check_amount_diff,
      submitted_at: data.submitted_at,
      verified_at: data.verified_at
    };
  }

  /**
   * Get customer verification by session ID
   */
  async getCustomerVerificationBySession(sessionId: string): Promise<CustomerVerification | null> {
    const { data, error } = await this.supabase
      .from('customer_verifications')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      session_id: data.session_id,
      transaction_time: data.transaction_time,
      transaction_amount: data.transaction_amount,
      phone_number_e164: data.phone_number_e164,
      phone_number_national: data.phone_number_national,
      time_validation_status: data.time_validation_status as ValidationStatus,
      amount_validation_status: data.amount_validation_status as ValidationStatus,
      phone_validation_status: data.phone_validation_status as PhoneValidationStatus,
      tolerance_check_time_diff: data.tolerance_check_time_diff,
      tolerance_check_amount_diff: data.tolerance_check_amount_diff,
      submitted_at: data.submitted_at,
      verified_at: data.verified_at
    };
  }

  // ==================== FRAUD DETECTION OPERATIONS ====================

  /**
   * Create fraud detection log
   */
  async createFraudDetectionLog(
    sessionId: string | null,
    detectionType: FraudDetectionType,
    riskScore: number,
    ipAddress: string | null,
    userAgent: string | null,
    detectionDetails: any,
    actionTaken: FraudActionTaken
  ): Promise<FraudDetectionLog> {
    const { data, error } = await this.supabase
      .from('fraud_detection_logs')
      .insert({
        session_id: sessionId,
        detection_type: detectionType,
        risk_score: riskScore,
        ip_address: ipAddress,
        user_agent: userAgent,
        detection_details: detectionDetails,
        action_taken: actionTaken
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create fraud detection log: ${error?.message}`);
    }

    return {
      id: data.id,
      session_id: data.session_id,
      detection_type: data.detection_type as FraudDetectionType,
      risk_score: data.risk_score,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      detection_details: data.detection_details,
      action_taken: data.action_taken as FraudActionTaken,
      detected_at: data.detected_at
    };
  }

  /**
   * Get fraud detection logs for IP within time window
   */
  async getFraudDetectionLogs(
    ipAddress: string,
    windowMinutes: number
  ): Promise<FraudDetectionLog[]> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const { data, error } = await this.supabase
      .from('fraud_detection_logs')
      .select('*')
      .eq('ip_address', ipAddress)
      .gte('detected_at', windowStart.toISOString())
      .order('detected_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(row => ({
      id: row.id,
      session_id: row.session_id,
      detection_type: row.detection_type as FraudDetectionType,
      risk_score: row.risk_score,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      detection_details: row.detection_details,
      action_taken: row.action_taken as FraudActionTaken,
      detected_at: row.detected_at
    }));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const { data, error } = await this.supabase
      .from('verification_sessions')
      .update({ 
        status: 'expired' as VerificationSessionStatus,
        updated_at: new Date().toISOString()
      })
      .lt('created_at', thirtyMinutesAgo.toISOString())
      .eq('status', 'pending')
      .select('id');

    if (error) {
      throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
    }

    return data?.length || 0;
  }
}