import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CustomQuestion, QuestionCategory, QuestionTrigger } from '@vocilia/types';

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// Zod schemas for validation
const QuestionTypeSchema = z.enum(['text', 'rating', 'multiple_choice', 'yes_no']);

const FrequencySchema = z.object({
  window: z.enum(['hourly', 'daily', 'weekly']),
  maxPresentations: z.number().int().min(1).max(100),
  cooldownMinutes: z.number().int().min(0).max(10080), // Max 1 week
});

const TriggerConditionSchema = z.record(z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  valueType: z.enum(['string', 'number', 'boolean', 'datetime', 'select']),
}));

const TriggerSchema = z.object({
  id: z.string().uuid().optional(),
  questionId: z.string().uuid().optional(),
  type: z.enum(['time_based', 'frequency_based', 'customer_behavior', 'store_context']),
  conditions: TriggerConditionSchema,
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

const CreateQuestionSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(1000),
  type: QuestionTypeSchema,
  categoryId: z.string().uuid(),
  priority: z.number().int().min(1).max(10).default(5),
  isRequired: z.boolean().default(false),
  maxLength: z.number().int().min(1).max(10000).optional(),
  options: z.array(z.string().min(1).max(200)).min(2).max(10).optional(),
  ratingScale: z.number().int().min(2).max(10).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  frequency: FrequencySchema,
  triggers: z.array(TriggerSchema).default([]),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  isActive: z.boolean().default(true),
});

const UpdateQuestionSchema = CreateQuestionSchema.partial();

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  isDefault: z.boolean().default(false),
});

const UpdateCategorySchema = CreateCategorySchema.partial();

const QuestionPreviewSchema = z.object({
  format: z.enum(['html', 'json', 'text']).default('json'),
  personalization: z.object({
    customerName: z.string().optional(),
    visitCount: z.number().int().min(0).optional(),
    lastVisit: z.string().datetime().optional(),
    preferences: z.record(z.any()).optional(),
  }).optional(),
});

const BulkOperationSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1).max(100),
  force: z.boolean().default(false),
});

const PaginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 100).default('20'),
});

const QuestionsListSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 100).optional(),
  category: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  priority: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 10).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['title', 'createdAt', 'priority', 'category']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
});

// Custom validation functions
const customValidators = {
  validateQuestionTypeFields: (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    switch (data.type) {
      case 'multiple_choice':
        if (!data.options || !Array.isArray(data.options) || data.options.length < 2) {
          errors.push({
            field: 'options',
            message: 'Multiple choice questions require at least 2 options',
            code: 'INSUFFICIENT_OPTIONS',
            value: data.options,
          });
        }
        break;

      case 'rating':
        if (!data.ratingScale || data.ratingScale < 2 || data.ratingScale > 10) {
          errors.push({
            field: 'ratingScale',
            message: 'Rating scale must be between 2 and 10',
            code: 'INVALID_RATING_SCALE',
            value: data.ratingScale,
          });
        }
        break;

      case 'text':
        if (data.maxLength && (data.maxLength < 1 || data.maxLength > 10000)) {
          errors.push({
            field: 'maxLength',
            message: 'Max length must be between 1 and 10,000 characters',
            code: 'INVALID_MAX_LENGTH',
            value: data.maxLength,
          });
        }
        break;
    }

    return errors;
  },

  validateDateRange: (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (data.validFrom && data.validUntil) {
      const startDate = new Date(data.validFrom);
      const endDate = new Date(data.validUntil);

      if (startDate >= endDate) {
        errors.push({
          field: 'validUntil',
          message: 'End date must be after start date',
          code: 'INVALID_DATE_RANGE',
          value: { validFrom: data.validFrom, validUntil: data.validUntil },
        });
      }
    }

    if (data.validUntil) {
      const endDate = new Date(data.validUntil);
      const now = new Date();

      if (endDate < now) {
        errors.push({
          field: 'validUntil',
          message: 'End date cannot be in the past',
          code: 'PAST_END_DATE',
          value: data.validUntil,
        });
      }
    }

    return errors;
  },

  validateTriggers: (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!data.triggers || !Array.isArray(data.triggers)) {
      return errors;
    }

    data.triggers.forEach((trigger: any, index: number) => {
      const triggerPrefix = `triggers[${index}]`;

      // Validate trigger has conditions if active
      if (trigger.isActive && (!trigger.conditions || Object.keys(trigger.conditions).length === 0)) {
        errors.push({
          field: `${triggerPrefix}.conditions`,
          message: `Active trigger ${index + 1} must have at least one condition`,
          code: 'MISSING_TRIGGER_CONDITIONS',
          value: trigger.conditions,
        });
      }

      // Validate individual conditions
      if (trigger.conditions && typeof trigger.conditions === 'object') {
        Object.entries(trigger.conditions).forEach(([conditionId, condition]: [string, any], conditionIndex: number) => {
          const conditionPrefix = `${triggerPrefix}.conditions[${conditionIndex}]`;

          if (!condition.field) {
            errors.push({
              field: `${conditionPrefix}.field`,
              message: `Condition ${conditionIndex + 1} must have a field`,
              code: 'MISSING_CONDITION_FIELD',
              value: condition.field,
            });
          }

          if (!condition.operator) {
            errors.push({
              field: `${conditionPrefix}.operator`,
              message: `Condition ${conditionIndex + 1} must have an operator`,
              code: 'MISSING_CONDITION_OPERATOR',
              value: condition.operator,
            });
          }

          // Type-specific validation
          if (condition.valueType === 'number' && typeof condition.value !== 'number') {
            errors.push({
              field: `${conditionPrefix}.value`,
              message: `Condition ${conditionIndex + 1} must have a valid number`,
              code: 'INVALID_NUMBER_VALUE',
              value: condition.value,
            });
          }

          if (condition.valueType === 'datetime' && condition.value && isNaN(Date.parse(condition.value))) {
            errors.push({
              field: `${conditionPrefix}.value`,
              message: `Condition ${conditionIndex + 1} must have a valid date`,
              code: 'INVALID_DATE_VALUE',
              value: condition.value,
            });
          }
        });
      }
    });

    return errors;
  },

  validateTags: (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!data.tags || !Array.isArray(data.tags)) {
      return errors;
    }

    // Check for duplicates
    const uniqueTags = new Set(data.tags);
    if (uniqueTags.size !== data.tags.length) {
      errors.push({
        field: 'tags',
        message: 'Tags must be unique',
        code: 'DUPLICATE_TAGS',
        value: data.tags,
      });
    }

    // Check individual tag format
    data.tags.forEach((tag: any, index: number) => {
      if (typeof tag !== 'string') {
        errors.push({
          field: 'tags',
          message: `Tag ${index + 1} must be a string`,
          code: 'INVALID_TAG_TYPE',
          value: tag,
        });
        return;
      }

      if (!tag.trim()) {
        errors.push({
          field: 'tags',
          message: `Tag ${index + 1} cannot be empty`,
          code: 'EMPTY_TAG',
          value: tag,
        });
        return;
      }

      if (tag.length > 50) {
        errors.push({
          field: 'tags',
          message: `Tag "${tag}" is too long (max 50 characters)`,
          code: 'TAG_TOO_LONG',
          value: tag,
        });
        return;
      }

      if (!/^[a-zA-Z0-9\s\-_]+$/.test(tag)) {
        errors.push({
          field: 'tags',
          message: `Tag "${tag}" contains invalid characters`,
          code: 'INVALID_TAG_CHARACTERS',
          value: tag,
        });
      }
    });

    return errors;
  },
};

// Main validation function
function validateQuestion(data: any, isUpdate: boolean = false): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  try {
    // Basic schema validation
    const schema = isUpdate ? UpdateQuestionSchema : CreateQuestionSchema;
    const result = schema.safeParse(data);

    if (!result.success) {
      result.error.issues.forEach(issue => {
        errors.push({
          field: issue.path.join('.'),
          message: issue.message,
          code: 'SCHEMA_VALIDATION_ERROR',
          value: issue.code,
        });
      });
    } else {
      // Custom validations
      errors.push(...customValidators.validateQuestionTypeFields(result.data));
      errors.push(...customValidators.validateDateRange(result.data));
      errors.push(...customValidators.validateTriggers(result.data));
      errors.push(...customValidators.validateTags(result.data));

      // Generate warnings
      if (result.data.triggers && result.data.triggers.length === 0) {
        warnings.push({
          field: 'triggers',
          message: 'Question has no triggers. It will be available based on frequency settings only.',
          code: 'NO_TRIGGERS',
        });
      }

      if (result.data.priority && result.data.priority < 3) {
        warnings.push({
          field: 'priority',
          message: 'Low priority questions may be presented less frequently.',
          code: 'LOW_PRIORITY',
        });
      }

      if (result.data.frequency?.maxPresentations > 5 && result.data.frequency?.window === 'hourly') {
        warnings.push({
          field: 'frequency',
          message: 'High frequency hourly presentations may overwhelm customers.',
          code: 'HIGH_FREQUENCY',
        });
      }

      if (result.data.content && result.data.content.length > 500) {
        warnings.push({
          field: 'content',
          message: 'Long questions may reduce completion rates.',
          code: 'LONG_CONTENT',
        });
      }
    }
  } catch (error) {
    errors.push({
      field: 'validation',
      message: 'Unexpected validation error',
      code: 'VALIDATION_EXCEPTION',
      value: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Middleware functions
export const validateCreateQuestion = (req: Request, res: Response, next: NextFunction) => {
  const result = validateQuestion(req.body, false);

  if (!result.isValid) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.errors,
      warnings: result.warnings,
    });
  }

  // Attach validation result to request for use in controllers
  (req as any).validationResult = result;
  next();
};

export const validateUpdateQuestion = (req: Request, res: Response, next: NextFunction) => {
  const result = validateQuestion(req.body, true);

  if (!result.isValid) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.errors,
      warnings: result.warnings,
    });
  }

  (req as any).validationResult = result;
  next();
};

export const validateCreateCategory = (req: Request, res: Response, next: NextFunction) => {
  const result = CreateCategorySchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: 'SCHEMA_VALIDATION_ERROR',
      value: issue.code,
    }));

    return res.status(400).json({
      message: 'Validation failed',
      errors,
      warnings: [],
    });
  }

  next();
};

export const validateUpdateCategory = (req: Request, res: Response, next: NextFunction) => {
  const result = UpdateCategorySchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: 'SCHEMA_VALIDATION_ERROR',
      value: issue.code,
    }));

    return res.status(400).json({
      message: 'Validation failed',
      errors,
      warnings: [],
    });
  }

  next();
};

export const validateQuestionPreview = (req: Request, res: Response, next: NextFunction) => {
  const result = QuestionPreviewSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: 'SCHEMA_VALIDATION_ERROR',
      value: issue.code,
    }));

    return res.status(400).json({
      message: 'Validation failed',
      errors,
      warnings: [],
    });
  }

  next();
};

export const validateBulkOperation = (req: Request, res: Response, next: NextFunction) => {
  const result = BulkOperationSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: 'SCHEMA_VALIDATION_ERROR',
      value: issue.code,
    }));

    return res.status(400).json({
      message: 'Validation failed',
      errors,
      warnings: [],
    });
  }

  next();
};

export const validateQuestionsListQuery = (req: Request, res: Response, next: NextFunction) => {
  const result = QuestionsListSchema.safeParse(req.query);

  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: 'SCHEMA_VALIDATION_ERROR',
      value: issue.code,
    }));

    return res.status(400).json({
      message: 'Query validation failed',
      errors,
      warnings: [],
    });
  }

  // Attach validated query to request
  (req as any).validatedQuery = result.data;
  next();
};

export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const result = PaginationSchema.safeParse(req.query);

  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: 'SCHEMA_VALIDATION_ERROR',
      value: issue.code,
    }));

    return res.status(400).json({
      message: 'Pagination validation failed',
      errors,
      warnings: [],
    });
  }

  (req as any).pagination = result.data;
  next();
};

// Parameter validation middleware
export const validateUUID = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!value || !uuidRegex.test(value)) {
      return res.status(400).json({
        message: `Invalid ${paramName} format`,
        errors: [{
          field: paramName,
          message: `${paramName} must be a valid UUID`,
          code: 'INVALID_UUID',
          value,
        }],
        warnings: [],
      });
    }

    next();
  };
};

// Error handling utility
export const handleValidationError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: [{
        field: 'validation',
        message: error.message,
        code: 'VALIDATION_ERROR',
      }],
      warnings: [],
    });
  }

  next(error);
};

// Export schemas for use in other modules
export {
  CreateQuestionSchema,
  UpdateQuestionSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  QuestionPreviewSchema,
  BulkOperationSchema,
  QuestionsListSchema,
  TriggerSchema,
  customValidators,
};