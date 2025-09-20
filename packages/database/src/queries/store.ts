import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type {
  Database,
  Store,
  StoreInsert,
  StoreUpdate,
  StoreFilters,
  StoreWithContext,
  StoreWithFeedback,
  PaginationParams,
  PaginatedResponse,
  AuthContext
} from '../types/index.js';
import { formatDatabaseError, retryWithExponentialBackoff, dbLogger } from '../client/utils.js';

export class StoreQueries {
  constructor(private client: SupabaseClient<Database>) {}

  async create(data: StoreInsert, authContext?: AuthContext): Promise<Store> {
    try {
      dbLogger.debug('Creating store', { name: data.name, business_id: data.business_id });

      if (authContext?.business_id && authContext.business_id !== data.business_id) {
        throw new Error('Cannot create store for different business');
      }

      const qrCodeData = data.qr_code_data || this.generateQRCodeData(data.business_id, data.name);

      const { data: store, error } = await this.client
        .from('stores')
        .insert({
          ...data,
          qr_code_data: qrCodeData
        })
        .select()
        .single();

      if (error) {
        dbLogger.error('Failed to create store', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Store created successfully', { id: store.id, name: store.name });
      return store;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to create store');
    }
  }

  async findById(id: string, authContext?: AuthContext): Promise<Store | null> {
    try {
      dbLogger.debug('Finding store by ID', { id });

      const query = this.client
        .from('stores')
        .select('*')
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('business_id', authContext.business_id);
      }

      const { data: store, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          dbLogger.debug('Store not found', { id });
          return null;
        }
        dbLogger.error('Failed to find store by ID', error);
        throw formatDatabaseError(error);
      }

      return store;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find store');
    }
  }

  async findByQRCode(qrCodeData: string, authContext?: AuthContext): Promise<Store | null> {
    try {
      dbLogger.debug('Finding store by QR code', { qrCodeData: qrCodeData.substring(0, 20) + '...' });

      const query = this.client
        .from('stores')
        .select('*')
        .eq('qr_code_data', qrCodeData)
        .eq('is_active', true);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('business_id', authContext.business_id);
      }

      const { data: store, error } = await query.maybeSingle();

      if (error) {
        dbLogger.error('Failed to find store by QR code', error);
        throw formatDatabaseError(error);
      }

      return store;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find store by QR code');
    }
  }

  async findByBusinessId(
    businessId: string,
    filters: StoreFilters = {},
    pagination: PaginationParams = { page: 1, limit: 50 },
    authContext?: AuthContext
  ): Promise<PaginatedResponse<Store>> {
    try {
      dbLogger.debug('Finding stores by business ID', { businessId });

      if (authContext?.business_id && authContext.business_id !== businessId && authContext.role !== 'admin') {
        throw new Error('Cannot access stores for different business');
      }

      const { page, limit, order_by = 'created_at', order_direction = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      let query = this.client
        .from('stores')
        .select('*', { count: 'exact' })
        .eq('business_id', businessId);

      if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`);
      }

      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters.location_address) {
        query = query.ilike('location_address', `%${filters.location_address}%`);
      }

      query = query
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);

      const { data: stores, error, count } = await query;

      if (error) {
        dbLogger.error('Failed to find stores by business ID', error);
        throw formatDatabaseError(error);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: stores || [],
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
      throw new Error('Failed to find stores by business ID');
    }
  }

  async findWithContext(id: string, authContext?: AuthContext): Promise<StoreWithContext | null> {
    try {
      dbLogger.debug('Finding store with context', { id });

      const query = this.client
        .from('stores')
        .select(`
          *,
          context_window:context_window(*)
        `)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('business_id', authContext.business_id);
      }

      const { data: store, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        dbLogger.error('Failed to find store with context', error);
        throw formatDatabaseError(error);
      }

      return store as StoreWithContext;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find store with context');
    }
  }

  async findWithFeedback(
    id: string,
    dateRange?: { start: string; end: string },
    authContext?: AuthContext
  ): Promise<StoreWithFeedback | null> {
    try {
      dbLogger.debug('Finding store with feedback', { id, dateRange });

      const query = this.client
        .from('stores')
        .select(`
          *,
          feedback_sessions:feedback_sessions(*)
        `)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('business_id', authContext.business_id);
      }

      if (dateRange) {
        query.gte('feedback_sessions.created_at', dateRange.start);
        query.lte('feedback_sessions.created_at', dateRange.end);
      }

      const { data: store, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        dbLogger.error('Failed to find store with feedback', error);
        throw formatDatabaseError(error);
      }

      return store as StoreWithFeedback;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find store with feedback');
    }
  }

  async update(id: string, data: StoreUpdate, authContext?: AuthContext): Promise<Store> {
    try {
      dbLogger.debug('Updating store', { id, fields: Object.keys(data) });

      const query = this.client
        .from('stores')
        .update(data)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('business_id', authContext.business_id);
      }

      const { data: store, error } = await query.select().single();

      if (error) {
        dbLogger.error('Failed to update store', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Store updated successfully', { id, name: store.name });
      return store;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update store');
    }
  }

  async delete(id: string, authContext?: AuthContext): Promise<void> {
    try {
      dbLogger.debug('Deleting store', { id });

      const query = this.client
        .from('stores')
        .delete()
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.eq('business_id', authContext.business_id);
      }

      const { error } = await query;

      if (error) {
        dbLogger.error('Failed to delete store', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Store deleted successfully', { id });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to delete store');
    }
  }

  async setActive(id: string, isActive: boolean, authContext?: AuthContext): Promise<Store> {
    try {
      dbLogger.debug('Setting store active status', { id, isActive });

      return await this.update(id, { is_active: isActive }, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to set store active status');
    }
  }

  async regenerateQRCode(id: string, authContext?: AuthContext): Promise<Store> {
    try {
      dbLogger.debug('Regenerating QR code for store', { id });

      const store = await this.findById(id, authContext);
      if (!store) {
        throw new Error('Store not found');
      }

      const newQRCodeData = this.generateQRCodeData(store.business_id, store.name);

      return await this.update(id, { qr_code_data: newQRCodeData }, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to regenerate QR code');
    }
  }

  async updateProfile(
    id: string,
    profileUpdates: Record<string, any>,
    authContext?: AuthContext
  ): Promise<Store> {
    try {
      const store = await this.findById(id, authContext);
      if (!store) {
        throw new Error('Store not found');
      }

      const mergedProfile = {
        ...store.store_profile,
        ...profileUpdates
      };

      return await this.update(id, { store_profile: mergedProfile }, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update store profile');
    }
  }

  async exists(id: string, authContext?: AuthContext): Promise<boolean> {
    try {
      const store = await this.findById(id, authContext);
      return store !== null;
    } catch {
      return false;
    }
  }

  async count(businessId?: string, authContext?: AuthContext): Promise<number> {
    try {
      let query = this.client
        .from('stores')
        .select('*', { count: 'exact', head: true });

      if (businessId) {
        query = query.eq('business_id', businessId);
      }

      if (authContext?.business_id && authContext.role !== 'admin') {
        query = query.eq('business_id', authContext.business_id);
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
      throw new Error('Failed to count stores');
    }
  }

  async validateStoreAccess(storeId: string, authContext: AuthContext): Promise<boolean> {
    try {
      if (authContext.role === 'admin') {
        return true;
      }

      const store = await this.findById(storeId, authContext);
      return store !== null && store.business_id === authContext.business_id;
    } catch {
      return false;
    }
  }

  private generateQRCodeData(businessId: string, storeName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const storeSlug = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    return `${businessId}-${storeSlug}-${timestamp}-${random}`;
  }

  async searchByLocation(
    coordinates: { lat: number; lng: number },
    radiusKm: number = 10,
    authContext?: AuthContext
  ): Promise<Store[]> {
    try {
      dbLogger.debug('Searching stores by location', { coordinates, radiusKm });

      let query = this.client
        .from('stores')
        .select('*')
        .eq('is_active', true);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query = query.eq('business_id', authContext.business_id);
      }

      const { data: stores, error } = await query;

      if (error) {
        dbLogger.error('Failed to search stores by location', error);
        throw formatDatabaseError(error);
      }

      return stores || [];
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to search stores by location');
    }
  }
}

export function createStoreQueries(client: SupabaseClient<Database>): StoreQueries {
  return new StoreQueries(client);
}