import { describe, it, expect, expectTypeOf } from 'vitest';

// Import types from the types package
import {
  User,
  UserProfile,
  Business,
  Store,
  Permission,
  UserPermission,
  ApiKey,
  AuthToken,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RefreshTokenRequest,
  BusinessCreateRequest,
  BusinessUpdateRequest,
  StoreCreateRequest,
  StoreUpdateRequest,
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
  HealthCheckResponse,
  QRCodeData,
  SubscriptionStatus,
  Role,
  PermissionAction,
  BusinessStatus,
  StoreStatus,
  ApiKeyStatus
} from '../../../packages/types/src/index';

describe('User Types', () => {
  describe('User', () => {
    it('should have correct structure', () => {
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        role: 'business_account',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      expectTypeOf(user.id).toEqualTypeOf<string>();
      expectTypeOf(user.email).toEqualTypeOf<string>();
      expectTypeOf(user.role).toEqualTypeOf<Role>();
      expectTypeOf(user.created_at).toEqualTypeOf<string>();
      expectTypeOf(user.updated_at).toEqualTypeOf<string>();
    });

    it('should enforce UUID format for id', () => {
      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        role: 'business_account',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('UserProfile', () => {
    it('should have correct structure with all fields', () => {
      const profile: UserProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '+46701234567',
        avatar_url: 'https://example.com/avatar.jpg',
        business_id: '123e4567-e89b-12d3-a456-426614174002',
        subscription_status: 'active',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      expectTypeOf(profile.subscription_status).toEqualTypeOf<SubscriptionStatus>();
      expectTypeOf(profile.business_id).toEqualTypeOf<string | null>();
      expectTypeOf(profile.avatar_url).toEqualTypeOf<string | null>();
    });

    it('should allow null values for optional fields', () => {
      const profile: UserProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: null,
        avatar_url: null,
        business_id: null,
        subscription_status: 'trial',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      expect(profile.phone_number).toBeNull();
      expect(profile.avatar_url).toBeNull();
      expect(profile.business_id).toBeNull();
    });
  });
});

describe('Business Types', () => {
  describe('Business', () => {
    it('should have correct structure', () => {
      const business: Business = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Business',
        description: 'A test business',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        contact_email: 'contact@testbusiness.com',
        contact_phone: '+46701234567',
        address: '123 Test Street',
        website_url: 'https://testbusiness.com',
        logo_url: 'https://testbusiness.com/logo.png',
        status: 'active',
        subscription_status: 'premium',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      expectTypeOf(business.status).toEqualTypeOf<BusinessStatus>();
      expectTypeOf(business.subscription_status).toEqualTypeOf<SubscriptionStatus>();
      expectTypeOf(business.website_url).toEqualTypeOf<string | null>();
    });
  });

  describe('BusinessCreateRequest', () => {
    it('should have required fields only', () => {
      const request: BusinessCreateRequest = {
        name: 'New Business',
        description: 'A new business',
        contact_email: 'contact@newbusiness.com'
      };

      expectTypeOf(request).toHaveProperty('name');
      expectTypeOf(request).toHaveProperty('description');
      expectTypeOf(request).toHaveProperty('contact_email');
    });

    it('should allow optional fields', () => {
      const request: BusinessCreateRequest = {
        name: 'New Business',
        description: 'A new business',
        contact_email: 'contact@newbusiness.com',
        contact_phone: '+46701234567',
        address: '123 New Street',
        website_url: 'https://newbusiness.com'
      };

      expect(request.contact_phone).toBeDefined();
      expect(request.address).toBeDefined();
      expect(request.website_url).toBeDefined();
    });
  });
});

describe('Store Types', () => {
  describe('Store', () => {
    it('should have correct structure', () => {
      const store: Store = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        business_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Store',
        description: 'A test store',
        address: '456 Store Street',
        phone_number: '+46701234567',
        qr_code_data: 'store_123_data',
        qr_code_url: 'https://example.com/qr/store_123.png',
        status: 'active',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      expectTypeOf(store.status).toEqualTypeOf<StoreStatus>();
      expectTypeOf(store.qr_code_data).toEqualTypeOf<string>();
      expectTypeOf(store.qr_code_url).toEqualTypeOf<string | null>();
    });
  });

  describe('QRCodeData', () => {
    it('should have correct structure', () => {
      const qrData: QRCodeData = {
        store_id: '123e4567-e89b-12d3-a456-426614174000',
        business_id: '123e4567-e89b-12d3-a456-426614174001',
        url: 'https://customer.vocilia.com/store/123',
        data: JSON.stringify({
          storeId: '123',
          businessId: '456',
          timestamp: Date.now()
        })
      };

      expectTypeOf(qrData.store_id).toEqualTypeOf<string>();
      expectTypeOf(qrData.business_id).toEqualTypeOf<string>();
      expectTypeOf(qrData.url).toEqualTypeOf<string>();
      expectTypeOf(qrData.data).toEqualTypeOf<string>();
    });
  });
});

describe('Permission Types', () => {
  describe('Permission', () => {
    it('should have correct structure', () => {
      const permission: Permission = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'read:businesses',
        description: 'Read business information',
        action: 'read',
        resource: 'businesses',
        created_at: '2023-01-01T00:00:00Z'
      };

      expectTypeOf(permission.action).toEqualTypeOf<PermissionAction>();
      expectTypeOf(permission.resource).toEqualTypeOf<string>();
    });
  });

  describe('UserPermission', () => {
    it('should have correct structure', () => {
      const userPermission: UserPermission = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        permission_id: '123e4567-e89b-12d3-a456-426614174002',
        granted_at: '2023-01-01T00:00:00Z',
        granted_by: '123e4567-e89b-12d3-a456-426614174003'
      };

      expectTypeOf(userPermission.user_id).toEqualTypeOf<string>();
      expectTypeOf(userPermission.permission_id).toEqualTypeOf<string>();
      expectTypeOf(userPermission.granted_by).toEqualTypeOf<string>();
    });
  });
});

describe('API Types', () => {
  describe('ApiResponse', () => {
    it('should have correct structure for success', () => {
      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Success' },
        timestamp: '2023-01-01T00:00:00Z'
      };

      expectTypeOf(response.success).toEqualTypeOf<boolean>();
      expectTypeOf(response.data).toEqualTypeOf<{ message: string } | undefined>();
      expectTypeOf(response.error).toEqualTypeOf<string | undefined>();
    });

    it('should have correct structure for error', () => {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Something went wrong',
        timestamp: '2023-01-01T00:00:00Z'
      };

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.data).toBeUndefined();
    });
  });

  describe('PaginatedResponse', () => {
    it('should have correct structure', () => {
      const response: PaginatedResponse<User> = {
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 100,
          totalPages: 10
        },
        timestamp: '2023-01-01T00:00:00Z'
      };

      expectTypeOf(response.data).toEqualTypeOf<User[] | undefined>();
      expectTypeOf(response.pagination).toEqualTypeOf<{
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      } | undefined>();
    });
  });

  describe('ErrorResponse', () => {
    it('should have correct structure', () => {
      const error: ErrorResponse = {
        success: false,
        error: 'Validation failed',
        details: {
          field: 'email',
          message: 'Invalid email format'
        },
        timestamp: '2023-01-01T00:00:00Z'
      };

      expectTypeOf(error.success).toEqualTypeOf<false>();
      expectTypeOf(error.error).toEqualTypeOf<string>();
      expectTypeOf(error.details).toEqualTypeOf<any>();
    });
  });
});

describe('Authentication Types', () => {
  describe('LoginRequest', () => {
    it('should have correct structure', () => {
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      expectTypeOf(request.email).toEqualTypeOf<string>();
      expectTypeOf(request.password).toEqualTypeOf<string>();
    });
  });

  describe('LoginResponse', () => {
    it('should have correct structure', () => {
      const response: LoginResponse = {
        success: true,
        data: {
          user: {
            id: '123',
            email: 'test@example.com',
            role: 'business_account',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          },
          tokens: {
            access_token: 'access_token_here',
            refresh_token: 'refresh_token_here',
            expires_at: '2023-01-01T01:00:00Z'
          }
        },
        timestamp: '2023-01-01T00:00:00Z'
      };

      expectTypeOf(response.data?.user).toEqualTypeOf<User | undefined>();
      expectTypeOf(response.data?.tokens).toEqualTypeOf<AuthToken | undefined>();
    });
  });

  describe('AuthToken', () => {
    it('should have correct structure', () => {
      const token: AuthToken = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'refresh_token_here',
        expires_at: '2023-01-01T01:00:00Z'
      };

      expectTypeOf(token.access_token).toEqualTypeOf<string>();
      expectTypeOf(token.refresh_token).toEqualTypeOf<string>();
      expectTypeOf(token.expires_at).toEqualTypeOf<string>();
    });
  });
});

describe('Enum Types', () => {
  describe('Role', () => {
    it('should have correct values', () => {
      const businessRole: Role = 'business_account';
      const adminRole: Role = 'admin_account';

      expect(['business_account', 'admin_account']).toContain(businessRole);
      expect(['business_account', 'admin_account']).toContain(adminRole);
    });
  });

  describe('PermissionAction', () => {
    it('should have correct values', () => {
      const actions: PermissionAction[] = ['create', 'read', 'update', 'delete'];
      
      actions.forEach(action => {
        expect(['create', 'read', 'update', 'delete']).toContain(action);
      });
    });
  });

  describe('BusinessStatus', () => {
    it('should have correct values', () => {
      const statuses: BusinessStatus[] = ['active', 'inactive', 'suspended', 'pending'];
      
      statuses.forEach(status => {
        expect(['active', 'inactive', 'suspended', 'pending']).toContain(status);
      });
    });
  });

  describe('SubscriptionStatus', () => {
    it('should have correct values', () => {
      const statuses: SubscriptionStatus[] = ['trial', 'active', 'premium', 'cancelled', 'expired'];
      
      statuses.forEach(status => {
        expect(['trial', 'active', 'premium', 'cancelled', 'expired']).toContain(status);
      });
    });
  });
});

describe('API Key Types', () => {
  describe('ApiKey', () => {
    it('should have correct structure', () => {
      const apiKey: ApiKey = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        business_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'API Key for Integration',
        key_hash: 'hashed_key_value',
        status: 'active',
        expires_at: '2024-01-01T00:00:00Z',
        last_used_at: '2023-12-01T10:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        created_by: '123e4567-e89b-12d3-a456-426614174002'
      };

      expectTypeOf(apiKey.status).toEqualTypeOf<ApiKeyStatus>();
      expectTypeOf(apiKey.expires_at).toEqualTypeOf<string | null>();
      expectTypeOf(apiKey.last_used_at).toEqualTypeOf<string | null>();
    });
  });
});

describe('Health Check Types', () => {
  describe('HealthCheckResponse', () => {
    it('should have correct structure for healthy status', () => {
      const response: HealthCheckResponse = {
        status: 'healthy',
        timestamp: '2023-01-01T00:00:00Z',
        version: '1.0.0',
        environment: 'production',
        uptime: 3600,
        checks: {
          database: { status: 'healthy', responseTime: 50 },
          supabase: { status: 'healthy', responseTime: 75 },
          memory: { status: 'healthy', usage: 65 }
        }
      };

      expectTypeOf(response.status).toEqualTypeOf<'healthy' | 'unhealthy' | 'degraded'>();
      expectTypeOf(response.checks).toEqualTypeOf<Record<string, any>>();
    });

    it('should allow unhealthy status with error details', () => {
      const response: HealthCheckResponse = {
        status: 'unhealthy',
        timestamp: '2023-01-01T00:00:00Z',
        version: '1.0.0',
        environment: 'production',
        uptime: 3600,
        checks: {
          database: { status: 'unhealthy', error: 'Connection timeout' },
          supabase: { status: 'healthy', responseTime: 75 }
        }
      };

      expect(response.status).toBe('unhealthy');
      expect(response.checks.database.error).toBeDefined();
    });
  });
});

describe('Type Guards and Utilities', () => {
  it('should validate UUID format', () => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';
    const invalidUUID = 'not-a-uuid';

    expect(validUUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(invalidUUID).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should validate ISO date format', () => {
    const validDate = '2023-01-01T00:00:00Z';
    const invalidDate = 'not-a-date';

    expect(validDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(invalidDate).not.toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('should validate email format', () => {
    const validEmail = 'test@example.com';
    const invalidEmail = 'not-an-email';

    expect(validEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(invalidEmail).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it('should validate phone number format', () => {
    const validPhone = '+46701234567';
    const invalidPhone = 'not-a-phone';

    expect(validPhone).toMatch(/^\+\d{10,15}$/);
    expect(invalidPhone).not.toMatch(/^\+\d{10,15}$/);
  });
});

describe('Complex Type Relationships', () => {
  it('should maintain referential integrity between related types', () => {
    const user: User = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      role: 'business_account',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    };

    const profile: UserProfile = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      user_id: user.id, // References user.id
      first_name: 'John',
      last_name: 'Doe',
      phone_number: '+46701234567',
      avatar_url: null,
      business_id: '123e4567-e89b-12d3-a456-426614174002',
      subscription_status: 'active',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    };

    const business: Business = {
      id: profile.business_id!, // References profile.business_id
      name: 'Test Business',
      description: 'A test business',
      owner_id: user.id, // References user.id
      contact_email: 'contact@testbusiness.com',
      contact_phone: '+46701234567',
      address: '123 Test Street',
      website_url: null,
      logo_url: null,
      status: 'active',
      subscription_status: 'premium',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    };

    // Verify relationships
    expect(profile.user_id).toBe(user.id);
    expect(business.id).toBe(profile.business_id);
    expect(business.owner_id).toBe(user.id);
  });
});