import { Request, Response, NextFunction } from 'express';
import { loggingService } from '../services/loggingService';

export interface VerificationError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  context?: Record<string, any>;
}

export class VerificationErrorTypes {
  static readonly CYCLE_NOT_FOUND = 'VERIFICATION_CYCLE_NOT_FOUND';
  static readonly DATABASE_NOT_FOUND = 'VERIFICATION_DATABASE_NOT_FOUND';
  static readonly INVALID_DEADLINE = 'INVALID_VERIFICATION_DEADLINE';
  static readonly ALREADY_SUBMITTED = 'VERIFICATION_ALREADY_SUBMITTED';
  static readonly DEADLINE_EXPIRED = 'VERIFICATION_DEADLINE_EXPIRED';
  static readonly INVALID_FILE_FORMAT = 'INVALID_VERIFICATION_FILE_FORMAT';
  static readonly FILE_TOO_LARGE = 'VERIFICATION_FILE_TOO_LARGE';
  static readonly MISSING_RECORDS = 'MISSING_VERIFICATION_RECORDS';
  static readonly INVALID_VERIFICATION_STATUS = 'INVALID_VERIFICATION_STATUS';
  static readonly PAYMENT_NOT_FOUND = 'PAYMENT_INVOICE_NOT_FOUND';
  static readonly PAYMENT_ALREADY_PROCESSED = 'PAYMENT_ALREADY_PROCESSED';
  static readonly INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_VERIFICATION_PERMISSIONS';
  static readonly STORE_ACCESS_DENIED = 'STORE_ACCESS_DENIED';
  static readonly PREPARATION_IN_PROGRESS = 'DATABASE_PREPARATION_IN_PROGRESS';
  static readonly PREPARATION_FAILED = 'DATABASE_PREPARATION_FAILED';
  static readonly EXPORT_FAILED = 'FILE_EXPORT_FAILED';
  static readonly STORAGE_ERROR = 'VERIFICATION_STORAGE_ERROR';
  static readonly SWISH_PAYMENT_FAILED = 'SWISH_PAYMENT_FAILED';
  static readonly EMAIL_DELIVERY_FAILED = 'EMAIL_DELIVERY_FAILED';
  static readonly INVALID_PHONE_NUMBER = 'INVALID_PHONE_NUMBER_FORMAT';
  static readonly DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION_REFERENCE';
}

export function createVerificationError(
  type: string,
  message: string,
  statusCode: number = 400,
  details?: any,
  context?: Record<string, any>
): VerificationError {
  const error = new Error(message) as VerificationError;
  error.name = 'VerificationError';
  error.code = type;
  error.statusCode = statusCode;
  error.details = details;
  error.context = context;
  return error;
}

export function verificationErrorHandler(
  error: VerificationError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract context information
  const requestContext = {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
    storeId: req.params.storeId || req.body.storeId,
    cycleId: req.params.cycleId || req.body.cycleId,
    databaseId: req.params.databaseId || req.body.databaseId
  };

  // Log the error with full context
  loggingService.logError('Verification workflow error', error, {
    ...requestContext,
    errorCode: error.code,
    errorDetails: error.details,
    errorContext: error.context
  });

  // Determine appropriate response based on error type
  const response = getErrorResponse(error);

  // Send standardized error response
  res.status(response.statusCode).json({
    success: false,
    error: {
      code: response.code,
      message: response.message,
      details: response.details,
      timestamp: new Date().toISOString(),
      requestId: generateRequestId()
    }
  });
}

function getErrorResponse(error: VerificationError): {
  statusCode: number;
  code: string;
  message: string;
  details?: any;
} {
  // Default values
  let statusCode = error.statusCode || 500;
  let code = error.code || 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'An unexpected error occurred';
  let details = error.details;

  // Specific error handling based on type
  switch (error.code) {
    case VerificationErrorTypes.CYCLE_NOT_FOUND:
      statusCode = 404;
      message = 'Verification cycle not found';
      break;

    case VerificationErrorTypes.DATABASE_NOT_FOUND:
      statusCode = 404;
      message = 'Verification database not found';
      break;

    case VerificationErrorTypes.INVALID_DEADLINE:
      statusCode = 400;
      message = 'Invalid verification deadline specified';
      break;

    case VerificationErrorTypes.ALREADY_SUBMITTED:
      statusCode = 409;
      message = 'Verification has already been submitted for this database';
      break;

    case VerificationErrorTypes.DEADLINE_EXPIRED:
      statusCode = 410;
      message = 'Verification deadline has expired';
      break;

    case VerificationErrorTypes.INVALID_FILE_FORMAT:
      statusCode = 400;
      message = 'Invalid file format. Please upload a valid CSV or Excel file';
      break;

    case VerificationErrorTypes.FILE_TOO_LARGE:
      statusCode = 413;
      message = 'File size exceeds maximum allowed limit (50MB)';
      break;

    case VerificationErrorTypes.MISSING_RECORDS:
      statusCode = 400;
      message = 'Verification file is missing required transaction records';
      break;

    case VerificationErrorTypes.INVALID_VERIFICATION_STATUS:
      statusCode = 400;
      message = 'Invalid verification status. Status must be "verified" or "fake"';
      break;

    case VerificationErrorTypes.PAYMENT_NOT_FOUND:
      statusCode = 404;
      message = 'Payment invoice not found';
      break;

    case VerificationErrorTypes.PAYMENT_ALREADY_PROCESSED:
      statusCode = 409;
      message = 'Payment has already been processed';
      break;

    case VerificationErrorTypes.INSUFFICIENT_PERMISSIONS:
      statusCode = 403;
      message = 'Insufficient permissions to access verification data';
      break;

    case VerificationErrorTypes.STORE_ACCESS_DENIED:
      statusCode = 403;
      message = 'Access denied for this store';
      break;

    case VerificationErrorTypes.PREPARATION_IN_PROGRESS:
      statusCode = 409;
      message = 'Database preparation is already in progress';
      break;

    case VerificationErrorTypes.PREPARATION_FAILED:
      statusCode = 500;
      message = 'Database preparation failed. Please try again or contact support';
      break;

    case VerificationErrorTypes.EXPORT_FAILED:
      statusCode = 500;
      message = 'File export failed. Please try again';
      break;

    case VerificationErrorTypes.STORAGE_ERROR:
      statusCode = 500;
      message = 'File storage error. Please try again';
      break;

    case VerificationErrorTypes.SWISH_PAYMENT_FAILED:
      statusCode = 502;
      message = 'Payment processing failed. Please try again or contact support';
      break;

    case VerificationErrorTypes.EMAIL_DELIVERY_FAILED:
      statusCode = 500;
      message = 'Email notification failed to send';
      break;

    case VerificationErrorTypes.INVALID_PHONE_NUMBER:
      statusCode = 400;
      message = 'Invalid Swedish phone number format';
      break;

    case VerificationErrorTypes.DUPLICATE_TRANSACTION:
      statusCode = 409;
      message = 'Duplicate transaction reference detected';
      break;

    default:
      // Handle non-verification errors
      if (error.name === 'ValidationError') {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = 'Request validation failed';
      } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        code = 'UNAUTHORIZED';
        message = 'Authentication required';
      } else if (error.name === 'ForbiddenError') {
        statusCode = 403;
        code = 'FORBIDDEN';
        message = 'Access denied';
      }
      break;
  }

  return { statusCode, code, message, details };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Middleware for catching async errors in verification routes
export function asyncVerificationHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Utility functions for creating specific verification errors
export const VerificationErrors = {
  cycleNotFound: (cycleId: string) =>
    createVerificationError(
      VerificationErrorTypes.CYCLE_NOT_FOUND,
      'Verification cycle not found',
      404,
      { cycleId }
    ),

  databaseNotFound: (databaseId: string) =>
    createVerificationError(
      VerificationErrorTypes.DATABASE_NOT_FOUND,
      'Verification database not found',
      404,
      { databaseId }
    ),

  deadlineExpired: (deadline: Date) =>
    createVerificationError(
      VerificationErrorTypes.DEADLINE_EXPIRED,
      'Verification deadline has expired',
      410,
      { deadline: deadline.toISOString() }
    ),

  alreadySubmitted: (databaseId: string) =>
    createVerificationError(
      VerificationErrorTypes.ALREADY_SUBMITTED,
      'Verification already submitted',
      409,
      { databaseId }
    ),

  invalidFileFormat: (allowedFormats: string[]) =>
    createVerificationError(
      VerificationErrorTypes.INVALID_FILE_FORMAT,
      'Invalid file format',
      400,
      { allowedFormats }
    ),

  fileTooLarge: (maxSize: number, actualSize: number) =>
    createVerificationError(
      VerificationErrorTypes.FILE_TOO_LARGE,
      'File too large',
      413,
      { maxSize, actualSize }
    ),

  storeAccessDenied: (storeId: string, userId: string) =>
    createVerificationError(
      VerificationErrorTypes.STORE_ACCESS_DENIED,
      'Access denied for this store',
      403,
      { storeId, userId }
    ),

  preparationFailed: (reason: string) =>
    createVerificationError(
      VerificationErrorTypes.PREPARATION_FAILED,
      'Database preparation failed',
      500,
      { reason }
    ),

  swishPaymentFailed: (error: string) =>
    createVerificationError(
      VerificationErrorTypes.SWISH_PAYMENT_FAILED,
      'Swish payment failed',
      502,
      { swishError: error }
    ),

  invalidPhoneNumber: (phoneNumber: string) =>
    createVerificationError(
      VerificationErrorTypes.INVALID_PHONE_NUMBER,
      'Invalid Swedish phone number',
      400,
      { phoneNumber: '***MASKED***' }
    )
};

// Type guards for error checking
export function isVerificationError(error: any): error is VerificationError {
  return error && error.name === 'VerificationError' && error.code;
}

export function isDeadlineExpiredError(error: any): boolean {
  return isVerificationError(error) && error.code === VerificationErrorTypes.DEADLINE_EXPIRED;
}

export function isAccessDeniedError(error: any): boolean {
  return isVerificationError(error) && (
    error.code === VerificationErrorTypes.STORE_ACCESS_DENIED ||
    error.code === VerificationErrorTypes.INSUFFICIENT_PERMISSIONS
  );
}

export function isPaymentError(error: any): boolean {
  return isVerificationError(error) && (
    error.code === VerificationErrorTypes.SWISH_PAYMENT_FAILED ||
    error.code === VerificationErrorTypes.PAYMENT_NOT_FOUND ||
    error.code === VerificationErrorTypes.PAYMENT_ALREADY_PROCESSED
  );
}

// Export the middleware
export default verificationErrorHandler;