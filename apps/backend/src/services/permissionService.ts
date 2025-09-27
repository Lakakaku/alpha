import { database } from '@vocilia/database';
import { ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  created_at: string;
}

export interface CreatePermission {
  name: string;
  description: string;
  category: string;
}

export interface UpdatePermission {
  name?: string;
  description?: string;
  category?: string;
}

export interface PermissionListOptions {
  category?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface PermissionListResult {
  permissions: Permission[];
  total: number;
  has_more: boolean;
}

export interface UserPermissionAssignment {
  user_id: string;
  permission_id: string;
  permission_name: string;
  assigned_at: string;
}

export class PermissionService {
  private supabase = database.createClient();

  async getPermissionById(id: string): Promise<Permission> {
    if (!id) {
      throw new ValidationError('Permission ID is required');
    }

    const { data: permission, error } = await this.supabase
      .from('permissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Permission not found');
      }
      throw new Error(`Failed to fetch permission: ${error.message}`);
    }

    return permission;
  }

  async getPermissionByName(name: string): Promise<Permission> {
    if (!name) {
      throw new ValidationError('Permission name is required');
    }

    const { data: permission, error } = await this.supabase
      .from('permissions')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Permission not found');
      }
      throw new Error(`Failed to fetch permission: ${error.message}`);
    }

    return permission;
  }

  async getPermissions(options: PermissionListOptions = {}): Promise<PermissionListResult> {
    const {
      category,
      limit = 50,
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
      .from('permissions')
      .select('*', { count: 'exact' });

    // Apply filters
    if (category) {
      const validCategories = ['business', 'customer', 'admin', 'feedback'];
      if (!validCategories.includes(category)) {
        throw new ValidationError(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply pagination and ordering
    query = query
      .range(offset, offset + limit - 1)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    const { data: permissions, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch permissions: ${error.message}`);
    }

    return {
      permissions: permissions || [],
      total: count || 0,
      has_more: (count || 0) > offset + limit,
    };
  }

  async createPermission(permissionData: CreatePermission): Promise<Permission> {
    // Validate required fields
    if (!permissionData.name || !permissionData.description || !permissionData.category) {
      throw new ValidationError('Name, description, and category are required', {
        name: !permissionData.name ? 'Name is required' : undefined,
        description: !permissionData.description ? 'Description is required' : undefined,
        category: !permissionData.category ? 'Category is required' : undefined,
      });
    }

    // Validate name format (should be kebab-case like 'business.read')
    const nameRegex = /^[a-z]+(\.[a-z]+)*$/;
    if (!nameRegex.test(permissionData.name)) {
      throw new ValidationError('Permission name must be in format: category.action (e.g., business.read)');
    }

    // Validate category
    const validCategories = ['business', 'customer', 'admin', 'feedback'];
    if (!validCategories.includes(permissionData.category)) {
      throw new ValidationError(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }

    // Validate description length
    if (permissionData.description.length < 5 || permissionData.description.length > 200) {
      throw new ValidationError('Description must be between 5 and 200 characters');
    }

    const { data: permission, error } = await this.supabase
      .from('permissions')
      .insert({
        name: permissionData.name,
        description: permissionData.description,
        category: permissionData.category,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError('Permission with this name already exists');
      }
      throw new Error(`Failed to create permission: ${error.message}`);
    }

    return permission;
  }

  async updatePermission(id: string, updates: UpdatePermission): Promise<Permission> {
    if (!id) {
      throw new ValidationError('Permission ID is required');
    }

    // Validate updates
    if (updates.name) {
      const nameRegex = /^[a-z]+(\.[a-z]+)*$/;
      if (!nameRegex.test(updates.name)) {
        throw new ValidationError('Permission name must be in format: category.action (e.g., business.read)');
      }
    }

    if (updates.category) {
      const validCategories = ['business', 'customer', 'admin', 'feedback'];
      if (!validCategories.includes(updates.category)) {
        throw new ValidationError(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }
    }

    if (updates.description && (updates.description.length < 5 || updates.description.length > 200)) {
      throw new ValidationError('Description must be between 5 and 200 characters');
    }

    // Build update object
    const updateData: Partial<UpdatePermission> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;

    const { data: permission, error } = await this.supabase
      .from('permissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Permission not found');
      }
      if (error.code === '23505') {
        throw new ConflictError('Permission with this name already exists');
      }
      throw new Error(`Failed to update permission: ${error.message}`);
    }

    return permission;
  }

  async deletePermission(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('Permission ID is required');
    }

    // Check if permission is assigned to users
    const { data: assignments, error: assignmentError } = await this.supabase
      .from('user_permissions')
      .select('user_id')
      .eq('permission_id', id)
      .limit(1);

    if (assignmentError) {
      throw new Error(`Failed to check permission assignments: ${assignmentError.message}`);
    }

    if (assignments && assignments.length > 0) {
      throw new ConflictError('Cannot delete permission that is assigned to users');
    }

    const { error } = await this.supabase
      .from('permissions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete permission: ${error.message}`);
    }
  }

  async getPermissionsByCategory(category: string): Promise<Permission[]> {
    if (!category) {
      throw new ValidationError('Category is required');
    }

    const result = await this.getPermissions({ category });
    return result.permissions;
  }

  async searchPermissions(query: string, limit = 20, offset = 0): Promise<PermissionListResult> {
    if (!query) {
      throw new ValidationError('Search query is required');
    }

    return this.getPermissions({
      search: query,
      limit,
      offset,
    });
  }

  async assignPermissionToUser(userId: string, permissionId: string): Promise<void> {
    if (!userId || !permissionId) {
      throw new ValidationError('User ID and Permission ID are required');
    }

    // Verify permission exists
    await this.getPermissionById(permissionId);

    // Verify user exists (we'll just check in user_profiles table)
    const { data: user, error: userError } = await this.supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundError('User not found');
    }

    // Create assignment
    const { error } = await this.supabase
      .from('user_permissions')
      .insert({
        user_id: userId,
        permission_id: permissionId,
      });

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError('User already has this permission');
      }
      throw new Error(`Failed to assign permission: ${error.message}`);
    }
  }

  async removePermissionFromUser(userId: string, permissionId: string): Promise<void> {
    if (!userId || !permissionId) {
      throw new ValidationError('User ID and Permission ID are required');
    }

    const { error } = await this.supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission_id', permissionId);

    if (error) {
      throw new Error(`Failed to remove permission: ${error.message}`);
    }
  }

  async assignPermissionByName(userId: string, permissionName: string): Promise<void> {
    if (!userId || !permissionName) {
      throw new ValidationError('User ID and Permission name are required');
    }

    const permission = await this.getPermissionByName(permissionName);
    await this.assignPermissionToUser(userId, permission.id);
  }

  async removePermissionByName(userId: string, permissionName: string): Promise<void> {
    if (!userId || !permissionName) {
      throw new ValidationError('User ID and Permission name are required');
    }

    const permission = await this.getPermissionByName(permissionName);
    await this.removePermissionFromUser(userId, permission.id);
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const { data: userPermissions, error } = await this.supabase
      .from('user_permissions')
      .select(`
        permission:permissions(*)
      `)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch user permissions: ${error.message}`);
    }

    return userPermissions?.map(up => up.permission).filter(Boolean) || [];
  }

  async getPermissionAssignments(permissionId: string): Promise<UserPermissionAssignment[]> {
    if (!permissionId) {
      throw new ValidationError('Permission ID is required');
    }

    const { data: assignments, error } = await this.supabase
      .from('user_permissions')
      .select(`
        user_id,
        permission_id,
        created_at,
        permission:permissions(name)
      `)
      .eq('permission_id', permissionId);

    if (error) {
      throw new Error(`Failed to fetch permission assignments: ${error.message}`);
    }

    return assignments?.map(assignment => ({
      user_id: assignment.user_id,
      permission_id: assignment.permission_id,
      permission_name: assignment.permission?.name || 'Unknown',
      assigned_at: assignment.created_at,
    })) || [];
  }

  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    if (!userId || !permissionName) {
      return false;
    }

    try {
      const userPermissions = await this.getUserPermissions(userId);
      return userPermissions.some(permission => permission.name === permissionName);
    } catch (error) {
      return false;
    }
  }

  async getDefaultPermissionsByRole(role: 'business_account' | 'admin_account'): Promise<string[]> {
    if (role === 'admin_account') {
      return ['admin.read', 'admin.write', 'business.read', 'business.write', 'feedback.read', 'feedback.write'];
    } else if (role === 'business_account') {
      return ['business.read', 'feedback.read', 'customers.read'];
    }
    
    return [];
  }
}

// Singleton instance
export const permissionService = new PermissionService();