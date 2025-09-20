import { createClient } from '@alpha/database';
import { ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler';

export interface Store {
  id: string;
  business_id: string;
  name: string;
  address: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  } | null;
  store_code: string | null;
  qr_code_data: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStore {
  business_id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  store_code?: string;
}

export interface UpdateStore {
  name?: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  store_code?: string;
  active?: boolean;
}

export interface StoreListOptions {
  business_id?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface StoreListResult {
  stores: Store[];
  total: number;
  has_more: boolean;
}

export class StoreService {
  private supabase = createClient();

  async getStoreById(id: string): Promise<Store> {
    if (!id) {
      throw new ValidationError('Store ID is required');
    }

    const { data: store, error } = await this.supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Store not found');
      }
      throw new Error(`Failed to fetch store: ${error.message}`);
    }

    return store;
  }

  async getStores(options: StoreListOptions = {}): Promise<StoreListResult> {
    const {
      business_id,
      active,
      limit = 20,
      offset = 0,
      search,
    } = options;

    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    if (offset < 0) {
      throw new ValidationError('Offset must be non-negative');
    }

    let query = this.supabase
      .from('stores')
      .select('*', { count: 'exact' });

    // Apply filters
    if (business_id) {
      query = query.eq('business_id', business_id);
    }

    if (active !== undefined) {
      query = query.eq('active', active);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,store_code.ilike.%${search}%`);
    }

    // Apply pagination and ordering
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: stores, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch stores: ${error.message}`);
    }

    return {
      stores: stores || [],
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    };
  }

  async getStoresByBusinessId(businessId: string, activeOnly = false): Promise<Store[]> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    const result = await this.getStores({
      business_id: businessId,
      active: activeOnly ? true : undefined,
    });

    return result.stores;
  }

  async createStore(storeData: CreateStore): Promise<Store> {
    // Validate required fields
    if (!storeData.business_id || !storeData.name) {
      throw new ValidationError('Business ID and name are required', {
        business_id: !storeData.business_id ? 'Business ID is required' : undefined,
        name: !storeData.name ? 'Name is required' : undefined,
      });
    }

    // Validate name length
    if (storeData.name.length < 1 || storeData.name.length > 100) {
      throw new ValidationError('Store name must be between 1 and 100 characters');
    }

    // Validate store code if provided
    if (storeData.store_code && storeData.store_code.length > 50) {
      throw new ValidationError('Store code must be 50 characters or less');
    }

    // Verify business exists
    const { data: business, error: businessError } = await this.supabase
      .from('businesses')
      .select('id')
      .eq('id', storeData.business_id)
      .single();

    if (businessError || !business) {
      throw new NotFoundError('Business not found');
    }

    // Generate unique store ID and QR code data
    const storeId = crypto.randomUUID();
    const qrCodeData = `https://customer.vocilia.se/entry/store/${storeId}`;

    const { data: store, error } = await this.supabase
      .from('stores')
      .insert({
        id: storeId,
        business_id: storeData.business_id,
        name: storeData.name,
        address: storeData.address || null,
        store_code: storeData.store_code || null,
        qr_code_data: qrCodeData,
        active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError('Store with this information already exists');
      }
      throw new Error(`Failed to create store: ${error.message}`);
    }

    return store;
  }

  async updateStore(id: string, updates: UpdateStore): Promise<Store> {
    if (!id) {
      throw new ValidationError('Store ID is required');
    }

    // Validate updates
    if (updates.name && (updates.name.length < 1 || updates.name.length > 100)) {
      throw new ValidationError('Store name must be between 1 and 100 characters');
    }

    if (updates.store_code && updates.store_code.length > 50) {
      throw new ValidationError('Store code must be 50 characters or less');
    }

    // Build update object
    const updateData: Partial<UpdateStore & { updated_at: string }> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.store_code !== undefined) updateData.store_code = updates.store_code;
    if (updates.active !== undefined) updateData.active = updates.active;

    const { data: store, error } = await this.supabase
      .from('stores')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Store not found');
      }
      if (error.code === '23505') {
        throw new ConflictError('Store with this information already exists');
      }
      throw new Error(`Failed to update store: ${error.message}`);
    }

    return store;
  }

  async deleteStore(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('Store ID is required');
    }

    // TODO: Check if store has associated data (feedback, sessions, etc.)
    // For now, we'll allow deletion

    const { error } = await this.supabase
      .from('stores')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete store: ${error.message}`);
    }
  }

  async activateStore(id: string): Promise<Store> {
    if (!id) {
      throw new ValidationError('Store ID is required');
    }

    return this.updateStore(id, { active: true });
  }

  async deactivateStore(id: string): Promise<Store> {
    if (!id) {
      throw new ValidationError('Store ID is required');
    }

    return this.updateStore(id, { active: false });
  }

  async regenerateQRCode(id: string): Promise<Store> {
    if (!id) {
      throw new ValidationError('Store ID is required');
    }

    // Generate new QR code data
    const qrCodeData = `https://customer.vocilia.se/entry/store/${id}?t=${Date.now()}`;

    const { data: store, error } = await this.supabase
      .from('stores')
      .update({
        qr_code_data: qrCodeData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Store not found');
      }
      throw new Error(`Failed to regenerate QR code: ${error.message}`);
    }

    return store;
  }

  async getStoreStats(id: string): Promise<{
    active: boolean;
    created_at: string;
    business_name: string;
    // TODO: Add feedback and session counts when those tables exist
  }> {
    if (!id) {
      throw new ValidationError('Store ID is required');
    }

    // Get store with business information
    const { data: storeWithBusiness, error } = await this.supabase
      .from('stores')
      .select(`
        active,
        created_at,
        business:businesses(name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Store not found');
      }
      throw new Error(`Failed to get store stats: ${error.message}`);
    }

    return {
      active: storeWithBusiness.active,
      created_at: storeWithBusiness.created_at,
      business_name: storeWithBusiness.business?.name || 'Unknown',
    };
  }

  async searchStores(query: string, businessId?: string, limit = 20, offset = 0): Promise<StoreListResult> {
    if (!query) {
      throw new ValidationError('Search query is required');
    }

    return this.getStores({
      search: query,
      business_id: businessId,
      limit,
      offset,
    });
  }

  async getActiveStoresByBusiness(businessId: string): Promise<Store[]> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    return this.getStoresByBusinessId(businessId, true);
  }

  async validateStoreAccess(storeId: string, businessId: string): Promise<boolean> {
    if (!storeId || !businessId) {
      throw new ValidationError('Store ID and Business ID are required');
    }

    const { data: store, error } = await this.supabase
      .from('stores')
      .select('business_id')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      return false;
    }

    return store.business_id === businessId;
  }

  async getStoreByCode(storeCode: string, businessId?: string): Promise<Store> {
    if (!storeCode) {
      throw new ValidationError('Store code is required');
    }

    let query = this.supabase
      .from('stores')
      .select('*')
      .eq('store_code', storeCode);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: store, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Store not found');
      }
      throw new Error(`Failed to fetch store by code: ${error.message}`);
    }

    return store;
  }
}

// Singleton instance
export const storeService = new StoreService();