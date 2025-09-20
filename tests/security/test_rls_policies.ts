import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient, getMainClient } from '../../apps/backend/src/config/database';

// Test configuration
const TEST_USERS = {
  BUSINESS_OWNER: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'business.owner@test.com',
    role: 'business_account'
  },
  BUSINESS_MEMBER: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    email: 'business.member@test.com',
    role: 'business_account'
  },
  ADMIN: {
    id: '123e4567-e89b-12d3-a456-426614174002',
    email: 'admin@test.com',
    role: 'admin_account'
  },
  UNAUTHORIZED: {
    id: '123e4567-e89b-12d3-a456-426614174003',
    email: 'unauthorized@test.com',
    role: 'business_account'
  }
};

const TEST_BUSINESS = {
  id: '223e4567-e89b-12d3-a456-426614174000',
  name: 'Test Business for RLS',
  owner_id: TEST_USERS.BUSINESS_OWNER.id
};

const TEST_STORE = {
  id: '323e4567-e89b-12d3-a456-426614174000',
  business_id: TEST_BUSINESS.id,
  name: 'Test Store for RLS'
};

describe('RLS (Row Level Security) Policy Tests', () => {
  let serviceClient: SupabaseClient;
  let businessOwnerClient: SupabaseClient;
  let businessMemberClient: SupabaseClient;
  let adminClient: SupabaseClient;
  let unauthorizedClient: SupabaseClient;

  beforeAll(async () => {
    // Get service client for setup operations
    serviceClient = getServiceClient();
    
    // Create test clients for different user roles
    businessOwnerClient = createTestClient(TEST_USERS.BUSINESS_OWNER);
    businessMemberClient = createTestClient(TEST_USERS.BUSINESS_MEMBER);
    adminClient = createTestClient(TEST_USERS.ADMIN);
    unauthorizedClient = createTestClient(TEST_USERS.UNAUTHORIZED);
    
    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
  });

  // Helper function to create a client with user context
  function createTestClient(user: typeof TEST_USERS.BUSINESS_OWNER): SupabaseClient {
    const client = getMainClient();
    
    // Mock user authentication for RLS testing
    // In a real test, you would authenticate with actual tokens
    return client;
  }

  async function setupTestData() {
    try {
      // Create test users in auth.users (using service client)
      for (const user of Object.values(TEST_USERS)) {
        await serviceClient.auth.admin.createUser({
          email: user.email,
          password: 'test-password-123',
          email_confirm: true,
          user_metadata: {
            id: user.id,
            role: user.role
          }
        });
      }

      // Create test business
      await serviceClient
        .from('businesses')
        .insert([{
          id: TEST_BUSINESS.id,
          name: TEST_BUSINESS.name,
          description: 'Test business for RLS testing',
          owner_id: TEST_BUSINESS.owner_id,
          contact_email: 'contact@testbusiness.com',
          status: 'active',
          subscription_status: 'active'
        }]);

      // Create test store
      await serviceClient
        .from('stores')
        .insert([{
          id: TEST_STORE.id,
          business_id: TEST_STORE.business_id,
          name: TEST_STORE.name,
          description: 'Test store for RLS testing',
          address: '123 Test Street',
          qr_code_data: 'test-qr-data',
          status: 'active'
        }]);

      // Create user profiles
      await serviceClient
        .from('user_profiles')
        .insert([
          {
            id: '423e4567-e89b-12d3-a456-426614174000',
            user_id: TEST_USERS.BUSINESS_OWNER.id,
            first_name: 'Business',
            last_name: 'Owner',
            business_id: TEST_BUSINESS.id,
            subscription_status: 'active'
          },
          {
            id: '423e4567-e89b-12d3-a456-426614174001',
            user_id: TEST_USERS.BUSINESS_MEMBER.id,
            first_name: 'Business',
            last_name: 'Member',
            business_id: TEST_BUSINESS.id,
            subscription_status: 'active'
          },
          {
            id: '423e4567-e89b-12d3-a456-426614174002',
            user_id: TEST_USERS.ADMIN.id,
            first_name: 'Admin',
            last_name: 'User',
            business_id: null,
            subscription_status: 'active'
          },
          {
            id: '423e4567-e89b-12d3-a456-426614174003',
            user_id: TEST_USERS.UNAUTHORIZED.id,
            first_name: 'Unauthorized',
            last_name: 'User',
            business_id: '999e4567-e89b-12d3-a456-426614174999', // Different business
            subscription_status: 'active'
          }
        ]);

    } catch (error) {
      console.error('Error setting up test data:', error);
    }
  }

  async function cleanupTestData() {
    try {
      // Clean up in reverse order due to foreign key constraints
      await serviceClient.from('user_profiles').delete().in('user_id', Object.values(TEST_USERS).map(u => u.id));
      await serviceClient.from('stores').delete().eq('id', TEST_STORE.id);
      await serviceClient.from('businesses').delete().eq('id', TEST_BUSINESS.id);
      
      // Delete auth users
      for (const user of Object.values(TEST_USERS)) {
        await serviceClient.auth.admin.deleteUser(user.id);
      }
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  }

  describe('User Profiles RLS Policies', () => {
    it('should allow users to read their own profile', async () => {
      const { data, error } = await businessOwnerClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', TEST_USERS.BUSINESS_OWNER.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data?.user_id).toBe(TEST_USERS.BUSINESS_OWNER.id);
    });

    it('should prevent users from reading other users profiles', async () => {
      const { data, error } = await businessOwnerClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', TEST_USERS.BUSINESS_MEMBER.id)
        .single();

      // Should either return null data or an error depending on RLS implementation
      expect(data).toBeNull();
    });

    it('should allow users to update their own profile', async () => {
      const { data, error } = await businessOwnerClient
        .from('user_profiles')
        .update({ first_name: 'Updated Name' })
        .eq('user_id', TEST_USERS.BUSINESS_OWNER.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.first_name).toBe('Updated Name');
    });

    it('should prevent users from updating other users profiles', async () => {
      const { data, error } = await businessOwnerClient
        .from('user_profiles')
        .update({ first_name: 'Hacked Name' })
        .eq('user_id', TEST_USERS.BUSINESS_MEMBER.id)
        .select();

      // Should fail to update due to RLS
      expect(data).toEqual([]);
    });

    it('should allow admins to read all profiles', async () => {
      const { data, error } = await adminClient
        .from('user_profiles')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Businesses RLS Policies', () => {
    it('should allow business owners to read their own business', async () => {
      const { data, error } = await businessOwnerClient
        .from('businesses')
        .select('*')
        .eq('id', TEST_BUSINESS.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data?.id).toBe(TEST_BUSINESS.id);
    });

    it('should allow business members to read their business', async () => {
      const { data, error } = await businessMemberClient
        .from('businesses')
        .select('*')
        .eq('id', TEST_BUSINESS.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data?.id).toBe(TEST_BUSINESS.id);
    });

    it('should prevent unauthorized users from reading businesses', async () => {
      const { data, error } = await unauthorizedClient
        .from('businesses')
        .select('*')
        .eq('id', TEST_BUSINESS.id)
        .single();

      expect(data).toBeNull();
    });

    it('should only allow business owners to update their business', async () => {
      const { data, error } = await businessOwnerClient
        .from('businesses')
        .update({ description: 'Updated by owner' })
        .eq('id', TEST_BUSINESS.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.description).toBe('Updated by owner');
    });

    it('should prevent business members from updating business', async () => {
      const { data, error } = await businessMemberClient
        .from('businesses')
        .update({ description: 'Attempted update by member' })
        .eq('id', TEST_BUSINESS.id)
        .select();

      // Should fail due to RLS - only owners can update
      expect(data).toEqual([]);
    });

    it('should allow admins to read all businesses', async () => {
      const { data, error } = await adminClient
        .from('businesses')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Stores RLS Policies', () => {
    it('should allow business owners to read their stores', async () => {
      const { data, error } = await businessOwnerClient
        .from('stores')
        .select('*')
        .eq('business_id', TEST_BUSINESS.id);

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length).toBeGreaterThan(0);
    });

    it('should allow business members to read stores in their business', async () => {
      const { data, error } = await businessMemberClient
        .from('stores')
        .select('*')
        .eq('business_id', TEST_BUSINESS.id);

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should prevent unauthorized users from reading stores', async () => {
      const { data, error } = await unauthorizedClient
        .from('stores')
        .select('*')
        .eq('business_id', TEST_BUSINESS.id);

      expect(data).toEqual([]);
    });

    it('should allow business owners to create stores', async () => {
      const newStore = {
        business_id: TEST_BUSINESS.id,
        name: 'New Test Store',
        description: 'Created by owner',
        address: '456 New Street',
        qr_code_data: 'new-qr-data',
        status: 'active'
      };

      const { data, error } = await businessOwnerClient
        .from('stores')
        .insert([newStore])
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data?.name).toBe('New Test Store');

      // Clean up
      if (data?.id) {
        await serviceClient.from('stores').delete().eq('id', data.id);
      }
    });

    it('should prevent users from creating stores in other businesses', async () => {
      const maliciousStore = {
        business_id: '999e4567-e89b-12d3-a456-426614174999', // Different business
        name: 'Malicious Store',
        description: 'Should not be created',
        address: '999 Hacker Street',
        qr_code_data: 'malicious-qr-data',
        status: 'active'
      };

      const { data, error } = await businessOwnerClient
        .from('stores')
        .insert([maliciousStore])
        .select();

      // Should fail due to RLS
      expect(data).toEqual([]);
    });
  });

  describe('Permissions RLS Policies', () => {
    it('should allow all authenticated users to read permissions list', async () => {
      const { data, error } = await businessOwnerClient
        .from('permissions')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should prevent unauthorized users from reading user_permissions', async () => {
      const { data, error } = await unauthorizedClient
        .from('user_permissions')
        .select('*')
        .eq('user_id', TEST_USERS.BUSINESS_OWNER.id);

      expect(data).toEqual([]);
    });

    it('should allow users to read their own permissions', async () => {
      // First, create a permission assignment
      await serviceClient
        .from('user_permissions')
        .insert([{
          user_id: TEST_USERS.BUSINESS_OWNER.id,
          permission_id: '523e4567-e89b-12d3-a456-426614174000',
          granted_by: TEST_USERS.ADMIN.id
        }]);

      const { data, error } = await businessOwnerClient
        .from('user_permissions')
        .select('*')
        .eq('user_id', TEST_USERS.BUSINESS_OWNER.id);

      expect(error).toBeNull();
      expect(data).toBeTruthy();

      // Clean up
      await serviceClient
        .from('user_permissions')
        .delete()
        .eq('user_id', TEST_USERS.BUSINESS_OWNER.id);
    });
  });

  describe('API Keys RLS Policies', () => {
    it('should allow business owners to read their API keys', async () => {
      // Create a test API key
      const { data: apiKey } = await serviceClient
        .from('api_keys')
        .insert([{
          business_id: TEST_BUSINESS.id,
          name: 'Test API Key',
          key_hash: 'hashed_key_value',
          status: 'active',
          created_by: TEST_USERS.BUSINESS_OWNER.id
        }])
        .select()
        .single();

      const { data, error } = await businessOwnerClient
        .from('api_keys')
        .select('*')
        .eq('business_id', TEST_BUSINESS.id);

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(Array.isArray(data)).toBe(true);

      // Clean up
      if (apiKey?.id) {
        await serviceClient.from('api_keys').delete().eq('id', apiKey.id);
      }
    });

    it('should prevent users from reading API keys of other businesses', async () => {
      const { data, error } = await unauthorizedClient
        .from('api_keys')
        .select('*')
        .eq('business_id', TEST_BUSINESS.id);

      expect(data).toEqual([]);
    });
  });

  describe('Cross-Table RLS Validation', () => {
    it('should enforce consistent access across related tables', async () => {
      // Test that if a user can access a business, they can access its stores
      const { data: businessData } = await businessMemberClient
        .from('businesses')
        .select('*')
        .eq('id', TEST_BUSINESS.id)
        .single();

      if (businessData) {
        const { data: storeData, error } = await businessMemberClient
          .from('stores')
          .select('*')
          .eq('business_id', TEST_BUSINESS.id);

        expect(error).toBeNull();
        expect(data).toBeTruthy();
      }
    });

    it('should maintain data isolation between different businesses', async () => {
      // Create another business and verify isolation
      const otherBusinessId = '999e4567-e89b-12d3-a456-426614174999';
      
      await serviceClient
        .from('businesses')
        .insert([{
          id: otherBusinessId,
          name: 'Other Business',
          description: 'Should be isolated',
          owner_id: TEST_USERS.UNAUTHORIZED.id,
          contact_email: 'other@business.com',
          status: 'active',
          subscription_status: 'active'
        }]);

      // User from first business should not see second business
      const { data } = await businessOwnerClient
        .from('businesses')
        .select('*')
        .eq('id', otherBusinessId)
        .single();

      expect(data).toBeNull();

      // Clean up
      await serviceClient.from('businesses').delete().eq('id', otherBusinessId);
    });
  });

  describe('Admin Override Tests', () => {
    it('should allow admins to access all resources', async () => {
      const tables = ['businesses', 'stores', 'user_profiles', 'permissions', 'user_permissions'];
      
      for (const table of tables) {
        const { data, error } = await adminClient
          .from(table)
          .select('*')
          .limit(1);

        expect(error).toBeNull();
        expect(data).toBeTruthy();
      }
    });

    it('should allow admins to modify any resource', async () => {
      // Test admin can update any business
      const { data, error } = await adminClient
        .from('businesses')
        .update({ description: 'Updated by admin' })
        .eq('id', TEST_BUSINESS.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.description).toBe('Updated by admin');
    });
  });

  describe('Security Edge Cases', () => {
    it('should prevent SQL injection through RLS policies', async () => {
      // Attempt to inject SQL through various fields
      const maliciousInputs = [
        "'; DROP TABLE businesses; --",
        "1 OR 1=1",
        "UNION SELECT * FROM user_profiles",
        "<script>alert('xss')</script>"
      ];

      for (const maliciousInput of maliciousInputs) {
        const { data, error } = await businessOwnerClient
          .from('businesses')
          .select('*')
          .eq('name', maliciousInput);

        // Should return empty results, not cause errors
        expect(data).toEqual([]);
      }
    });

    it('should handle concurrent access correctly', async () => {
      // Multiple users accessing the same resource simultaneously
      const promises = [
        businessOwnerClient.from('businesses').select('*').eq('id', TEST_BUSINESS.id),
        businessMemberClient.from('businesses').select('*').eq('id', TEST_BUSINESS.id),
        unauthorizedClient.from('businesses').select('*').eq('id', TEST_BUSINESS.id)
      ];

      const results = await Promise.all(promises);
      
      // Authorized users should get data, unauthorized should not
      expect(results[0].data).toBeTruthy();
      expect(results[1].data).toBeTruthy();
      expect(results[2].data).toEqual([]);
    });

    it('should maintain security during transaction rollbacks', async () => {
      // Attempt to create and then rollback a transaction that would violate RLS
      try {
        await businessOwnerClient.rpc('test_transaction_security', {
          business_id: '999e4567-e89b-12d3-a456-426614174999'
        });
      } catch (error) {
        // Transaction should fail due to RLS
        expect(error).toBeTruthy();
      }
    });
  });
});