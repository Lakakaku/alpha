/**
 * Authentication middleware for feedback analysis routes
 * Feature: 008-step-2-6 (T036)
 * Created: 2025-09-22
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';

// Extended request interface
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    business_id: string;
    role: string;
    permissions: string[];
  };
  store?: {
    id: string;
    business_id: string;
    name: string;
    permissions: string[];
  };
}

// Permission definitions for feedback analysis
export const FEEDBACK_ANALYSIS_PERMISSIONS = {
  READ_FEEDBACK: 'read_feedback',
  VIEW_ANALYTICS: 'view_analytics',
  GENERATE_REPORTS: 'generate_reports',
  MANAGE_INSIGHTS: 'manage_insights',
  SEARCH_FEEDBACK: 'search_feedback',
  EXPORT_DATA: 'export_data',
  ADMIN_ACCESS: 'admin_access',
} as const;

type PermissionType = typeof FEEDBACK_ANALYSIS_PERMISSIONS[keyof typeof FEEDBACK_ANALYSIS_PERMISSIONS];

// Role-based permission mappings
const ROLE_PERMISSIONS: Record<string, PermissionType[]> = {
  owner: [
    FEEDBACK_ANALYSIS_PERMISSIONS.READ_FEEDBACK,
    FEEDBACK_ANALYSIS_PERMISSIONS.VIEW_ANALYTICS,
    FEEDBACK_ANALYSIS_PERMISSIONS.GENERATE_REPORTS,
    FEEDBACK_ANALYSIS_PERMISSIONS.MANAGE_INSIGHTS,
    FEEDBACK_ANALYSIS_PERMISSIONS.SEARCH_FEEDBACK,
    FEEDBACK_ANALYSIS_PERMISSIONS.EXPORT_DATA,
    FEEDBACK_ANALYSIS_PERMISSIONS.ADMIN_ACCESS,
  ],
  manager: [
    FEEDBACK_ANALYSIS_PERMISSIONS.READ_FEEDBACK,
    FEEDBACK_ANALYSIS_PERMISSIONS.VIEW_ANALYTICS,
    FEEDBACK_ANALYSIS_PERMISSIONS.GENERATE_REPORTS,
    FEEDBACK_ANALYSIS_PERMISSIONS.MANAGE_INSIGHTS,
    FEEDBACK_ANALYSIS_PERMISSIONS.SEARCH_FEEDBACK,
    FEEDBACK_ANALYSIS_PERMISSIONS.EXPORT_DATA,
  ],
  analyst: [
    FEEDBACK_ANALYSIS_PERMISSIONS.READ_FEEDBACK,
    FEEDBACK_ANALYSIS_PERMISSIONS.VIEW_ANALYTICS,
    FEEDBACK_ANALYSIS_PERMISSIONS.SEARCH_FEEDBACK,
  ],
  viewer: [
    FEEDBACK_ANALYSIS_PERMISSIONS.READ_FEEDBACK,
    FEEDBACK_ANALYSIS_PERMISSIONS.VIEW_ANALYTICS,
  ],
};

// Validation schemas
const StoreIdSchema = z.string().uuid('Invalid store ID format');
const BusinessIdSchema = z.string().uuid('Invalid business ID format');

class FeedbackAnalysisAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'FeedbackAnalysisAuthError';
  }
}

export class FeedbackAnalysisAuthService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Extract and validate JWT token from Authorization header
   */
  private extractToken(authHeader?: string): string {
    if (!authHeader) {
      throw new FeedbackAnalysisAuthError(
        'Authorization header is required',
        'MISSING_AUTH_HEADER',
        401
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new FeedbackAnalysisAuthError(
        'Invalid authorization header format. Expected: Bearer <token>',
        'INVALID_AUTH_FORMAT',
        401
      );
    }

    return parts[1];
  }

  /**
   * Verify JWT token and get user information
   */
  async verifyToken(token: string): Promise<{
    id: string;
    email: string;
    business_id: string;
    role: string;
  }> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new FeedbackAnalysisAuthError(
          'Invalid or expired token',
          'INVALID_TOKEN',
          401
        );
      }

      // Get business membership information
      const { data: membership, error: membershipError } = await this.supabase
        .from('business_users')
        .select(`
          business_id,
          role,
          businesses!inner (
            id,
            name,
            verification_status
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (membershipError || !membership) {
        throw new FeedbackAnalysisAuthError(
          'User is not associated with any business',
          'NO_BUSINESS_MEMBERSHIP',
          403
        );
      }

      // Check business verification status
      if (membership.businesses.verification_status !== 'approved') {
        throw new FeedbackAnalysisAuthError(
          'Business account is not verified for feedback analysis access',
          'BUSINESS_NOT_VERIFIED',
          403
        );
      }

      return {
        id: user.id,
        email: user.email!,
        business_id: membership.business_id,
        role: membership.role,
      };
    } catch (error) {
      if (error instanceof FeedbackAnalysisAuthError) {
        throw error;
      }
      throw new FeedbackAnalysisAuthError(
        'Token verification failed',
        'TOKEN_VERIFICATION_FAILED',
        401
      );
    }
  }

  /**
   * Get user permissions based on role and store-specific permissions
   */
  getUserPermissions(role: string, storePermissions: string[] = []): string[] {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    return [...new Set([...rolePermissions, ...storePermissions])];
  }

  /**
   * Verify user has access to specific store
   */
  async verifyStoreAccess(userId: string, businessId: string, storeId: string): Promise<{
    id: string;
    business_id: string;
    name: string;
    permissions: string[];
  }> {
    try {
      // Validate store ID format
      StoreIdSchema.parse(storeId);

      // Check if user has access to the store
      const { data: storeAccess, error } = await this.supabase
        .from('business_stores')
        .select(`
          stores!inner (
            id,
            business_id,
            name,
            is_active
          ),
          permissions
        `)
        .eq('business_id', businessId)
        .eq('stores.id', storeId)
        .eq('stores.is_active', true)
        .single();

      if (error || !storeAccess) {
        throw new FeedbackAnalysisAuthError(
          'Store not found or access denied',
          'STORE_ACCESS_DENIED',
          403
        );
      }

      return {
        id: storeAccess.stores.id,
        business_id: storeAccess.stores.business_id,
        name: storeAccess.stores.name,
        permissions: storeAccess.permissions || [],
      };
    } catch (error) {
      if (error instanceof FeedbackAnalysisAuthError) {
        throw error;
      }
      throw new FeedbackAnalysisAuthError(
        'Store access verification failed',
        'STORE_ACCESS_VERIFICATION_FAILED',
        500
      );
    }
  }

  /**
   * Check if user has required permission
   */
  hasPermission(userPermissions: string[], requiredPermission: PermissionType): boolean {
    return userPermissions.includes(requiredPermission) || 
           userPermissions.includes(FEEDBACK_ANALYSIS_PERMISSIONS.ADMIN_ACCESS);
  }

  /**
   * Validate rate limit compliance
   */
  async checkRateLimit(userId: string, endpoint: string, limit: number, windowMs: number): Promise<void> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get recent requests for this user and endpoint
    const { data: recentRequests, error } = await this.supabase
      .from('api_requests')
      .select('created_at')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('created_at', new Date(windowStart).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Rate limit check failed:', error);
      return; // Allow request if rate limit check fails
    }

    if ((recentRequests?.length || 0) >= limit) {
      throw new FeedbackAnalysisAuthError(
        `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds`,
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }

    // Log this request
    await this.supabase
      .from('api_requests')
      .insert({
        user_id: userId,
        endpoint,
        created_at: new Date().toISOString(),
      });
  }
}

// Singleton instance
const authService = new FeedbackAnalysisAuthService();

/**
 * Base authentication middleware
 */
export function requireAuthentication() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = authService.extractToken(req.headers.authorization);
      const user = await authService.verifyToken(token);
      
      (req as AuthenticatedRequest).user = {
        ...user,
        permissions: authService.getUserPermissions(user.role),
      };

      next();
    } catch (error) {
      if (error instanceof FeedbackAnalysisAuthError) {
        return res.status(error.statusCode).json({
          code: error.code,
          message: error.message,
        });
      }

      console.error('Authentication error:', error);
      return res.status(500).json({
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed',
      });
    }
  };
}

/**
 * Store access middleware - validates access to specific store
 */
export function requireStoreAccess() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new FeedbackAnalysisAuthError(
          'User authentication required',
          'USER_NOT_AUTHENTICATED',
          401
        );
      }

      const storeId = req.params.storeId;
      if (!storeId) {
        throw new FeedbackAnalysisAuthError(
          'Store ID parameter is required',
          'MISSING_STORE_ID',
          400
        );
      }

      const store = await authService.verifyStoreAccess(
        req.user.id,
        req.user.business_id,
        storeId
      );

      req.store = {
        ...store,
      };

      // Update user permissions with store-specific permissions
      req.user.permissions = authService.getUserPermissions(
        req.user.role,
        store.permissions
      );

      next();
    } catch (error) {
      if (error instanceof FeedbackAnalysisAuthError) {
        return res.status(error.statusCode).json({
          code: error.code,
          message: error.message,
        });
      }

      console.error('Store access error:', error);
      return res.status(500).json({
        code: 'STORE_ACCESS_ERROR',
        message: 'Store access verification failed',
      });
    }
  };
}

/**
 * Permission-based authorization middleware
 */
export function requirePermission(permission: PermissionType) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new FeedbackAnalysisAuthError(
          'User authentication required',
          'USER_NOT_AUTHENTICATED',
          401
        );
      }

      if (!authService.hasPermission(req.user.permissions, permission)) {
        throw new FeedbackAnalysisAuthError(
          `Missing required permission: ${permission}`,
          'INSUFFICIENT_PERMISSIONS',
          403
        );
      }

      next();
    } catch (error) {
      if (error instanceof FeedbackAnalysisAuthError) {
        return res.status(error.statusCode).json({
          code: error.code,
          message: error.message,
        });
      }

      console.error('Permission check error:', error);
      return res.status(500).json({
        code: 'PERMISSION_CHECK_ERROR',
        message: 'Permission verification failed',
      });
    }
  };
}

/**
 * Rate limiting middleware
 */
export function requireRateLimit(endpoint: string, limit: number, windowMs: number) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new FeedbackAnalysisAuthError(
          'User authentication required for rate limiting',
          'USER_NOT_AUTHENTICATED',
          401
        );
      }

      await authService.checkRateLimit(req.user.id, endpoint, limit, windowMs);
      next();
    } catch (error) {
      if (error instanceof FeedbackAnalysisAuthError) {
        return res.status(error.statusCode).json({
          code: error.code,
          message: error.message,
        });
      }

      console.error('Rate limit error:', error);
      return res.status(500).json({
        code: 'RATE_LIMIT_ERROR',
        message: 'Rate limit check failed',
      });
    }
  };
}

/**
 * Combined middleware for common feedback analysis route protection
 */
export function protectFeedbackAnalysisRoute(permission: PermissionType) {
  return [
    requireAuthentication(),
    requireStoreAccess(),
    requirePermission(permission),
  ];
}

/**
 * Combined middleware with rate limiting
 */
export function protectFeedbackAnalysisRouteWithRateLimit(
  permission: PermissionType,
  endpoint: string,
  limit: number,
  windowMs: number
) {
  return [
    requireAuthentication(),
    requireStoreAccess(),
    requirePermission(permission),
    requireRateLimit(endpoint, limit, windowMs),
  ];
}

// Common rate limit configurations
export const RATE_LIMITS = {
  SEARCH: { limit: 60, windowMs: 60000 }, // 60 requests per minute
  REPORTS: { limit: 30, windowMs: 60000 }, // 30 requests per minute
  INSIGHTS: { limit: 120, windowMs: 60000 }, // 120 requests per minute
  EXPORT: { limit: 10, windowMs: 60000 }, // 10 exports per minute
  TEMPORAL: { limit: 20, windowMs: 60000 }, // 20 requests per minute
} as const;

// Utility functions for route protection
export const protectSearchRoute = () =>
  protectFeedbackAnalysisRouteWithRateLimit(
    FEEDBACK_ANALYSIS_PERMISSIONS.SEARCH_FEEDBACK,
    'search',
    RATE_LIMITS.SEARCH.limit,
    RATE_LIMITS.SEARCH.windowMs
  );

export const protectReportsRoute = () =>
  protectFeedbackAnalysisRouteWithRateLimit(
    FEEDBACK_ANALYSIS_PERMISSIONS.VIEW_ANALYTICS,
    'reports',
    RATE_LIMITS.REPORTS.limit,
    RATE_LIMITS.REPORTS.windowMs
  );

export const protectInsightsRoute = () =>
  protectFeedbackAnalysisRouteWithRateLimit(
    FEEDBACK_ANALYSIS_PERMISSIONS.MANAGE_INSIGHTS,
    'insights',
    RATE_LIMITS.INSIGHTS.limit,
    RATE_LIMITS.INSIGHTS.windowMs
  );

export const protectExportRoute = () =>
  protectFeedbackAnalysisRouteWithRateLimit(
    FEEDBACK_ANALYSIS_PERMISSIONS.EXPORT_DATA,
    'export',
    RATE_LIMITS.EXPORT.limit,
    RATE_LIMITS.EXPORT.windowMs
  );

export const protectTemporalRoute = () =>
  protectFeedbackAnalysisRouteWithRateLimit(
    FEEDBACK_ANALYSIS_PERMISSIONS.VIEW_ANALYTICS,
    'temporal',
    RATE_LIMITS.TEMPORAL.limit,
    RATE_LIMITS.TEMPORAL.windowMs
  );

// Error handler for authentication errors
export function handleAuthErrors() {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof FeedbackAnalysisAuthError) {
      return res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
      });
    }

    next(error);
  };
}

export { FeedbackAnalysisAuthError, FeedbackAnalysisAuthService };