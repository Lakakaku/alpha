import { createClient } from './client/supabase';
import { DatabaseError, QueryResult } from './types';
import { Store, BusinessStorePermission } from '@vocilia/types/business-auth';

export interface StoreFilters {
  businessId?: string;
  name?: string;
  createdAfter?: string;
  createdBefore?: string;
  hasQRCode?: boolean;
}

export interface StoreWithPermissions extends Store {
  permissions?: string[];
  joinedAt?: string;
}

export interface CreateStoreData {
  name: string;
  address: string;
  businessId: string;
  qrCode?: string;
  metadata?: Record<string, any>;
}

export interface StoreService {
  getById(id: string): Promise<QueryResult<Store>>;
  getByBusinessId(businessId: string): Promise<QueryResult<Store[]>>;
  getByQRCode(qrCode: string): Promise<QueryResult<Store>>;
  getAll(filters?: StoreFilters): Promise<QueryResult<Store[]>>;
  create(data: CreateStoreData): Promise<QueryResult<Store>>;
  update(id: string, updates: Partial<Store>): Promise<QueryResult<Store>>;
  delete(id: string): Promise<QueryResult<void>>;
  generateQRCode(storeId: string): Promise<QueryResult<string>>;
  getStoresForBusinessAccount(businessAccountId: string): Promise<QueryResult<StoreWithPermissions[]>>;
  addBusinessStorePermission(
    businessAccountId: string,
    storeId: string,
    permissions: string[]
  ): Promise<QueryResult<void>>;
  updateBusinessStorePermissions(
    businessAccountId: string,
    storeId: string,
    permissions: string[]
  ): Promise<QueryResult<void>>;
  removeBusinessStorePermission(
    businessAccountId: string,
    storeId: string
  ): Promise<QueryResult<void>>;
  getBusinessStorePermissions(
    businessAccountId: string,
    storeId: string
  ): Promise<QueryResult<string[]>>;
}

/**
 * Database service for store operations
 */
export function createStoreService(): StoreService {
  const supabase = createClient();

  const getById = async (id: string): Promise<QueryResult<Store>> => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: new DatabaseError('Store not found', 'NOT_FOUND') };
        }
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get store',
          'UNKNOWN'
        )
      };
    }
  };

  const getByBusinessId = async (businessId: string): Promise<QueryResult<Store[]>> => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true });

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get stores by business',
          'UNKNOWN'
        )
      };
    }
  };

  const getByQRCode = async (qrCode: string): Promise<QueryResult<Store>> => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('qr_code', qrCode)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: new DatabaseError('Store not found for QR code', 'NOT_FOUND') };
        }
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get store by QR code',
          'UNKNOWN'
        )
      };
    }
  };

  const getAll = async (filters?: StoreFilters): Promise<QueryResult<Store[]>> => {
    try {
      let query = supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.businessId) {
        query = query.eq('business_id', filters.businessId);
      }

      if (filters?.name) {
        query = query.ilike('name', `%${filters.name}%`);
      }

      if (filters?.createdAfter) {
        query = query.gte('created_at', filters.createdAfter);
      }

      if (filters?.createdBefore) {
        query = query.lte('created_at', filters.createdBefore);
      }

      if (filters?.hasQRCode !== undefined) {
        if (filters.hasQRCode) {
          query = query.not('qr_code', 'is', null);
        } else {
          query = query.is('qr_code', null);
        }
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get stores',
          'UNKNOWN'
        )
      };
    }
  };

  const create = async (data: CreateStoreData): Promise<QueryResult<Store>> => {
    try {
      const storeData = {
        name: data.name,
        address: data.address,
        business_id: data.businessId,
        qr_code: data.qrCode || generateUniqueQRCode(),
        metadata: data.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await supabase
        .from('stores')
        .insert(storeData)
        .select()
        .single();

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: result };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to create store',
          'UNKNOWN'
        )
      };
    }
  };

  const update = async (id: string, updates: Partial<Store>): Promise<QueryResult<Store>> => {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('stores')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      if (!data) {
        return { success: false, error: new DatabaseError('Store not found', 'NOT_FOUND') };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to update store',
          'UNKNOWN'
        )
      };
    }
  };

  const deleteStore = async (id: string): Promise<QueryResult<void>> => {
    try {
      // Check if store has associated feedback sessions
      const { data: sessions, error: sessionError } = await supabase
        .from('feedback_sessions')
        .select('id')
        .eq('store_id', id)
        .limit(1);

      if (sessionError) {
        return { success: false, error: new DatabaseError(sessionError.message, sessionError.code) };
      }

      if (sessions && sessions.length > 0) {
        return {
          success: false,
          error: new DatabaseError(
            'Cannot delete store with existing feedback sessions',
            'CONSTRAINT_VIOLATION'
          )
        };
      }

      // Remove business store permissions first
      const { error: permissionsError } = await supabase
        .from('business_stores')
        .delete()
        .eq('store_id', id);

      if (permissionsError) {
        return { success: false, error: new DatabaseError(permissionsError.message, permissionsError.code) };
      }

      // Delete the store
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to delete store',
          'UNKNOWN'
        )
      };
    }
  };

  const generateQRCode = async (storeId: string): Promise<QueryResult<string>> => {
    try {
      const newQRCode = generateUniqueQRCode();

      const { data, error } = await supabase
        .from('stores')
        .update({ qr_code: newQRCode, updated_at: new Date().toISOString() })
        .eq('id', storeId)
        .select('qr_code')
        .single();

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      if (!data) {
        return { success: false, error: new DatabaseError('Store not found', 'NOT_FOUND') };
      }

      return { success: true, data: data.qr_code };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to generate QR code',
          'UNKNOWN'
        )
      };
    }
  };

  const getStoresForBusinessAccount = async (
    businessAccountId: string
  ): Promise<QueryResult<StoreWithPermissions[]>> => {
    try {
      const { data, error } = await supabase
        .from('business_stores')
        .select(`
          permissions,
          created_at,
          stores (
            id,
            name,
            address,
            qr_code,
            business_id,
            metadata,
            created_at,
            updated_at
          )
        `)
        .eq('business_account_id', businessAccountId);

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      const storesWithPermissions: StoreWithPermissions[] = data?.map(bs => ({
        ...bs.stores,
        permissions: bs.permissions,
        joinedAt: bs.created_at
      })) || [];

      return { success: true, data: storesWithPermissions };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get stores for business account',
          'UNKNOWN'
        )
      };
    }
  };

  const addBusinessStorePermission = async (
    businessAccountId: string,
    storeId: string,
    permissions: string[]
  ): Promise<QueryResult<void>> => {
    try {
      const { error } = await supabase
        .from('business_stores')
        .insert({
          business_account_id: businessAccountId,
          store_id: storeId,
          permissions,
          created_at: new Date().toISOString()
        });

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to add business store permission',
          'UNKNOWN'
        )
      };
    }
  };

  const updateBusinessStorePermissions = async (
    businessAccountId: string,
    storeId: string,
    permissions: string[]
  ): Promise<QueryResult<void>> => {
    try {
      const { error } = await supabase
        .from('business_stores')
        .update({ permissions })
        .eq('business_account_id', businessAccountId)
        .eq('store_id', storeId);

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to update business store permissions',
          'UNKNOWN'
        )
      };
    }
  };

  const removeBusinessStorePermission = async (
    businessAccountId: string,
    storeId: string
  ): Promise<QueryResult<void>> => {
    try {
      const { error } = await supabase
        .from('business_stores')
        .delete()
        .eq('business_account_id', businessAccountId)
        .eq('store_id', storeId);

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: undefined };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to remove business store permission',
          'UNKNOWN'
        )
      };
    }
  };

  const getBusinessStorePermissions = async (
    businessAccountId: string,
    storeId: string
  ): Promise<QueryResult<string[]>> => {
    try {
      const { data, error } = await supabase
        .from('business_stores')
        .select('permissions')
        .eq('business_account_id', businessAccountId)
        .eq('store_id', storeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: [] }; // No permissions found
        }
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: data.permissions || [] };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get business store permissions',
          'UNKNOWN'
        )
      };
    }
  };

  return {
    getById,
    getByBusinessId,
    getByQRCode,
    getAll,
    create,
    update,
    delete: deleteStore,
    generateQRCode,
    getStoresForBusinessAccount,
    addBusinessStorePermission,
    updateBusinessStorePermissions,
    removeBusinessStorePermission,
    getBusinessStorePermissions
  };
}

/**
 * Generates a unique QR code for a store
 */
function generateUniqueQRCode(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `VCL-${timestamp}-${random}`.toUpperCase();
}

/**
 * Validates store data
 */
export function validateStoreData(data: Partial<Store>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (data.name !== undefined) {
    if (!data.name || data.name.trim().length < 2) {
      errors.push('Store name must be at least 2 characters');
    }
    if (data.name.length > 100) {
      errors.push('Store name must be less than 100 characters');
    }
  }

  if (data.address !== undefined) {
    if (!data.address || data.address.trim().length < 10) {
      errors.push('Store address must be at least 10 characters');
    }
    if (data.address.length > 255) {
      errors.push('Store address must be less than 255 characters');
    }
  }

  if (data.qr_code !== undefined) {
    if (data.qr_code && !/^VCL-\d+-[A-Z0-9]+$/.test(data.qr_code)) {
      errors.push('Invalid QR code format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates business store permissions
 */
export function validateBusinessStorePermissions(permissions: string[]): {
  isValid: boolean;
  errors: string[];
} {
  const validPermissions = [
    'read_feedback',
    'write_context',
    'manage_qr',
    'view_analytics',
    'admin'
  ];

  const errors: string[] = [];

  if (!Array.isArray(permissions)) {
    errors.push('Permissions must be an array');
    return { isValid: false, errors };
  }

  if (permissions.length === 0) {
    errors.push('At least one permission is required');
  }

  const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
  if (invalidPermissions.length > 0) {
    errors.push(`Invalid permissions: ${invalidPermissions.join(', ')}`);
  }

  const duplicatePermissions = permissions.filter((p, index) => permissions.indexOf(p) !== index);
  if (duplicatePermissions.length > 0) {
    errors.push(`Duplicate permissions: ${duplicatePermissions.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Singleton instance of the store service
 */
export const storeService = createStoreService();