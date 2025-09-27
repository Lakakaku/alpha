import { supabase } from '../client/supabase';
import type { Database } from '../types';

export type Store = Database['public']['Tables']['stores']['Row'];
export type StoreInsert = Database['public']['Tables']['stores']['Insert'];
export type StoreUpdate = Database['public']['Tables']['stores']['Update'];

export type SyncStatus = 'pending' | 'success' | 'failed';

export class StoreModel {
  /**
   * Get store by ID with monitoring fields
   */
  static async getById(id: string): Promise<Store | null> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching store:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all stores with pagination and monitoring status
   */
  static async getAll(
    page = 1, 
    limit = 20, 
    filters?: {
      search?: string;
      onlineStatus?: boolean;
      syncStatus?: SyncStatus;
      monitoringEnabled?: boolean;
    }
  ): Promise<{ stores: Store[]; total: number }> {
    let query = supabase
      .from('stores')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,business_email.ilike.%${filters.search}%`);
    }
    if (filters?.onlineStatus !== undefined) {
      query = query.eq('online_status', filters.onlineStatus);
    }
    if (filters?.syncStatus) {
      query = query.eq('sync_status', filters.syncStatus);
    }
    if (filters?.monitoringEnabled !== undefined) {
      query = query.eq('monitoring_enabled', filters.monitoringEnabled);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching stores:', error);
      return { stores: [], total: 0 };
    }

    return { 
      stores: data || [], 
      total: count || 0 
    };
  }

  /**
   * Create new store with default monitoring settings
   */
  static async create(storeData: StoreInsert): Promise<Store | null> {
    const { data, error } = await supabase
      .from('stores')
      .insert({
        ...storeData,
        sync_status: 'pending',
        error_count: 0,
        online_status: false,
        monitoring_enabled: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating store:', error);
      return null;
    }

    return data;
  }

  /**
   * Update store information
   */
  static async update(id: string, updates: StoreUpdate): Promise<Store | null> {
    const { data, error } = await supabase
      .from('stores')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating store:', error);
      return null;
    }

    return data;
  }

  /**
   * Update sync status
   */
  static async updateSyncStatus(
    id: string, 
    status: SyncStatus, 
    lastSyncAt?: string
  ): Promise<boolean> {
    const updates: any = { 
      sync_status: status,
      updated_at: new Date().toISOString()
    };

    if (lastSyncAt) {
      updates.last_sync_at = lastSyncAt;
    }

    // Reset error count on successful sync
    if (status === 'success') {
      updates.error_count = 0;
    }

    const { error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating sync status:', error);
      return false;
    }

    return true;
  }

  /**
   * Update online status
   */
  static async updateOnlineStatus(id: string, isOnline: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('stores')
      .update({ 
        online_status: isOnline,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating online status:', error);
      return false;
    }

    return true;
  }

  /**
   * Update performance score
   */
  static async updatePerformanceScore(id: string, score: number): Promise<boolean> {
    // Validate score is between 0.00 and 10.00
    if (score < 0 || score > 10) {
      console.error('Performance score must be between 0.00 and 10.00');
      return false;
    }

    const { error } = await supabase
      .from('stores')
      .update({ 
        performance_score: score,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating performance score:', error);
      return false;
    }

    return true;
  }

  /**
   * Increment error count
   */
  static async incrementErrorCount(id: string): Promise<boolean> {
    const { data: store, error: fetchError } = await supabase
      .from('stores')
      .select('error_count')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching store for error count:', fetchError);
      return false;
    }

    const newErrorCount = (store.error_count || 0) + 1;

    const { error } = await supabase
      .from('stores')
      .update({ 
        error_count: newErrorCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error incrementing error count:', error);
      return false;
    }

    return true;
  }

  /**
   * Reset error count
   */
  static async resetErrorCount(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('stores')
      .update({ 
        error_count: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error resetting error count:', error);
      return false;
    }

    return true;
  }

  /**
   * Toggle monitoring status
   */
  static async toggleMonitoring(id: string, enabled: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('stores')
      .update({ 
        monitoring_enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error toggling monitoring:', error);
      return false;
    }

    return true;
  }

  /**
   * Get stores by sync status
   */
  static async getBySyncStatus(status: SyncStatus): Promise<Store[]> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('sync_status', status)
      .order('last_sync_at', { ascending: true, nullsFirst: true });

    if (error) {
      console.error('Error fetching stores by sync status:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get online stores
   */
  static async getOnlineStores(): Promise<Store[]> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('online_status', true)
      .eq('monitoring_enabled', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching online stores:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get stores with errors
   */
  static async getStoresWithErrors(minErrorCount = 1): Promise<Store[]> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .gte('error_count', minErrorCount)
      .order('error_count', { ascending: false });

    if (error) {
      console.error('Error fetching stores with errors:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get stores needing sync (pending or failed)
   */
  static async getStoresNeedingSync(): Promise<Store[]> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .in('sync_status', ['pending', 'failed'])
      .eq('monitoring_enabled', true)
      .order('last_sync_at', { ascending: true, nullsFirst: true });

    if (error) {
      console.error('Error fetching stores needing sync:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get comprehensive store statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    online: number;
    offline: number;
    syncPending: number;
    syncSuccess: number;
    syncFailed: number;
    withErrors: number;
    monitoringEnabled: number;
    avgPerformanceScore: number;
  }> {
    const { data, error } = await supabase
      .from('stores')
      .select('online_status, sync_status, error_count, monitoring_enabled, performance_score');

    if (error) {
      console.error('Error fetching store statistics:', error);
      return {
        total: 0,
        online: 0,
        offline: 0,
        syncPending: 0,
        syncSuccess: 0,
        syncFailed: 0,
        withErrors: 0,
        monitoringEnabled: 0,
        avgPerformanceScore: 0
      };
    }

    const stores = data || [];
    const total = stores.length;
    const online = stores.filter(s => s.online_status).length;
    const offline = total - online;
    const syncPending = stores.filter(s => s.sync_status === 'pending').length;
    const syncSuccess = stores.filter(s => s.sync_status === 'success').length;
    const syncFailed = stores.filter(s => s.sync_status === 'failed').length;
    const withErrors = stores.filter(s => (s.error_count || 0) > 0).length;
    const monitoringEnabled = stores.filter(s => s.monitoring_enabled).length;
    
    const storesWithScores = stores.filter(s => s.performance_score !== null);
    const avgPerformanceScore = storesWithScores.length > 0
      ? storesWithScores.reduce((sum, s) => sum + (s.performance_score || 0), 0) / storesWithScores.length
      : 0;

    return {
      total,
      online,
      offline,
      syncPending,
      syncSuccess,
      syncFailed,
      withErrors,
      monitoringEnabled,
      avgPerformanceScore
    };
  }

  /**
   * Search stores by name or email
   */
  static async search(query: string, limit = 50): Promise<Store[]> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .or(`name.ilike.%${query}%,business_email.ilike.%${query}%,physical_address.ilike.%${query}%`)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error searching stores:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Delete store
   */
  static async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting store:', error);
      return false;
    }

    return true;
  }

  /**
   * Validate store data
   */
  static validateStoreData(data: Partial<StoreInsert>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.name && data.name.trim().length < 2) {
      errors.push('Store name must be at least 2 characters');
    }

    if (data.business_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.business_email)) {
      errors.push('Invalid business email format');
    }

    if (data.phone_number && !/^\+46\s?\d{1,3}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(data.phone_number)) {
      errors.push('Invalid Swedish phone number format');
    }

    if (data.physical_address && data.physical_address.trim().length < 10) {
      errors.push('Physical address must be at least 10 characters');
    }

    if (data.business_registration_number && !/^\d{6}-\d{4}$/.test(data.business_registration_number)) {
      errors.push('Invalid Swedish business registration number format (XXXXXX-XXXX)');
    }

    if (data.performance_score !== undefined && (data.performance_score < 0 || data.performance_score > 10)) {
      errors.push('Performance score must be between 0.00 and 10.00');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}