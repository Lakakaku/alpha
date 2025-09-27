// QR Code Management System Database Utilities
// Provides type-safe database operations for QR functionality

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  QRCodeStore,
  QRScanEvent,
  QRAnalytics5Min,
  QRAnalyticsHourly,
  QRAnalyticsDaily,
  QRCodeHistory,
  QRPrintTemplate,
  QRRegenerateRequest,
  QRRegenerateResponse,
  QRBulkRequest,
  QRBulkResponse,
  QRScanRequest,
  QRAnalyticsRequest,
  QRAnalyticsResponse,
  QRStatus,
  QRActionType,
  PageSize,
  BorderStyle
} from '@vocilia/types/qr';

export class QRDatabase {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Store QR Management
  async getStoreQR(storeId: string): Promise<QRCodeStore | null> {
    const { data, error } = await this.supabase
      .from('stores')
      .select(`
        id,
        business_id,
        name,
        qr_code_data,
        qr_status,
        qr_generated_at,
        qr_version,
        qr_transition_until,
        created_at,
        updated_at,
        verification_status
      `)
      .eq('id', storeId)
      .single();

    if (error) throw error;
    return data;
  }

  async getBusinessStores(businessId: string): Promise<QRCodeStore[]> {
    const { data, error } = await this.supabase
      .from('stores')
      .select(`
        id,
        business_id,
        name,
        qr_code_data,
        qr_status,
        qr_generated_at,
        qr_version,
        qr_transition_until,
        created_at,
        updated_at,
        verification_status
      `)
      .eq('business_id', businessId)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async updateStoreQRStatus(storeId: string, status: QRStatus): Promise<void> {
    const { error } = await this.supabase
      .from('stores')
      .update({
        qr_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId);

    if (error) throw error;
  }

  // QR Regeneration (using database function for atomic operation)
  async regenerateStoreQR(
    storeId: string,
    reason: string,
    userId: string,
    transitionHours: number = 24
  ): Promise<QRRegenerateResponse> {
    const { data, error } = await this.supabase.rpc('regenerate_store_qr', {
      p_store_id: storeId,
      p_reason: reason,
      p_user_id: userId,
      p_transition_hours: transitionHours
    });

    if (error) throw error;

    const result = data as any;
    if (!result.success) {
      throw new Error(result.error || 'QR regeneration failed');
    }

    return {
      success: true,
      store_id: storeId,
      new_qr_version: result.new_version,
      new_qr_data: result.new_qr_data,
      transition_until: result.transition_until,
      message: 'QR code regenerated successfully'
    };
  }

  // Bulk Operations
  async bulkRegenerateQR(
    storeIds: string[],
    reason: string,
    userId: string,
    transitionHours: number = 24
  ): Promise<QRBulkResponse> {
    const batchId = crypto.randomUUID();
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const storeId of storeIds) {
      try {
        const result = await this.regenerateStoreQR(storeId, reason, userId, transitionHours);

        // Update history with batch ID
        await this.updateHistoryBatchId(storeId, batchId);

        results.push({
          store_id: storeId,
          success: true,
          new_qr_version: result.new_qr_version
        });
        successCount++;
      } catch (error: any) {
        results.push({
          store_id: storeId,
          success: false,
          error_message: error.message
        });
        failureCount++;
      }
    }

    return {
      success: successCount > 0,
      total_stores: storeIds.length,
      successful_operations: successCount,
      failed_operations: failureCount,
      batch_operation_id: batchId,
      results,
      message: `Bulk operation completed: ${successCount} successful, ${failureCount} failed`
    };
  }

  private async updateHistoryBatchId(storeId: string, batchId: string): Promise<void> {
    const { error } = await this.supabase
      .from('qr_code_history')
      .update({ batch_operation_id: batchId })
      .eq('store_id', storeId)
      .order('changed_at', { ascending: false })
      .limit(1);

    if (error) throw error;
  }

  // Scan Tracking
  async recordScan(scanEvent: QRScanRequest): Promise<void> {
    const { error } = await this.supabase
      .from('qr_scan_events')
      .insert({
        store_id: scanEvent.store_id,
        user_agent: scanEvent.user_agent,
        referrer: scanEvent.referrer || null,
        ip_address: '0.0.0.0', // Will be set from request headers in backend
        qr_version: scanEvent.qr_version,
        session_id: scanEvent.session_id
      });

    if (error) throw error;
  }

  async getScanEvents(
    storeId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<QRScanEvent[]> {
    const { data, error } = await this.supabase
      .from('qr_scan_events')
      .select('*')
      .eq('store_id', storeId)
      .order('scanned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  // Analytics
  async getAnalytics5Min(
    storeId: string,
    startDate: string,
    endDate: string
  ): Promise<QRAnalytics5Min[]> {
    const { data, error } = await this.supabase
      .from('qr_analytics_5min')
      .select('*')
      .eq('store_id', storeId)
      .gte('time_bucket', startDate)
      .lte('time_bucket', endDate)
      .order('time_bucket', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getAnalyticsHourly(
    storeId: string,
    startDate: string,
    endDate: string
  ): Promise<QRAnalyticsHourly[]> {
    const { data, error } = await this.supabase
      .from('qr_analytics_hourly')
      .select('*')
      .eq('store_id', storeId)
      .gte('hour_bucket', startDate)
      .lte('hour_bucket', endDate)
      .order('hour_bucket', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getAnalyticsDaily(
    storeId: string,
    startDate: string,
    endDate: string
  ): Promise<QRAnalyticsDaily[]> {
    const { data, error } = await this.supabase
      .from('qr_analytics_daily')
      .select('*')
      .eq('store_id', storeId)
      .gte('date_bucket', startDate)
      .lte('date_bucket', endDate)
      .order('date_bucket', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getAggregatedAnalytics(
    storeId: string,
    request: QRAnalyticsRequest
  ): Promise<QRAnalyticsResponse> {
    const endDate = request.end_date || new Date().toISOString();
    const startDate = request.start_date || this.calculateStartDate(request.period, endDate);

    let analyticsData: any[] = [];
    let totalScans = 0;
    let uniqueSessions = 0;
    let peakActivity = { time: '', scan_count: 0 };

    switch (request.period) {
      case 'hour':
        analyticsData = await this.getAnalytics5Min(storeId, startDate, endDate);
        break;
      case 'day':
        analyticsData = await this.getAnalyticsHourly(storeId, startDate, endDate);
        break;
      case 'week':
      case 'month':
        analyticsData = await this.getAnalyticsDaily(storeId, startDate, endDate);
        break;
    }

    // Calculate totals and peak activity
    analyticsData.forEach(point => {
      totalScans += point.scan_count;
      uniqueSessions += point.unique_sessions;

      if (point.scan_count > peakActivity.scan_count) {
        peakActivity = {
          time: point.time_bucket || point.hour_bucket || point.date_bucket,
          scan_count: point.scan_count
        };
      }
    });

    return {
      success: true,
      store_id: storeId,
      period: request.period,
      total_scans: totalScans,
      unique_sessions: uniqueSessions,
      peak_activity: peakActivity,
      data_points: analyticsData.map(point => ({
        time: point.time_bucket || point.hour_bucket || point.date_bucket,
        scan_count: point.scan_count,
        unique_sessions: point.unique_sessions
      }))
    };
  }

  private calculateStartDate(period: string, endDate: string): string {
    const end = new Date(endDate);
    switch (period) {
      case 'hour':
        end.setHours(end.getHours() - 1);
        break;
      case 'day':
        end.setDate(end.getDate() - 1);
        break;
      case 'week':
        end.setDate(end.getDate() - 7);
        break;
      case 'month':
        end.setMonth(end.getMonth() - 1);
        break;
    }
    return end.toISOString();
  }

  // QR Code History
  async getQRHistory(
    storeId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<QRCodeHistory[]> {
    const { data, error } = await this.supabase
      .from('qr_code_history')
      .select('*')
      .eq('store_id', storeId)
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  async addHistoryRecord(
    storeId: string,
    actionType: QRActionType,
    oldQrData: string | null,
    newQrData: string,
    oldVersion: number | null,
    newVersion: number,
    reason: string,
    userId: string,
    batchId: string | null = null
  ): Promise<void> {
    const { error } = await this.supabase
      .from('qr_code_history')
      .insert({
        store_id: storeId,
        action_type: actionType,
        old_qr_data: oldQrData,
        new_qr_data: newQrData,
        old_version: oldVersion,
        new_version: newVersion,
        reason,
        changed_by: userId,
        batch_operation_id: batchId
      });

    if (error) throw error;
  }

  // Print Templates
  async getBusinessTemplates(businessId: string): Promise<QRPrintTemplate[]> {
    const { data, error } = await this.supabase
      .from('qr_print_templates')
      .select('*')
      .eq('business_id', businessId)
      .order('is_default', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getDefaultTemplate(businessId: string): Promise<QRPrintTemplate | null> {
    const { data, error } = await this.supabase
      .from('qr_print_templates')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_default', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data;
  }

  async createTemplate(
    template: Omit<QRPrintTemplate, 'id' | 'created_at' | 'updated_at'>
  ): Promise<QRPrintTemplate> {
    // If this is the first template for the business, make it default
    const existingTemplates = await this.getBusinessTemplates(template.business_id);
    const isFirstTemplate = existingTemplates.length === 0;

    const { data, error } = await this.supabase
      .from('qr_print_templates')
      .insert({
        ...template,
        is_default: template.is_default || isFirstTemplate
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<QRPrintTemplate>
  ): Promise<QRPrintTemplate> {
    const { data, error } = await this.supabase
      .from('qr_print_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await this.supabase
      .from('qr_print_templates')
      .delete()
      .eq('id', templateId);

    if (error) throw error;
  }

  async setDefaultTemplate(templateId: string, businessId: string): Promise<void> {
    // First, unset any existing default templates
    await this.supabase
      .from('qr_print_templates')
      .update({ is_default: false })
      .eq('business_id', businessId)
      .eq('is_default', true);

    // Set the new default template
    const { error } = await this.supabase
      .from('qr_print_templates')
      .update({ is_default: true })
      .eq('id', templateId);

    if (error) throw error;
  }

  // Real-time Subscriptions
  subscribeToScanEvents(
    storeId: string,
    callback: (payload: any) => void
  ) {
    return this.supabase
      .channel(`qr_scans_${storeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'qr_scan_events',
          filter: `store_id=eq.${storeId}`
        },
        callback
      )
      .subscribe();
  }

  subscribeToAnalyticsUpdates(
    storeId: string,
    callback: (payload: any) => void
  ) {
    return this.supabase
      .channel(`qr_analytics_${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'qr_analytics_5min',
          filter: `store_id=eq.${storeId}`
        },
        callback
      )
      .subscribe();
  }

  // Utility Methods
  async completeQRTransitions(): Promise<number> {
    const { data, error } = await this.supabase.rpc('complete_qr_transitions');
    if (error) throw error;
    return data as number;
  }

  async aggregateScans5Min(timeBucket?: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('aggregate_qr_scans_5min', {
      p_time_bucket: timeBucket || null
    });
    if (error) throw error;
    return data as number;
  }

  async cleanupOldScanEvents(): Promise<number> {
    const { data, error } = await this.supabase.rpc('cleanup_old_scan_events');
    if (error) throw error;
    return data as number;
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('stores')
        .select('id')
        .limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}

// Factory function for creating QR database instance
export function createQRDatabase(supabaseUrl: string, supabaseKey: string): QRDatabase {
  return new QRDatabase(supabaseUrl, supabaseKey);
}

// Export types for convenience
export type {
  QRCodeStore,
  QRScanEvent,
  QRAnalytics5Min,
  QRAnalyticsHourly,
  QRAnalyticsDaily,
  QRCodeHistory,
  QRPrintTemplate,
  QRRegenerateRequest,
  QRRegenerateResponse,
  QRBulkRequest,
  QRBulkResponse,
  QRScanRequest,
  QRAnalyticsRequest,
  QRAnalyticsResponse
};