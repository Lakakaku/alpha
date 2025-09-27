import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Centralized error handling middleware for QR verification system
 */
export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction) {
  // Set default error properties
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_SERVER_ERROR';

  // Log error details (but not sensitive information)
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
    error: err.message,
    code: err.code,
    statusCode: err.statusCode,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    requestId: req.headers['x-request-id'] || 'unknown'
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.code === 'VALIDATION_ERROR' ? err.message : undefined
      }
    });
  }

  if (err.name === 'UnauthorizedError' || err.statusCode === 401) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }

  if (err.name === 'ForbiddenError' || err.statusCode === 403) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied'
      }
    });
  }

  if (err.name === 'NotFoundError' || err.statusCode === 404) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found'
      }
    });
  }

  if (err.statusCode === 429) {
    return res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: err.message || 'Too many requests'
      }
    });
  }

  // Database errors
  if (err.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: 'Resource already exists'
      }
    });
  }

  if (err.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({
      error: {
        code: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist'
      }
    });
  }

  // Default error response
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An internal server error occurred' : err.message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err
      })
    }
  });
}

/**
 * Handle 404 errors for undefined routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error: AppError = new Error(`Route ${req.method} ${req.url} not found`);
  error.statusCode = 404;
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
}

/**
 * Async error wrapper to catch async function errors
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create custom application errors
 */
export function createError(message: string, statusCode: number = 500, code?: string): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
}

/**
 * Validation error creator
 */
export function createValidationError(message: string): AppError {
  return createError(message, 400, 'VALIDATION_ERROR');
}

/**
 * Authentication error creator
 */
export function createAuthError(message: string = 'Authentication required'): AppError {
  return createError(message, 401, 'UNAUTHORIZED');
}

/**
 * Authorization error creator
 */
export function createForbiddenError(message: string = 'Access denied'): AppError {
  return createError(message, 403, 'FORBIDDEN');
}

/**
 * Not found error creator
 */
export function createNotFoundError(message: string = 'Resource not found'): AppError {
  return createError(message, 404, 'NOT_FOUND');
}

/**
 * Rate limit error creator
 */
export function createRateLimitError(message: string = 'Too many requests'): AppError {
  return createError(message, 429, 'RATE_LIMIT_EXCEEDED');
}