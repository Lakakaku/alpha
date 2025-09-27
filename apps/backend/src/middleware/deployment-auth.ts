import { Request, Response, NextFunction } from 'express';
import { requireAdminAuth, AdminRequest } from './admin-auth';
import { auditService } from '../services/admin/audit';

/**
 * Middleware specifically for deployment-related endpoints
 * Requires admin authentication and logs deployment actions
 */
export const requireDeploymentAuth = [
  requireAdminAuth,
  async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      // Check if admin has deployment permissions
      const { adminAccountService } = await import('../services/admin/auth');
      const adminAccount = await adminAccountService.getById(req.admin!.id);
      
      if (!adminAccount) {
        return res.status(401).json({ 
          error: 'Invalid admin account',
          message: 'Admin account not found'
        });
      }

      // For deployment operations, require super admin privileges
      if (!adminAccount.is_super_admin) {
        // Log unauthorized deployment access attempt
        await auditService.logAction({
          admin_id: req.admin!.id,
          admin_username: req.admin!.username,
          action_type: 'unauthorized_deployment_access',
          resource_type: 'deployment_endpoint',
          resource_id: req.path,
          details: `Attempted deployment access: ${req.method} ${req.path}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent') || '',
          success: false,
          error_message: 'Insufficient deployment permissions'
        });

        return res.status(403).json({ 
          error: 'Insufficient permissions',
          message: 'Deployment operations require super admin privileges'
        });
      }

      // Log deployment endpoint access
      await auditService.logAction({
        admin_id: req.admin!.id,
        admin_username: req.admin!.username,
        action_type: 'deployment_endpoint_access',
        resource_type: 'deployment_endpoint',
        resource_id: req.path,
        details: `Deployment endpoint accessed: ${req.method} ${req.path}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent') || '',
        success: true
      });

      next();
    } catch (error) {
      console.error('Deployment auth middleware error:', error);
      
      // Log failed deployment access attempt
      if (req.admin) {
        try {
          await auditService.logAction({
            admin_id: req.admin.id,
            admin_username: req.admin.username,
            action_type: 'deployment_auth_error',
            resource_type: 'deployment_endpoint',
            resource_id: req.path,
            details: `Deployment auth error: ${req.method} ${req.path}`,
            ip_address: req.ip,
            user_agent: req.get('User-Agent') || '',
            success: false,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          });
        } catch (auditError) {
          console.error('Failed to log deployment auth audit entry:', auditError);
        }
      }

      res.status(500).json({ 
        error: 'Deployment authentication error',
        message: 'Internal server error'
      });
    }
  }
];

/**
 * Middleware to log deployment actions with enhanced details
 */
export const logDeploymentAction = (actionType: string) => {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next();
    }

    // Store original body for logging
    const originalBody = req.body;

    // Log the deployment action after the request completes
    const originalSend = res.send;
    res.send = function(data) {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Extract relevant deployment details from request
      const deploymentDetails = extractDeploymentDetails(req, originalBody, actionType);
      
      auditService.logAction({
        admin_id: req.admin!.id,
        admin_username: req.admin!.username,
        action_type: actionType,
        resource_type: 'deployment_operation',
        resource_id: req.path,
        details: `${actionType} - ${req.method} ${req.path} - ${deploymentDetails}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent') || '',
        success,
        error_message: success ? undefined : extractErrorMessage(data)
      }).catch(console.error);

      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Extract deployment-specific details from request for audit logging
 */
function extractDeploymentDetails(req: Request, body: any, actionType: string): string {
  const details: string[] = [];
  
  // Extract environment info
  if (body?.environment) {
    details.push(`env:${body.environment}`);
  }
  
  // Extract deployment ID for status/rollback operations
  if (body?.deployment_id || req.params?.deploymentId) {
    details.push(`deployment:${body.deployment_id || req.params.deploymentId}`);
  }
  
  // Extract rollback target
  if (body?.target_deployment_id) {
    details.push(`rollback_target:${body.target_deployment_id}`);
  }
  
  // Extract app name
  if (body?.app || req.params?.app) {
    details.push(`app:${body.app || req.params.app}`);
  }
  
  // Extract monitoring timeframe
  if (req.query?.timeframe) {
    details.push(`timeframe:${req.query.timeframe}`);
  }
  
  // Extract backup ID for backup operations
  if (body?.backup_id || req.params?.backupId) {
    details.push(`backup:${body.backup_id || req.params.backupId}`);
  }
  
  // Extract reason for deployment actions
  if (body?.reason) {
    details.push(`reason:"${body.reason}"`);
  }

  return details.length > 0 ? details.join(', ') : 'no additional details';
}

/**
 * Extract error message from response data for audit logging
 */
function extractErrorMessage(data: any): string {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed.error || parsed.message || data;
    } catch {
      return data;
    }
  }
  
  if (typeof data === 'object' && data !== null) {
    return data.error || data.message || JSON.stringify(data);
  }
  
  return 'Unknown error';
}

/**
 * Rate limiting specifically for deployment operations
 * More restrictive than general admin rate limiting
 */
export const deploymentRateLimit = (maxRequests: number = 10, windowMs: number = 5 * 60 * 1000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next();
    }

    const key = `deployment:${req.admin.id}`;
    const now = Date.now();
    
    // Clean up expired entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < now) {
        requests.delete(k);
      }
    }

    const current = requests.get(key);
    if (!current) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (current.resetTime < now) {
      // Reset window
      requests.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      // Log deployment rate limit violation
      auditService.logAction({
        admin_id: req.admin.id,
        admin_username: req.admin.username,
        action_type: 'deployment_rate_limit_violation',
        resource_type: 'deployment_api',
        resource_id: req.path,
        details: `Deployment rate limit exceeded: ${current.count}/${maxRequests} requests in ${windowMs/1000}s`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent') || '',
        success: false
      }).catch(console.error);

      return res.status(429).json({
        error: 'Deployment rate limit exceeded',
        message: 'Too many deployment operations, please wait before trying again',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }

    current.count++;
    next();
  };
};

export default requireDeploymentAuth;