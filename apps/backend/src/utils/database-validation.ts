import { z } from 'zod';

/**
 * Database validation schemas for QR verification system
 * Ensures data integrity before database operations
 */

// Session Token Validation
export const sessionTokenSchema = z.string()
  .length(64, 'Session token must be exactly 64 characters')
  .regex(/^[a-z0-9]+$/, 'Session token must contain only lowercase alphanumeric characters');

// Store ID Validation
export const storeIdSchema = z.string()
  .uuid('Store ID must be a valid UUID');

// IP Address Validation
export const ipAddressSchema = z.string()
  .refine((ip) => {
    // Basic IPv4/IPv6 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }, 'Invalid IP address format');

// Transaction Time Validation (HH:MM format)
export const transactionTimeSchema = z.string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Transaction time must be in HH:MM format');

// Transaction Amount Validation
export const transactionAmountSchema = z.number()
  .min(0, 'Transaction amount must be positive')
  .max(999999.99, 'Transaction amount too large')
  .refine((amount) => {
    // Check for valid decimal precision (max 2 decimal places)
    return Number.isInteger(amount * 100);
  }, 'Transaction amount can have at most 2 decimal places');

// Phone Number Validation (basic format check)
export const phoneNumberSchema = z.string()
  .min(8, 'Phone number too short')
  .max(20, 'Phone number too long')
  .regex(/^[\+]?[0-9\s\-\(\)]+$/, 'Invalid phone number format');

// User Agent Validation
export const userAgentSchema = z.string()
  .min(1, 'User agent cannot be empty')
  .max(1000, 'User agent too long');

// Risk Factors Validation
export const riskFactorsSchema = z.array(z.string())
  .max(10, 'Too many risk factors');

// Verification Session Status Validation
export const verificationSessionStatusSchema = z.enum([
  'pending', 'completed', 'expired', 'failed'
]);

// Verification Status Validation
export const verificationStatusSchema = z.enum([
  'pending', 'completed', 'failed'
]);

// Validation Results Schema
export const validationResultsSchema = z.object({
  time_validation: z.object({
    status: z.enum(['valid', 'out_of_tolerance', 'invalid_format']),
    difference_minutes: z.number().optional(),
    tolerance_range: z.string().optional()
  }),
  amount_validation: z.object({
    status: z.enum(['valid', 'out_of_tolerance']),
    difference_sek: z.number().optional(),
    tolerance_range: z.string().optional()
  }),
  phone_validation: z.object({
    status: z.enum(['valid', 'invalid_format', 'not_swedish', 'not_mobile']),
    e164_format: z.string().optional(),
    national_format: z.string().optional()
  }),
  overall_valid: z.boolean()
});

// Complete Verification Session Schema
export const verificationSessionSchema = z.object({
  session_token: sessionTokenSchema,
  store_id: storeIdSchema,
  status: verificationSessionStatusSchema,
  created_at: z.date(),
  expires_at: z.date(),
  ip_address: ipAddressSchema,
  user_agent: userAgentSchema
});

// Complete Customer Verification Schema
export const customerVerificationSchema = z.object({
  verification_id: z.string().uuid(),
  session_token: sessionTokenSchema,
  transaction_time: transactionTimeSchema,
  transaction_amount: transactionAmountSchema,
  phone_number: phoneNumberSchema,
  verification_status: verificationStatusSchema,
  submitted_at: z.date(),
  validation_results: validationResultsSchema
});

// Complete Fraud Detection Log Schema
export const fraudDetectionLogSchema = z.object({
  log_id: z.string().uuid(),
  store_id: storeIdSchema,
  ip_address: ipAddressSchema,
  user_agent: userAgentSchema,
  access_timestamp: z.date(),
  risk_factors: riskFactorsSchema,
  session_token: sessionTokenSchema.nullable()
});

/**
 * Validation helper functions
 */

export class DatabaseValidator {
  /**
   * Validate session token format
   */
  static validateSessionToken(token: string): boolean {
    try {
      sessionTokenSchema.parse(token);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate store ID format
   */
  static validateStoreId(storeId: string): boolean {
    try {
      storeIdSchema.parse(storeId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate transaction time format
   */
  static validateTransactionTime(time: string): boolean {
    try {
      transactionTimeSchema.parse(time);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate transaction amount
   */
  static validateTransactionAmount(amount: number): boolean {
    try {
      transactionAmountSchema.parse(amount);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phone: string): boolean {
    try {
      phoneNumberSchema.parse(phone);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate IP address format
   */
  static validateIpAddress(ip: string): boolean {
    try {
      ipAddressSchema.parse(ip);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate complete verification session object
   */
  static validateVerificationSession(session: any): boolean {
    try {
      verificationSessionSchema.parse(session);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate complete customer verification object
   */
  static validateCustomerVerification(verification: any): boolean {
    try {
      customerVerificationSchema.parse(verification);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate complete fraud detection log object
   */
  static validateFraudDetectionLog(log: any): boolean {
    try {
      fraudDetectionLogSchema.parse(log);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize session token (ensure lowercase alphanumeric)
   */
  static sanitizeSessionToken(token: string): string {
    return token.replace(/[^a-z0-9]/g, '').toLowerCase();
  }

  /**
   * Sanitize phone number (remove non-digit/plus characters)
   */
  static sanitizePhoneNumber(phone: string): string {
    return phone.replace(/[^\+0-9\s\-\(\)]/g, '');
  }

  /**
   * Normalize transaction amount to 2 decimal places
   */
  static normalizeTransactionAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}