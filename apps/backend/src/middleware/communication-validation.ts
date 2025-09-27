import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import DOMPurify from 'isomorphic-dompurify';

// Types for validation
interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'admin' | 'customer' | 'business';
    phone?: string;
  };
}

// Common validation schemas
const phoneNumberSchema = z.string()
  .min(1, 'Phone number is required')
  .refine((phone) => {
    try {
      const parsed = parsePhoneNumber(phone, 'SE'); // Default to Sweden
      return parsed && parsed.isValid();
    } catch {
      return false;
    }
  }, 'Invalid phone number format');

const emailSchema = z.string()
  .email('Invalid email format')
  .max(254, 'Email address too long');

const uuidSchema = z.string()
  .uuid('Invalid UUID format');

const notificationTypeSchema = z.enum([
  'reward_earned', 'payment_confirmation', 'verification_request',
  'payment_reminder', 'support_response', 'status_update',
  'weekly_summary', 'verification_timeout', 'fraud_alert'
]);

const communicationChannelSchema = z.enum(['sms', 'email', 'push']);

const supportPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

const supportCategorySchema = z.enum([
  'payment', 'verification', 'technical', 'account', 'feedback', 'other'
]);

const languageSchema = z.enum(['sv', 'en']);

// SMS Notification validation
export const validateSMSNotification = (req: Request, res: Response, next: NextFunction) => {
  const smsNotificationSchema = z.object({
    phone: phoneNumberSchema,
    notification_type: notificationTypeSchema,
    template_id: uuidSchema.optional(),
    variables: z.record(z.string(), z.any()).optional(),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    send_at: z.string().datetime().optional(),
    language: languageSchema.default('sv')
  });

  try {
    const validatedData = smsNotificationSchema.parse(req.body);
    
    // Normalize phone number to international format
    const phoneNumber = parsePhoneNumber(validatedData.phone, 'SE');
    validatedData.phone = phoneNumber.formatInternational();
    
    // Sanitize variables if provided
    if (validatedData.variables) {
      validatedData.variables = sanitizeVariables(validatedData.variables);
    }
    
    req.body = validatedData;
    next();
  } catch (error) {
    return handleValidationError(error, res);
  }
};

// Support ticket validation
export const validateSupportTicket = (req: Request, res: Response, next: NextFunction) => {
  const supportTicketSchema = z.object({
    subject: z.string()
      .min(5, 'Subject must be at least 5 characters')
      .max(200, 'Subject must be less than 200 characters'),
    description: z.string()
      .min(10, 'Description must be at least 10 characters')
      .max(5000, 'Description must be less than 5000 characters'),
    category: supportCategorySchema,
    priority: supportPrioritySchema.default('medium'),
    channel: z.enum(['email', 'chat', 'phone']).default('email'),
    customer_email: emailSchema.optional(),
    customer_phone: phoneNumberSchema.optional(),
    business_id: uuidSchema.optional(),
    attachments: z.array(z.object({
      filename: z.string().max(255),
      content_type: z.string().max(100),
      size: z.number().max(10 * 1024 * 1024) // 10MB max
    })).optional()
  });

  try {
    const validatedData = supportTicketSchema.parse(req.body);
    
    // Sanitize text fields
    validatedData.subject = sanitizeText(validatedData.subject);
    validatedData.description = sanitizeText(validatedData.description);
    
    // Normalize phone number if provided
    if (validatedData.customer_phone) {
      const phoneNumber = parsePhoneNumber(validatedData.customer_phone, 'SE');
      validatedData.customer_phone = phoneNumber.formatInternational();
    }
    
    req.body = validatedData;
    next();
  } catch (error) {
    return handleValidationError(error, res);
  }
};

// Template validation
export const validateTemplate = (req: Request, res: Response, next: NextFunction) => {
  const templateSchema = z.object({
    name: z.string()
      .min(3, 'Template name must be at least 3 characters')
      .max(100, 'Template name must be less than 100 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Template name can only contain letters, numbers, underscores, and hyphens'),
    content: z.string()
      .min(1, 'Template content is required')
      .max(1600, 'SMS template content must be less than 1600 characters'),
    variables: z.array(z.string()).optional(),
    language: languageSchema,
    notification_type: notificationTypeSchema,
    channel: communicationChannelSchema,
    is_active: z.boolean().default(true),
    compliance_checked: z.boolean().default(false)
  });

  try {
    const validatedData = templateSchema.parse(req.body);
    
    // Sanitize template content (preserve handlebars syntax)
    validatedData.content = sanitizeTemplateContent(validatedData.content);
    
    // Validate handlebars syntax
    if (!validateHandlebarsSyntax(validatedData.content)) {
      return res.status(400).json({
        error: 'Invalid handlebars syntax in template content',
        code: 'INVALID_TEMPLATE_SYNTAX'
      });
    }
    
    // Extract and validate variables from content
    const extractedVariables = extractHandlebarsVariables(validatedData.content);
    if (validatedData.variables) {
      const missingVariables = validatedData.variables.filter(v => !extractedVariables.includes(v));
      if (missingVariables.length > 0) {
        return res.status(400).json({
          error: 'Template variables do not match content variables',
          code: 'TEMPLATE_VARIABLE_MISMATCH',
          missing: missingVariables
        });
      }
    } else {
      validatedData.variables = extractedVariables;
    }
    
    req.body = validatedData;
    next();
  } catch (error) {
    return handleValidationError(error, res);
  }
};

// Communication preferences validation
export const validateCommunicationPreferences = (req: Request, res: Response, next: NextFunction) => {
  const preferencesSchema = z.object({
    sms_enabled: z.boolean().default(true),
    email_enabled: z.boolean().default(true),
    push_enabled: z.boolean().default(true),
    frequency: z.enum(['immediate', 'daily', 'weekly']).default('immediate'),
    quiet_hours_start: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
    quiet_hours_end: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
    language: languageSchema.default('sv'),
    timezone: z.string().default('Europe/Stockholm'),
    notification_types: z.array(notificationTypeSchema).optional()
  });

  try {
    const validatedData = preferencesSchema.parse(req.body);
    
    // Validate quiet hours logic
    if (validatedData.quiet_hours_start && validatedData.quiet_hours_end) {
      const start = validatedData.quiet_hours_start;
      const end = validatedData.quiet_hours_end;
      if (start === end) {
        return res.status(400).json({
          error: 'Quiet hours start and end times cannot be the same',
          code: 'INVALID_QUIET_HOURS'
        });
      }
    }
    
    req.body = validatedData;
    next();
  } catch (error) {
    return handleValidationError(error, res);
  }
};

// Webhook validation (Twilio)
export const validateTwilioWebhook = (req: Request, res: Response, next: NextFunction) => {
  const twilioWebhookSchema = z.object({
    MessageSid: z.string(),
    MessageStatus: z.enum(['queued', 'failed', 'sent', 'delivered', 'undelivered', 'receiving', 'received']),
    To: phoneNumberSchema,
    From: z.string(),
    Body: z.string().optional(),
    ErrorCode: z.string().optional(),
    ErrorMessage: z.string().optional(),
    AccountSid: z.string(),
    SmsSid: z.string().optional(),
    SmsStatus: z.string().optional()
  });

  try {
    const validatedData = twilioWebhookSchema.parse(req.body);
    
    // Normalize phone number
    const phoneNumber = parsePhoneNumber(validatedData.To, 'SE');
    validatedData.To = phoneNumber.formatInternational();
    
    req.body = validatedData;
    next();
  } catch (error) {
    return handleValidationError(error, res);
  }
};

// Query parameter validation
export const validateQueryParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedQuery = schema.parse(req.query);
      req.query = validatedQuery;
      next();
    } catch (error) {
      return handleValidationError(error, res);
    }
  };
};

// Common query parameter schemas
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).default('20'),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc')
});

export const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  timezone: z.string().default('Europe/Stockholm')
});

// Sanitization functions
const sanitizeText = (text: string): string => {
  return DOMPurify.sanitize(text, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  }).trim();
};

const sanitizeTemplateContent = (content: string): string => {
  // Preserve handlebars syntax while sanitizing
  return content
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim();
};

const sanitizeVariables = (variables: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value === null || value === undefined) {
      sanitized[key] = value;
    } else {
      // Convert complex types to string and sanitize
      sanitized[key] = sanitizeText(String(value));
    }
  }
  
  return sanitized;
};

// Handlebars validation
const validateHandlebarsSyntax = (content: string): boolean => {
  try {
    // Check for balanced handlebars brackets
    const openBrackets = (content.match(/\{\{/g) || []).length;
    const closeBrackets = (content.match(/\}\}/g) || []).length;
    
    if (openBrackets !== closeBrackets) {
      return false;
    }
    
    // Check for valid variable names (no spaces, special chars except _)
    const variables = content.match(/\{\{([^}]+)\}\}/g) || [];
    for (const variable of variables) {
      const variableName = variable.replace(/\{\{|\}\}/g, '').trim();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(variableName)) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
};

const extractHandlebarsVariables = (content: string): string[] => {
  const variables = content.match(/\{\{([^}]+)\}\}/g) || [];
  return variables
    .map(v => v.replace(/\{\{|\}\}/g, '').trim())
    .filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
};

// Error handling
const handleValidationError = (error: any, res: Response) => {
  if (error instanceof z.ZodError) {
    const validationErrors: ValidationError[] = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      value: err.input
    }));

    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: validationErrors
    });
  }

  console.error('Validation middleware error:', error);
  return res.status(500).json({
    error: 'Internal validation error',
    code: 'VALIDATION_INTERNAL_ERROR'
  });
};

// File upload validation
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  if (!req.file && !req.files) {
    return next();
  }

  const files = req.files ? (Array.isArray(req.files) ? req.files : [req.files]) : [req.file];

  for (const file of files) {
    if (!file) continue;

    // Check file size
    if (file.size > maxFileSize) {
      return res.status(400).json({
        error: 'File size exceeds 10MB limit',
        code: 'FILE_TOO_LARGE',
        filename: file.originalname
      });
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'File type not allowed',
        code: 'INVALID_FILE_TYPE',
        filename: file.originalname,
        mimetype: file.mimetype
      });
    }

    // Sanitize filename
    file.originalname = sanitizeFilename(file.originalname);
  }

  next();
};

const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
};

// Request size validation
export const validateRequestSize = (maxSize: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize,
        actualSize: contentLength
      });
    }
    
    next();
  };
};

// Export validation schemas for reuse
export {
  phoneNumberSchema,
  emailSchema,
  uuidSchema,
  notificationTypeSchema,
  communicationChannelSchema,
  supportPrioritySchema,
  supportCategorySchema,
  languageSchema,
  paginationSchema,
  dateRangeSchema
};