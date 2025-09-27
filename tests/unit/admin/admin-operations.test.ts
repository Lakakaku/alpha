import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { AdminOperations } from '../../../apps/admin/src/services/admin-operations';
import { AdminAccountModel, AuditLogModel, StoreModel } from '@vocilia/database';
import { AdminAccount, AuditLog, Store, AdminSession } from '@vocilia/types';
import { hash, compare } from 'bcryptjs';

// Mock dependencies
jest.mock('@vocilia/database');
jest.mock('bcryptjs');

const mockAdminAccountModel = AdminAccountModel as jest.Mocked<typeof AdminAccountModel>;
const mockAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;
const mockStoreModel = StoreModel as jest.Mocked<typeof StoreModel>;
const mockHash = hash as jest.MockedFunction<typeof hash>;
const mockCompare = compare as jest.MockedFunction<typeof compare>;

describe('AdminOperations', () => {
  let adminOperations: AdminOperations;
  
  const mockAdminAccount: AdminAccount = {
    id: 'admin-123',
    email: 'admin@vocilia.se',
    firstName: 'Anna',
    lastName: 'Andersson',
    role: 'admin',
    isActive: true,
    lastLoginAt: new Date('2024-01-15T10:30:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z')
  };

  const mockSession: AdminSession = {
    id: 'session-456',
    adminId: mockAdminAccount.id,
    token: 'session-token-abc',
    expiresAt: new Date(Date.now() + 7200000), // 2 hours
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    createdAt: new Date(),
    lastActivityAt: new Date()
  };

  beforeEach(() => {
    adminOperations = new AdminOperations();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('authenticateAdmin', () => {
    const credentials = {
      email: 'admin@vocilia.se',
      password: 'SecurePassword123!'
    };

    it('should successfully authenticate admin with correct credentials', async () => {
      mockAdminAccountModel.findByEmail.mockResolvedValue({
        ...mockAdminAccount,
        passwordHash: 'hashed-password'
      });
      mockCompare.mockResolvedValue(true);

      const result = await adminOperations.authenticateAdmin(credentials);

      expect(result.success).toBe(true);
      expect(result.admin).toEqual(mockAdminAccount);
      expect(mockCompare).toHaveBeenCalledWith(credentials.password, 'hashed-password');
    });

    it('should reject invalid email address', async () => {
      mockAdminAccountModel.findByEmail.mockResolvedValue(null);

      const result = await adminOperations.authenticateAdmin(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should reject incorrect password', async () => {
      mockAdminAccountModel.findByEmail.mockResolvedValue({
        ...mockAdminAccount,
        passwordHash: 'hashed-password'
      });
      mockCompare.mockResolvedValue(false);

      const result = await adminOperations.authenticateAdmin(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should reject inactive admin accounts', async () => {
      mockAdminAccountModel.findByEmail.mockResolvedValue({
        ...mockAdminAccount,
        passwordHash: 'hashed-password',
        isActive: false
      });
      mockCompare.mockResolvedValue(true);

      const result = await adminOperations.authenticateAdmin(credentials);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is deactivated');
    });

    it('should update last login timestamp on successful authentication', async () => {
      mockAdminAccountModel.findByEmail.mockResolvedValue({
        ...mockAdminAccount,
        passwordHash: 'hashed-password'
      });
      mockCompare.mockResolvedValue(true);
      mockAdminAccountModel.updateLastLogin.mockResolvedValue();

      await adminOperations.authenticateAdmin(credentials);

      expect(mockAdminAccountModel.updateLastLogin).toHaveBeenCalledWith(
        mockAdminAccount.id,
        expect.any(Date)
      );
    });
  });

  describe('createAdminSession', () => {
    const sessionData = {
      adminId: mockAdminAccount.id,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    };

    it('should create new admin session with secure token', async () => {
      mockAdminAccountModel.createSession.mockResolvedValue(mockSession);

      const result = await adminOperations.createAdminSession(sessionData);

      expect(result).toEqual(mockSession);
      expect(mockAdminAccountModel.createSession).toHaveBeenCalledWith({
        ...sessionData,
        token: expect.stringMatching(/^[a-f0-9]{64}$/), // 64-char hex token
        expiresAt: expect.any(Date)
      });
    });

    it('should set session expiration to 2 hours from creation', async () => {
      const beforeCall = Date.now();
      mockAdminAccountModel.createSession.mockResolvedValue(mockSession);

      await adminOperations.createAdminSession(sessionData);

      const createCall = mockAdminAccountModel.createSession.mock.calls[0][0];
      const expectedExpiration = beforeCall + 7200000; // 2 hours
      expect(createCall.expiresAt.getTime()).toBeCloseTo(expectedExpiration, -3);
    });

    it('should log session creation in audit trail', async () => {
      mockAdminAccountModel.createSession.mockResolvedValue(mockSession);
      mockAuditLogModel.create.mockResolvedValue({} as AuditLog);

      await adminOperations.createAdminSession(sessionData);

      expect(mockAuditLogModel.create).toHaveBeenCalledWith({
        adminId: sessionData.adminId,
        action: 'session_created',
        entityType: 'admin_session',
        entityId: mockSession.id,
        details: {
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent
        },
        ipAddress: sessionData.ipAddress
      });
    });
  });

  describe('validateSession', () => {
    it('should validate active session successfully', async () => {
      mockAdminAccountModel.findSession.mockResolvedValue(mockSession);
      mockAdminAccountModel.updateSessionActivity.mockResolvedValue();

      const result = await adminOperations.validateSession(mockSession.token);

      expect(result.valid).toBe(true);
      expect(result.session).toEqual(mockSession);
      expect(mockAdminAccountModel.updateSessionActivity).toHaveBeenCalledWith(
        mockSession.id,
        expect.any(Date)
      );
    });

    it('should reject non-existent session', async () => {
      mockAdminAccountModel.findSession.mockResolvedValue(null);

      const result = await adminOperations.validateSession('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should reject expired session', async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      };

      mockAdminAccountModel.findSession.mockResolvedValue(expiredSession);

      const result = await adminOperations.validateSession(mockSession.token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session has expired');
    });
  });

  describe('logAdminAction', () => {
    const actionData = {
      adminId: mockAdminAccount.id,
      action: 'store_created',
      entityType: 'store' as const,
      entityId: 'store-789',
      details: { name: 'New Store', location: 'Stockholm' },
      ipAddress: '192.168.1.100'
    };

    it('should create comprehensive audit log entry', async () => {
      const mockAuditLog: AuditLog = {
        id: 'audit-123',
        ...actionData,
        timestamp: new Date(),
        createdAt: new Date()
      };

      mockAuditLogModel.create.mockResolvedValue(mockAuditLog);

      const result = await adminOperations.logAdminAction(actionData);

      expect(result).toEqual(mockAuditLog);
      expect(mockAuditLogModel.create).toHaveBeenCalledWith({
        ...actionData,
        timestamp: expect.any(Date)
      });
    });

    it('should handle audit logging errors gracefully', async () => {
      mockAuditLogModel.create.mockRejectedValue(new Error('Database connection failed'));

      // Should not throw, but log error internally
      await expect(adminOperations.logAdminAction(actionData)).resolves.toBeUndefined();
    });
  });

  describe('getAdminPermissions', () => {
    it('should return super admin permissions for super admin role', async () => {
      const superAdmin = { ...mockAdminAccount, role: 'super_admin' };
      mockAdminAccountModel.findById.mockResolvedValue(superAdmin);

      const permissions = await adminOperations.getAdminPermissions(mockAdminAccount.id);

      expect(permissions).toEqual({
        canManageAdmins: true,
        canManageStores: true,
        canViewAuditLogs: true,
        canManagePayments: true,
        canAccessSystemSettings: true,
        canExportData: true,
        canManageCSVUploads: true
      });
    });

    it('should return limited permissions for regular admin role', async () => {
      mockAdminAccountModel.findById.mockResolvedValue(mockAdminAccount);

      const permissions = await adminOperations.getAdminPermissions(mockAdminAccount.id);

      expect(permissions).toEqual({
        canManageAdmins: false,
        canManageStores: true,
        canViewAuditLogs: true,
        canManagePayments: false,
        canAccessSystemSettings: false,
        canExportData: false,
        canManageCSVUploads: true
      });
    });

    it('should return no permissions for inactive admin', async () => {
      const inactiveAdmin = { ...mockAdminAccount, isActive: false };
      mockAdminAccountModel.findById.mockResolvedValue(inactiveAdmin);

      const permissions = await adminOperations.getAdminPermissions(mockAdminAccount.id);

      expect(permissions).toEqual({
        canManageAdmins: false,
        canManageStores: false,
        canViewAuditLogs: false,
        canManagePayments: false,
        canAccessSystemSettings: false,
        canExportData: false,
        canManageCSVUploads: false
      });
    });
  });

  describe('processCSVUpload', () => {
    const csvData = [
      { name: 'Store A', address: 'Kungsgatan 1, Stockholm', phone: '+46812345678' },
      { name: 'Store B', address: 'Götgatan 2, Göteborg', phone: '+46731234567' }
    ];

    it('should successfully process valid CSV data', async () => {
      mockStoreModel.batchCreate.mockResolvedValue({
        created: 2,
        failed: 0,
        errors: []
      });

      const result = await adminOperations.processCSVUpload(
        csvData,
        mockAdminAccount.id,
        '192.168.1.100'
      );

      expect(result.success).toBe(true);
      expect(result.summary).toEqual({
        totalRows: 2,
        successfulInserts: 2,
        failedInserts: 0,
        errors: []
      });
    });

    it('should validate required CSV fields', async () => {
      const invalidData = [
        { name: 'Store A' }, // Missing required fields
        { address: 'Some address' } // Missing required fields
      ];

      const result = await adminOperations.processCSVUpload(
        invalidData,
        mockAdminAccount.id,
        '192.168.1.100'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Row 1: Missing required field: address');
      expect(result.errors).toContain('Row 2: Missing required field: name');
    });

    it('should validate Swedish phone number format in CSV', async () => {
      const invalidPhoneData = [
        { name: 'Store A', address: 'Address 1', phone: '+1234567890' }
      ];

      const result = await adminOperations.processCSVUpload(
        invalidPhoneData,
        mockAdminAccount.id,
        '192.168.1.100'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Row 1: Invalid Swedish phone number format');
    });

    it('should log CSV upload activity', async () => {
      mockStoreModel.batchCreate.mockResolvedValue({
        created: 2,
        failed: 0,
        errors: []
      });
      mockAuditLogModel.create.mockResolvedValue({} as AuditLog);

      await adminOperations.processCSVUpload(
        csvData,
        mockAdminAccount.id,
        '192.168.1.100'
      );

      expect(mockAuditLogModel.create).toHaveBeenCalledWith({
        adminId: mockAdminAccount.id,
        action: 'csv_upload_processed',
        entityType: 'store',
        entityId: null,
        details: {
          totalRows: 2,
          successfulInserts: 2,
          failedInserts: 0
        },
        ipAddress: '192.168.1.100'
      });
    });
  });

  describe('revokeAdminSession', () => {
    it('should successfully revoke active session', async () => {
      mockAdminAccountModel.revokeSession.mockResolvedValue();
      mockAuditLogModel.create.mockResolvedValue({} as AuditLog);

      await adminOperations.revokeAdminSession(
        mockSession.token,
        mockAdminAccount.id,
        '192.168.1.100'
      );

      expect(mockAdminAccountModel.revokeSession).toHaveBeenCalledWith(mockSession.token);
      expect(mockAuditLogModel.create).toHaveBeenCalledWith({
        adminId: mockAdminAccount.id,
        action: 'session_revoked',
        entityType: 'admin_session',
        entityId: mockSession.token,
        details: { reason: 'manual_logout' },
        ipAddress: '192.168.1.100'
      });
    });
  });
});