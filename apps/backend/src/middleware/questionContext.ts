import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { CustomQuestion, QuestionCategory, Business, Store } from '@vocilia/types';

// Extended request interface with question context
export interface QuestionContextRequest extends Request {
  questionContext?: {
    business: Business;
    store?: Store;
    question?: CustomQuestion;
    category?: QuestionCategory;
    permissions: {
      canRead: boolean;
      canWrite: boolean;
      canDelete: boolean;
      canAdmin: boolean;
      canViewAnalytics: boolean;
    };
    metadata: {
      businessId: string;
      storeId?: string;
      userId: string;
      isAdmin: boolean;
      requestId: string;
      timestamp: Date;
    };
  };
}

// Permission levels enum
export enum PermissionLevel {
  READ = 'read_feedback',
  WRITE = 'write_context',
  ADMIN = 'admin',
  ANALYTICS = 'view_analytics',
  QR_MANAGE = 'manage_qr',
}

// Context validation options
export interface ContextOptions {
  requireBusiness?: boolean;
  requireStore?: boolean;
  requireQuestion?: boolean;
  requireCategory?: boolean;
  requiredPermissions?: PermissionLevel[];
  allowAdmin?: boolean;
}

// Business context cache (simple in-memory cache with TTL)
const businessCache = new Map<string, { data: Business; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper function to get business from cache or database
async function getBusiness(businessId: string): Promise<Business | null> {
  // Check cache first
  const cached = businessCache.get(businessId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error || !data) {
      return null;
    }

    // Cache the result
    businessCache.set(businessId, {
      data: data as Business,
      expires: Date.now() + CACHE_TTL,
    });

    return data as Business;
  } catch (error) {
    console.error('Error fetching business:', error);
    return null;
  }
}

// Helper function to get user permissions for a business
async function getUserPermissions(
  userId: string, 
  businessId: string, 
  storeId?: string
): Promise<{
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canAdmin: boolean;
  canViewAnalytics: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from('business_stores')
      .select('permissions')
      .eq('business_id', businessId)
      .eq('id', storeId || '')
      .single();

    if (error || !data) {
      return {
        canRead: false,
        canWrite: false,
        canDelete: false,
        canAdmin: false,
        canViewAnalytics: false,
      };
    }

    const permissions = data.permissions || {};

    return {
      canRead: !!(permissions.read_feedback || permissions.admin),
      canWrite: !!(permissions.write_context || permissions.admin),
      canDelete: !!(permissions.admin),
      canAdmin: !!(permissions.admin),
      canViewAnalytics: !!(permissions.view_analytics || permissions.admin),
    };
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return {
      canRead: false,
      canWrite: false,
      canDelete: false,
      canAdmin: false,
      canViewAnalytics: false,
    };
  }
}

// Helper function to get question with category
async function getQuestionWithCategory(questionId: string): Promise<{
  question: CustomQuestion | null;
  category: QuestionCategory | null;
}> {
  try {
    const { data: questionData, error: questionError } = await supabase
      .from('custom_questions')
      .select(`
        *,
        question_categories (*)
      `)
      .eq('id', questionId)
      .single();

    if (questionError || !questionData) {
      return { question: null, category: null };
    }

    return {
      question: questionData as CustomQuestion,
      category: (questionData as any).question_categories as QuestionCategory,
    };
  } catch (error) {
    console.error('Error fetching question:', error);
    return { question: null, category: null };
  }
}

// Helper function to extract business ID from various sources
function extractBusinessId(req: Request): string | null {
  // Try from JWT token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload.business_id) {
        return payload.business_id;
      }
    } catch {
      // Invalid token, continue
    }
  }

  // Try from request body
  if (req.body?.businessId) {
    return req.body.businessId;
  }

  // Try from query params
  if (req.query?.businessId) {
    return req.query.businessId as string;
  }

  // Try from headers
  if (req.headers['x-business-id']) {
    return req.headers['x-business-id'] as string;
  }

  return null;
}

// Helper function to extract store ID
function extractStoreId(req: Request): string | null {
  // Try from JWT token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload.store_id || payload.active_store_id) {
        return payload.store_id || payload.active_store_id;
      }
    } catch {
      // Invalid token, continue
    }
  }

  // Try from request body
  if (req.body?.storeId) {
    return req.body.storeId;
  }

  // Try from query params
  if (req.query?.storeId) {
    return req.query.storeId as string;
  }

  // Try from headers
  if (req.headers['x-store-id']) {
    return req.headers['x-store-id'] as string;
  }

  return null;
}

// Helper function to extract user ID
function extractUserId(req: Request): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.sub || payload.user_id || null;
    } catch {
      // Invalid token
    }
  }

  return null;
}

// Helper function to check if user is admin
function isAdmin(req: Request): boolean {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.is_admin === true;
    } catch {
      // Invalid token
    }
  }

  return false;
}

// Main context middleware
export function createQuestionContext(options: ContextOptions = {}) {
  return async (req: QuestionContextRequest, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || 
                     Math.random().toString(36).substring(2, 15);
    const timestamp = new Date();

    try {
      // Extract basic information
      const userId = extractUserId(req);
      const businessId = extractBusinessId(req);
      const storeId = extractStoreId(req);
      const questionId = req.params.questionId;
      const categoryId = req.params.categoryId || req.body?.categoryId;
      const userIsAdmin = isAdmin(req);

      // Validate required authentication
      if (!userId) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'MISSING_AUTHENTICATION',
          requestId,
        });
      }

      // Validate business requirement
      if (options.requireBusiness && !businessId) {
        return res.status(400).json({
          message: 'Business context required',
          code: 'MISSING_BUSINESS_CONTEXT',
          requestId,
        });
      }

      // Initialize context
      let business: Business | null = null;
      let store: Store | null = null;
      let question: CustomQuestion | null = null;
      let category: QuestionCategory | null = null;

      // Fetch business if available
      if (businessId) {
        business = await getBusiness(businessId);
        if (options.requireBusiness && !business) {
          return res.status(404).json({
            message: 'Business not found',
            code: 'BUSINESS_NOT_FOUND',
            requestId,
          });
        }
      }

      // Fetch store if available
      if (storeId && businessId) {
        try {
          const { data: storeData, error: storeError } = await supabase
            .from('stores')
            .select('*')
            .eq('id', storeId)
            .eq('business_id', businessId)
            .single();

          if (!storeError && storeData) {
            store = storeData as Store;
          }
        } catch (error) {
          console.error('Error fetching store:', error);
        }

        if (options.requireStore && !store) {
          return res.status(404).json({
            message: 'Store not found or access denied',
            code: 'STORE_NOT_FOUND',
            requestId,
          });
        }
      }

      // Fetch question and category if needed
      if (questionId) {
        const { question: fetchedQuestion, category: fetchedCategory } = 
          await getQuestionWithCategory(questionId);
        
        question = fetchedQuestion;
        category = fetchedCategory;

        if (options.requireQuestion && !question) {
          return res.status(404).json({
            message: 'Question not found',
            code: 'QUESTION_NOT_FOUND',
            requestId,
          });
        }

        // Validate business ownership of question
        if (question && businessId && question.businessId !== businessId && !userIsAdmin) {
          return res.status(403).json({
            message: 'Access denied to question',
            code: 'QUESTION_ACCESS_DENIED',
            requestId,
          });
        }
      }

      // Fetch category separately if needed
      if (categoryId && !category) {
        try {
          const { data: categoryData, error: categoryError } = await supabase
            .from('question_categories')
            .select('*')
            .eq('id', categoryId)
            .single();

          if (!categoryError && categoryData) {
            category = categoryData as QuestionCategory;
          }
        } catch (error) {
          console.error('Error fetching category:', error);
        }

        if (options.requireCategory && !category) {
          return res.status(404).json({
            message: 'Category not found',
            code: 'CATEGORY_NOT_FOUND',
            requestId,
          });
        }
      }

      // Get user permissions
      const permissions = businessId ? 
        await getUserPermissions(userId, businessId, storeId) :
        {
          canRead: false,
          canWrite: false,
          canDelete: false,
          canAdmin: false,
          canViewAnalytics: false,
        };

      // Override permissions for admin users
      if (userIsAdmin) {
        permissions.canRead = true;
        permissions.canWrite = true;
        permissions.canDelete = true;
        permissions.canAdmin = true;
        permissions.canViewAnalytics = true;
      }

      // Validate required permissions
      if (options.requiredPermissions) {
        const hasRequiredPermissions = options.requiredPermissions.every(perm => {
          switch (perm) {
            case PermissionLevel.READ:
              return permissions.canRead;
            case PermissionLevel.WRITE:
              return permissions.canWrite;
            case PermissionLevel.ADMIN:
              return permissions.canAdmin;
            case PermissionLevel.ANALYTICS:
              return permissions.canViewAnalytics;
            default:
              return false;
          }
        });

        if (!hasRequiredPermissions && !(options.allowAdmin && userIsAdmin)) {
          return res.status(403).json({
            message: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            requestId,
            required: options.requiredPermissions,
            current: permissions,
          });
        }
      }

      // Attach context to request
      req.questionContext = {
        business: business!,
        store,
        question,
        category,
        permissions,
        metadata: {
          businessId: businessId!,
          storeId,
          userId,
          isAdmin: userIsAdmin,
          requestId,
          timestamp,
        },
      };

      // Add request ID to response headers
      res.setHeader('X-Request-ID', requestId);

      next();
    } catch (error) {
      console.error('Question context middleware error:', error);
      res.status(500).json({
        message: 'Internal server error',
        code: 'CONTEXT_ERROR',
        requestId,
      });
    }
  };
}

// Convenience middleware functions
export const requireBusinessContext = createQuestionContext({
  requireBusiness: true,
  requiredPermissions: [PermissionLevel.READ],
  allowAdmin: true,
});

export const requireWritePermission = createQuestionContext({
  requireBusiness: true,
  requiredPermissions: [PermissionLevel.WRITE],
  allowAdmin: true,
});

export const requireAdminPermission = createQuestionContext({
  requireBusiness: true,
  requiredPermissions: [PermissionLevel.ADMIN],
  allowAdmin: true,
});

export const requireAnalyticsPermission = createQuestionContext({
  requireBusiness: true,
  requiredPermissions: [PermissionLevel.ANALYTICS],
  allowAdmin: true,
});

export const requireQuestionAccess = createQuestionContext({
  requireBusiness: true,
  requireQuestion: true,
  requiredPermissions: [PermissionLevel.READ],
  allowAdmin: true,
});

export const requireQuestionWrite = createQuestionContext({
  requireBusiness: true,
  requireQuestion: true,
  requiredPermissions: [PermissionLevel.WRITE],
  allowAdmin: true,
});

export const requireCategoryAccess = createQuestionContext({
  requireBusiness: true,
  requireCategory: true,
  requiredPermissions: [PermissionLevel.READ],
  allowAdmin: true,
});

// Utility function to clear business cache
export function clearBusinessCache(businessId?: string) {
  if (businessId) {
    businessCache.delete(businessId);
  } else {
    businessCache.clear();
  }
}

// Utility function to get cache stats
export function getCacheStats() {
  return {
    size: businessCache.size,
    entries: Array.from(businessCache.keys()),
    memoryUsage: process.memoryUsage(),
  };
}

// Error handler for context-related errors
export function handleContextError(error: any, req: Request, res: Response, next: NextFunction) {
  if (error.code?.startsWith('CONTEXT_') || error.code?.startsWith('QUESTION_')) {
    return res.status(error.status || 500).json({
      message: error.message || 'Context error',
      code: error.code,
      requestId: req.headers['x-request-id'],
    });
  }

  next(error);
}

// Middleware to log context usage for monitoring
export function logContextUsage(req: QuestionContextRequest, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const context = req.questionContext;

    if (context) {
      console.log(`[Question Context] ${req.method} ${req.path}`, {
        requestId: context.metadata.requestId,
        businessId: context.metadata.businessId,
        storeId: context.metadata.storeId,
        userId: context.metadata.userId,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        permissions: context.permissions,
      });
    }
  });

  next();
}

export default {
  createQuestionContext,
  requireBusinessContext,
  requireWritePermission,
  requireAdminPermission,
  requireAnalyticsPermission,
  requireQuestionAccess,
  requireQuestionWrite,
  requireCategoryAccess,
  clearBusinessCache,
  getCacheStats,
  handleContextError,
  logContextUsage,
  PermissionLevel,
};