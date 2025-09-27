import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Base validation schemas for question logic
export const UUIDSchema = z.string().uuid({ message: 'Invalid UUID format' });

export const BusinessContextIdSchema = z.object({
  business_context_id: UUIDSchema
});

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(50),
  offset: z.number().int().min(0).default(0)
});

export const DateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional()
});

// Question Combination Rule validation schemas
export const CreateQuestionCombinationRuleSchema = z.object({
  business_context_id: UUIDSchema,
  rule_name: z.string().min(1).max(100).trim(),
  max_call_duration_seconds: z.number().int().min(60).max(180).default(120),
  priority_threshold_critical: z.number().int().min(0).default(0),
  priority_threshold_high: z.number().int().min(0).default(60),
  priority_threshold_medium: z.number().int().min(0).default(90),
  priority_threshold_low: z.number().int().min(0).default(120),
  is_active: z.boolean().default(true)
}).refine(data => {
  // Validate priority thresholds are in ascending order
  return data.priority_threshold_critical <= data.priority_threshold_high &&
         data.priority_threshold_high <= data.priority_threshold_medium &&
         data.priority_threshold_medium <= data.priority_threshold_low;
}, {
  message: 'Priority thresholds must be in ascending order: critical ≤ high ≤ medium ≤ low'
});

export const UpdateQuestionCombinationRuleSchema = CreateQuestionCombinationRuleSchema
  .omit({ business_context_id: true })
  .partial();

// Dynamic Trigger validation schemas
export const TriggerConfigSchema = z.union([
  // purchase_based config
  z.object({
    categories: z.array(z.string()).min(1),
    required_items: z.array(z.string()).optional(),
    minimum_items: z.number().int().min(1).optional()
  }),
  // time_based config
  z.object({
    time_windows: z.array(z.object({
      start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7)
    })).min(1)
  }),
  // amount_based config
  z.object({
    currency: z.string().length(3),
    minimum_amount: z.number().positive(),
    maximum_amount: z.number().positive().optional(),
    comparison_operator: z.enum(['>=', '<=', '==', 'between'])
  })
]);

export const CreateDynamicTriggerSchema = z.object({
  business_context_id: UUIDSchema,
  trigger_name: z.string().min(1).max(100).trim(),
  trigger_type: z.enum(['purchase_based', 'time_based', 'amount_based']),
  priority_level: z.number().int().min(1).max(5).default(3),
  sensitivity_threshold: z.number().int().min(1).max(100).default(10),
  is_active: z.boolean().default(true),
  trigger_config: TriggerConfigSchema
}).refine(data => {
  // Validate trigger_config matches trigger_type
  if (data.trigger_type === 'purchase_based') {
    return 'categories' in data.trigger_config;
  } else if (data.trigger_type === 'time_based') {
    return 'time_windows' in data.trigger_config;
  } else if (data.trigger_type === 'amount_based') {
    return 'currency' in data.trigger_config && 'minimum_amount' in data.trigger_config;
  }
  return false;
}, {
  message: 'trigger_config must match the specified trigger_type'
});

export const UpdateDynamicTriggerSchema = CreateDynamicTriggerSchema
  .omit({ business_context_id: true })
  .partial();

// Frequency Harmonizer validation schemas
export const CreateFrequencyHarmonizerSchema = z.object({
  question_id_1: UUIDSchema,
  question_id_2: UUIDSchema,
  resolution_strategy: z.enum(['combine', 'priority', 'alternate', 'custom']),
  custom_frequency: z.number().int().positive().optional(),
  priority_question_id: UUIDSchema.optional()
}).refine(data => {
  // Ensure question IDs are different
  return data.question_id_1 !== data.question_id_2;
}, {
  message: 'Question IDs must be different'
}).refine(data => {
  // Validate priority_question_id when strategy is 'priority'
  if (data.resolution_strategy === 'priority') {
    return data.priority_question_id === data.question_id_1 || 
           data.priority_question_id === data.question_id_2;
  }
  return true;
}, {
  message: 'priority_question_id must be one of the two questions when resolution_strategy is priority'
}).refine(data => {
  // Validate custom_frequency when strategy is 'custom'
  if (data.resolution_strategy === 'custom') {
    return data.custom_frequency && data.custom_frequency > 0;
  }
  return true;
}, {
  message: 'custom_frequency is required and must be positive when resolution_strategy is custom'
});

// Question Evaluation validation schema
export const QuestionEvaluationSchema = z.object({
  business_context_id: UUIDSchema,
  customer_data: z.object({
    verification_id: UUIDSchema,
    transaction_time: z.string().datetime().optional(),
    transaction_amount: z.number().positive().optional(),
    transaction_currency: z.string().length(3).default('SEK'),
    purchase_categories: z.array(z.string()).optional(),
    purchase_items: z.array(z.string()).optional(),
    customer_sequence: z.number().int().positive().optional()
  }),
  time_constraints: z.object({
    max_call_duration_seconds: z.number().int().min(60).max(180).default(120),
    target_question_count: z.number().int().min(1).max(20).optional()
  }).optional(),
  options: z.object({
    force_triggers: z.array(UUIDSchema).optional(),
    exclude_triggers: z.array(UUIDSchema).optional(),
    include_debug_info: z.boolean().default(false)
  }).optional()
});

// Generic validation middleware factory
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Request body contains invalid data',
          details: result.error.errors.map(error => ({
            field: error.path.join('.'),
            message: error.message,
            received: error.received
          }))
        });
      }
      
      // Replace request body with validated and transformed data
      req.body = result.data;
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({
        error: 'Validation error',
        message: 'Failed to validate request data'
      });
    }
  };
}

// Query parameter validation middleware
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          message: 'Query parameters contain invalid data',
          details: result.error.errors.map(error => ({
            field: error.path.join('.'),
            message: error.message,
            received: error.received
          }))
        });
      }
      
      // Replace query with validated and transformed data
      req.query = result.data as any;
      next();
    } catch (error) {
      console.error('Query validation middleware error:', error);
      res.status(500).json({
        error: 'Validation error',
        message: 'Failed to validate query parameters'
      });
    }
  };
}

// Path parameter validation middleware
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);
      
      if (!result.success) {
        return res.status(400).json({
          error: 'Invalid path parameters',
          message: 'Path parameters contain invalid data',
          details: result.error.errors.map(error => ({
            field: error.path.join('.'),
            message: error.message,
            received: error.received
          }))
        });
      }
      
      req.params = result.data as any;
      next();
    } catch (error) {
      console.error('Path validation middleware error:', error);
      res.status(500).json({
        error: 'Validation error',
        message: 'Failed to validate path parameters'
      });
    }
  };
}

// Business rule validation middleware
export const validateBusinessRules = (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    
    // Additional business rule validations that go beyond schema validation
    
    // Rule 1: Validate time windows don't overlap
    if (body.trigger_type === 'time_based' && body.trigger_config?.time_windows) {
      const timeWindows = body.trigger_config.time_windows;
      
      for (let i = 0; i < timeWindows.length; i++) {
        for (let j = i + 1; j < timeWindows.length; j++) {
          const window1 = timeWindows[i];
          const window2 = timeWindows[j];
          
          // Check for day overlap
          const daysOverlap = window1.days_of_week.some(day => 
            window2.days_of_week.includes(day)
          );
          
          if (daysOverlap) {
            // Check for time overlap
            const start1 = timeToMinutes(window1.start_time);
            const end1 = timeToMinutes(window1.end_time);
            const start2 = timeToMinutes(window2.start_time);
            const end2 = timeToMinutes(window2.end_time);
            
            if ((start1 < end2 && end1 > start2)) {
              return res.status(400).json({
                error: 'Business rule violation',
                message: 'Time windows cannot overlap on the same days'
              });
            }
          }
        }
      }
    }
    
    // Rule 2: Validate amount-based trigger ranges
    if (body.trigger_type === 'amount_based' && body.trigger_config) {
      const config = body.trigger_config;
      
      if (config.comparison_operator === 'between') {
        if (!config.maximum_amount) {
          return res.status(400).json({
            error: 'Business rule violation',
            message: 'maximum_amount is required when comparison_operator is "between"'
          });
        }
        
        if (config.minimum_amount >= config.maximum_amount) {
          return res.status(400).json({
            error: 'Business rule violation',
            message: 'minimum_amount must be less than maximum_amount'
          });
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Business rules validation error:', error);
    res.status(500).json({
      error: 'Validation error',
      message: 'Failed to validate business rules'
    });
  }
};

// Helper function to convert time string to minutes
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}