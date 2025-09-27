import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { adminAuthService } from '../../src/services/admin/auth'
import { adminSessionService } from '../../src/services/admin/session'
import { storeMonitoringService } from '../../src/services/admin/store-monitoring'
import { auditService } from '../../src/services/admin/audit'

// Mock Supabase
jest.mock('../../src/config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn()
    }))
  }
}))

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true)
}))

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({ toString: jest.fn().mockReturnValue('mock_token') })),
  createHash: jest.fn(() => ({ update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue('mock_hash') }))
}))

describe('Admin Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateCredentials', () => {
    test('should return admin account for valid credentials', async () => {
      const mockAdmin = {
        id: 'admin-123',
        username: 'admin',
        email: 'admin@test.com',
        password_hash: 'hashed_password',
        is_super_admin: false,
        is_active: true
      }

      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockAdmin,
        error: null
      })

      const result = await adminAuthService.validateCredentials('admin', 'password')
      
      expect(result).toEqual(mockAdmin)
      expect(mockSupabase.from).toHaveBeenCalledWith('admin_accounts')
    })

    test('should return null for invalid credentials', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' }
      })

      const result = await adminAuthService.validateCredentials('admin', 'wrong_password')
      
      expect(result).toBeNull()
    })

    test('should return null for inactive admin', async () => {
      const mockAdmin = {
        id: 'admin-123',
        username: 'admin',
        email: 'admin@test.com',
        password_hash: 'hashed_password',
        is_super_admin: false,
        is_active: false
      }

      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockAdmin,
        error: null
      })

      const result = await adminAuthService.validateCredentials('admin', 'password')
      
      expect(result).toBeNull()
    })
  })

  describe('validatePasswordStrength', () => {
    test('should return true for strong password', () => {
      const result = adminAuthService.validatePasswordStrength('StrongP@ssw0rd123')
      expect(result).toBe(true)
    })

    test('should return false for weak password', () => {
      const result = adminAuthService.validatePasswordStrength('weak')
      expect(result).toBe(false)
    })

    test('should return false for password without numbers', () => {
      const result = adminAuthService.validatePasswordStrength('NoNumbers!')
      expect(result).toBe(false)
    })

    test('should return false for password without special characters', () => {
      const result = adminAuthService.validatePasswordStrength('NoSpecial123')
      expect(result).toBe(false)
    })
  })
})

describe('Admin Session Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createSession', () => {
    test('should create new session successfully', async () => {
      const mockSession = {
        id: 'session-123',
        admin_id: 'admin-123',
        admin_username: 'admin',
        session_token: 'mock_token',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      }

      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockSession,
        error: null
      })

      const result = await adminSessionService.createSession(
        'admin-123',
        'admin',
        '192.168.1.1',
        'Mozilla/5.0'
      )
      
      expect(result).toEqual(mockSession)
      expect(mockSupabase.from).toHaveBeenCalledWith('admin_sessions')
    })

    test('should handle database error', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      await expect(adminSessionService.createSession(
        'admin-123',
        'admin',
        '192.168.1.1',
        'Mozilla/5.0'
      )).rejects.toThrow('Failed to create session')
    })
  })

  describe('validateSession', () => {
    test('should return session for valid token', async () => {
      const mockSession = {
        id: 'session-123',
        admin_id: 'admin-123',
        admin_username: 'admin',
        session_token: 'valid_token',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }

      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockSession,
        error: null
      })

      const result = await adminSessionService.validateSession('valid_token')
      
      expect(result).toEqual(mockSession)
    })

    test('should return null for invalid token', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' }
      })

      const result = await adminSessionService.validateSession('invalid_token')
      
      expect(result).toBeNull()
    })
  })

  describe('updateActivity', () => {
    test('should update session activity', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().update().eq().mockResolvedValue({
        error: null
      })

      await expect(adminSessionService.updateActivity(
        'session_token',
        '192.168.1.1',
        'Mozilla/5.0'
      )).resolves.not.toThrow()

      expect(mockSupabase.from).toHaveBeenCalledWith('admin_sessions')
    })
  })
})

describe('Store Monitoring Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getSystemHealth', () => {
    test('should return system health status', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      
      // Mock successful database query
      mockSupabase.from().select().limit().mockResolvedValue({
        data: [{ id: 1 }],
        error: null
      })

      const result = await storeMonitoringService.getSystemHealth()
      
      expect(result).toHaveProperty('database_status')
      expect(result).toHaveProperty('api_status')
      expect(result).toHaveProperty('storage_status')
      expect(result).toHaveProperty('overall_status')
      expect(result).toHaveProperty('last_check')
    })

    test('should detect database issues', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      
      // Mock database error
      mockSupabase.from().select().limit().mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      })

      const result = await storeMonitoringService.getSystemHealth()
      
      expect(result.database_status).toBe('down')
      expect(result.overall_status).toBe('down')
    })
  })

  describe('getSystemStats', () => {
    test('should return system statistics', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      
      // Mock statistics queries
      mockSupabase.from().select().single.mockResolvedValueOnce({
        data: { count: 5 },
        error: null
      }).mockResolvedValueOnce({
        data: { count: 3 },
        error: null
      }).mockResolvedValueOnce({
        data: { count: 10 },
        error: null
      }).mockResolvedValueOnce({
        data: { count: 8 },
        error: null
      }).mockResolvedValueOnce({
        data: { count: 100 },
        error: null
      }).mockResolvedValueOnce({
        data: { count: 25 },
        error: null
      })

      const result = await storeMonitoringService.getSystemStats()
      
      expect(result).toHaveProperty('total_stores')
      expect(result).toHaveProperty('active_stores')
      expect(result).toHaveProperty('total_qr_codes')
      expect(result).toHaveProperty('active_qr_codes')
      expect(result).toHaveProperty('total_verifications')
      expect(result).toHaveProperty('recent_verifications')
      expect(typeof result.total_stores).toBe('number')
    })
  })
})

describe('Audit Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('logAction', () => {
    test('should log action successfully', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().insert().mockResolvedValue({
        error: null
      })

      const actionData = {
        admin_id: 'admin-123',
        admin_username: 'admin',
        action_type: 'login',
        resource_type: 'authentication',
        resource_id: 'login',
        details: 'User logged in',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        success: true
      }

      await expect(auditService.logAction(actionData)).resolves.not.toThrow()
      
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs')
    })

    test('should handle logging errors gracefully', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().insert().mockResolvedValue({
        error: { message: 'Insert failed' }
      })

      const actionData = {
        admin_id: 'admin-123',
        admin_username: 'admin',
        action_type: 'login',
        resource_type: 'authentication',
        resource_id: 'login',
        details: 'User logged in',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        success: true
      }

      // Should not throw error, but log it
      await expect(auditService.logAction(actionData)).resolves.not.toThrow()
    })
  })

  describe('getAuditLogs', () => {
    test('should retrieve audit logs with pagination', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          admin_username: 'admin',
          action_type: 'login',
          resource_type: 'authentication',
          details: 'User logged in',
          created_at: new Date().toISOString(),
          success: true
        },
        {
          id: 'log-2',
          admin_username: 'admin',
          action_type: 'logout',
          resource_type: 'authentication',
          details: 'User logged out',
          created_at: new Date().toISOString(),
          success: true
        }
      ]

      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().select().order().limit().mockResolvedValue({
        data: mockLogs,
        error: null
      })

      const result = await auditService.getAuditLogs({ limit: 10 })
      
      expect(result).toEqual(mockLogs)
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs')
    })

    test('should filter logs by admin', async () => {
      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().select().eq().order().limit().mockResolvedValue({
        data: [],
        error: null
      })

      await auditService.getAuditLogs({ adminId: 'admin-123', limit: 10 })
      
      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('admin_id', 'admin-123')
    })
  })

  describe('getSecurityAlerts', () => {
    test('should retrieve security alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          type: 'login_failure',
          message: 'Multiple failed login attempts',
          severity: 'high',
          timestamp: new Date().toISOString(),
          resolved: false
        }
      ]

      const mockSupabase = require('../../src/config/database').supabase
      mockSupabase.from().select().order().limit().mockResolvedValue({
        data: mockAlerts,
        error: null
      })

      const result = await auditService.getSecurityAlerts({ limit: 10 })
      
      expect(result).toEqual(mockAlerts)
    })
  })
})