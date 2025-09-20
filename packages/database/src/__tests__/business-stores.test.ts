import { createClient } from '@supabase/supabase-js';
import {
  BusinessStoreService,
  StorePermissions,
  BusinessStoreRelation,
  PermissionLevel
} from '../business-stores';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          maybeSingle: jest.fn()
        })),
        in: jest.fn(() => ({
          eq: jest.fn()
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          and: jest.fn()
        }))
      })),
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }))
}));

describe('BusinessStoreService', () => {
  let service: BusinessStoreService;
  let mockSupabase: any;

  const sampleBusinessAccount = {
    id: 'business-123',
    user_id: 'user-123',
    business_name: 'Test Business',
    verification_status: 'approved'
  };

  const sampleStore = {
    id: 'store-123',
    name: 'Test Store',
    address: 'Test Address',
    business_id: 'business-123'
  };

  const samplePermissions: StorePermissions = {
    read_feedback: true,
    write_context: true,
    manage_qr: false,
    view_analytics: true,
    admin: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient('', '');
    service = new BusinessStoreService();
  });

  describe('Permission validation', () => {
    describe('validatePermissions', () => {
      it('should accept valid permission objects', () => {
        const validPermissions = [
          { read_feedback: true, write_context: false, manage_qr: true, view_analytics: false, admin: false },
          { read_feedback: false, write_context: false, manage_qr: false, view_analytics: false, admin: true },
          samplePermissions
        ];

        validPermissions.forEach(permissions => {
          expect(() => service.validatePermissions(permissions)).not.toThrow();
        });
      });

      it('should reject invalid permission objects', () => {
        const invalidPermissions = [
          { read_feedback: 'true' }, // String instead of boolean
          { invalid_permission: true }, // Invalid permission key
          { read_feedback: true, admin: 'yes' }, // Mixed types
          null,
          undefined,
          {}
        ];

        invalidPermissions.forEach(permissions => {
          expect(() => service.validatePermissions(permissions as any)).toThrow();
        });
      });

      it('should require all permission fields', () => {
        const incompletePermissions = [
          { read_feedback: true }, // Missing other fields
          { read_feedback: true, write_context: true }, // Still incomplete
          { admin: true } // Only admin field
        ];

        incompletePermissions.forEach(permissions => {
          expect(() => service.validatePermissions(permissions as any)).toThrow();
        });
      });
    });

    describe('hasPermission', () => {
      it('should correctly check individual permissions', () => {
        expect(service.hasPermission(samplePermissions, 'read_feedback')).toBe(true);
        expect(service.hasPermission(samplePermissions, 'write_context')).toBe(true);
        expect(service.hasPermission(samplePermissions, 'manage_qr')).toBe(false);
        expect(service.hasPermission(samplePermissions, 'view_analytics')).toBe(true);
        expect(service.hasPermission(samplePermissions, 'admin')).toBe(false);
      });

      it('should return false for invalid permission keys', () => {
        expect(service.hasPermission(samplePermissions, 'invalid_permission' as any)).toBe(false);
      });

      it('should handle admin permissions correctly', () => {
        const adminPermissions: StorePermissions = {
          read_feedback: false,
          write_context: false,
          manage_qr: false,
          view_analytics: false,
          admin: true
        };

        // Admin should have access to everything
        expect(service.hasPermission(adminPermissions, 'read_feedback')).toBe(true);
        expect(service.hasPermission(adminPermissions, 'write_context')).toBe(true);
        expect(service.hasPermission(adminPermissions, 'manage_qr')).toBe(true);
        expect(service.hasPermission(adminPermissions, 'view_analytics')).toBe(true);
        expect(service.hasPermission(adminPermissions, 'admin')).toBe(true);
      });
    });

    describe('getPermissionLevel', () => {
      it('should correctly determine permission levels', () => {
        const testCases = [
          {
            permissions: { read_feedback: false, write_context: false, manage_qr: false, view_analytics: false, admin: false },
            expected: 'none' as PermissionLevel
          },
          {
            permissions: { read_feedback: true, write_context: false, manage_qr: false, view_analytics: false, admin: false },
            expected: 'read' as PermissionLevel
          },
          {
            permissions: { read_feedback: true, write_context: true, manage_qr: false, view_analytics: true, admin: false },
            expected: 'write' as PermissionLevel
          },
          {
            permissions: { read_feedback: true, write_context: true, manage_qr: true, view_analytics: true, admin: false },
            expected: 'manage' as PermissionLevel
          },
          {
            permissions: { read_feedback: false, write_context: false, manage_qr: false, view_analytics: false, admin: true },
            expected: 'admin' as PermissionLevel
          }
        ];

        testCases.forEach(({ permissions, expected }) => {
          expect(service.getPermissionLevel(permissions)).toBe(expected);
        });
      });
    });
  });

  describe('Business-Store relationship management', () => {
    describe('createBusinessStoreRelation', () => {
      it('should create a new business-store relationship successfully', async () => {
        const mockRelation = {
          id: 'relation-123',
          business_account_id: sampleBusinessAccount.id,
          store_id: sampleStore.id,
          permissions: samplePermissions,
          created_at: new Date().toISOString()
        };

        mockSupabase.from().insert().select().single.mockResolvedValue({
          data: mockRelation,
          error: null
        });

        const result = await service.createBusinessStoreRelation(
          sampleBusinessAccount.id,
          sampleStore.id,
          samplePermissions
        );

        expect(result.success).toBe(true);
        expect(result.relation).toEqual(mockRelation);
        expect(result.error).toBeUndefined();
      });

      it('should handle creation errors', async () => {
        mockSupabase.from().insert().select().single.mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        });

        const result = await service.createBusinessStoreRelation(
          sampleBusinessAccount.id,
          sampleStore.id,
          samplePermissions
        );

        expect(result.success).toBe(false);
        expect(result.relation).toBeUndefined();
        expect(result.error).toContain('Database error');
      });

      it('should validate permissions before creating relation', async () => {
        const invalidPermissions = { read_feedback: 'true' } as any;

        const result = await service.createBusinessStoreRelation(
          sampleBusinessAccount.id,
          sampleStore.id,
          invalidPermissions
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid permissions');
      });
    });

    describe('updateStorePermissions', () => {
      it('should update store permissions successfully', async () => {
        const updatedPermissions: StorePermissions = {
          ...samplePermissions,
          manage_qr: true,
          admin: true
        };

        const mockUpdatedRelation = {
          id: 'relation-123',
          business_account_id: sampleBusinessAccount.id,
          store_id: sampleStore.id,
          permissions: updatedPermissions,
          updated_at: new Date().toISOString()
        };

        mockSupabase.from().update().eq().select().single.mockResolvedValue({
          data: mockUpdatedRelation,
          error: null
        });

        const result = await service.updateStorePermissions(
          sampleBusinessAccount.id,
          sampleStore.id,
          updatedPermissions
        );

        expect(result.success).toBe(true);
        expect(result.relation).toEqual(mockUpdatedRelation);
        expect(result.relation!.permissions.manage_qr).toBe(true);
        expect(result.relation!.permissions.admin).toBe(true);
      });

      it('should handle update errors', async () => {
        mockSupabase.from().update().eq().select().single.mockResolvedValue({
          data: null,
          error: { message: 'Relation not found' }
        });

        const result = await service.updateStorePermissions(
          sampleBusinessAccount.id,
          sampleStore.id,
          samplePermissions
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Relation not found');
      });
    });

    describe('removeBusinessStoreRelation', () => {
      it('should remove business-store relationship successfully', async () => {
        mockSupabase.from().delete().eq().and.mockResolvedValue({
          error: null,
          count: 1
        });

        const result = await service.removeBusinessStoreRelation(
          sampleBusinessAccount.id,
          sampleStore.id
        );

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should handle removal errors', async () => {
        mockSupabase.from().delete().eq().and.mockResolvedValue({
          error: { message: 'Deletion failed' },
          count: 0
        });

        const result = await service.removeBusinessStoreRelation(
          sampleBusinessAccount.id,
          sampleStore.id
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Deletion failed');
      });
    });
  });

  describe('Permission queries', () => {
    describe('getBusinessStorePermissions', () => {
      it('should retrieve permissions for a business-store relationship', async () => {
        const mockRelation = {
          business_account_id: sampleBusinessAccount.id,
          store_id: sampleStore.id,
          permissions: samplePermissions
        };

        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: mockRelation,
          error: null
        });

        const result = await service.getBusinessStorePermissions(
          sampleBusinessAccount.id,
          sampleStore.id
        );

        expect(result.success).toBe(true);
        expect(result.permissions).toEqual(samplePermissions);
      });

      it('should handle non-existent relationships', async () => {
        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' } // Not found
        });

        const result = await service.getBusinessStorePermissions(
          'non-existent-business',
          'non-existent-store'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Relationship not found');
      });
    });

    describe('getStoresForBusiness', () => {
      it('should retrieve all stores accessible to a business', async () => {
        const mockStores = [
          {
            store_id: 'store-1',
            permissions: samplePermissions,
            stores: { id: 'store-1', name: 'Store 1', address: 'Address 1' }
          },
          {
            store_id: 'store-2',
            permissions: { ...samplePermissions, admin: true },
            stores: { id: 'store-2', name: 'Store 2', address: 'Address 2' }
          }
        ];

        mockSupabase.from().select().eq.mockResolvedValue({
          data: mockStores,
          error: null
        });

        const result = await service.getStoresForBusiness(sampleBusinessAccount.id);

        expect(result.success).toBe(true);
        expect(result.stores).toHaveLength(2);
        expect(result.stores![0].store.name).toBe('Store 1');
        expect(result.stores![1].permissions.admin).toBe(true);
      });

      it('should handle empty store lists', async () => {
        mockSupabase.from().select().eq.mockResolvedValue({
          data: [],
          error: null
        });

        const result = await service.getStoresForBusiness(sampleBusinessAccount.id);

        expect(result.success).toBe(true);
        expect(result.stores).toHaveLength(0);
      });
    });

    describe('getBusinessesForStore', () => {
      it('should retrieve all businesses with access to a store', async () => {
        const mockBusinesses = [
          {
            business_account_id: 'business-1',
            permissions: samplePermissions,
            business_accounts: { id: 'business-1', business_name: 'Business 1' }
          },
          {
            business_account_id: 'business-2',
            permissions: { ...samplePermissions, admin: true },
            business_accounts: { id: 'business-2', business_name: 'Business 2' }
          }
        ];

        mockSupabase.from().select().eq.mockResolvedValue({
          data: mockBusinesses,
          error: null
        });

        const result = await service.getBusinessesForStore(sampleStore.id);

        expect(result.success).toBe(true);
        expect(result.businesses).toHaveLength(2);
        expect(result.businesses![0].business.business_name).toBe('Business 1');
        expect(result.businesses![1].permissions.admin).toBe(true);
      });
    });
  });

  describe('Bulk operations', () => {
    describe('bulkUpdatePermissions', () => {
      it('should update permissions for multiple business-store relationships', async () => {
        const updates = [
          {
            businessAccountId: 'business-1',
            storeId: 'store-1',
            permissions: { ...samplePermissions, admin: true }
          },
          {
            businessAccountId: 'business-2',
            storeId: 'store-2',
            permissions: { ...samplePermissions, manage_qr: true }
          }
        ];

        // Mock successful updates
        mockSupabase.from().update().eq().select().single
          .mockResolvedValueOnce({ data: { id: 'relation-1' }, error: null })
          .mockResolvedValueOnce({ data: { id: 'relation-2' }, error: null });

        const result = await service.bulkUpdatePermissions(updates);

        expect(result.successful).toHaveLength(2);
        expect(result.failed).toHaveLength(0);
        expect(result.successful).toEqual(['business-1:store-1', 'business-2:store-2']);
      });

      it('should handle partial failures in bulk updates', async () => {
        const updates = [
          {
            businessAccountId: 'business-1',
            storeId: 'store-1',
            permissions: samplePermissions
          },
          {
            businessAccountId: 'business-2',
            storeId: 'store-2',
            permissions: samplePermissions
          }
        ];

        // Mock one success and one failure
        mockSupabase.from().update().eq().select().single
          .mockResolvedValueOnce({ data: { id: 'relation-1' }, error: null })
          .mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } });

        const result = await service.bulkUpdatePermissions(updates);

        expect(result.successful).toHaveLength(1);
        expect(result.failed).toHaveLength(1);
        expect(result.successful[0]).toBe('business-1:store-1');
        expect(result.failed[0]).toEqual({
          relationId: 'business-2:store-2',
          error: 'Update failed'
        });
      });
    });
  });

  describe('Permission inheritance and hierarchy', () => {
    describe('checkPermissionHierarchy', () => {
      it('should respect admin permission hierarchy', () => {
        const adminPermissions: StorePermissions = {
          read_feedback: false,
          write_context: false,
          manage_qr: false,
          view_analytics: false,
          admin: true
        };

        // Admin should override all other permissions
        expect(service.hasPermission(adminPermissions, 'read_feedback')).toBe(true);
        expect(service.hasPermission(adminPermissions, 'write_context')).toBe(true);
        expect(service.hasPermission(adminPermissions, 'manage_qr')).toBe(true);
        expect(service.hasPermission(adminPermissions, 'view_analytics')).toBe(true);
      });

      it('should handle permission dependencies correctly', () => {
        // Write context should require read feedback
        const writeOnlyPermissions: StorePermissions = {
          read_feedback: false,
          write_context: true,
          manage_qr: false,
          view_analytics: false,
          admin: false
        };

        // This should be considered invalid in a real system
        expect(service.validatePermissionDependencies(writeOnlyPermissions)).toBe(false);

        // Valid permission set
        const validPermissions: StorePermissions = {
          read_feedback: true,
          write_context: true,
          manage_qr: false,
          view_analytics: true,
          admin: false
        };

        expect(service.validatePermissionDependencies(validPermissions)).toBe(true);
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle database connection errors', async () => {
      mockSupabase.from().select().eq().single.mockRejectedValue(new Error('Connection failed'));

      const result = await service.getBusinessStorePermissions(
        sampleBusinessAccount.id,
        sampleStore.id
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });

    it('should handle invalid UUIDs', async () => {
      const result = await service.createBusinessStoreRelation(
        'invalid-uuid',
        'another-invalid-uuid',
        samplePermissions
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid UUID format');
    });

    it('should handle null/undefined inputs gracefully', async () => {
      const result = await service.getBusinessStorePermissions(null as any, undefined as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });
  });

  describe('Permission utility functions', () => {
    describe('isValidPermissionKey', () => {
      it('should validate permission keys correctly', () => {
        const validKeys = ['read_feedback', 'write_context', 'manage_qr', 'view_analytics', 'admin'];
        const invalidKeys = ['invalid_permission', 'read', 'write', 'delete', ''];

        validKeys.forEach(key => {
          expect(service.isValidPermissionKey(key)).toBe(true);
        });

        invalidKeys.forEach(key => {
          expect(service.isValidPermissionKey(key)).toBe(false);
        });
      });
    });

    describe('getDefaultPermissions', () => {
      it('should return appropriate default permissions for different roles', () => {
        const ownerDefaults = service.getDefaultPermissions('owner');
        expect(ownerDefaults.admin).toBe(true);

        const managerDefaults = service.getDefaultPermissions('manager');
        expect(managerDefaults.admin).toBe(false);
        expect(managerDefaults.manage_qr).toBe(true);

        const employeeDefaults = service.getDefaultPermissions('employee');
        expect(employeeDefaults.read_feedback).toBe(true);
        expect(employeeDefaults.write_context).toBe(false);
      });
    });
  });
});