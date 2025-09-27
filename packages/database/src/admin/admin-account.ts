import { supabase } from '../client/supabase';
import type { Database } from '../types';

export type AdminAccount = Database['public']['Tables']['admin_accounts']['Row'];
export type AdminAccountInsert = Database['public']['Tables']['admin_accounts']['Insert'];
export type AdminAccountUpdate = Database['public']['Tables']['admin_accounts']['Update'];

export class AdminAccountModel {
  /**
   * Get admin account by user ID
   */
  static async getByUserId(userId: string): Promise<AdminAccount | null> {
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching admin account:', error);
      return null;
    }

    return data;
  }

  /**
   * Get admin account by username
   */
  static async getByUsername(username: string): Promise<AdminAccount | null> {
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching admin account by username:', error);
      return null;
    }

    return data;
  }

  /**
   * Create new admin account
   */
  static async create(adminData: AdminAccountInsert): Promise<AdminAccount | null> {
    const { data, error } = await supabase
      .from('admin_accounts')
      .insert(adminData)
      .select()
      .single();

    if (error) {
      console.error('Error creating admin account:', error);
      return null;
    }

    return data;
  }

  /**
   * Update admin account
   */
  static async update(id: string, updates: AdminAccountUpdate): Promise<AdminAccount | null> {
    const { data, error } = await supabase
      .from('admin_accounts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating admin account:', error);
      return null;
    }

    return data;
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('admin_accounts')
      .update({ 
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating last login:', error);
      return false;
    }

    return true;
  }

  /**
   * Deactivate admin account
   */
  static async deactivate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('admin_accounts')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error deactivating admin account:', error);
      return false;
    }

    return true;
  }

  /**
   * Get all active admin accounts
   */
  static async getAll(): Promise<AdminAccount[]> {
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin accounts:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Validate admin credentials exist
   */
  static async validateExists(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    return !error && !!data;
  }
}