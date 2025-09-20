import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type {
  Database,
  Business,
  BusinessInsert,
  BusinessUpdate,
  BusinessFilters,
  BusinessWithStores,
  BusinessWithUsers,
  PaginationParams,
  PaginatedResponse,
  AuthContext
} from '../types/index.js';
import { formatDatabaseError, retryWithExponentialBackoff, dbLogger } from '../client/utils.js';

export class BusinessQueries {
  constructor(private client: SupabaseClient<Database>) {}

  async create(data: BusinessInsert, authContext?: AuthContext): Promise<Business> {
    try {
      dbLogger.debug('Creating business', { name: data.name, email: data.email });

      const { data: business, error } = await this.client
        .from('businesses')
        .insert(data)
        .select()
        .single();

      if (error) {
        dbLogger.error('Failed to create business', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Business created successfully', { id: business.id, name: business.name });
      return business;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to create business');
    }
  }

  async findById(id: string, authContext?: AuthContext): Promise<Business | null> {
    try {
      dbLogger.debug('Finding business by ID', { id });

      const query = this.client
        .from('businesses')
        .select('*')
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('id', authContext.business_id);
      }

      const { data: business, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          dbLogger.debug('Business not found', { id });
          return null;
        }
        dbLogger.error('Failed to find business by ID', error);
        throw formatDatabaseError(error);
      }

      return business;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find business');
    }
  }

  async findByEmail(email: string, authContext?: AuthContext): Promise<Business | null> {
    try {
      dbLogger.debug('Finding business by email', { email });

      const query = this.client
        .from('businesses')
        .select('*')
        .eq('email', email);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('id', authContext.business_id);
      }

      const { data: business, error } = await query.maybeSingle();

      if (error) {
        dbLogger.error('Failed to find business by email', error);
        throw formatDatabaseError(error);
      }

      return business;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find business by email');
    }
  }

  async findWithStores(id: string, authContext?: AuthContext): Promise<BusinessWithStores | null> {
    try {
      dbLogger.debug('Finding business with stores', { id });

      const query = this.client
        .from('businesses')
        .select(`
          *,
          stores:stores(*)
        `)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('id', authContext.business_id);
      }

      const { data: business, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        dbLogger.error('Failed to find business with stores', error);
        throw formatDatabaseError(error);
      }

      return business as BusinessWithStores;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find business with stores');
    }
  }

  async findWithUsers(id: string, authContext?: AuthContext): Promise<BusinessWithUsers | null> {
    try {
      dbLogger.debug('Finding business with users', { id });

      if (authContext?.role !== 'admin' && authContext?.business_id !== id) {
        throw new Error('Insufficient permissions to view business users');
      }

      const { data: business, error } = await this.client
        .from('businesses')
        .select(`
          *,
          user_accounts:user_accounts(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        dbLogger.error('Failed to find business with users', error);
        throw formatDatabaseError(error);
      }

      return business as BusinessWithUsers;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find business with users');
    }
  }

  async update(id: string, data: BusinessUpdate, authContext?: AuthContext): Promise<Business> {
    try {
      dbLogger.debug('Updating business', { id, fields: Object.keys(data) });

      const query = this.client
        .from('businesses')
        .update(data)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('id', authContext.business_id);
      }

      const { data: business, error } = await query.select().single();

      if (error) {
        dbLogger.error('Failed to update business', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Business updated successfully', { id, name: business.name });
      return business;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update business');
    }
  }

  async delete(id: string, authContext?: AuthContext): Promise<void> {
    try {
      dbLogger.debug('Deleting business', { id });

      if (authContext?.role !== 'admin') {
        throw new Error('Only admin users can delete businesses');
      }

      const { error } = await this.client
        .from('businesses')
        .delete()
        .eq('id', id);

      if (error) {
        dbLogger.error('Failed to delete business', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Business deleted successfully', { id });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to delete business');
    }
  }

  async list(
    filters: BusinessFilters = {},
    pagination: PaginationParams = { page: 1, limit: 50 },
    authContext?: AuthContext
  ): Promise<PaginatedResponse<Business>> {
    try {
      dbLogger.debug('Listing businesses', { filters, pagination });

      if (authContext?.role !== 'admin') {
        throw new Error('Only admin users can list all businesses');
      }

      const { page, limit, order_by = 'created_at', order_direction = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      let query = this.client
        .from('businesses')
        .select('*', { count: 'exact' });

      if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`);
      }

      if (filters.email) {
        query = query.ilike('email', `%${filters.email}%`);
      }

      if (filters.created_after) {
        query = query.gte('created_at', filters.created_after);
      }

      if (filters.created_before) {
        query = query.lte('created_at', filters.created_before);
      }

      query = query
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);

      const { data: businesses, error, count } = await query;

      if (error) {
        dbLogger.error('Failed to list businesses', error);
        throw formatDatabaseError(error);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: businesses || [],
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
      throw new Error('Failed to list businesses');
    }
  }

  async exists(id: string, authContext?: AuthContext): Promise<boolean> {
    try {
      const business = await this.findById(id, authContext);
      return business !== null;
    } catch {
      return false;
    }
  }

  async count(filters: BusinessFilters = {}, authContext?: AuthContext): Promise<number> {
    try {
      if (authContext?.role !== 'admin') {
        return authContext?.business_id ? 1 : 0;
      }

      let query = this.client
        .from('businesses')
        .select('*', { count: 'exact', head: true });

      if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`);
      }

      if (filters.email) {
        query = query.ilike('email', `%${filters.email}%`);
      }

      if (filters.created_after) {
        query = query.gte('created_at', filters.created_after);
      }

      if (filters.created_before) {
        query = query.lte('created_at', filters.created_before);
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
      throw new Error('Failed to count businesses');
    }
  }

  async updateSettings(
    id: string,
    settings: Record<string, any>,
    authContext?: AuthContext
  ): Promise<Business> {
    try {
      const business = await this.findById(id, authContext);
      if (!business) {
        throw new Error('Business not found');
      }

      const mergedSettings = {
        ...business.settings,
        ...settings
      };

      return await this.update(id, { settings: mergedSettings }, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update business settings');
    }
  }

  async validateBusinessAccess(businessId: string, authContext: AuthContext): Promise<boolean> {
    try {
      if (authContext.role === 'admin') {
        return true;
      }

      if (authContext.business_id === businessId) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}

export function createBusinessQueries(client: SupabaseClient<Database>): BusinessQueries {
  return new BusinessQueries(client);
}