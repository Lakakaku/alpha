import { SupabaseClient, User } from '@supabase/supabase-js';
import type {
  Database,
  AuthContext,
  RLSContext,
  UserRole,
  UserAccount
} from '../types/index.js';
import { createUserAccountQueries } from '../queries/user-account.js';
import { dbLogger } from '../client/utils.js';

export interface JWTClaims {
  sub: string;
  email?: string;
  role?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  aud?: string;
  exp?: number;
  iat?: number;
  iss?: string;
}

export interface AuthTokenValidation {
  isValid: boolean;
  user?: User;
  claims?: JWTClaims;
  error?: string;
}

export class AuthHelper {
  private userAccountQueries: ReturnType<typeof createUserAccountQueries>;

  constructor(private client: SupabaseClient<Database>) {
    this.userAccountQueries = createUserAccountQueries(client);
  }

  async extractJWTClaims(token: string): Promise<JWTClaims | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      const claims: JWTClaims = JSON.parse(decoded);

      return claims;
    } catch (error) {
      dbLogger.error('Failed to extract JWT claims', error);
      return null;
    }
  }

  async validateAuthToken(token?: string): Promise<AuthTokenValidation> {
    try {
      if (!token) {
        return {
          isValid: false,
          error: 'No authentication token provided'
        };
      }

      const { data, error } = await this.client.auth.getUser(token);

      if (error) {
        dbLogger.warn('Token validation failed', error);
        return {
          isValid: false,
          error: error.message
        };
      }

      if (!data.user) {
        return {
          isValid: false,
          error: 'Invalid user token'
        };
      }

      const claims = await this.extractJWTClaims(token);

      return {
        isValid: true,
        user: data.user,
        claims: claims || undefined
      };
    } catch (error) {
      dbLogger.error('Error validating auth token', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  async createAuthContext(user: User): Promise<AuthContext> {
    try {
      dbLogger.debug('Creating auth context for user', { userId: user.id, email: user.email });

      const userAccount = await this.userAccountQueries.findByEmail(user.email || '');

      if (!userAccount) {
        throw new Error('User account not found in database');
      }

      const permissions = this.extractPermissions(userAccount);

      const authContext: AuthContext = {
        user_id: userAccount.id,
        business_id: userAccount.business_id,
        role: userAccount.role,
        permissions,
        email: userAccount.email
      };

      dbLogger.debug('Auth context created', {
        userId: authContext.user_id,
        businessId: authContext.business_id,
        role: authContext.role
      });

      return authContext;
    } catch (error) {
      dbLogger.error('Failed to create auth context', error);
      throw new Error('Failed to create authentication context');
    }
  }

  async createRLSContext(authContext: AuthContext): Promise<RLSContext> {
    const rlsContext: RLSContext = {
      business_id: authContext.business_id,
      role: authContext.role,
      user_id: authContext.user_id
    };

    return rlsContext;
  }

  async setRLSContext(authContext: AuthContext): Promise<void> {
    try {
      dbLogger.debug('Setting RLS context', {
        userId: authContext.user_id,
        businessId: authContext.business_id,
        role: authContext.role
      });

      const { error: userIdError } = await this.client.rpc('set_current_user_id', {
        user_id: authContext.user_id
      });

      if (userIdError && !userIdError.message.includes('function does not exist')) {
        dbLogger.warn('Failed to set current user ID in RLS context', userIdError);
      }

      if (authContext.business_id) {
        const { error: businessIdError } = await this.client.rpc('set_current_business_id', {
          business_id: authContext.business_id
        });

        if (businessIdError && !businessIdError.message.includes('function does not exist')) {
          dbLogger.warn('Failed to set current business ID in RLS context', businessIdError);
        }
      }

      const { error: roleError } = await this.client.rpc('set_current_user_role', {
        user_role: authContext.role
      });

      if (roleError && !roleError.message.includes('function does not exist')) {
        dbLogger.warn('Failed to set current user role in RLS context', roleError);
      }

    } catch (error) {
      dbLogger.warn('Error setting RLS context (functions may not exist in schema)', error);
    }
  }

  async clearRLSContext(): Promise<void> {
    try {
      dbLogger.debug('Clearing RLS context');

      await this.client.rpc('clear_current_user_context');
    } catch (error) {
      dbLogger.warn('Error clearing RLS context (function may not exist in schema)', error);
    }
  }

  async requireAuth(token?: string): Promise<AuthContext> {
    const validation = await this.validateAuthToken(token);

    if (!validation.isValid || !validation.user) {
      throw new Error(validation.error || 'Authentication required');
    }

    return await this.createAuthContext(validation.user);
  }

  async requireRole(authContext: AuthContext, allowedRoles: UserRole[]): Promise<void> {
    if (!allowedRoles.includes(authContext.role)) {
      throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
    }
  }

  async requireBusinessAccess(authContext: AuthContext, businessId: string): Promise<void> {
    if (authContext.role === 'admin') {
      return;
    }

    if (authContext.business_id !== businessId) {
      throw new Error('Access denied. Cannot access resources from different business');
    }
  }

  async requirePermission(authContext: AuthContext, permission: string): Promise<void> {
    if (authContext.role === 'admin') {
      return;
    }

    if (!authContext.permissions.includes(permission)) {
      throw new Error(`Access denied. Required permission: ${permission}`);
    }
  }

  hasPermission(authContext: AuthContext, permission: string): boolean {
    if (authContext.role === 'admin') {
      return true;
    }

    return authContext.permissions.includes(permission);
  }

  canAccessBusiness(authContext: AuthContext, businessId: string): boolean {
    if (authContext.role === 'admin') {
      return true;
    }

    return authContext.business_id === businessId;
  }

  canAccessStore(authContext: AuthContext, storeBelongsToBusiness: string): boolean {
    if (authContext.role === 'admin') {
      return true;
    }

    return authContext.business_id === storeBelongsToBusiness;
  }

  isAdmin(authContext: AuthContext): boolean {
    return authContext.role === 'admin';
  }

  isBusinessOwner(authContext: AuthContext): boolean {
    return authContext.role === 'business_owner';
  }

  isBusinessStaff(authContext: AuthContext): boolean {
    return authContext.role === 'business_staff';
  }

  async refreshUserAccount(authContext: AuthContext): Promise<AuthContext> {
    try {
      const userAccount = await this.userAccountQueries.findById(authContext.user_id);

      if (!userAccount) {
        throw new Error('User account not found');
      }

      await this.userAccountQueries.updateLastLogin(authContext.user_id);

      return {
        ...authContext,
        business_id: userAccount.business_id,
        role: userAccount.role,
        permissions: this.extractPermissions(userAccount),
        email: userAccount.email
      };
    } catch (error) {
      dbLogger.error('Failed to refresh user account', error);
      throw new Error('Failed to refresh user account');
    }
  }

  private extractPermissions(userAccount: UserAccount): string[] {
    const permissions: string[] = [];

    if (userAccount.role === 'admin') {
      return [
        'read:all',
        'write:all',
        'delete:all',
        'manage:users',
        'manage:businesses',
        'manage:system'
      ];
    }

    if (userAccount.role === 'business_owner') {
      permissions.push(
        'read:business',
        'write:business',
        'manage:stores',
        'manage:staff',
        'read:feedback',
        'read:analytics',
        'manage:verification'
      );
    }

    if (userAccount.role === 'business_staff') {
      permissions.push(
        'read:business',
        'read:stores',
        'read:feedback',
        'write:feedback'
      );
    }

    if (userAccount.permissions && typeof userAccount.permissions === 'object') {
      Object.entries(userAccount.permissions).forEach(([key, value]) => {
        if (value === true && !permissions.includes(key)) {
          permissions.push(key);
        }
      });
    }

    return permissions;
  }

  async createSystemAuthContext(): Promise<AuthContext> {
    return {
      user_id: 'system',
      business_id: null,
      role: 'admin',
      permissions: ['read:all', 'write:all', 'delete:all', 'manage:system'],
      email: 'system@alpha.internal'
    };
  }

  async validateBusinessOwnership(authContext: AuthContext, businessId: string): Promise<boolean> {
    try {
      if (authContext.role === 'admin') {
        return true;
      }

      if (authContext.role !== 'business_owner') {
        return false;
      }

      return authContext.business_id === businessId;
    } catch {
      return false;
    }
  }

  async extractAuthFromRequest(request: {
    headers: Record<string, string>;
  }): Promise<AuthContext | null> {
    try {
      const authHeader = request.headers.authorization || request.headers.Authorization;

      if (!authHeader) {
        return null;
      }

      const token = authHeader.replace(/^Bearer\s+/i, '');
      const validation = await this.validateAuthToken(token);

      if (!validation.isValid || !validation.user) {
        return null;
      }

      return await this.createAuthContext(validation.user);
    } catch (error) {
      dbLogger.warn('Failed to extract auth from request', error);
      return null;
    }
  }

  async withAuth<T>(
    token: string | undefined,
    operation: (authContext: AuthContext) => Promise<T>
  ): Promise<T> {
    const authContext = await this.requireAuth(token);
    await this.setRLSContext(authContext);

    try {
      return await operation(authContext);
    } finally {
      await this.clearRLSContext();
    }
  }

  async withOptionalAuth<T>(
    token: string | undefined,
    operation: (authContext?: AuthContext) => Promise<T>
  ): Promise<T> {
    try {
      const validation = await this.validateAuthToken(token);

      if (validation.isValid && validation.user) {
        const authContext = await this.createAuthContext(validation.user);
        await this.setRLSContext(authContext);

        try {
          return await operation(authContext);
        } finally {
          await this.clearRLSContext();
        }
      } else {
        return await operation();
      }
    } catch (error) {
      dbLogger.warn('Error in optional auth operation', error);
      return await operation();
    }
  }
}

export function createAuthHelper(client: SupabaseClient<Database>): AuthHelper {
  return new AuthHelper(client);
}