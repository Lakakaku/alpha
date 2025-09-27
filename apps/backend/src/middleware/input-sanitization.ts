import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Input sanitization and validation middleware
 */
export function inputSanitization() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize and validate request body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
      }

      // Sanitize URL parameters
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
      }

      next();
    } catch (error) {
      console.error('Input sanitization error:', error);
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid input data'
      });
    }
  };
}

/**
 * Sanitize an object recursively
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize a string to prevent XSS and injection attacks
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove or escape potentially dangerous characters
  return str
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Validate verification submission data
 */
export function validateVerificationSubmission() {
  const schema = z.object({
    transaction_time: z.string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM'),
    transaction_amount: z.number()
      .positive('Amount must be positive')
      .max(99999.99, 'Amount too large')
      .refine((val) => {
        const str = val.toString();
        const decimals = str.split('.')[1];
        return !decimals || decimals.length <= 2;
      }, 'Amount can have at most 2 decimal places'),
    phone_number: z.string()
      .regex(/^(\+46|0046|0)[\s-]?7[\s-]?[02369][\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/, 
        'Invalid Swedish mobile number format')
  });

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      console.error('Validation error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Validation failed'
      });
    }
  };
}

/**
 * Validate QR verification request data
 */
export function validateQRVerificationRequest() {
  const schema = z.object({
    ip_address: z.string().ip('Invalid IP address'),
    user_agent: z.string().min(1, 'User agent required').max(500, 'User agent too long')
  });

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      console.error('QR validation error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Request validation failed'
      });
    }
  };
}