import { supabase } from '../client/supabase';
import type { Database } from '../types';

export type AdminSession = Database['public']['Tables']['admin_sessions']['Row'];
export type AdminSessionInsert = Database['public']['Tables']['admin_sessions']['Insert'];
export type AdminSessionUpdate = Database['public']['Tables']['admin_sessions']['Update'];

export class AdminSessionModel {
  /**
   * Create new admin session
   */
  static async create(sessionData: AdminSessionInsert): Promise<AdminSession | null> {
    // Set expiration to 2 hours from creation
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    const { data, error } = await supabase
      .from('admin_sessions')
      .insert({
        ...sessionData,
        expires_at: expiresAt.toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating admin session:', error);
      return null;
    }

    return data;
  }

  /**
   * Get session by token
   */
  static async getByToken(sessionToken: string): Promise<AdminSession | null> {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching session by token:', error);
      return null;
    }

    return data;
  }

  /**
   * Get active sessions for admin
   */
  static async getActiveByAdminId(adminId: string): Promise<AdminSession[]> {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active sessions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update session activity
   */
  static async updateActivity(sessionToken: string): Promise<boolean> {
    const { error } = await supabase
      .from('admin_sessions')
      .update({ 
        last_activity_at: new Date().toISOString()
      })
      .eq('session_token', sessionToken)
      .eq('is_active', true);

    if (error) {
      console.error('Error updating session activity:', error);
      return false;
    }

    return true;
  }

  /**
   * End session (logout)
   */
  static async end(sessionToken: string): Promise<boolean> {
    const { error } = await supabase
      .from('admin_sessions')
      .update({ 
        is_active: false,
        ended_at: new Date().toISOString()
      })
      .eq('session_token', sessionToken);

    if (error) {
      console.error('Error ending session:', error);
      return false;
    }

    return true;
  }

  /**
   * End all sessions for admin
   */
  static async endAllForAdmin(adminId: string): Promise<boolean> {
    const { error } = await supabase
      .from('admin_sessions')
      .update({ 
        is_active: false,
        ended_at: new Date().toISOString()
      })
      .eq('admin_id', adminId)
      .eq('is_active', true);

    if (error) {
      console.error('Error ending all sessions for admin:', error);
      return false;
    }

    return true;
  }

  /**
   * Check if session is valid (active and not expired)
   */
  static async isValid(sessionToken: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('expires_at, is_active')
      .eq('session_token', sessionToken)
      .single();

    if (error || !data) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    return data.is_active && expiresAt > now;
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpired(): Promise<number> {
    const { data, error } = await supabase
      .from('admin_sessions')
      .update({ 
        is_active: false,
        ended_at: new Date().toISOString()
      })
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Get session with admin details
   */
  static async getWithAdmin(sessionToken: string): Promise<(AdminSession & { admin_account?: any }) | null> {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select(`
        *,
        admin_account:admin_accounts(*)
      `)
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching session with admin:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all sessions for admin (for audit purposes)
   */
  static async getAllForAdmin(adminId: string, limit = 50): Promise<AdminSession[]> {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching sessions for admin:', error);
      return [];
    }

    return data || [];
  }
}