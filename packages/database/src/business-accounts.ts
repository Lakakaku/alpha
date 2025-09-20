import { createClient } from './client/supabase';
import { DatabaseError, QueryResult } from './types';
import { BusinessAccount, BusinessRegistrationData } from '@vocilia/types/business-auth';

export interface BusinessAccountFilters {
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  businessType?: string;
  createdAfter?: string;
  createdBefore?: string;
  searchTerm?: string;
}

export interface BusinessAccountService {
  getById(id: string): Promise<QueryResult<BusinessAccount>>;
  getByUserId(userId: string): Promise<QueryResult<BusinessAccount>>;
  getAll(filters?: BusinessAccountFilters): Promise<QueryResult<BusinessAccount[]>>;
  create(data: BusinessRegistrationData & { userId: string }): Promise<QueryResult<BusinessAccount>>;
  update(id: string, updates: Partial<BusinessAccount>): Promise<QueryResult<BusinessAccount>>;
  updateVerificationStatus(
    id: string, 
    status: 'pending' | 'approved' | 'rejected',
    verifiedBy?: string,
    notes?: string
  ): Promise<QueryResult<BusinessAccount>>;
  delete(id: string): Promise<QueryResult<void>>;
  searchByName(searchTerm: string): Promise<QueryResult<BusinessAccount[]>>;
  getVerificationStats(): Promise<QueryResult<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }>>;
}

/**
 * Database service for business account operations
 */
export function createBusinessAccountService(): BusinessAccountService {
  const supabase = createClient();

  const getById = async (id: string): Promise<QueryResult<BusinessAccount>> => {
    try {
      const { data, error } = await supabase
        .from('business_accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      if (!data) {
        return { success: false, error: new DatabaseError('Business account not found', 'NOT_FOUND') };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get business account',
          'UNKNOWN'
        )
      };
    }
  };

  const getByUserId = async (userId: string): Promise<QueryResult<BusinessAccount>> => {
    try {
      const { data, error } = await supabase
        .from('business_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: new DatabaseError('Business account not found', 'NOT_FOUND') };
        }
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get business account',
          'UNKNOWN'
        )
      };
    }
  };

  const getAll = async (filters?: BusinessAccountFilters): Promise<QueryResult<BusinessAccount[]>> => {
    try {
      let query = supabase
        .from('business_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.verificationStatus) {
        query = query.eq('verification_status', filters.verificationStatus);
      }

      if (filters?.businessType) {
        query = query.eq('business_type', filters.businessType);
      }

      if (filters?.createdAfter) {
        query = query.gte('created_at', filters.createdAfter);
      }

      if (filters?.createdBefore) {
        query = query.lte('created_at', filters.createdBefore);
      }

      if (filters?.searchTerm) {
        query = query.or(`business_name.ilike.%${filters.searchTerm}%,contact_person.ilike.%${filters.searchTerm}%`);
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
          err instanceof Error ? err.message : 'Failed to get business accounts',
          'UNKNOWN'
        )
      };
    }
  };

  const create = async (
    data: BusinessRegistrationData & { userId: string }
  ): Promise<QueryResult<BusinessAccount>> => {
    try {
      const businessAccountData = {
        user_id: data.userId,
        business_name: data.businessName,
        contact_person: data.contactPerson,
        phone: data.phone,
        address: data.address,
        business_type: data.businessType,
        estimated_monthly_customers: data.estimatedMonthlyCustomers,
        verification_status: 'pending' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await supabase
        .from('business_accounts')
        .insert(businessAccountData)
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
          err instanceof Error ? err.message : 'Failed to create business account',
          'UNKNOWN'
        )
      };
    }
  };

  const update = async (
    id: string,
    updates: Partial<BusinessAccount>
  ): Promise<QueryResult<BusinessAccount>> => {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('business_accounts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      if (!data) {
        return { success: false, error: new DatabaseError('Business account not found', 'NOT_FOUND') };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to update business account',
          'UNKNOWN'
        )
      };
    }
  };

  const updateVerificationStatus = async (
    id: string,
    status: 'pending' | 'approved' | 'rejected',
    verifiedBy?: string,
    notes?: string
  ): Promise<QueryResult<BusinessAccount>> => {
    try {
      const updateData = {
        verification_status: status,
        verified_by: verifiedBy || null,
        verified_at: status !== 'pending' ? new Date().toISOString() : null,
        verification_notes: notes || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('business_accounts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      if (!data) {
        return { success: false, error: new DatabaseError('Business account not found', 'NOT_FOUND') };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to update verification status',
          'UNKNOWN'
        )
      };
    }
  };

  const deleteAccount = async (id: string): Promise<QueryResult<void>> => {
    try {
      // Check if business account has associated stores
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id')
        .eq('business_id', id)
        .limit(1);

      if (storesError) {
        return { success: false, error: new DatabaseError(storesError.message, storesError.code) };
      }

      if (stores && stores.length > 0) {
        return {
          success: false,
          error: new DatabaseError(
            'Cannot delete business account with associated stores',
            'CONSTRAINT_VIOLATION'
          )
        };
      }

      const { error } = await supabase
        .from('business_accounts')
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
          err instanceof Error ? err.message : 'Failed to delete business account',
          'UNKNOWN'
        )
      };
    }
  };

  const searchByName = async (searchTerm: string): Promise<QueryResult<BusinessAccount[]>> => {
    try {
      const { data, error } = await supabase
        .from('business_accounts')
        .select('*')
        .ilike('business_name', `%${searchTerm}%`)
        .order('business_name', { ascending: true });

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to search business accounts',
          'UNKNOWN'
        )
      };
    }
  };

  const getVerificationStats = async (): Promise<QueryResult<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }>> => {
    try {
      const { data, error } = await supabase
        .from('business_accounts')
        .select('verification_status');

      if (error) {
        return { success: false, error: new DatabaseError(error.message, error.code) };
      }

      const stats = data?.reduce(
        (acc, account) => {
          acc.total++;
          switch (account.verification_status) {
            case 'pending':
              acc.pending++;
              break;
            case 'approved':
              acc.approved++;
              break;
            case 'rejected':
              acc.rejected++;
              break;
          }
          return acc;
        },
        { pending: 0, approved: 0, rejected: 0, total: 0 }
      ) || { pending: 0, approved: 0, rejected: 0, total: 0 };

      return { success: true, data: stats };
    } catch (err) {
      return {
        success: false,
        error: new DatabaseError(
          err instanceof Error ? err.message : 'Failed to get verification stats',
          'UNKNOWN'
        )
      };
    }
  };

  return {
    getById,
    getByUserId,
    getAll,
    create,
    update,
    updateVerificationStatus,
    delete: deleteAccount,
    searchByName,
    getVerificationStats
  };
}

/**
 * Singleton instance of the business account service
 */
export const businessAccountService = createBusinessAccountService();

/**
 * Helper function to validate business account data
 */
export function validateBusinessAccountData(data: Partial<BusinessAccount>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (data.business_name !== undefined) {
    if (!data.business_name || data.business_name.trim().length < 2) {
      errors.push('Business name must be at least 2 characters');
    }
    if (data.business_name.length > 100) {
      errors.push('Business name must be less than 100 characters');
    }
  }

  if (data.contact_person !== undefined) {
    if (!data.contact_person || data.contact_person.trim().length < 2) {
      errors.push('Contact person name must be at least 2 characters');
    }
  }

  if (data.phone !== undefined) {
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(data.phone)) {
      errors.push('Invalid phone number format');
    }
  }

  if (data.address !== undefined) {
    if (!data.address || data.address.trim().length < 10) {
      errors.push('Address must be at least 10 characters');
    }
  }

  if (data.business_type !== undefined) {
    const validTypes = ['restaurant', 'retail', 'services', 'hospitality', 'healthcare', 'entertainment', 'other'];
    if (!validTypes.includes(data.business_type)) {
      errors.push('Invalid business type');
    }
  }

  if (data.estimated_monthly_customers !== undefined) {
    if (!Number.isInteger(data.estimated_monthly_customers) || data.estimated_monthly_customers < 1) {
      errors.push('Estimated monthly customers must be a positive integer');
    }
    if (data.estimated_monthly_customers > 100000) {
      errors.push('Estimated monthly customers seems too high (max 100,000)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}