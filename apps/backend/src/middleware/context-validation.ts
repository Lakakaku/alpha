import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import ContextPermissions, { ContextPermissionContext, BusinessUserMetadata } from '@vocilia/auth/src/context/permissions';
import { ContextValidationService } from '../services/context/validation';

// Extended Request interface to include validated data and user context
export interface ContextValidatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    metadata: BusinessUserMetadata;
  };
  store?: {
    id: string;
    permissions: string[];
  };
  validatedData?: unknown;
  contextPermissions?: ReturnType<typeof ContextPermissions.createPermissionChecker>;
}

export interface ValidationMiddlewareOptions {
  schema?: z.ZodSchema;
  validatePermissions?: boolean;
  requiredPermission?: string;
  section?: 'profile' | 'personnel' | 'layout' | 'inventory';
  action?: 'read' | 'write' | 'delete' | 'admin';
  allowEmpty?: boolean;
  skipValidationOnMethods?: string[];
}

/**
 * Middleware to validate request data against Zod schemas
 */
export function validateRequestData(schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: ContextValidatedRequest, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[source];
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
      }

      req.validatedData = result.data;
      next();

    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
      });
    }
  };
}

/**
 * Middleware to validate context-specific data using business logic
 */
export function validateContextData(section: 'profile' | 'personnel' | 'layout' | 'inventory') {
  return (req: ContextValidatedRequest, res: Response, next: NextFunction) => {
    try {
      let validationResult;

      switch (section) {
        case 'profile':
          validationResult = ContextValidationService.validateStoreProfile(req.body);
          break;
        case 'personnel':
          validationResult = ContextValidationService.validatePersonnel(req.body);
          break;
        case 'layout':
          validationResult = ContextValidationService.validateLayout(req.body);
          break;
        case 'inventory':
          validationResult = ContextValidationService.validateInventory(req.body);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: `Unknown context section: ${section}`,
          });
      }

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Context validation failed',
          details: validationResult.errors,
        });
      }

      req.validatedData = validationResult.data;
      next();

    } catch (error) {
      console.error('Context validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal context validation error',
      });
    }
  };
}

/**
 * Middleware to validate user permissions for context operations
 */
export function validateContextPermissions(options: ValidationMiddlewareOptions = {}) {
  return (req: ContextValidatedRequest, res: Response, next: NextFunction) => {
    try {
      // Skip validation for certain methods if specified
      if (options.skipValidationOnMethods?.includes(req.method)) {
        return next();
      }

      // Check if user authentication is available
      if (!req.user || !req.user.metadata) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      // Extract store ID from route parameters
      const storeId = req.params.storeId || req.params.id;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: 'Store ID is required',
        });
      }

      // Create permission checker
      const permissionChecker = ContextPermissions.createPermissionChecker({
        id: req.user.id,
        email: req.user.email,
        user_metadata: req.user.metadata,
        app_metadata: req.user.metadata,
      } as any);

      req.contextPermissions = permissionChecker;

      // Check if user has access to the store
      const accessibleStores = permissionChecker.getStoreAccess();
      if (!accessibleStores.includes(storeId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this store',
        });
      }

      // Validate specific permissions if required
      if (options.requiredPermission) {
        const hasPermission = permissionChecker.hasAccess(storeId, options.requiredPermission as any);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: `Missing required permission: ${options.requiredPermission}`,
          });
        }
      }

      // Validate section-specific permissions
      if (options.section && options.action) {
        const canAccess = permissionChecker.canAccessSection(storeId, options.section, options.action);
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: `Access denied to ${options.section} section for ${options.action} operation`,
          });
        }
      }

      // Validate permission context if provided
      if (options.section || options.action) {
        const context: ContextPermissionContext = {
          storeId,
          section: options.section,
          action: options.action || 'read',
        };

        const validation = permissionChecker.canAccess(context);
        if (!validation.allowed) {
          return res.status(403).json({
            success: false,
            error: validation.reason || 'Access denied',
            requiredPermission: validation.requiredPermission,
          });
        }
      }

      // Store validated store information
      req.store = {
        id: storeId,
        permissions: permissionChecker.getStoreAccess(),
      };

      next();

    } catch (error) {
      console.error('Permission validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal permission validation error',
      });
    }
  };
}

/**
 * Combined middleware for comprehensive context validation
 */
export function validateContext(options: ValidationMiddlewareOptions = {}) {
  return [
    // Validate permissions first
    validateContextPermissions(options),
    
    // Then validate data if schema is provided
    ...(options.schema ? [validateRequestData(options.schema)] : []),
    
    // Finally validate context-specific business logic
    ...(options.section ? [validateContextData(options.section)] : []),
  ];
}

/**
 * Middleware to validate store ownership/access
 */
export function validateStoreAccess(req: ContextValidatedRequest, res: Response, next: NextFunction) {
  try {
    const storeId = req.params.storeId || req.params.id;
    
    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required',
      });
    }

    if (!req.user || !req.user.metadata) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Check if user has access to the store
    const userStores = req.user.metadata.stores || [];
    const hasAccess = userStores.some(store => store.storeId === storeId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this store',
      });
    }

    next();

  } catch (error) {
    console.error('Store access validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal store validation error',
    });
  }
}

/**
 * Middleware to validate file upload permissions and constraints
 */
export function validateFileUpload(options: {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  requiresPermission?: string;
} = {}) {
  return (req: ContextValidatedRequest, res: Response, next: NextFunction) => {
    try {
      // Check upload permission
      if (options.requiresPermission && req.contextPermissions) {
        const storeId = req.params.storeId || req.params.id;
        const hasPermission = req.contextPermissions.hasAccess(storeId, options.requiresPermission as any);
        
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: `Missing required permission for file upload: ${options.requiresPermission}`,
          });
        }
      }

      // Validate file if present
      if (req.file) {
        const maxSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
        const allowedTypes = options.allowedMimeTypes || [
          'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'
        ];

        if (req.file.size > maxSize) {
          return res.status(400).json({
            success: false,
            error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`,
          });
        }

        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            success: false,
            error: `File type ${req.file.mimetype} is not allowed`,
          });
        }
      }

      next();

    } catch (error) {
      console.error('File upload validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal file validation error',
      });
    }
  };
}

/**
 * Error handling middleware for validation errors
 */
export function handleValidationError(
  error: Error,
  req: ContextValidatedRequest,
  res: Response,
  next: NextFunction
) {
  console.error('Validation error:', error);

  if (error instanceof z.ZodError) {
    const errors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  if (error.name === 'PermissionError') {
    return res.status(403).json({
      success: false,
      error: error.message,
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}

/**
 * Middleware to log context operations for audit trail
 */
export function logContextOperation(action: string) {
  return (req: ContextValidatedRequest, res: Response, next: NextFunction) => {
    try {
      const storeId = req.params.storeId || req.params.id;
      const userId = req.user?.id;
      
      // Store operation metadata for audit logging
      req.auditMetadata = {
        action,
        storeId,
        userId,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
      };

      next();

    } catch (error) {
      console.error('Audit logging middleware error:', error);
      next(); // Continue even if audit logging fails
    }
  };
}

// Schemas for common context validation
export const contextSchemas = {
  storeProfile: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    category: z.string().min(1),
    tags: z.array(z.string()).optional(),
    operatingHours: z.object({
      monday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
      tuesday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
      wednesday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
      thursday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
      friday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
      saturday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
      sunday: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
    }),
    settings: z.object({
      timezone: z.string(),
      currency: z.string(),
      language: z.string(),
    }),
  }),

  personnel: z.object({
    name: z.string().min(1).max(100),
    role: z.string().min(1).max(50),
    department: z.string().min(1).max(50),
    shift: z.string().min(1),
    responsibilities: z.array(z.string()),
    isActive: z.boolean(),
    startDate: z.string(),
    endDate: z.string().optional(),
  }),

  layout: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    dimensions: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      unit: z.enum(['meters', 'feet']),
    }),
    departments: z.array(z.object({
      id: z.string(),
      name: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    })),
    isActive: z.boolean(),
  }),

  inventory: z.object({
    name: z.string().min(1).max(100),
    category: z.string().min(1).max(50),
    subcategories: z.array(z.string()),
    attributes: z.record(z.unknown()),
    isActive: z.boolean(),
  }),
};

export default {
  validateRequestData,
  validateContextData,
  validateContextPermissions,
  validateContext,
  validateStoreAccess,
  validateFileUpload,
  handleValidationError,
  logContextOperation,
  contextSchemas,
};