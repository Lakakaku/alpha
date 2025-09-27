import { Request, Response, NextFunction } from 'express'
import { adminSessionService } from '../services/admin/session'
import { auditService } from '../services/admin/audit'

interface AdminRequest extends Request {
  admin?: {
    id: string
    username: string
    sessionId: string
  }
}

export const requireAdminAuth = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    // Extract session token from Authorization header or cookie
    const authHeader = req.headers.authorization
    const sessionToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7)
      : req.cookies?.admin_session

    if (!sessionToken) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No session token provided'
      })
    }

    // Validate session
    const session = await adminSessionService.validateSession(sessionToken)
    if (!session) {
      return res.status(401).json({ 
        error: 'Invalid session',
        message: 'Session expired or invalid'
      })
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      await adminSessionService.endSession(sessionToken)
      return res.status(401).json({ 
        error: 'Session expired',
        message: 'Please log in again'
      })
    }

    // Update session activity
    await adminSessionService.updateActivity(sessionToken, req.ip, req.get('User-Agent') || '')

    // Attach admin info to request
    req.admin = {
      id: session.admin_id,
      username: session.admin_username,
      sessionId: session.id
    }

    // Log access attempt
    await auditService.logAction({
      admin_id: session.admin_id,
      admin_username: session.admin_username,
      action_type: 'api_access',
      resource_type: 'endpoint',
      resource_id: req.path,
      details: `${req.method} ${req.path}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent') || '',
      success: true
    })

    next()
  } catch (error) {
    console.error('Admin auth middleware error:', error)
    
    // Log failed access attempt if we have enough info
    if (req.ip) {
      try {
        await auditService.logAction({
          admin_id: null,
          admin_username: null,
          action_type: 'api_access',
          resource_type: 'endpoint',
          resource_id: req.path,
          details: `Failed auth: ${req.method} ${req.path}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent') || '',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
      } catch (auditError) {
        console.error('Failed to log audit entry:', auditError)
      }
    }

    res.status(500).json({ 
      error: 'Authentication error',
      message: 'Internal server error'
    })
  }
}

export const optionalAdminAuth = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    const sessionToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7)
      : req.cookies?.admin_session

    if (sessionToken) {
      const session = await adminSessionService.validateSession(sessionToken)
      if (session && new Date(session.expires_at) >= new Date()) {
        // Update session activity
        await adminSessionService.updateActivity(sessionToken, req.ip, req.get('User-Agent') || '')
        
        // Attach admin info to request
        req.admin = {
          id: session.admin_id,
          username: session.admin_username,
          sessionId: session.id
        }
      }
    }

    next()
  } catch (error) {
    console.error('Optional admin auth middleware error:', error)
    // Don't fail the request for optional auth
    next()
  }
}

export const requireSuperAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.admin) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Not authenticated'
      })
    }

    // Get admin account to check permissions
    const { adminAccountService } = await import('../services/admin/auth')
    const adminAccount = await adminAccountService.getById(req.admin.id)
    
    if (!adminAccount) {
      return res.status(401).json({ 
        error: 'Invalid admin account',
        message: 'Admin account not found'
      })
    }

    if (!adminAccount.is_super_admin) {
      // Log unauthorized access attempt
      await auditService.logAction({
        admin_id: req.admin.id,
        admin_username: req.admin.username,
        action_type: 'unauthorized_access',
        resource_type: 'super_admin_endpoint',
        resource_id: req.path,
        details: `Attempted super admin access: ${req.method} ${req.path}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent') || '',
        success: false,
        error_message: 'Insufficient permissions'
      })

      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: 'Super admin access required'
      })
    }

    next()
  } catch (error) {
    console.error('Super admin middleware error:', error)
    res.status(500).json({ 
      error: 'Authorization error',
      message: 'Internal server error'
    })
  }
}

export const rateLimitAdmin = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map<string, { count: number; resetTime: number }>()

  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const key = req.admin?.id || req.ip
    const now = Date.now()
    
    // Clean up expired entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < now) {
        requests.delete(k)
      }
    }

    const current = requests.get(key)
    if (!current) {
      requests.set(key, { count: 1, resetTime: now + windowMs })
      next()
      return
    }

    if (current.resetTime < now) {
      // Reset window
      requests.set(key, { count: 1, resetTime: now + windowMs })
      next()
      return
    }

    if (current.count >= maxRequests) {
      // Log rate limit violation
      if (req.admin) {
        auditService.logAction({
          admin_id: req.admin.id,
          admin_username: req.admin.username,
          action_type: 'rate_limit_violation',
          resource_type: 'api',
          resource_id: req.path,
          details: `Rate limit exceeded: ${current.count}/${maxRequests} requests`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent') || '',
          success: false
        }).catch(console.error)
      }

      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      })
    }

    current.count++
    next()
  }
}

export const logAdminAction = (actionType: string) => {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next()
    }

    // Log the action after the request completes
    const originalSend = res.send
    res.send = function(data) {
      const success = res.statusCode >= 200 && res.statusCode < 400
      
      auditService.logAction({
        admin_id: req.admin!.id,
        admin_username: req.admin!.username,
        action_type: actionType,
        resource_type: 'api_operation',
        resource_id: req.path,
        details: `${req.method} ${req.path} - ${res.statusCode}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent') || '',
        success,
        error_message: success ? undefined : (typeof data === 'string' ? data : JSON.stringify(data))
      }).catch(console.error)

      return originalSend.call(this, data)
    }

    next()
  }
}

export type { AdminRequest }