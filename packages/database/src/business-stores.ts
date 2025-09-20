import { createClient } from './client/supabase';
import { DatabaseError, QueryResult } from './types';
import { BusinessStorePermission } from '@vocilia/types/business-auth';

export interface BusinessStoreRelation {
  id: string;
  business_account_id: string;
  store_id: string;
  permissions: string[];
  created_at: string;
}

export interface BusinessStoreFilters {
  businessAccountId?: string;
  storeId?: string;
  hasPermission?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface BusinessStorePermissionSummary {
  business_account_id: string;
  business_name: string;
  store_id: string;
  store_name: string;
  permissions: string[];
  granted_at: string;
}

export interface BusinessStoreService {
  getRelation(businessAccountId: string, storeId: string): Promise<QueryResult<BusinessStoreRelation>>;
  getByBusinessAccount(businessAccountId: string): Promise<QueryResult<BusinessStoreRelation[]>>;
  getByStore(storeId: string): Promise<QueryResult<BusinessStoreRelation[]>>;
  getAll(filters?: BusinessStoreFilters): Promise<QueryResult<BusinessStoreRelation[]>>;
  grantPermissions(
    businessAccountId: string,
    storeId: string,
    permissions: string[]
  ): Promise<QueryResult<BusinessStoreRelation>>;
  updatePermissions(
    businessAccountId: string,
    storeId: string,
    permissions: string[]
  ): Promise<QueryResult<BusinessStoreRelation>>;
  revokePermissions(businessAccountId: string, storeId: string): Promise<QueryResult<void>>;
  hasPermission(
    businessAccountId: string,
    storeId: string,
    permission: string
  ): Promise<QueryResult<boolean>>;
  addPermission(
    businessAccountId: string,
    storeId: string,
    permission: string
  ): Promise<QueryResult<BusinessStoreRelation>>;
  removePermission(
    businessAccountId: string,
    storeId: string,
    permission: string
  ): Promise<QueryResult<BusinessStoreRelation>>;
  getPermissionSummary(): Promise<QueryResult<BusinessStorePermissionSummary[]>>;
  bulkGrantPermissions(
    grants: Array<{
      businessAccountId: string;
      storeId: string;
      permissions: string[];
    }>
  ): Promise<QueryResult<{ successful: number; failed: number; errors: string[] }>>;
}

/**
 * Database service for business-store permission operations
 */
export function createBusinessStoreService(): BusinessStoreService {
  const supabase = createClient();

  const getRelation = async (
    businessAccountId: string,
    storeId: string
  ): Promise<QueryResult<BusinessStoreRelation>> => {
    try {
      const { data, error } = await supabase
        .from('business_stores')
        .select('*')
        .eq('business_account_id', businessAccountId)
        .eq('store_id', storeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: new DatabaseError('Business store relation not found', 'NOT_FOUND') };
        }
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get business store relation',
          'UNKNOWN'
        )
      };
    }
  };

  const getByBusinessAccount = async (
    businessAccountId: string
  ): Promise<QueryResult<BusinessStoreRelation[]>> => {
    try {
      const { data, error } = await supabase
        .from('business_stores')
        .select('*')
        .eq('business_account_id', businessAccountId)
        .order('created_at', { ascending: true });

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get business store relations',
          'UNKNOWN'
        )
      };
    }
  };

  const getByStore = async (storeId: string): Promise<QueryResult<BusinessStoreRelation[]>> => {
    try {
      const { data, error } = await supabase
        .from('business_stores')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: true });

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get business store relations',
          'UNKNOWN'
        )
      };
    }
  };

  const getAll = async (filters?: BusinessStoreFilters): Promise<QueryResult<BusinessStoreRelation[]>> => {
    try {
      let query = supabase
        .from('business_stores')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.businessAccountId) {
        query = query.eq('business_account_id', filters.businessAccountId);
      }

      if (filters?.storeId) {
        query = query.eq('store_id', filters.storeId);
      }

      if (filters?.hasPermission) {
        query = query.contains('permissions', [filters.hasPermission]);
      }

      if (filters?.createdAfter) {
        query = query.gte('created_at', filters.createdAfter);
      }

      if (filters?.createdBefore) {
        query = query.lte('created_at', filters.createdBefore);
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
          err instanceof Error ? err.message : 'Failed to get business store relations',
          'UNKNOWN'
        )
      };
    }
  };

  const grantPermissions = async (
    businessAccountId: string,
    storeId: string,
    permissions: string[]
  ): Promise<QueryResult<BusinessStoreRelation>> => {
    try {
      // Validate permissions
      const validation = validatePermissions(permissions);
      if (!validation.isValid) {
        return {
          success: false,
          error: new DatabaseError(`Invalid permissions: ${validation.errors.join(', ')}`, 'VALIDATION_ERROR')
        };
      }

      const relationData = {
        business_account_id: businessAccountId,
        store_id: storeId,
        permissions,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('business_stores')
        .insert(relationData)
        .select()
        .single();

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to grant permissions',
          'UNKNOWN'
        )
      };
    }
  };

  const updatePermissions = async (
    businessAccountId: string,
    storeId: string,
    permissions: string[]
  ): Promise<QueryResult<BusinessStoreRelation>> => {
    try {
      // Validate permissions
      const validation = validatePermissions(permissions);
      if (!validation.isValid) {
        return {
          success: false,
          error: new DatabaseError(`Invalid permissions: ${validation.errors.join(', ')}`, 'VALIDATION_ERROR')
        };
      }

      const { data, error } = await supabase
        .from('business_stores')
        .update({ permissions })
        .eq('business_account_id', businessAccountId)
        .eq('store_id', storeId)
        .select()
        .single();

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      if (!data) {
        return { success: false, error: new DatabaseError('Business store relation not found', 'NOT_FOUND') };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to update permissions',
          'UNKNOWN'
        )
      };
    }
  };

  const revokePermissions = async (
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
          err instanceof Error ? err.message : 'Failed to revoke permissions',
          'UNKNOWN'
        )
      };
    }
  };

  const hasPermission = async (
    businessAccountId: string,
    storeId: string,
    permission: string
  ): Promise<QueryResult<boolean>> => {
    try {
      const { data, error } = await supabase
        .from('business_stores')
        .select('permissions')
        .eq('business_account_id', businessAccountId)
        .eq('store_id', storeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: false }; // No relation = no permissions
        }
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      const hasPermission = data.permissions.includes(permission) || data.permissions.includes('admin');
      return { success: true, data: hasPermission };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to check permission',
          'UNKNOWN'
        )
      };
    }
  };

  const addPermission = async (
    businessAccountId: string,
    storeId: string,
    permission: string
  ): Promise<QueryResult<BusinessStoreRelation>> => {
    try {
      // Get current permissions
      const relationResult = await getRelation(businessAccountId, storeId);
      if (!relationResult.success) {
        return relationResult;
      }

      const currentPermissions = relationResult.data.permissions;
      
      // Add permission if not already present
      if (!currentPermissions.includes(permission)) {
        const updatedPermissions = [...currentPermissions, permission];
        return updatePermissions(businessAccountId, storeId, updatedPermissions);
      }

      return { success: true, data: relationResult.data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to add permission',
          'UNKNOWN'
        )
      };
    }
  };

  const removePermission = async (
    businessAccountId: string,
    storeId: string,
    permission: string
  ): Promise<QueryResult<BusinessStoreRelation>> => {
    try {
      // Get current permissions
      const relationResult = await getRelation(businessAccountId, storeId);
      if (!relationResult.success) {
        return relationResult;
      }

      const currentPermissions = relationResult.data.permissions;
      
      // Remove permission if present
      const updatedPermissions = currentPermissions.filter(p => p !== permission);
      
      // Ensure at least one permission remains
      if (updatedPermissions.length === 0) {
        return {
          success: false,
          error: new DatabaseError('Cannot remove all permissions', 'VALIDATION_ERROR')
        };
      }

      return updatePermissions(businessAccountId, storeId, updatedPermissions);
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to remove permission',
          'UNKNOWN'
        )
      };
    }
  };

  const getPermissionSummary = async (): Promise<QueryResult<BusinessStorePermissionSummary[]>> => {
    try {
      const { data, error } = await supabase
        .from('business_stores')
        .select(`
          business_account_id,
          store_id,
          permissions,
          created_at,
          business_accounts!inner (
            business_name
          ),
          stores!inner (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      const summary: BusinessStorePermissionSummary[] = data?.map(relation => ({
        business_account_id: relation.business_account_id,
        business_name: relation.business_accounts.business_name,
        store_id: relation.store_id,
        store_name: relation.stores.name,
        permissions: relation.permissions,
        granted_at: relation.created_at
      })) || [];

      return { success: true, data: summary };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get permission summary',
          'UNKNOWN'
        )
      };
    }
  };

  const bulkGrantPermissions = async (
    grants: Array<{
      businessAccountId: string;
      storeId: string;
      permissions: string[];
    }>
  ): Promise<QueryResult<{ successful: number; failed: number; errors: string[] }>> => {
    try {
      let successful = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const grant of grants) {
        try {
          const result = await grantPermissions(
            grant.businessAccountId,
            grant.storeId,
            grant.permissions
          );

          if (result.success) {
            successful++;
          } else {
            failed++;
            errors.push(`Failed to grant permissions for ${grant.businessAccountId}/${grant.storeId}: ${result.error?.message}`);
          }
        } catch (err) {
          failed++;
          errors.push(`Error granting permissions for ${grant.businessAccountId}/${grant.storeId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      return {
        success: true,
        data: { successful, failed, errors }
      };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to bulk grant permissions',
          'UNKNOWN'
        )
      };
    }
  };

  return {
    getRelation,
    getByBusinessAccount,
    getByStore,
    getAll,
    grantPermissions,
    updatePermissions,
    revokePermissions,
    hasPermission,
    addPermission,
    removePermission,
    getPermissionSummary,
    bulkGrantPermissions
  };
}

/**
 * Validates business store permissions
 */
export function validatePermissions(permissions: string[]): {
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
 * Checks if a permission set includes admin access
 */
export function hasAdminAccess(permissions: string[]): boolean {
  return permissions.includes('admin');
}

/**
 * Gets effective permissions (admin implies all permissions)
 */
export function getEffectivePermissions(permissions: string[]): string[] {
  if (hasAdminAccess(permissions)) {
    return ['admin', 'read_feedback', 'write_context', 'manage_qr', 'view_analytics'];
  }
  return permissions;
}

/**
 * Formats permissions for display
 */
export function formatPermissionsForDisplay(permissions: string[]): string[] {
  const permissionLabels: Record<string, string> = {
    'read_feedback': 'Read Feedback',
    'write_context': 'Write Context',
    'manage_qr': 'Manage QR Codes',
    'view_analytics': 'View Analytics',
    'admin': 'Administrator'
  };

  return permissions
    .map(p => permissionLabels[p] || p)
    .sort((a, b) => {
      // Admin first, then alphabetical
      if (a === 'Administrator') return -1;
      if (b === 'Administrator') return 1;
      return a.localeCompare(b);
    });
}

/**
 * Singleton instance of the business store service
 */
export const businessStoreService = createBusinessStoreService();