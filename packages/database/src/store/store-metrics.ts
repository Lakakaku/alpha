import { supabase } from '../client/supabase';
import type { Database } from '../types';

export type StoreStatusMetric = Database['public']['Tables']['store_status_metrics']['Row'];
export type StoreStatusMetricInsert = Database['public']['Tables']['store_status_metrics']['Insert'];
export type StoreStatusMetricUpdate = Database['public']['Tables']['store_status_metrics']['Update'];

export type MetricType = 'sync' | 'error' | 'performance' | 'availability';
export type MetricUnit = 'count' | 'ms' | 'percentage' | 'score';

export class StoreMetricsModel {
  /**
   * Record a new metric
   */
  static async record(metricData: StoreStatusMetricInsert): Promise<StoreStatusMetric | null> {
    const { data, error } = await supabase
      .from('store_status_metrics')
      .insert({
        ...metricData,
        recorded_at: metricData.recorded_at || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording store metric:', error);
      return null;
    }

    return data;
  }

  /**
   * Get metrics for a store by type
   */
  static async getByStoreAndType(
    storeId: string, 
    metricType: MetricType, 
    limit = 100
  ): Promise<StoreStatusMetric[]> {
    const { data, error } = await supabase
      .from('store_status_metrics')
      .select('*')
      .eq('store_id', storeId)
      .eq('metric_type', metricType)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching store metrics:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get recent metrics for a store (last 24 hours)
   */
  static async getRecentByStore(storeId: string): Promise<StoreStatusMetric[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data, error } = await supabase
      .from('store_status_metrics')
      .select('*')
      .eq('store_id', storeId)
      .gte('recorded_at', yesterday.toISOString())
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('Error fetching recent store metrics:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get metrics for date range
   */
  static async getByDateRange(
    storeId: string,
    startDate: string,
    endDate: string,
    metricType?: MetricType
  ): Promise<StoreStatusMetric[]> {
    let query = supabase
      .from('store_status_metrics')
      .select('*')
      .eq('store_id', storeId)
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate)
      .order('recorded_at', { ascending: true });

    if (metricType) {
      query = query.eq('metric_type', metricType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching metrics by date range:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get latest metric of each type for a store
   */
  static async getLatestByStore(storeId: string): Promise<Record<MetricType, StoreStatusMetric | null>> {
    const metricTypes: MetricType[] = ['sync', 'error', 'performance', 'availability'];
    const result: Record<MetricType, StoreStatusMetric | null> = {
      sync: null,
      error: null,
      performance: null,
      availability: null
    };

    for (const type of metricTypes) {
      const { data, error } = await supabase
        .from('store_status_metrics')
        .select('*')
        .eq('store_id', storeId)
        .eq('metric_type', type)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        result[type] = data;
      }
    }

    return result;
  }

  /**
   * Record sync metric
   */
  static async recordSync(
    storeId: string, 
    success: boolean, 
    duration?: number,
    recordCount?: number
  ): Promise<StoreStatusMetric | null> {
    return this.record({
      store_id: storeId,
      metric_type: 'sync',
      metric_value: success ? 1 : 0,
      metric_unit: 'count',
      metadata: {
        success,
        duration_ms: duration,
        record_count: recordCount
      }
    });
  }

  /**
   * Record error metric
   */
  static async recordError(
    storeId: string, 
    errorCount: number,
    errorDetails?: any
  ): Promise<StoreStatusMetric | null> {
    return this.record({
      store_id: storeId,
      metric_type: 'error',
      metric_value: errorCount,
      metric_unit: 'count',
      metadata: {
        error_details: errorDetails
      }
    });
  }

  /**
   * Record performance metric
   */
  static async recordPerformance(
    storeId: string, 
    score: number,
    details?: any
  ): Promise<StoreStatusMetric | null> {
    return this.record({
      store_id: storeId,
      metric_type: 'performance',
      metric_value: score,
      metric_unit: 'score',
      metadata: details
    });
  }

  /**
   * Record availability metric
   */
  static async recordAvailability(
    storeId: string, 
    isOnline: boolean,
    responseTime?: number
  ): Promise<StoreStatusMetric | null> {
    return this.record({
      store_id: storeId,
      metric_type: 'availability',
      metric_value: isOnline ? 100 : 0,
      metric_unit: 'percentage',
      metadata: {
        online: isOnline,
        response_time_ms: responseTime
      }
    });
  }

  /**
   * Get aggregated metrics for dashboard
   */
  static async getAggregatedMetrics(storeId: string, hours = 24): Promise<{
    errorCount: number;
    avgPerformance: number;
    availabilityPercentage: number;
    syncSuccessRate: number;
  }> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const [errors, performance, availability, syncs] = await Promise.all([
      this.getByDateRange(storeId, since.toISOString(), new Date().toISOString(), 'error'),
      this.getByDateRange(storeId, since.toISOString(), new Date().toISOString(), 'performance'),
      this.getByDateRange(storeId, since.toISOString(), new Date().toISOString(), 'availability'),
      this.getByDateRange(storeId, since.toISOString(), new Date().toISOString(), 'sync')
    ]);

    const errorCount = errors.reduce((sum, metric) => sum + metric.metric_value, 0);
    const avgPerformance = performance.length > 0 
      ? performance.reduce((sum, metric) => sum + metric.metric_value, 0) / performance.length 
      : 0;
    const availabilityPercentage = availability.length > 0
      ? availability.reduce((sum, metric) => sum + metric.metric_value, 0) / availability.length
      : 0;
    const syncSuccessRate = syncs.length > 0
      ? syncs.reduce((sum, metric) => sum + metric.metric_value, 0) / syncs.length * 100
      : 0;

    return {
      errorCount,
      avgPerformance,
      availabilityPercentage,
      syncSuccessRate
    };
  }

  /**
   * Delete old metrics (cleanup)
   */
  static async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from('store_status_metrics')
      .delete()
      .lt('recorded_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Error deleting old metrics:', error);
      return 0;
    }

    return data?.length || 0;
  }
}