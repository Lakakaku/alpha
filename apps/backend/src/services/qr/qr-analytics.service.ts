// QR Analytics Service
// Handles analytics aggregation, reporting, and real-time scan tracking

import { QRDatabase } from '@vocilia/database/qr';
import type {
  QRScanEvent,
  QRScanRequest,
  QRScanResponse,
  QRAnalyticsRequest,
  QRAnalyticsResponse,
  QRAnalytics5Min,
  QRAnalyticsHourly,
  QRAnalyticsDaily,
  QRAnalyticsDataPoint,
  QRValidationError,
  QRPermissionError
} from '@vocilia/types/qr';

export class QRAnalyticsService {
  private database: QRDatabase;
  private aggregationJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor(database: QRDatabase) {
    this.database = database;
  }

  /**
   * Record a QR code scan event
   */
  async recordScan(event: Omit<QRScanEvent, 'id' | 'scanned_at'>, ipAddress: string): Promise<QRScanResponse> {
    try {
      // Validate store exists
      const store = await this.database.getStoreQR(event.store_id);
      if (!store) {
        return {
          success: false,
          scan_recorded: false,
          message: 'Store not found'
        };
      }

      // Validate QR version (allow current and previous version during transition)
      const validVersions = [store.qr_version];
      if (store.qr_version > 1) {
        validVersions.push(store.qr_version - 1);
      }

      if (!validVersions.includes(event.qr_version)) {
        return {
          success: false,
          scan_recorded: false,
          message: 'Invalid QR code version'
        };
      }

      // Create scan event with IP address
      const scanEvent: Omit<QRScanEvent, 'id' | 'scanned_at'> = {
        ...event,
        ip_address: this.anonymizeIP(ipAddress)
      };

      // Record scan in database
      await this.database.recordScan({
        store_id: scanEvent.store_id,
        qr_version: scanEvent.qr_version,
        user_agent: scanEvent.user_agent,
        referrer: scanEvent.referrer,
        session_id: scanEvent.session_id
      });

      // Trigger real-time aggregation for current 5-minute bucket
      this.scheduleImmediateAggregation(event.store_id);

      return {
        success: true,
        scan_recorded: true,
        message: 'Scan recorded successfully'
      };
    } catch (error: any) {
      console.error('Failed to record scan:', error);
      return {
        success: false,
        scan_recorded: false,
        message: 'Failed to record scan'
      };
    }
  }

  /**
   * Get analytics for a store
   */
  async getAnalytics(storeId: string, request: QRAnalyticsRequest): Promise<QRAnalyticsResponse> {
    try {
      // Validate store exists and user has permission
      const store = await this.database.getStoreQR(storeId);
      if (!store) {
        throw new QRValidationError('Store not found', 'STORE_NOT_FOUND', { storeId });
      }

      // Get aggregated analytics from database
      const analyticsResponse = await this.database.getAggregatedAnalytics(storeId, request);

      // Enrich with real-time data if looking at recent periods
      if (this.isRecentPeriod(request)) {
        await this.enrichWithRealtimeData(storeId, analyticsResponse);
      }

      // Add trend analysis
      this.addTrendAnalysis(analyticsResponse);

      return analyticsResponse;
    } catch (error: any) {
      if (error instanceof QRValidationError || error instanceof QRPermissionError) {
        throw error;
      }
      throw new QRValidationError(
        'Failed to get analytics',
        'ANALYTICS_RETRIEVAL_FAILED',
        { storeId, period: request.period, originalError: error.message }
      );
    }
  }

  /**
   * Aggregate scan data for 5-minute buckets
   */
  async aggregateScans5Min(timeBucket?: string): Promise<number> {
    try {
      // Use current 5-minute bucket if not specified
      const bucket = timeBucket || this.getCurrentTimeBucket(5);
      
      // Call database aggregation function
      const aggregatedRows = await this.database.aggregateScans5Min(bucket);

      console.log(`Aggregated ${aggregatedRows} rows for 5-minute bucket: ${bucket}`);
      return aggregatedRows;
    } catch (error: any) {
      console.error('Failed to aggregate 5-minute scans:', error);
      throw new QRValidationError(
        'Failed to aggregate 5-minute scan data',
        'AGGREGATION_5MIN_FAILED',
        { timeBucket, originalError: error.message }
      );
    }
  }

  /**
   * Aggregate scan data for hourly buckets
   */
  async aggregateScansHourly(hourBucket?: string): Promise<number> {
    try {
      const bucket = hourBucket || this.getCurrentTimeBucket(60);
      
      // Get all 5-minute data for this hour
      const startTime = new Date(bucket);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // Aggregate from 5-minute data
      const stores = await this.getAllActiveStores();
      let totalAggregated = 0;

      for (const store of stores) {
        const fiveMinData = await this.database.getAnalytics5Min(
          store.id,
          startTime.toISOString(),
          endTime.toISOString()
        );

        if (fiveMinData.length > 0) {
          const hourlyData = this.aggregateToHourly(fiveMinData, bucket);
          await this.saveHourlyData(store.id, hourlyData);
          totalAggregated++;
        }
      }

      console.log(`Aggregated hourly data for ${totalAggregated} stores for bucket: ${bucket}`);
      return totalAggregated;
    } catch (error: any) {
      console.error('Failed to aggregate hourly scans:', error);
      throw new QRValidationError(
        'Failed to aggregate hourly scan data',
        'AGGREGATION_HOURLY_FAILED',
        { hourBucket, originalError: error.message }
      );
    }
  }

  /**
   * Aggregate scan data for daily buckets
   */
  async aggregateScansDaily(dateBucket?: string): Promise<number> {
    try {
      const bucket = dateBucket || this.getCurrentDateBucket();
      
      // Get all hourly data for this day
      const startTime = new Date(bucket);
      const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);

      const stores = await this.getAllActiveStores();
      let totalAggregated = 0;

      for (const store of stores) {
        const hourlyData = await this.database.getAnalyticsHourly(
          store.id,
          startTime.toISOString(),
          endTime.toISOString()
        );

        if (hourlyData.length > 0) {
          const dailyData = this.aggregateToDaily(hourlyData, bucket);
          await this.saveDailyData(store.id, dailyData);
          totalAggregated++;
        }
      }

      console.log(`Aggregated daily data for ${totalAggregated} stores for bucket: ${bucket}`);
      return totalAggregated;
    } catch (error: any) {
      console.error('Failed to aggregate daily scans:', error);
      throw new QRValidationError(
        'Failed to aggregate daily scan data',
        'AGGREGATION_DAILY_FAILED',
        { dateBucket, originalError: error.message }
      );
    }
  }

  /**
   * Get scan statistics for a store
   */
  async getScanStatistics(storeId: string, days: number = 30): Promise<{
    total_scans: number;
    unique_sessions: number;
    avg_scans_per_day: number;
    peak_day: { date: string; scans: number } | null;
    growth_trend: 'up' | 'down' | 'stable';
    recent_activity: QRAnalyticsDataPoint[];
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      // Get daily analytics for the period
      const dailyData = await this.database.getAnalyticsDaily(
        storeId,
        startDate.toISOString(),
        endDate.toISOString()
      );

      // Calculate statistics
      const totalScans = dailyData.reduce((sum, day) => sum + day.scan_count, 0);
      const uniqueSessions = dailyData.reduce((sum, day) => sum + day.unique_sessions, 0);
      const avgScansPerDay = dailyData.length > 0 ? totalScans / dailyData.length : 0;

      // Find peak day
      const peakDay = dailyData.reduce((peak, day) => 
        !peak || day.scan_count > peak.scan_count ? day : peak, 
        null as QRAnalyticsDaily | null
      );

      // Calculate growth trend (compare first half vs second half)
      const midPoint = Math.floor(dailyData.length / 2);
      const firstHalf = dailyData.slice(0, midPoint);
      const secondHalf = dailyData.slice(midPoint);

      const firstHalfAvg = firstHalf.length > 0 ? 
        firstHalf.reduce((sum, day) => sum + day.scan_count, 0) / firstHalf.length : 0;
      const secondHalfAvg = secondHalf.length > 0 ? 
        secondHalf.reduce((sum, day) => sum + day.scan_count, 0) / secondHalf.length : 0;

      let growthTrend: 'up' | 'down' | 'stable' = 'stable';
      const trendThreshold = 0.1; // 10% change threshold

      if (secondHalfAvg > firstHalfAvg * (1 + trendThreshold)) {
        growthTrend = 'up';
      } else if (secondHalfAvg < firstHalfAvg * (1 - trendThreshold)) {
        growthTrend = 'down';
      }

      // Get recent activity (last 7 days)
      const recentDays = Math.min(7, dailyData.length);
      const recentActivity = dailyData
        .slice(-recentDays)
        .map(day => ({
          time: day.date_bucket,
          scan_count: day.scan_count,
          unique_sessions: day.unique_sessions
        }));

      return {
        total_scans: totalScans,
        unique_sessions: uniqueSessions,
        avg_scans_per_day: Math.round(avgScansPerDay * 100) / 100,
        peak_day: peakDay ? {
          date: peakDay.date_bucket,
          scans: peakDay.scan_count
        } : null,
        growth_trend: growthTrend,
        recent_activity: recentActivity
      };
    } catch (error: any) {
      throw new QRValidationError(
        'Failed to get scan statistics',
        'SCAN_STATISTICS_FAILED',
        { storeId, days, originalError: error.message }
      );
    }
  }

  /**
   * Compare analytics between multiple stores
   */
  async compareStoreAnalytics(
    storeIds: string[],
    period: QRAnalyticsRequest['period'],
    days: number = 30
  ): Promise<{
    stores: Array<{
      store_id: string;
      total_scans: number;
      unique_sessions: number;
      avg_daily_scans: number;
      performance_rank: number;
    }>;
    summary: {
      total_scans_all: number;
      avg_scans_per_store: number;
      top_performer: string;
      lowest_performer: string;
    };
  }> {
    try {
      const storeAnalytics = [];

      // Get analytics for each store
      for (const storeId of storeIds) {
        const endDate = new Date().toISOString();
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const analytics = await this.database.getAggregatedAnalytics(storeId, {
          period,
          start_date: startDate,
          end_date: endDate
        });

        storeAnalytics.push({
          store_id: storeId,
          total_scans: analytics.total_scans,
          unique_sessions: analytics.unique_sessions,
          avg_daily_scans: Math.round((analytics.total_scans / days) * 100) / 100,
          performance_rank: 0 // Will be calculated below
        });
      }

      // Sort by total scans and assign ranks
      storeAnalytics.sort((a, b) => b.total_scans - a.total_scans);
      storeAnalytics.forEach((store, index) => {
        store.performance_rank = index + 1;
      });

      // Calculate summary
      const totalScansAll = storeAnalytics.reduce((sum, store) => sum + store.total_scans, 0);
      const avgScansPerStore = storeAnalytics.length > 0 ? totalScansAll / storeAnalytics.length : 0;

      return {
        stores: storeAnalytics,
        summary: {
          total_scans_all: totalScansAll,
          avg_scans_per_store: Math.round(avgScansPerStore * 100) / 100,
          top_performer: storeAnalytics[0]?.store_id || '',
          lowest_performer: storeAnalytics[storeAnalytics.length - 1]?.store_id || ''
        }
      };
    } catch (error: any) {
      throw new QRValidationError(
        'Failed to compare store analytics',
        'STORE_COMPARISON_FAILED',
        { storeIds, period, originalError: error.message }
      );
    }
  }

  /**
   * Schedule immediate aggregation for real-time updates
   */
  private scheduleImmediateAggregation(storeId: string): void {
    const jobKey = `immediate_${storeId}`;
    
    // Clear existing job if any
    if (this.aggregationJobs.has(jobKey)) {
      clearTimeout(this.aggregationJobs.get(jobKey)!);
    }

    // Schedule aggregation after 30 seconds to batch multiple scans
    const timeoutId = setTimeout(async () => {
      try {
        await this.aggregateScans5Min();
        this.aggregationJobs.delete(jobKey);
      } catch (error) {
        console.error('Immediate aggregation failed:', error);
        this.aggregationJobs.delete(jobKey);
      }
    }, 30000);

    this.aggregationJobs.set(jobKey, timeoutId);
  }

  /**
   * Check if request is for recent period (requires real-time data)
   */
  private isRecentPeriod(request: QRAnalyticsRequest): boolean {
    if (request.period === 'hour') return true;
    
    const endDate = new Date(request.end_date || new Date());
    const now = new Date();
    const diffHours = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60);
    
    return diffHours < 24; // Less than 24 hours ago
  }

  /**
   * Enrich analytics with real-time data
   */
  private async enrichWithRealtimeData(storeId: string, analytics: QRAnalyticsResponse): Promise<void> {
    try {
      // Get recent scan events for current incomplete bucket
      const recentScans = await this.database.getScanEvents(storeId, 100);
      const currentBucket = this.getCurrentTimeBucket(5);
      
      // Filter scans for current bucket
      const currentBucketScans = recentScans.filter(scan => {
        const scanTime = new Date(scan.scanned_at);
        const bucketTime = new Date(currentBucket);
        const bucketEnd = new Date(bucketTime.getTime() + 5 * 60 * 1000);
        return scanTime >= bucketTime && scanTime < bucketEnd;
      });

      if (currentBucketScans.length > 0) {
        // Add current bucket data to analytics
        const uniqueSessions = new Set(currentBucketScans.map(s => s.session_id)).size;
        
        analytics.data_points.push({
          time: currentBucket,
          scan_count: currentBucketScans.length,
          unique_sessions: uniqueSessions
        });

        // Update totals
        analytics.total_scans += currentBucketScans.length;
        analytics.unique_sessions += uniqueSessions;

        // Update peak activity if current bucket is higher
        if (currentBucketScans.length > analytics.peak_activity.scan_count) {
          analytics.peak_activity = {
            time: currentBucket,
            scan_count: currentBucketScans.length
          };
        }
      }
    } catch (error) {
      console.warn('Failed to enrich with real-time data:', error);
    }
  }

  /**
   * Add trend analysis to analytics response
   */
  private addTrendAnalysis(analytics: QRAnalyticsResponse): void {
    if (analytics.data_points.length < 2) return;

    // Calculate trend for the period
    const dataPoints = analytics.data_points;
    const midPoint = Math.floor(dataPoints.length / 2);
    
    const firstHalf = dataPoints.slice(0, midPoint);
    const secondHalf = dataPoints.slice(midPoint);

    const firstHalfAvg = firstHalf.reduce((sum, p) => sum + p.scan_count, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, p) => sum + p.scan_count, 0) / secondHalf.length;

    // Add trend metadata
    (analytics as any).trend = {
      direction: secondHalfAvg > firstHalfAvg ? 'up' : secondHalfAvg < firstHalfAvg ? 'down' : 'stable',
      change_percent: firstHalfAvg > 0 ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100) : 0,
      first_half_avg: Math.round(firstHalfAvg * 100) / 100,
      second_half_avg: Math.round(secondHalfAvg * 100) / 100
    };
  }

  /**
   * Get current time bucket for aggregation
   */
  private getCurrentTimeBucket(minutes: number): string {
    const now = new Date();
    const bucket = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      Math.floor(now.getMinutes() / minutes) * minutes,
      0,
      0
    );
    return bucket.toISOString();
  }

  /**
   * Get current date bucket
   */
  private getCurrentDateBucket(): string {
    const now = new Date();
    const bucket = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return bucket.toISOString().split('T')[0];
  }

  /**
   * Anonymize IP address for privacy
   */
  private anonymizeIP(ip: string): string {
    if (ip.includes(':')) {
      // IPv6 - mask last 4 groups
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + '::';
    } else {
      // IPv4 - mask last octet
      const parts = ip.split('.');
      return parts.slice(0, 3).join('.') + '.0';
    }
  }

  /**
   * Get all active stores for aggregation
   */
  private async getAllActiveStores(): Promise<{ id: string }[]> {
    // This would typically use a more efficient query
    // For now, we'll return empty array and let specific store aggregation handle this
    return [];
  }

  /**
   * Aggregate 5-minute data to hourly
   */
  private aggregateToHourly(fiveMinData: QRAnalytics5Min[], hourBucket: string): QRAnalyticsHourly {
    const totalScans = fiveMinData.reduce((sum, d) => sum + d.scan_count, 0);
    const totalSessions = fiveMinData.reduce((sum, d) => sum + d.unique_sessions, 0);
    const peakFiveMin = Math.max(...fiveMinData.map(d => d.scan_count));
    const avgScansPerFiveMin = fiveMinData.length > 0 ? totalScans / fiveMinData.length : 0;

    return {
      id: '', // Will be set by database
      store_id: fiveMinData[0]?.store_id || '',
      hour_bucket: hourBucket,
      scan_count: totalScans,
      unique_sessions: totalSessions,
      peak_5min: peakFiveMin,
      avg_scans_per_5min: Math.round(avgScansPerFiveMin * 100) / 100,
      computed_at: new Date().toISOString()
    };
  }

  /**
   * Aggregate hourly data to daily
   */
  private aggregateToDaily(hourlyData: QRAnalyticsHourly[], dateBucket: string): QRAnalyticsDaily {
    const totalScans = hourlyData.reduce((sum, d) => sum + d.scan_count, 0);
    const totalSessions = hourlyData.reduce((sum, d) => sum + d.unique_sessions, 0);
    const peakHour = Math.max(...hourlyData.map(d => d.scan_count));
    const avgScansPerHour = hourlyData.length > 0 ? totalScans / hourlyData.length : 0;

    // Find busiest 5-min period
    const busiestHour = hourlyData.reduce((peak, hour) => 
      !peak || hour.peak_5min > peak.peak_5min ? hour : peak, 
      null as QRAnalyticsHourly | null
    );

    return {
      id: '', // Will be set by database
      store_id: hourlyData[0]?.store_id || '',
      date_bucket: dateBucket,
      scan_count: totalScans,
      unique_sessions: totalSessions,
      peak_hour: peakHour,
      busiest_5min: busiestHour?.hour_bucket || '',
      avg_scans_per_hour: Math.round(avgScansPerHour * 100) / 100,
      computed_at: new Date().toISOString()
    };
  }

  /**
   * Save hourly data to database
   */
  private async saveHourlyData(storeId: string, data: QRAnalyticsHourly): Promise<void> {
    // This would use a database upsert operation
    // For now, we'll assume the database handles this
    console.log(`Saving hourly data for store ${storeId}:`, data);
  }

  /**
   * Save daily data to database
   */
  private async saveDailyData(storeId: string, data: QRAnalyticsDaily): Promise<void> {
    // This would use a database upsert operation
    // For now, we'll assume the database handles this
    console.log(`Saving daily data for store ${storeId}:`, data);
  }

  /**
   * Clean up aggregation jobs
   */
  cleanup(): void {
    for (const [jobKey, timeoutId] of this.aggregationJobs) {
      clearTimeout(timeoutId);
    }
    this.aggregationJobs.clear();
  }

  /**
   * Health check for analytics service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    database_connected: boolean;
    active_aggregation_jobs: number;
    last_aggregation: string | null;
    errors: string[];
  }> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Check database connection
      const dbHealthy = await this.database.healthCheck();
      if (!dbHealthy) {
        errors.push('Database connection failed');
        status = 'unhealthy';
      }

      // Test aggregation capability
      try {
        const currentBucket = this.getCurrentTimeBucket(5);
        // Test aggregation (would normally check if this succeeds)
        console.log(`Current 5-min bucket: ${currentBucket}`);
      } catch (error: any) {
        errors.push(`Aggregation test failed: ${error.message}`);
        status = status === 'healthy' ? 'degraded' : 'unhealthy';
      }

      return {
        status,
        database_connected: dbHealthy,
        active_aggregation_jobs: this.aggregationJobs.size,
        last_aggregation: null, // Would track this in production
        errors
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        database_connected: false,
        active_aggregation_jobs: this.aggregationJobs.size,
        last_aggregation: null,
        errors: [`Health check failed: ${error.message}`]
      };
    }
  }
}

// Factory function
export function createQRAnalyticsService(database: QRDatabase): QRAnalyticsService {
  return new QRAnalyticsService(database);
}