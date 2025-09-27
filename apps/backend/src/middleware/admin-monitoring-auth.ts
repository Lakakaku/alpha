import { Request, Response, NextFunction } from 'express';
import { loggingService } from '../services/loggingService';

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface AdminMonitoringRequest extends Request {
  adminUser?: AdminUser;
  monitoringAccess?: {
    canViewMetrics: boolean;
    canConfigureAlerts: boolean;
    canExportData: boolean;
    canViewBusinessData: boolean;
    accessLevel: 'read' | 'write' | 'admin';
  };
}

/**
 * Middleware to authenticate admin users and validate monitoring permissions
 * This middleware extends the basic admin authentication with monitoring-specific permissions
 */
export const adminMonitoringAuth = async (
  req: AdminMonitoringRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if admin user is already authenticated (by previous middleware)
    if (!req.adminUser) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Admin authentication required for monitoring access',
      });
    }

    // Validate monitoring permissions
    const monitoringAccess = validateMonitoringPermissions(req.adminUser);
    
    if (!monitoringAccess.canViewMetrics) {
      // Log unauthorized access attempt
      await logMonitoringAccess(req, 'UNAUTHORIZED_ACCESS', {
        reason: 'Insufficient monitoring permissions',
        requiredPermission: 'monitoring_read',
        userPermissions: req.adminUser.permissions,
      });

      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions for monitoring access',
        required: 'monitoring_read',
      });
    }

    // Attach monitoring access context to request
    req.monitoringAccess = monitoringAccess;

    // Log successful monitoring access
    await logMonitoringAccess(req, 'ACCESS_GRANTED', {
      accessLevel: monitoringAccess.accessLevel,
      permissions: {
        canViewMetrics: monitoringAccess.canViewMetrics,
        canConfigureAlerts: monitoringAccess.canConfigureAlerts,
        canExportData: monitoringAccess.canExportData,
        canViewBusinessData: monitoringAccess.canViewBusinessData,
      },
    });

    next();
  } catch (error) {
    loggingService.logError('admin-monitoring-auth', 'Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method,
      adminUserId: req.adminUser?.id,
    });

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication service error',
    });
  }
};

/**
 * Validate and determine monitoring permissions for admin user
 */
function validateMonitoringPermissions(adminUser: AdminUser) {
  const permissions = adminUser.permissions || [];
  const isSuperAdmin = adminUser.isSuperAdmin || false;

  // Super admin has all permissions
  if (isSuperAdmin) {
    return {
      canViewMetrics: true,
      canConfigureAlerts: true,
      canExportData: true,
      canViewBusinessData: true,
      accessLevel: 'admin' as const,
    };
  }

  // Check specific monitoring permissions
  const canViewMetrics = permissions.includes('monitoring_read') || permissions.includes('monitoring_admin');
  const canConfigureAlerts = permissions.includes('monitoring_write') || permissions.includes('monitoring_admin');
  const canExportData = permissions.includes('monitoring_export') || permissions.includes('monitoring_admin');
  const canViewBusinessData = permissions.includes('business_data_read') || permissions.includes('monitoring_admin');

  // Determine access level
  let accessLevel: 'read' | 'write' | 'admin' = 'read';
  if (permissions.includes('monitoring_admin')) {
    accessLevel = 'admin';
  } else if (permissions.includes('monitoring_write')) {
    accessLevel = 'write';
  }

  return {
    canViewMetrics,
    canConfigureAlerts,
    canExportData,
    canViewBusinessData,
    accessLevel,
  };
}

/**
 * Middleware to check specific monitoring operation permissions
 */
export const requireMonitoringPermission = (requiredPermission: 'read' | 'write' | 'export' | 'business_data') => {
  return (req: AdminMonitoringRequest, res: Response, next: NextFunction) => {
    const monitoringAccess = req.monitoringAccess;
    
    if (!monitoringAccess) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Monitoring authentication required',
      });
    }

    let hasPermission = false;
    
    switch (requiredPermission) {
      case 'read':
        hasPermission = monitoringAccess.canViewMetrics;
        break;
      case 'write':
        hasPermission = monitoringAccess.canConfigureAlerts;
        break;
      case 'export':
        hasPermission = monitoringAccess.canExportData;
        break;
      case 'business_data':
        hasPermission = monitoringAccess.canViewBusinessData;
        break;
    }

    if (!hasPermission) {
      logMonitoringAccess(req, 'PERMISSION_DENIED', {
        requiredPermission,
        userPermissions: req.adminUser?.permissions || [],
        accessLevel: monitoringAccess.accessLevel,
      }).catch(() => {}); // Fire and forget

      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Insufficient permissions for ${requiredPermission} operation`,
        required: `monitoring_${requiredPermission}`,
      });
    }

    next();
  };
};

/**
 * Log monitoring access attempts for audit purposes
 */
async function logMonitoringAccess(
  req: AdminMonitoringRequest,
  accessType: 'ACCESS_GRANTED' | 'UNAUTHORIZED_ACCESS' | 'PERMISSION_DENIED',
  details: Record<string, any>
) {
  try {
    const logData = {
      adminUserId: req.adminUser?.id,
      adminEmail: req.adminUser?.email,
      accessType,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details,
    };

    // Log to monitoring access logs (would typically insert into monitoring_access_logs table)
    loggingService.logAudit('monitoring-access', accessType, logData);

    // For unauthorized access, also log as security event
    if (accessType === 'UNAUTHORIZED_ACCESS' || accessType === 'PERMISSION_DENIED') {
      loggingService.logSecurity('monitoring-security', `Monitoring access denied: ${accessType}`, logData);
    }
  } catch (error) {
    // Don't fail the request if logging fails
    loggingService.logError('admin-monitoring-auth', 'Failed to log monitoring access', {
      error: error instanceof Error ? error.message : 'Unknown error',
      accessType,
      adminUserId: req.adminUser?.id,
    });
  }
}

/**
 * Middleware to validate business data access for specific stores/businesses
 * Used when admin tries to access store-specific monitoring data
 */
export const validateBusinessDataAccess = async (
  req: AdminMonitoringRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const monitoringAccess = req.monitoringAccess;
    
    if (!monitoringAccess?.canViewBusinessData) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions to access business data',
        required: 'business_data_read',
      });
    }

    // Extract store/business IDs from query parameters or request body
    const storeIds = extractStoreIds(req);
    const businessIds = extractBusinessIds(req);

    // If no specific stores/businesses requested, allow (will be filtered by RLS policies)
    if (storeIds.length === 0 && businessIds.length === 0) {
      return next();
    }

    // For non-super admins, validate access to specific stores/businesses
    if (!req.adminUser?.isSuperAdmin) {
      const accessValidation = await validateStoreBusinessAccess(
        req.adminUser!.id,
        storeIds,
        businessIds
      );

      if (!accessValidation.isValid) {
        await logMonitoringAccess(req, 'PERMISSION_DENIED', {
          reason: 'Business data access denied',
          requestedStores: storeIds,
          requestedBusinesses: businessIds,
          deniedStores: accessValidation.deniedStores,
          deniedBusinesses: accessValidation.deniedBusinesses,
        });

        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Access denied to requested business data',
          deniedStores: accessValidation.deniedStores,
          deniedBusinesses: accessValidation.deniedBusinesses,
        });
      }
    }

    next();
  } catch (error) {
    loggingService.logError('admin-monitoring-auth', 'Business data access validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminUserId: req.adminUser?.id,
      path: req.path,
    });

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Access validation error',
    });
  }
};

/**
 * Extract store IDs from request parameters
 */
function extractStoreIds(req: Request): string[] {
  const storeIds: string[] = [];
  
  // Check query parameters
  if (req.query.store_id) {
    const ids = Array.isArray(req.query.store_id) ? req.query.store_id : [req.query.store_id];
    storeIds.push(...ids.map(id => String(id)));
  }
  
  if (req.query.store_ids) {
    const ids = String(req.query.store_ids).split(',');
    storeIds.push(...ids);
  }
  
  // Check request body
  if (req.body?.store_ids) {
    storeIds.push(...req.body.store_ids);
  }
  
  return storeIds.filter(id => id && id.trim());
}

/**
 * Extract business IDs from request parameters
 */
function extractBusinessIds(req: Request): string[] {
  const businessIds: string[] = [];
  
  // Check query parameters
  if (req.query.business_id) {
    const ids = Array.isArray(req.query.business_id) ? req.query.business_id : [req.query.business_id];
    businessIds.push(...ids.map(id => String(id)));
  }
  
  if (req.query.business_ids) {
    const ids = String(req.query.business_ids).split(',');
    businessIds.push(...ids);
  }
  
  // Check request body
  if (req.body?.business_ids) {
    businessIds.push(...req.body.business_ids);
  }
  
  return businessIds.filter(id => id && id.trim());
}

/**
 * Validate admin access to specific stores and businesses
 * In a real implementation, this would check against admin permissions table
 */
async function validateStoreBusinessAccess(
  adminUserId: string,
  storeIds: string[],
  businessIds: string[]
): Promise<{
  isValid: boolean;
  deniedStores: string[];
  deniedBusinesses: string[];
}> {
  // This is a simplified implementation
  // In production, this would query the database to check admin permissions
  // against specific stores/businesses based on the admin's assigned territories
  
  try {
    // For now, assume all access is granted for non-super admins
    // This would be replaced with actual permission checking logic
    return {
      isValid: true,
      deniedStores: [],
      deniedBusinesses: [],
    };
  } catch (error) {
    loggingService.logError('admin-monitoring-auth', 'Store/business access validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminUserId,
      storeIds,
      businessIds,
    });
    
    return {
      isValid: false,
      deniedStores: storeIds,
      deniedBusinesses: businessIds,
    };
  }
}

export default adminMonitoringAuth;