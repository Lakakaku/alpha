import { database } from '@vocilia/database';
import { ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'business_account' | 'admin_account';
  business_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: 'business_account' | 'admin_account';
  business_id?: string;
}

export interface UpdateUserProfile {
  full_name?: string;
  avatar_url?: string;
  role?: 'business_account' | 'admin_account';
  business_id?: string;
}

export class UserService {
  private supabase = database.createClient();

  async getUserById(id: string): Promise<UserProfile> {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    const { data: profile, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('User profile not found');
      }
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    return profile;
  }

  async getUserByEmail(email: string): Promise<UserProfile> {
    if (!email) {
      throw new ValidationError('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    const { data: profile, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('User profile not found');
      }
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    return profile;
  }

  async createUser(userData: CreateUserProfile): Promise<UserProfile> {
    // Validate required fields
    if (!userData.id || !userData.email || !userData.role) {
      throw new ValidationError('ID, email, and role are required', {
        id: !userData.id ? 'ID is required' : undefined,
        email: !userData.email ? 'Email is required' : undefined,
        role: !userData.role ? 'Role is required' : undefined,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate role
    if (!['business_account', 'admin_account'].includes(userData.role)) {
      throw new ValidationError('Invalid role. Must be business_account or admin_account');
    }

    // Validate full name length if provided
    if (userData.full_name && userData.full_name.length > 100) {
      throw new ValidationError('Full name must be 100 characters or less');
    }

    // Validate avatar URL length if provided
    if (userData.avatar_url && userData.avatar_url.length > 500) {
      throw new ValidationError('Avatar URL must be 500 characters or less');
    }

    // If business role, ensure business_id is provided
    if (userData.role === 'business_account' && !userData.business_id) {
      throw new ValidationError('Business ID is required for business accounts');
    }

    const { data: profile, error } = await this.supabase
      .from('user_profiles')
      .insert({
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name || null,
        avatar_url: userData.avatar_url || null,
        role: userData.role,
        business_id: userData.business_id || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError('User with this email or ID already exists');
      }
      throw new Error(`Failed to create user profile: ${error.message}`);
    }

    return profile;
  }

  async updateUser(id: string, updates: UpdateUserProfile): Promise<UserProfile> {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    // Validate updates
    if (updates.full_name && updates.full_name.length > 100) {
      throw new ValidationError('Full name must be 100 characters or less');
    }

    if (updates.avatar_url && updates.avatar_url.length > 500) {
      throw new ValidationError('Avatar URL must be 500 characters or less');
    }

    if (updates.role && !['business_account', 'admin_account'].includes(updates.role)) {
      throw new ValidationError('Invalid role. Must be business_account or admin_account');
    }

    // Build update object
    const updateData: Partial<UpdateUserProfile & { updated_at: string }> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.full_name !== undefined) updateData.full_name = updates.full_name;
    if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.business_id !== undefined) updateData.business_id = updates.business_id;

    const { data: profile, error } = await this.supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('User profile not found');
      }
      if (error.code === '23505') {
        throw new ConflictError('Email already exists');
      }
      throw new Error(`Failed to update user profile: ${error.message}`);
    }

    return profile;
  }

  async deleteUser(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('User ID is required');
    }

    const { error } = await this.supabase
      .from('user_profiles')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete user profile: ${error.message}`);
    }
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Get user role and business_id
    const user = await this.getUserById(userId);

    // Get explicit permissions
    const { data: userPermissions, error } = await this.supabase
      .from('user_permissions')
      .select(`
        permission:permissions(name)
      `)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch user permissions: ${error.message}`);
    }

    const permissions = userPermissions?.map(up => up.permission?.name).filter(Boolean) || [];

    // Add default permissions based on role
    if (user.role === 'admin_account') {
      permissions.push('admin.read', 'admin.write', 'business.read', 'business.write');
    } else if (user.role === 'business_account') {
      permissions.push('business.read', 'feedback.read', 'customers.read');
    }

    return [...new Set(permissions)]; // Remove duplicates
  }

  async addUserPermission(userId: string, permissionName: string): Promise<void> {
    if (!userId || !permissionName) {
      throw new ValidationError('User ID and permission name are required');
    }

    // Get permission ID
    const { data: permission, error: permissionError } = await this.supabase
      .from('permissions')
      .select('id')
      .eq('name', permissionName)
      .single();

    if (permissionError || !permission) {
      throw new NotFoundError('Permission not found');
    }

    // Add user permission
    const { error } = await this.supabase
      .from('user_permissions')
      .insert({
        user_id: userId,
        permission_id: permission.id,
      });

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError('User already has this permission');
      }
      throw new Error(`Failed to add user permission: ${error.message}`);
    }
  }

  async removeUserPermission(userId: string, permissionName: string): Promise<void> {
    if (!userId || !permissionName) {
      throw new ValidationError('User ID and permission name are required');
    }

    // Get permission ID
    const { data: permission, error: permissionError } = await this.supabase
      .from('permissions')
      .select('id')
      .eq('name', permissionName)
      .single();

    if (permissionError || !permission) {
      throw new NotFoundError('Permission not found');
    }

    // Remove user permission
    const { error } = await this.supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission_id', permission.id);

    if (error) {
      throw new Error(`Failed to remove user permission: ${error.message}`);
    }
  }

  async getUsersByBusinessId(businessId: string): Promise<UserProfile[]> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    const { data: profiles, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch users by business: ${error.message}`);
    }

    return profiles || [];
  }

  async searchUsers(query: string, limit = 20, offset = 0): Promise<UserProfile[]> {
    if (!query) {
      throw new ValidationError('Search query is required');
    }

    const { data: profiles, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to search users: ${error.message}`);
    }

    return profiles || [];
  }
}

// Singleton instance
export const userService = new UserService();