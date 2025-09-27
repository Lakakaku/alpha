import { z } from 'zod';

// Common schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// Admin Verification Schemas

export const createCycleSchema = z.object({
  body: z.object({
    cycle_week: dateSchema,
    description: z.string().optional()
  })
});

export const getCyclesSchema = z.object({
  query: z.object({
    ...paginationSchema.shape,
    status: z.enum(['pending', 'preparing', 'ready', 'in_progress', 'completed', 'cancelled']).optional(),
    start_date: dateSchema.optional(),
    end_date: dateSchema.optional()
  })
});

export const prepareCycleSchema = z.object({
  params: z.object({
    cycleId: uuidSchema
  }),
  body: z.object({
    force: z.boolean().default(false)
  })
});

export const getDatabasesSchema = z.object({
  params: z.object({
    cycleId: uuidSchema
  }),
  query: z.object({
    ...paginationSchema.shape,
    business_id: uuidSchema.optional(),
    status: z.enum(['pending', 'downloaded', 'submitted', 'verified']).optional()
  })
});

export const downloadDatabaseSchema = z.object({
  params: z.object({
    databaseId: uuidSchema,
    format: z.enum(['csv', 'excel', 'json'])
  })
});

export const generateInvoicesSchema = z.object({
  params: z.object({
    cycleId: uuidSchema
  }),
  body: z.object({
    include_zero_rewards: z.boolean().default(false),
    admin_fee_percentage: z.number().min(0).max(100).default(10)
  })
});

export const updatePaymentSchema = z.object({
  params: z.object({
    invoiceId: uuidSchema
  }),
  body: z.object({
    payment_status: z.enum(['paid', 'disputed', 'cancelled']),
    payment_date: z.string().datetime().optional(),
    payment_reference: z.string().optional(),
    notes: z.string().optional()
  })
});

// Business Verification Schemas

export const getBusinessDatabasesSchema = z.object({
  query: z.object({
    ...paginationSchema.shape,
    cycle_id: uuidSchema.optional(),
    status: z.enum(['pending', 'downloaded', 'submitted', 'verified']).optional(),
    start_date: dateSchema.optional(),
    end_date: dateSchema.optional()
  })
});

export const getDatabaseDetailsSchema = z.object({
  params: z.object({
    databaseId: uuidSchema
  })
});

export const downloadBusinessDatabaseSchema = z.object({
  params: z.object({
    databaseId: uuidSchema,
    format: z.enum(['csv', 'excel', 'json'])
  })
});

export const submitDatabaseSchema = z.object({
  params: z.object({
    databaseId: uuidSchema
  }),
  body: z.object({
    submission_notes: z.string().optional()
  })
});

export const updateRecordsSchema = z.object({
  params: z.object({
    databaseId: uuidSchema
  }),
  body: z.object({
    records: z.array(z.object({
      id: uuidSchema,
      verification_status: z.enum(['verified', 'fake', 'pending']),
      reward_percentage: z.number().min(0).max(100)
    })).min(1).max(1000),
    operation: z.enum(['update', 'reset']).default('update')
  })
});

// Webhook Schemas

export const swishWebhookSchema = z.object({
  body: z.object({
    id: z.string(),
    status: z.enum(['CREATED', 'PAID', 'DECLINED', 'ERROR']),
    amount: z.number(),
    currency: z.string(),
    message: z.string().optional(),
    payeePaymentReference: z.string(),
    paymentReference: z.string(),
    dateCreated: z.string().datetime(),
    datePaid: z.string().datetime().optional(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional()
  }),
  headers: z.object({
    'x-swish-signature': z.string()
  })
});

// Common validation middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse({
        params: req.params,
        query: req.query,
        body: req.body,
        headers: req.headers
      });

      // Merge validated data back to request
      req.params = validated.params || req.params;
      req.query = validated.query || req.query;
      req.body = validated.body || req.body;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received
          }))
        });
        return;
      }

      next(error);
    }
  };
};

// Specialized validation for query parameters only
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid query parameters',
          code: 'QUERY_VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received
          }))
        });
        return;
      }

      next(error);
    }
  };
};

// Specialized validation for request body only
export const validateBody = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request body',
          code: 'BODY_VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received
          }))
        });
        return;
      }

      next(error);
    }
  };
};

// Specialized validation for URL parameters only
export const validateParams = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid URL parameters',
          code: 'PARAMS_VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            received: err.received
          }))
        });
        return;
      }

      next(error);
    }
  };
};

// Rate limiting schemas
export const rateLimitConfig = {
  verification: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      error: 'Too many verification requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    }
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: {
      error: 'Too many file uploads',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: '1 hour'
    }
  },
  download: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 downloads per hour
    message: {
      error: 'Too many downloads',
      code: 'DOWNLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: '1 hour'
    }
  }
};