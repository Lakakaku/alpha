import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type {
  Database,
  UserAccount,
  UserAccountInsert,
  UserAccountUpdate,
  UserRole,
  PaginationParams,
  PaginatedResponse,
  AuthContext
} from '../types/index.js';
import { formatDatabaseError, retryWithExponentialBackoff, dbLogger } from '../client/utils.js';

export class UserAccountQueries {
  constructor(private client: SupabaseClient<Database>) {}

  async create(data: UserAccountInsert, authContext?: AuthContext): Promise<UserAccount> {
    try {
      dbLogger.debug('Creating user account', { email: data.email, role: data.role });

      if (authContext?.role !== 'admin' && data.role === 'admin') {
        throw new Error('Only admin users can create admin accounts');
      }

      if (authContext?.business_id && data.business_id && authContext.business_id !== data.business_id) {
        throw new Error('Cannot create user for different business');
      }

      if (authContext?.role === 'business_owner' && data.role === 'business_owner') {
        const existingOwner = await this.findBusinessOwner(data.business_id!);
        if (existingOwner) {
          throw new Error('Business already has an owner');
        }
      }

      const { data: userAccount, error } = await this.client
        .from('user_accounts')
        .insert(data)
        .select()
        .single();

      if (error) {
        dbLogger.error('Failed to create user account', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('User account created successfully', { id: userAccount.id, email: userAccount.email });
      return userAccount;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to create user account');
    }
  }

  async findById(id: string, authContext?: AuthContext): Promise<UserAccount | null> {
    try {
      dbLogger.debug('Finding user account by ID', { id });

      const query = this.client
        .from('user_accounts')
        .select('*')
        .eq('id', id);

      if (authContext?.role !== 'admin') {
        if (authContext?.business_id) {
          query.eq('business_id', authContext.business_id);
        } else {
          query.eq('id', authContext?.user_id);
        }
      }

      const { data: userAccount, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          dbLogger.debug('User account not found', { id });
          return null;
        }
        dbLogger.error('Failed to find user account by ID', error);
        throw formatDatabaseError(error);
      }

      return userAccount;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find user account');
    }
  }

  async findByEmail(email: string, authContext?: AuthContext): Promise<UserAccount | null> {
    try {
      dbLogger.debug('Finding user account by email', { email });

      const query = this.client
        .from('user_accounts')
        .select('*')
        .eq('email', email);

      if (authContext?.role !== 'admin') {
        if (authContext?.business_id) {
          query.eq('business_id', authContext.business_id);
        } else {
          query.eq('id', authContext?.user_id);
        }
      }

      const { data: userAccount, error } = await query.maybeSingle();

      if (error) {
        dbLogger.error('Failed to find user account by email', error);
        throw formatDatabaseError(error);
      }

      return userAccount;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find user account by email');
    }
  }

  async findByBusinessId(
    businessId: string,
    pagination: PaginationParams = { page: 1, limit: 50 },
    authContext?: AuthContext
  ): Promise<PaginatedResponse<UserAccount>> {
    try {
      dbLogger.debug('Finding user accounts by business ID', { businessId });

      if (authContext?.role !== 'admin' && authContext?.business_id !== businessId) {
        throw new Error('Cannot access users for different business');
      }

      const { page, limit, order_by = 'created_at', order_direction = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      const query = this.client
        .from('user_accounts')
        .select('*', { count: 'exact' })
        .eq('business_id', businessId)
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);

      const { data: userAccounts, error, count } = await query;

      if (error) {
        dbLogger.error('Failed to find user accounts by business ID', error);
        throw formatDatabaseError(error);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: userAccounts || [],
        pagination: {
          page,
          limit,
          total_count: totalCount,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_previous: page > 1
        }
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find user accounts by business ID');
    }
  }

  async findBusinessOwner(businessId: string, authContext?: AuthContext): Promise<UserAccount | null> {
    try {
      dbLogger.debug('Finding business owner', { businessId });

      if (authContext?.role !== 'admin' && authContext?.business_id !== businessId) {
        throw new Error('Cannot access business owner for different business');
      }

      const { data: userAccount, error } = await this.client
        .from('user_accounts')
        .select('*')
        .eq('business_id', businessId)
        .eq('role', 'business_owner')
        .maybeSingle();

      if (error) {
        dbLogger.error('Failed to find business owner', error);
        throw formatDatabaseError(error);
      }

      return userAccount;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find business owner');
    }
  }

  async findByRole(
    role: UserRole,
    businessId?: string,
    pagination: PaginationParams = { page: 1, limit: 50 },
    authContext?: AuthContext
  ): Promise<PaginatedResponse<UserAccount>> {
    try {
      dbLogger.debug('Finding user accounts by role', { role, businessId });

      if (authContext?.role !== 'admin') {
        if (!businessId || authContext?.business_id !== businessId) {
          throw new Error('Insufficient permissions to query users by role');
        }
      }

      const { page, limit, order_by = 'created_at', order_direction = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      let query = this.client
        .from('user_accounts')
        .select('*', { count: 'exact' })
        .eq('role', role);

      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      query = query
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);

      const { data: userAccounts, error, count } = await query;

      if (error) {
        dbLogger.error('Failed to find user accounts by role', error);
        throw formatDatabaseError(error);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: userAccounts || [],
        pagination: {
          page,
          limit,
          total_count: totalCount,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_previous: page > 1
        }
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find user accounts by role');
    }
  }

  async update(id: string, data: UserAccountUpdate, authContext?: AuthContext): Promise<UserAccount> {
    try {
      dbLogger.debug('Updating user account', { id, fields: Object.keys(data) });

      if (authContext?.role !== 'admin' && authContext?.user_id !== id) {
        if (!authContext?.business_id) {
          throw new Error('Insufficient permissions to update user account');
        }

        const targetUser = await this.findById(id, authContext);
        if (!targetUser || targetUser.business_id !== authContext.business_id) {
          throw new Error('Cannot update user from different business');
        }

        if (data.role === 'admin' || targetUser.role === 'business_owner') {
          throw new Error('Insufficient permissions to modify this user');
        }
      }

      if (data.role === 'admin' && authContext?.role !== 'admin') {
        throw new Error('Only admin users can assign admin role');
      }

      const query = this.client
        .from('user_accounts')
        .update(data)
        .eq('id', id);

      if (authContext?.role !== 'admin') {
        if (authContext?.business_id) {
          query.eq('business_id', authContext.business_id);
        } else {
          query.eq('id', authContext?.user_id);
        }
      }

      const { data: userAccount, error } = await query.select().single();

      if (error) {
        dbLogger.error('Failed to update user account', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('User account updated successfully', { id, email: userAccount.email });
      return userAccount;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update user account');
    }
  }

  async delete(id: string, authContext?: AuthContext): Promise<void> {
    try {
      dbLogger.debug('Deleting user account', { id });

      if (authContext?.user_id === id) {
        throw new Error('Cannot delete your own account');
      }

      const targetUser = await this.findById(id, authContext);
      if (!targetUser) {
        throw new Error('User account not found');
      }

      if (targetUser.role === 'business_owner' && authContext?.role !== 'admin') {
        throw new Error('Only admin can delete business owner accounts');
      }

      if (authContext?.role !== 'admin') {
        if (!authContext?.business_id || targetUser.business_id !== authContext.business_id) {
          throw new Error('Cannot delete user from different business');
        }
      }

      const query = this.client
        .from('user_accounts')
        .delete()
        .eq('id', id);

      if (authContext?.role !== 'admin') {
        query.eq('business_id', authContext?.business_id);
      }

      const { error } = await query;

      if (error) {
        dbLogger.error('Failed to delete user account', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('User account deleted successfully', { id });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to delete user account');
    }
  }

  async updateLastLogin(id: string, timestamp?: string): Promise<UserAccount> {
    try {
      const loginTime = timestamp || new Date().toISOString();

      const { data: userAccount, error } = await this.client
        .from('user_accounts')
        .update({ last_login: loginTime })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        dbLogger.error('Failed to update last login', error);
        throw formatDatabaseError(error);
      }

      return userAccount;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update last login');
    }
  }

  async updatePermissions(
    id: string,
    permissions: Record<string, any>,
    authContext?: AuthContext
  ): Promise<UserAccount> {
    try {
      if (authContext?.role !== 'admin' && authContext?.role !== 'business_owner') {
        throw new Error('Insufficient permissions to update user permissions');
      }

      const userAccount = await this.findById(id, authContext);
      if (!userAccount) {
        throw new Error('User account not found');
      }

      const mergedPermissions = {
        ...userAccount.permissions,
        ...permissions
      };

      return await this.update(id, { permissions: mergedPermissions }, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update user permissions');
    }
  }

  async exists(id: string, authContext?: AuthContext): Promise<boolean> {
    try {
      const userAccount = await this.findById(id, authContext);
      return userAccount !== null;
    } catch {
      return false;
    }
  }

  async count(businessId?: string, role?: UserRole, authContext?: AuthContext): Promise<number> {
    try {
      let query = this.client
        .from('user_accounts')
        .select('*', { count: 'exact', head: true });

      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      if (role) {
        query = query.eq('role', role);
      }

      if (authContext?.role !== 'admin') {
        if (authContext?.business_id) {
          query = query.eq('business_id', authContext.business_id);
        } else {
          return 1;
        }
      }

      const { count, error } = await query;

      if (error) {
        throw formatDatabaseError(error);
      }

      return count || 0;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to count user accounts');
    }
  }

  async validateUserAccess(userId: string, authContext: AuthContext): Promise<boolean> {
    try {
      if (authContext.role === 'admin') {
        return true;
      }

      if (authContext.user_id === userId) {
        return true;
      }

      if (authContext.business_id) {
        const user = await this.findById(userId, authContext);
        return user !== null && user.business_id === authContext.business_id;
      }

      return false;
    } catch {
      return false;
    }
  }

  async isBusinessOwner(userId: string, businessId: string): Promise<boolean> {
    try {
      const { data: userAccount, error } = await this.client
        .from('user_accounts')
        .select('role')
        .eq('id', userId)
        .eq('business_id', businessId)
        .eq('role', 'business_owner')
        .maybeSingle();

      return !error && userAccount !== null;
    } catch {
      return false;
    }
  }

  async hasPermission(userId: string, permission: string, authContext?: AuthContext): Promise<boolean> {
    try {
      const userAccount = await this.findById(userId, authContext);
      if (!userAccount) {
        return false;
      }

      if (userAccount.role === 'admin') {
        return true;
      }

      return userAccount.permissions?.[permission] === true;
    } catch {
      return false;
    }
  }
}

export function createUserAccountQueries(client: SupabaseClient<Database>): UserAccountQueries {
  return new UserAccountQueries(client);
}