import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { 
  createAuthClient, 
  createServiceClient,
  generateSecureToken,
  validateTokenFormat,
  hashPassword,
  verifyPassword 
} from '../../../packages/auth/src/clients';
import {
  useAuth,
  useUser,
  usePermissions
} from '../../../packages/auth/src/hooks';
import {
  requireAuth,
  requireRole,
  requirePermission
} from '../../../packages/auth/src/guards';
import {
  checkPermission,
  getUserPermissions,
  hasRole
} from '../../../packages/auth/src/permissions';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn()
      }))
    }))
  }))
} as unknown as SupabaseClient;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

describe('Auth Clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  describe('createAuthClient', () => {
    it('should create a Supabase client with correct configuration', () => {
      const client = createAuthClient();
      expect(client).toBeDefined();
    });

    it('should throw error when environment variables are missing', () => {
      delete process.env.SUPABASE_URL;
      expect(() => createAuthClient()).toThrow('Missing required environment variables');
    });
  });

  describe('createServiceClient', () => {
    it('should create a service client with service role key', () => {
      const client = createServiceClient();
      expect(client).toBeDefined();
    });

    it('should throw error when service role key is missing', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(() => createServiceClient()).toThrow('Missing service role key');
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a token of default length', () => {
      const token = generateSecureToken();
      expect(token).toHaveLength(32);
      expect(typeof token).toBe('string');
    });

    it('should generate a token of specified length', () => {
      const token = generateSecureToken(64);
      expect(token).toHaveLength(64);
    });

    it('should generate different tokens on each call', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateTokenFormat', () => {
    it('should validate correct JWT format', () => {
      const validJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      expect(validateTokenFormat(validJWT)).toBe(true);
    });

    it('should reject invalid token formats', () => {
      expect(validateTokenFormat('invalid-token')).toBe(false);
      expect(validateTokenFormat('')).toBe(false);
      expect(validateTokenFormat('header.payload')).toBe(false);
      expect(validateTokenFormat('header.payload.signature.extra')).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(password.length);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });
  });
});

describe('Auth Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAuth', () => {
    it('should return auth state and methods', () => {
      const { user, loading, signIn, signOut, signUp } = useAuth();
      
      expect(user).toBeDefined();
      expect(typeof loading).toBe('boolean');
      expect(typeof signIn).toBe('function');
      expect(typeof signOut).toBe('function');
      expect(typeof signUp).toBe('function');
    });
  });

  describe('useUser', () => {
    it('should return user data and loading state', () => {
      const { user, loading, error, refetch } = useUser();
      
      expect(user).toBeDefined();
      expect(typeof loading).toBe('boolean');
      expect(error).toBeDefined();
      expect(typeof refetch).toBe('function');
    });
  });

  describe('usePermissions', () => {
    it('should return permissions data', () => {
      const { permissions, loading, hasPermission } = usePermissions();
      
      expect(permissions).toBeDefined();
      expect(typeof loading).toBe('boolean');
      expect(typeof hasPermission).toBe('function');
    });
  });
});

describe('Auth Guards', () => {
  const mockRequest = {
    headers: {},
    user: null
  } as any;

  const mockResponse = {
    status: vi.fn(() => mockResponse),
    json: vi.fn(() => mockResponse),
    redirect: vi.fn()
  } as any;

  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should allow authenticated users', () => {
      const authenticatedRequest = {
        ...mockRequest,
        user: { id: '123', email: 'test@example.com' }
      };

      requireAuth(authenticatedRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated users', () => {
      requireAuth(mockRequest, mockResponse, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow users with correct role', () => {
      const businessUserRequest = {
        ...mockRequest,
        user: { id: '123', role: 'business_account' }
      };

      const roleGuard = requireRole('business_account');
      roleGuard(businessUserRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject users with incorrect role', () => {
      const businessUserRequest = {
        ...mockRequest,
        user: { id: '123', role: 'business_account' }
      };

      const roleGuard = requireRole('admin_account');
      roleGuard(businessUserRequest, mockResponse, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should reject unauthenticated users', () => {
      const roleGuard = requireRole('business_account');
      roleGuard(mockRequest, mockResponse, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requirePermission', () => {
    it('should allow users with correct permission', async () => {
      const userRequest = {
        ...mockRequest,
        user: { id: '123', permissions: ['read:businesses'] }
      };

      const permissionGuard = requirePermission('read:businesses');
      await permissionGuard(userRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject users without permission', async () => {
      const userRequest = {
        ...mockRequest,
        user: { id: '123', permissions: ['read:stores'] }
      };

      const permissionGuard = requirePermission('write:businesses');
      await permissionGuard(userRequest, mockResponse, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });
});

describe('Permission Utilities', () => {
  const mockUser = {
    id: '123',
    role: 'business_account',
    permissions: ['read:businesses', 'write:stores', 'read:stores']
  };

  describe('checkPermission', () => {
    it('should return true for existing permission', () => {
      expect(checkPermission(mockUser, 'read:businesses')).toBe(true);
    });

    it('should return false for non-existing permission', () => {
      expect(checkPermission(mockUser, 'delete:businesses')).toBe(false);
    });

    it('should handle user without permissions array', () => {
      const userWithoutPermissions = { ...mockUser, permissions: undefined };
      expect(checkPermission(userWithoutPermissions, 'read:businesses')).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions array', async () => {
      // Mock the database call
      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({
            data: [
              { permission: { name: 'read:businesses' } },
              { permission: { name: 'write:stores' } }
            ],
            error: null
          }))
        }))
      }));

      const permissions = await getUserPermissions('123');
      expect(permissions).toEqual(['read:businesses', 'write:stores']);
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Database error' }
          }))
        }))
      }));

      const permissions = await getUserPermissions('123');
      expect(permissions).toEqual([]);
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      expect(hasRole(mockUser, 'business_account')).toBe(true);
    });

    it('should return false for non-matching role', () => {
      expect(hasRole(mockUser, 'admin_account')).toBe(false);
    });

    it('should handle user without role', () => {
      const userWithoutRole = { ...mockUser, role: undefined };
      expect(hasRole(userWithoutRole, 'business_account')).toBe(false);
    });
  });
});