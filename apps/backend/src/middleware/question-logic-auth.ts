import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../../packages/database/src/client/supabase';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
  businessContext?: {
    id: string;
    user_id: string;
  };
}

// Middleware to verify user has access to question logic operations
export const questionLogicAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Valid authentication token required for question logic operations'
      });
    }

    // Check if user has business context access
    const businessContextId = req.params.businessContextId || 
                            req.body.business_context_id || 
                            req.query.business_context_id;

    if (businessContextId) {
      const hasAccess = await verifyBusinessContextAccess(req.user.id, businessContextId);
      
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'User does not have access to this business context'
        });
      }

      // Attach business context to request for downstream use
      const { data: businessContext } = await supabase
        .from('business_contexts')
        .select('id, user_id')
        .eq('id', businessContextId)
        .single();

      if (businessContext) {
        req.businessContext = businessContext;
      }
    }

    next();
  } catch (error) {
    console.error('Question logic auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to verify user permissions'
    });
  }
};

// Middleware specifically for question combination rule operations
export const combinationRuleAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // First apply general question logic auth
    await new Promise<void>((resolve, reject) => {
      questionLogicAuthMiddleware(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Additional checks for rule operations
    const ruleId = req.params.ruleId;
    
    if (ruleId && req.method !== 'POST') {
      const hasRuleAccess = await verifyRuleAccess(req.user!.id, ruleId);
      
      if (!hasRuleAccess) {
        return res.status(404).json({
          error: 'Rule not found',
          message: 'Question combination rule not found or access denied'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Combination rule auth middleware error:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'Failed to verify rule permissions'
    });
  }
};

// Middleware specifically for dynamic trigger operations
export const dynamicTriggerAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // First apply general question logic auth
    await new Promise<void>((resolve, reject) => {
      questionLogicAuthMiddleware(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Additional checks for trigger operations
    const triggerId = req.params.triggerId;
    
    if (triggerId && req.method !== 'POST') {
      const hasTriggerAccess = await verifyTriggerAccess(req.user!.id, triggerId);
      
      if (!hasTriggerAccess) {
        return res.status(404).json({
          error: 'Trigger not found',
          message: 'Dynamic trigger not found or access denied'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Dynamic trigger auth middleware error:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'Failed to verify trigger permissions'
    });
  }
};

// Middleware for admin-only operations (trigger analytics, etc.)
export const adminQuestionLogicAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Admin authentication required'
      });
    }

    // Verify user has admin privileges
    const { data: adminAccount, error } = await supabase
      .from('admin_accounts')
      .select('id, is_super_admin, permissions')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (error || !adminAccount) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required for this operation'
      });
    }

    // Check if admin has question logic permissions
    const permissions = adminAccount.permissions || [];
    const hasQuestionLogicPermission = adminAccount.is_super_admin || 
                                     permissions.includes('question_logic') ||
                                     permissions.includes('analytics');

    if (!hasQuestionLogicPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Question logic admin permissions required'
      });
    }

    next();
  } catch (error) {
    console.error('Admin question logic auth middleware error:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'Failed to verify admin permissions'
    });
  }
};

// Helper function to verify business context access
async function verifyBusinessContextAccess(userId: string, businessContextId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('business_contexts')
      .select('id')
      .eq('id', businessContextId)
      .eq('user_id', userId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error verifying business context access:', error);
    return false;
  }
}

// Helper function to verify rule access
async function verifyRuleAccess(userId: string, ruleId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('question_combination_rules')
      .select('id, business_context_id')
      .eq('id', ruleId)
      .single();

    if (error || !data) {
      return false;
    }

    return await verifyBusinessContextAccess(userId, data.business_context_id);
  } catch (error) {
    console.error('Error verifying rule access:', error);
    return false;
  }
}

// Helper function to verify trigger access
async function verifyTriggerAccess(userId: string, triggerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('dynamic_triggers')
      .select('id, business_context_id')
      .eq('id', triggerId)
      .single();

    if (error || !data) {
      return false;
    }

    return await verifyBusinessContextAccess(userId, data.business_context_id);
  } catch (error) {
    console.error('Error verifying trigger access:', error);
    return false;
  }
}

// Rate limiting middleware for question logic operations
export const questionLogicRateLimitMiddleware = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(); // Let auth middleware handle this
    }

    const now = Date.now();
    const userKey = `question_logic:${userId}`;
    const userRequests = requestCounts.get(userKey);

    if (!userRequests || now > userRequests.resetTime) {
      requestCounts.set(userKey, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded for question logic operations',
        resetTime: new Date(userRequests.resetTime).toISOString()
      });
    }

    userRequests.count++;
    next();
  };
};