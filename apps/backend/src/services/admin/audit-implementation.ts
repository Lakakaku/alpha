import { auditService } from './audit'
import { adminSessionService } from './session'

interface AuditContext {
  adminId?: string
  username?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
}

export class AuditLogger {
  private context: AuditContext = {}

  constructor(context: Partial<AuditContext> = {}) {
    this.context = context
  }

  // Set context from admin session
  async setContextFromSession(sessionToken: string, ipAddress?: string, userAgent?: string) {
    try {
      const session = await adminSessionService.validateSession(sessionToken)
      if (session) {
        this.context = {
          adminId: session.admin_id,
          username: session.admin_username,
          sessionId: session.id,
          ipAddress,
          userAgent
        }
      }
    } catch (error) {
      console.error('Failed to set audit context from session:', error)
    }
  }

  // Log authentication events
  async logLogin(success: boolean, email?: string, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || email || null,
      action_type: 'login',
      resource_type: 'authentication',
      resource_id: 'admin_login',
      details: success ? 'Successful admin login' : `Failed login attempt: ${errorMessage}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  async logLogout() {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'logout',
      resource_type: 'authentication',
      resource_id: 'admin_logout',
      details: 'Admin logout',
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success: true
    })
  }

  async logSessionEnd(reason: 'logout' | 'timeout' | 'security') {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'session_end',
      resource_type: 'session',
      resource_id: this.context.sessionId || '',
      details: `Session ended: ${reason}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success: true
    })
  }

  // Log store management events
  async logStoreCreate(storeId: string, storeName: string, success: boolean, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'create',
      resource_type: 'store',
      resource_id: storeId,
      details: `Created store: ${storeName}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  async logStoreUpdate(storeId: string, storeName: string, changes: Record<string, any>, success: boolean, errorMessage?: string) {
    const changeDetails = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')

    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'update',
      resource_type: 'store',
      resource_id: storeId,
      details: `Updated store ${storeName}: ${changeDetails}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  async logStoreDelete(storeId: string, storeName: string, success: boolean, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'delete',
      resource_type: 'store',
      resource_id: storeId,
      details: `Deleted store: ${storeName}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  async logStoreView(storeId: string, storeName: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'view',
      resource_type: 'store',
      resource_id: storeId,
      details: `Viewed store: ${storeName}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success: true
    })
  }

  // Log database upload events
  async logDatabaseUpload(filename: string, recordCount: number, success: boolean, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'upload',
      resource_type: 'database',
      resource_id: filename,
      details: `Database upload: ${filename} (${recordCount} records)`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  // Log QR code management events
  async logQRCodeCreate(qrCodeId: string, storeId: string, success: boolean, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'create',
      resource_type: 'qr_code',
      resource_id: qrCodeId,
      details: `Created QR code for store ${storeId}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  async logQRCodeUpdate(qrCodeId: string, changes: Record<string, any>, success: boolean, errorMessage?: string) {
    const changeDetails = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')

    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'update',
      resource_type: 'qr_code',
      resource_id: qrCodeId,
      details: `Updated QR code: ${changeDetails}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  async logQRCodeDelete(qrCodeId: string, success: boolean, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'delete',
      resource_type: 'qr_code',
      resource_id: qrCodeId,
      details: `Deleted QR code`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  // Log system monitoring events
  async logSystemHealthCheck(results: Record<string, any>) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'health_check',
      resource_type: 'system',
      resource_id: 'health_check',
      details: `System health check: ${JSON.stringify(results)}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success: true
    })
  }

  async logDataExport(exportType: string, recordCount: number, success: boolean, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'export',
      resource_type: 'data',
      resource_id: exportType,
      details: `Data export: ${exportType} (${recordCount} records)`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  // Log security events
  async logSecurityAlert(alertType: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical') {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'security_alert',
      resource_type: 'security',
      resource_id: alertType,
      details: `Security alert [${severity}]: ${message}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success: false,
      error_message: message
    })
  }

  async logUnauthorizedAccess(attemptedResource: string, attemptedAction: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'unauthorized_access',
      resource_type: attemptedResource,
      resource_id: attemptedAction,
      details: `Unauthorized access attempt: ${attemptedAction} on ${attemptedResource}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success: false,
      error_message: 'Insufficient permissions'
    })
  }

  async logSuspiciousActivity(activityType: string, details: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'suspicious_activity',
      resource_type: 'security',
      resource_id: activityType,
      details: `Suspicious activity detected: ${details}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success: false,
      error_message: details
    })
  }

  // Log admin account management
  async logAdminAccountCreate(newAdminId: string, newAdminUsername: string, isSuperAdmin: boolean, success: boolean, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'create',
      resource_type: 'admin_account',
      resource_id: newAdminId,
      details: `Created admin account: ${newAdminUsername} (super_admin: ${isSuperAdmin})`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  async logAdminAccountUpdate(targetAdminId: string, targetUsername: string, changes: Record<string, any>, success: boolean, errorMessage?: string) {
    const changeDetails = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')

    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'update',
      resource_type: 'admin_account',
      resource_id: targetAdminId,
      details: `Updated admin account ${targetUsername}: ${changeDetails}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  async logAdminAccountDelete(targetAdminId: string, targetUsername: string, success: boolean, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'delete',
      resource_type: 'admin_account',
      resource_id: targetAdminId,
      details: `Deleted admin account: ${targetUsername}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  // Log configuration changes
  async logConfigurationChange(configType: string, configId: string, changes: Record<string, any>, success: boolean, errorMessage?: string) {
    const changeDetails = Object.entries(changes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')

    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'configure',
      resource_type: configType,
      resource_id: configId,
      details: `Configuration change: ${changeDetails}`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }

  // Bulk operations
  async logBulkOperation(operationType: string, resourceType: string, affectedCount: number, success: boolean, errorMessage?: string) {
    return auditService.logAction({
      admin_id: this.context.adminId || null,
      admin_username: this.context.username || null,
      action_type: 'bulk_operation',
      resource_type: resourceType,
      resource_id: operationType,
      details: `Bulk ${operationType}: ${affectedCount} ${resourceType}(s)`,
      ip_address: this.context.ipAddress || '',
      user_agent: this.context.userAgent || '',
      success,
      error_message: success ? undefined : errorMessage
    })
  }
}

// Factory function to create audit logger with request context
export const createAuditLogger = (req?: any): AuditLogger => {
  const context: Partial<AuditContext> = {}
  
  if (req) {
    context.ipAddress = req.ip
    context.userAgent = req.get('User-Agent')
    
    // Extract admin info if available (set by admin auth middleware)
    if (req.admin) {
      context.adminId = req.admin.id
      context.username = req.admin.username
      context.sessionId = req.admin.sessionId
    }
  }
  
  return new AuditLogger(context)
}

// Singleton instance for service-level logging
export const systemAuditLogger = new AuditLogger()

export { AuditLogger }