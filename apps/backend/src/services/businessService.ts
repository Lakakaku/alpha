import { createClient } from '@alpha/database';
import { ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler';

export interface Business {
  id: string;
  name: string;
  organization_number: string | null;
  contact_email: string | null;
  phone_number: string | null;
  address: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  } | null;
  subscription_status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface CreateBusiness {
  name: string;
  organization_number?: string;
  contact_email: string;
  phone_number?: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
}

export interface UpdateBusiness {
  name?: string;
  organization_number?: string;
  contact_email?: string;
  phone_number?: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  subscription_status?: 'active' | 'inactive' | 'suspended';
}

export interface BusinessListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  subscription_status?: 'active' | 'inactive' | 'suspended';
}

export interface BusinessListResult {
  businesses: Business[];
  total: number;
  has_more: boolean;
}

export class BusinessService {
  private supabase = createClient();

  async getBusinessById(id: string): Promise<Business> {
    if (!id) {
      throw new ValidationError('Business ID is required');
    }

    const { data: business, error } = await this.supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Business not found');
      }
      throw new Error(`Failed to fetch business: ${error.message}`);
    }

    return business;
  }

  async getBusinesses(options: BusinessListOptions = {}): Promise<BusinessListResult> {
    const {
      limit = 20,
      offset = 0,
      search,
      subscription_status,
    } = options;

    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    if (offset < 0) {
      throw new ValidationError('Offset must be non-negative');
    }

    let query = this.supabase
      .from('businesses')
      .select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (subscription_status) {
      query = query.eq('subscription_status', subscription_status);
    }

    // Apply pagination and ordering
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: businesses, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch businesses: ${error.message}`);
    }

    return {
      businesses: businesses || [],
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    };
  }

  async createBusiness(businessData: CreateBusiness): Promise<Business> {
    // Validate required fields
    if (!businessData.name || !businessData.contact_email) {
      throw new ValidationError('Name and contact email are required', {
        name: !businessData.name ? 'Name is required' : undefined,
        contact_email: !businessData.contact_email ? 'Contact email is required' : undefined,
      });
    }

    // Validate name length
    if (businessData.name.length < 2 || businessData.name.length > 100) {
      throw new ValidationError('Business name must be between 2 and 100 characters');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(businessData.contact_email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate phone number format (basic validation)
    if (businessData.phone_number && businessData.phone_number.length > 20) {
      throw new ValidationError('Phone number must be 20 characters or less');
    }

    // Validate organization number format (Swedish format)
    if (businessData.organization_number) {
      const orgNumberRegex = /^\d{6}-?\d{4}$/;
      if (!orgNumberRegex.test(businessData.organization_number)) {
        throw new ValidationError('Invalid organization number format (expected: XXXXXX-XXXX)');
      }
    }

    const { data: business, error } = await this.supabase
      .from('businesses')
      .insert({
        name: businessData.name,
        organization_number: businessData.organization_number || null,
        contact_email: businessData.contact_email,
        phone_number: businessData.phone_number || null,
        address: businessData.address || null,
        subscription_status: 'active',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError('Business with this information already exists');
      }
      throw new Error(`Failed to create business: ${error.message}`);
    }

    return business;
  }

  async updateBusiness(id: string, updates: UpdateBusiness): Promise<Business> {
    if (!id) {
      throw new ValidationError('Business ID is required');
    }

    // Validate updates
    if (updates.name && (updates.name.length < 2 || updates.name.length > 100)) {
      throw new ValidationError('Business name must be between 2 and 100 characters');
    }

    if (updates.contact_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.contact_email)) {
        throw new ValidationError('Invalid email format');
      }
    }

    if (updates.phone_number && updates.phone_number.length > 20) {
      throw new ValidationError('Phone number must be 20 characters or less');
    }

    if (updates.organization_number) {
      const orgNumberRegex = /^\d{6}-?\d{4}$/;
      if (!orgNumberRegex.test(updates.organization_number)) {
        throw new ValidationError('Invalid organization number format (expected: XXXXXX-XXXX)');
      }
    }

    if (updates.subscription_status && 
        !['active', 'inactive', 'suspended'].includes(updates.subscription_status)) {
      throw new ValidationError('Invalid subscription status');
    }

    // Build update object
    const updateData: Partial<UpdateBusiness & { updated_at: string }> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.organization_number !== undefined) updateData.organization_number = updates.organization_number;
    if (updates.contact_email !== undefined) updateData.contact_email = updates.contact_email;
    if (updates.phone_number !== undefined) updateData.phone_number = updates.phone_number;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.subscription_status !== undefined) updateData.subscription_status = updates.subscription_status;

    const { data: business, error } = await this.supabase
      .from('businesses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Business not found');
      }
      if (error.code === '23505') {
        throw new ConflictError('Business with this information already exists');
      }
      throw new Error(`Failed to update business: ${error.message}`);
    }

    return business;
  }

  async deleteBusiness(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('Business ID is required');
    }

    // Check if business has associated stores
    const { data: stores, error: storesError } = await this.supabase
      .from('stores')
      .select('id')
      .eq('business_id', id)
      .limit(1);

    if (storesError) {
      throw new Error(`Failed to check business stores: ${storesError.message}`);
    }

    if (stores && stores.length > 0) {
      throw new ConflictError('Cannot delete business with associated stores');
    }

    // Check if business has associated users
    const { data: users, error: usersError } = await this.supabase
      .from('user_profiles')
      .select('id')
      .eq('business_id', id)
      .limit(1);

    if (usersError) {
      throw new Error(`Failed to check business users: ${usersError.message}`);
    }

    if (users && users.length > 0) {
      throw new ConflictError('Cannot delete business with associated users');
    }

    const { error } = await this.supabase
      .from('businesses')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete business: ${error.message}`);
    }
  }

  async suspendBusiness(id: string, reason?: string): Promise<Business> {
    if (!id) {
      throw new ValidationError('Business ID is required');
    }

    const business = await this.updateBusiness(id, {
      subscription_status: 'suspended',
    });

    // TODO: Log suspension reason if logging service is available
    if (reason) {
      console.log(`Business ${id} suspended: ${reason}`);
    }

    return business;
  }

  async activateBusiness(id: string): Promise<Business> {
    if (!id) {
      throw new ValidationError('Business ID is required');
    }

    return this.updateBusiness(id, {
      subscription_status: 'active',
    });
  }

  async getBusinessStats(id: string): Promise<{
    store_count: number;
    user_count: number;
    created_at: string;
    subscription_status: string;
  }> {
    if (!id) {
      throw new ValidationError('Business ID is required');
    }

    // Verify business exists
    const business = await this.getBusinessById(id);

    // Get store count
    const { count: storeCount, error: storeError } = await this.supabase
      .from('stores')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', id);

    if (storeError) {
      throw new Error(`Failed to count stores: ${storeError.message}`);
    }

    // Get user count
    const { count: userCount, error: userError } = await this.supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', id);

    if (userError) {
      throw new Error(`Failed to count users: ${userError.message}`);
    }

    return {
      store_count: storeCount || 0,
      user_count: userCount || 0,
      created_at: business.created_at,
      subscription_status: business.subscription_status,
    };
  }

  async searchBusinesses(query: string, limit = 20, offset = 0): Promise<BusinessListResult> {
    if (!query) {
      throw new ValidationError('Search query is required');
    }

    return this.getBusinesses({
      search: query,
      limit,
      offset,
    });
  }

  async getBusinessesBySubscriptionStatus(
    status: 'active' | 'inactive' | 'suspended',
    limit = 20,
    offset = 0
  ): Promise<BusinessListResult> {
    return this.getBusinesses({
      subscription_status: status,
      limit,
      offset,
    });
  }
}

// Singleton instance
export const businessService = new BusinessService();