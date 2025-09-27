/**
 * Offline Sync Validation Middleware for Vocilia Customer Interface
 * 
 * Validates and processes offline submission data from customer devices.
 * Ensures data integrity, security, and proper synchronization of offline actions.
 * 
 * Features:
 * - Offline submission data validation
 * - Duplicate detection and prevention
 * - Data integrity checks and sanitization
 * - Batch processing validation
 * - Conflict resolution for sync operations
 * - Rate limiting for bulk submissions
 * - Schema validation for offline data
 */

import { Request, Response, NextFunction } from 'express';
import { database } from '@vocilia/database';
import crypto from 'crypto';

// === TYPES ===

interface OfflineSubmission {
  id: string;
  type: 'verification_submission' | 'call_completion' | 'support_request' | 'feedback_submission';
  data: Record<string, any>;
  timestamp: string;
  device_fingerprint?: string;
  checksum: string;
  retry_count?: number;
  version: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: any;
}

interface BatchValidationResult {
  totalItems: number;
  validItems: OfflineSubmission[];
  invalidItems: { item: OfflineSubmission; errors: string[] }[];
  duplicates: string[];
  conflicts: { id: string; reason: string }[];
}

// Extend Request interface for offline validation context
declare global {
  namespace Express {
    interface Request {
      offlineSubmissions?: OfflineSubmission[];
      validatedSubmissions?: OfflineSubmission[];
      batchValidationResult?: BatchValidationResult;
    }
  }
}

// === CONFIGURATION ===

const MAX_BATCH_SIZE = 50;
const MAX_SUBMISSION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const SUPPORTED_VERSIONS = ['1.0.0'];
const MAX_RETRY_COUNT = 5;

// Rate limiting for offline sync
const syncRateLimit = new Map<string, { count: number; resetTime: number }>();
const MAX_SYNC_REQUESTS_PER_HOUR = 10;

// === MAIN MIDDLEWARE FUNCTIONS ===

/**
 * Validates incoming offline submission requests
 */
export async function validateOfflineSubmission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { submissions } = req.body;

    if (!submissions || !Array.isArray(submissions)) {
      return res.status(400).json({
        error: 'INVALID_SUBMISSION_FORMAT',
        message: 'Request must contain an array of submissions'
      });
    }

    if (submissions.length === 0) {
      return res.status(400).json({
        error: 'EMPTY_SUBMISSION',
        message: 'At least one submission is required'
      });
    }

    if (submissions.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: 'BATCH_TOO_LARGE',
        message: `Batch size cannot exceed ${MAX_BATCH_SIZE} items`,
        maxBatchSize: MAX_BATCH_SIZE,
        providedSize: submissions.length
      });
    }

    // Validate each submission
    const batchResult = await validateSubmissionBatch(submissions);

    if (batchResult.validItems.length === 0) {
      return res.status(400).json({
        error: 'NO_VALID_SUBMISSIONS',
        message: 'No valid submissions found in batch',
        validationResult: batchResult
      });
    }

    // Attach validated data to request
    req.offlineSubmissions = submissions;
    req.validatedSubmissions = batchResult.validItems;
    req.batchValidationResult = batchResult;

    next();
  } catch (error) {
    console.error('Offline submission validation error:', error);
    res.status(500).json({
      error: 'VALIDATION_ERROR',
      message: 'Failed to validate offline submissions'
    });
  }
}

/**
 * Rate limits offline sync requests per device/IP
 */
export function rateLimitOfflineSync(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientId = req.headers['x-device-id'] as string || req.ip || 'unknown';
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;
  
  const current = syncRateLimit.get(clientId);
  
  if (!current || now > current.resetTime) {
    // Reset or initialize rate limit
    syncRateLimit.set(clientId, {
      count: 1,
      resetTime: now + hourInMs
    });
    return next();
  }
  
  if (current.count >= MAX_SYNC_REQUESTS_PER_HOUR) {
    return res.status(429).json({
      error: 'SYNC_RATE_LIMIT_EXCEEDED',
      message: 'Too many sync requests. Please try again later.',
      retryAfter: Math.ceil((current.resetTime - now) / 1000),
      maxRequestsPerHour: MAX_SYNC_REQUESTS_PER_HOUR
    });
  }
  
  current.count++;
  next();
}

/**
 * Validates data integrity and prevents duplicate submissions
 */
export async function validateDataIntegrity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedSubmissions = req.validatedSubmissions;
    if (!validatedSubmissions) {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Validated submissions not found'
      });
    }

    const integrityResults = await Promise.all(
      validatedSubmissions.map(submission => checkSubmissionIntegrity(submission))
    );

    const failedIntegrityChecks = integrityResults
      .map((result, index) => ({ result, submission: validatedSubmissions[index] }))
      .filter(({ result }) => !result.valid);

    if (failedIntegrityChecks.length > 0) {
      return res.status(400).json({
        error: 'DATA_INTEGRITY_FAILURE',
        message: 'One or more submissions failed integrity checks',
        failedSubmissions: failedIntegrityChecks.map(({ submission, result }) => ({
          id: submission.id,
          errors: result.errors
        }))
      });
    }

    // Check for duplicates in database
    const duplicateCheck = await checkForDuplicates(validatedSubmissions);
    if (duplicateCheck.duplicates.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_SUBMISSIONS',
        message: 'Some submissions have already been processed',
        duplicates: duplicateCheck.duplicates,
        newSubmissions: duplicateCheck.newSubmissions
      });
    }

    next();
  } catch (error) {
    console.error('Data integrity validation error:', error);
    res.status(500).json({
      error: 'INTEGRITY_VALIDATION_ERROR',
      message: 'Failed to validate data integrity'
    });
  }
}

/**
 * Sanitizes offline submission data
 */
export function sanitizeOfflineData(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const validatedSubmissions = req.validatedSubmissions;
    if (!validatedSubmissions) {
      return next();
    }

    const sanitizedSubmissions = validatedSubmissions.map(submission => ({
      ...submission,
      data: sanitizeSubmissionData(submission.type, submission.data)
    }));

    req.validatedSubmissions = sanitizedSubmissions;
    next();
  } catch (error) {
    console.error('Data sanitization error:', error);
    res.status(500).json({
      error: 'SANITIZATION_ERROR',
      message: 'Failed to sanitize submission data'
    });
  }
}

/**
 * Validates device and session context
 */
export async function validateOfflineContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const deviceId = req.headers['x-device-id'] as string;
    const sessionToken = req.headers['x-session-token'] as string;
    const userAgent = req.headers['user-agent'] as string;

    if (!deviceId) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'Device ID is required for offline submissions'
      });
    }

    // Validate device fingerprint consistency
    const validatedSubmissions = req.validatedSubmissions || [];
    for (const submission of validatedSubmissions) {
      if (submission.device_fingerprint && submission.device_fingerprint !== deviceId) {
        return res.status(400).json({
          error: 'DEVICE_FINGERPRINT_MISMATCH',
          message: 'Device fingerprint mismatch detected',
          submissionId: submission.id
        });
      }
    }

    // Validate session if provided
    if (sessionToken) {
      const sessionValid = await validateSessionToken(sessionToken, deviceId);
      if (!sessionValid) {
        return res.status(401).json({
          error: 'INVALID_SESSION',
          message: 'Session token is invalid or expired'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Offline context validation error:', error);
    res.status(500).json({
      error: 'CONTEXT_VALIDATION_ERROR',
      message: 'Failed to validate offline context'
    });
  }
}

// === VALIDATION FUNCTIONS ===

/**
 * Validates a batch of offline submissions
 */
async function validateSubmissionBatch(submissions: any[]): Promise<BatchValidationResult> {
  const result: BatchValidationResult = {
    totalItems: submissions.length,
    validItems: [],
    invalidItems: [],
    duplicates: [],
    conflicts: []
  };

  const submissionIds = new Set<string>();

  for (const submission of submissions) {
    try {
      // Check for duplicate IDs in batch
      if (submissionIds.has(submission.id)) {
        result.duplicates.push(submission.id);
        continue;
      }
      submissionIds.add(submission.id);

      const validation = await validateSingleSubmission(submission);
      
      if (validation.valid) {
        result.validItems.push(submission);
      } else {
        result.invalidItems.push({
          item: submission,
          errors: validation.errors
        });
      }
    } catch (error) {
      result.invalidItems.push({
        item: submission,
        errors: [`Validation error: ${error.message}`]
      });
    }
  }

  return result;
}

/**
 * Validates a single offline submission
 */
async function validateSingleSubmission(submission: any): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!submission.id || typeof submission.id !== 'string') {
    errors.push('Missing or invalid submission ID');
  }

  if (!submission.type || typeof submission.type !== 'string') {
    errors.push('Missing or invalid submission type');
  }

  if (!submission.data || typeof submission.data !== 'object') {
    errors.push('Missing or invalid submission data');
  }

  if (!submission.timestamp || !isValidTimestamp(submission.timestamp)) {
    errors.push('Missing or invalid timestamp');
  }

  if (!submission.checksum || typeof submission.checksum !== 'string') {
    errors.push('Missing or invalid checksum');
  }

  if (!submission.version || !SUPPORTED_VERSIONS.includes(submission.version)) {
    errors.push(`Unsupported version: ${submission.version}`);
  }

  // Type-specific validation
  if (submission.type && errors.length === 0) {
    const typeValidation = validateSubmissionType(submission.type, submission.data);
    errors.push(...typeValidation.errors);
    warnings.push(...typeValidation.warnings);
  }

  // Timestamp validation (not too old)
  if (submission.timestamp && isValidTimestamp(submission.timestamp)) {
    const submissionTime = new Date(submission.timestamp).getTime();
    const now = Date.now();
    
    if (now - submissionTime > MAX_SUBMISSION_AGE) {
      errors.push('Submission is too old to process');
    }
    
    if (submissionTime > now + 5 * 60 * 1000) { // 5 minutes future tolerance
      errors.push('Submission timestamp is in the future');
    }
  }

  // Retry count validation
  if (submission.retry_count !== undefined) {
    if (!Number.isInteger(submission.retry_count) || submission.retry_count < 0) {
      errors.push('Invalid retry count');
    } else if (submission.retry_count > MAX_RETRY_COUNT) {
      errors.push(`Retry count exceeds maximum (${MAX_RETRY_COUNT})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates specific submission types
 */
function validateSubmissionType(type: string, data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (type) {
    case 'verification_submission':
      if (!data.store_id || typeof data.store_id !== 'string') {
        errors.push('Missing or invalid store_id');
      }
      if (!data.customer_phone && !data.customer_email) {
        errors.push('Missing customer contact information');
      }
      if (data.verification_code && typeof data.verification_code !== 'string') {
        errors.push('Invalid verification code format');
      }
      break;

    case 'call_completion':
      if (!data.call_session_id || typeof data.call_session_id !== 'string') {
        errors.push('Missing or invalid call_session_id');
      }
      if (data.rating !== undefined) {
        if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
          errors.push('Rating must be between 1 and 5');
        }
      }
      if (data.feedback && typeof data.feedback !== 'string') {
        errors.push('Feedback must be a string');
      }
      break;

    case 'support_request':
      if (!data.type || typeof data.type !== 'string') {
        errors.push('Missing or invalid support request type');
      }
      if (!data.description || typeof data.description !== 'string') {
        errors.push('Missing or invalid description');
      }
      if (data.priority && !['low', 'medium', 'high', 'urgent'].includes(data.priority)) {
        errors.push('Invalid priority level');
      }
      break;

    case 'feedback_submission':
      if (!data.type || typeof data.type !== 'string') {
        errors.push('Missing or invalid feedback type');
      }
      if (!data.content || typeof data.content !== 'string') {
        errors.push('Missing or invalid feedback content');
      }
      break;

    default:
      errors.push(`Unsupported submission type: ${type}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Checks data integrity using checksums
 */
async function checkSubmissionIntegrity(submission: OfflineSubmission): Promise<ValidationResult> {
  const errors: string[] = [];

  try {
    // Calculate expected checksum
    const dataString = JSON.stringify(submission.data) + submission.timestamp + submission.type;
    const expectedChecksum = crypto.createHash('sha256').update(dataString).digest('hex');

    if (submission.checksum !== expectedChecksum) {
      errors.push('Data integrity check failed - checksum mismatch');
    }
  } catch (error) {
    errors.push('Failed to verify data integrity');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}

/**
 * Checks for duplicate submissions in database
 */
async function checkForDuplicates(submissions: OfflineSubmission[]): Promise<{
  duplicates: string[];
  newSubmissions: OfflineSubmission[];
}> {
  const submissionIds = submissions.map(s => s.id);
  
  const { data: existingSubmissions, error } = await database
    .from('offline_submission_queue')
    .select('submission_id')
    .in('submission_id', submissionIds);

  if (error) {
    console.error('Error checking for duplicates:', error);
    return { duplicates: [], newSubmissions: submissions };
  }

  const existingIds = new Set(existingSubmissions.map(s => s.submission_id));
  const duplicates = submissionIds.filter(id => existingIds.has(id));
  const newSubmissions = submissions.filter(s => !existingIds.has(s.id));

  return { duplicates, newSubmissions };
}

/**
 * Sanitizes submission data based on type
 */
function sanitizeSubmissionData(type: string, data: any): any {
  const sanitized = { ...data };

  // Common sanitization
  if (sanitized.description && typeof sanitized.description === 'string') {
    sanitized.description = sanitized.description.trim().slice(0, 1000);
  }

  if (sanitized.feedback && typeof sanitized.feedback === 'string') {
    sanitized.feedback = sanitized.feedback.trim().slice(0, 1000);
  }

  // Type-specific sanitization
  switch (type) {
    case 'verification_submission':
      if (sanitized.customer_phone) {
        sanitized.customer_phone = sanitized.customer_phone.replace(/[^\d+]/g, '');
      }
      if (sanitized.customer_email) {
        sanitized.customer_email = sanitized.customer_email.toLowerCase().trim();
      }
      break;

    case 'support_request':
      if (sanitized.contact_email) {
        sanitized.contact_email = sanitized.contact_email.toLowerCase().trim();
      }
      break;
  }

  return sanitized;
}

/**
 * Validates session token
 */
async function validateSessionToken(sessionToken: string, deviceId: string): Promise<boolean> {
  try {
    const { data: session, error } = await database
      .from('device_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('device_id', deviceId)
      .eq('active', true)
      .gte('expires_at', new Date().toISOString())
      .single();

    return !error && !!session;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

// === UTILITY FUNCTIONS ===

/**
 * Validates timestamp format and range
 */
function isValidTimestamp(timestamp: string): boolean {
  try {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && date.toISOString() === timestamp;
  } catch {
    return false;
  }
}

/**
 * Generates a checksum for submission data
 */
export function generateSubmissionChecksum(
  data: any,
  timestamp: string,
  type: string
): string {
  const dataString = JSON.stringify(data) + timestamp + type;
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

/**
 * Health check for offline validation middleware
 */
export function getOfflineValidationHealthMetrics(): {
  activeSyncSessions: number;
  rateLimitedClients: number;
  memoryUsage: number;
} {
  return {
    activeSyncSessions: syncRateLimit.size,
    rateLimitedClients: Array.from(syncRateLimit.values())
      .filter(limit => limit.count >= MAX_SYNC_REQUESTS_PER_HOUR).length,
    memoryUsage: process.memoryUsage().heapUsed
  };
}

// Clean up rate limiting data periodically
setInterval(() => {
  const now = Date.now();
  syncRateLimit.forEach((limit, clientId) => {
    if (now > limit.resetTime) {
      syncRateLimit.delete(clientId);
    }
  });
}, 60000); // Clean up every minute

// === EXPORTS ===

export {
  validateOfflineSubmission,
  rateLimitOfflineSync,
  validateDataIntegrity,
  sanitizeOfflineData,
  validateOfflineContext,
  generateSubmissionChecksum,
  getOfflineValidationHealthMetrics
};

// Type exports
export type {
  OfflineSubmission,
  ValidationResult,
  BatchValidationResult
};