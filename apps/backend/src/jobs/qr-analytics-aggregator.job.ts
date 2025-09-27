import cron from 'node-cron';
import { QRDatabaseUtils, qrDatabase, QR_DATABASE_CONFIG } from '../config/qr-database';

/**
 * QR Analytics Aggregation Job
 * Processes raw scan events into time-bucketed analytics data
 * Runs every 5 minutes for real-time analytics
 */
export class QRAnalyticsAggregatorJob {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private lastProcessedTimestamp: string | null = null;

  /**
   * Start the analytics aggregation cron job
   */
  public start(): void {
    // Run every 5 minutes
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      await this.processAnalytics();
    }, {
      scheduled: false // Don't start immediately
    });

    this.cronJob.start();
    console.log('QR Analytics Aggregator job started - running every 5 minutes');

    // Also run immediately on startup
    setTimeout(() => {
      this.processAnalytics();
    }, 5000); // Wait 5 seconds before first run
  }

  /**
   * Stop the analytics aggregation job
   */
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    console.log('QR Analytics Aggregator job stopped');
  }

  /**
   * Main analytics processing function
   */
  private async processAnalytics(): Promise<void> {
    if (this.isRunning) {
      console.log('Analytics aggregation already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('Starting QR analytics aggregation...');

      // Process 5-minute analytics
      await this.process5MinuteAnalytics();

      // Process hourly analytics (runs on the hour)
      const now = new Date();
      if (now.getMinutes() < 5) { // Only run in first 5 minutes of each hour
        await this.processHourlyAnalytics();
      }

      // Process daily analytics (runs once per day)
      if (now.getHours() === 1 && now.getMinutes() < 5) { // Run at 1 AM
        await this.processDailyAnalytics();
      }

      // Cleanup old data (runs once per day)
      if (now.getHours() === 2 && now.getMinutes() < 5) { // Run at 2 AM
        await this.cleanupOldData();
      }

      const duration = Date.now() - startTime;
      console.log(`QR analytics aggregation completed in ${duration}ms`);

    } catch (error) {
      console.error('Error in QR analytics aggregation:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process 5-minute analytics buckets
   */
  private async process5MinuteAnalytics(): Promise<void> {
    try {
      // Get the time range for processing
      const endTime = new Date();
      endTime.setSeconds(0, 0); // Round down to the minute
      endTime.setMinutes(Math.floor(endTime.getMinutes() / 5) * 5); // Round down to 5-minute boundary

      const startTime = new Date(endTime);
      startTime.setMinutes(startTime.getMinutes() - 5);

      // Check if we already processed this bucket
      const { data: existingData } = await qrDatabase
        .from('qr_analytics_5min')
        .select('time_bucket')
        .eq('time_bucket', startTime.toISOString())
        .limit(1);

      if (existingData && existingData.length > 0) {
        console.log(`5-minute analytics for ${startTime.toISOString()} already processed`);
        return;
      }

      // Aggregate scan events for this time bucket
      const { data: scanEvents } = await qrDatabase
        .from('qr_scan_events')
        .select('store_id, scan_result, ip_address')
        .gte('scanned_at', startTime.toISOString())
        .lt('scanned_at', endTime.toISOString());

      if (!scanEvents || scanEvents.length === 0) {
        console.log(`No scan events found for 5-minute bucket ${startTime.toISOString()}`);
        return;
      }

      // Group by store and calculate metrics
      const storeMetrics = new Map<string, {
        total_scans: number;
        successful_scans: number;
        failed_scans: number;
        unique_visitors: Set<string>;
      }>();

      for (const event of scanEvents) {
        if (!storeMetrics.has(event.store_id)) {
          storeMetrics.set(event.store_id, {
            total_scans: 0,
            successful_scans: 0,
            failed_scans: 0,
            unique_visitors: new Set()
          });
        }

        const metrics = storeMetrics.get(event.store_id)!;
        metrics.total_scans++;
        
        if (event.scan_result === 'success') {
          metrics.successful_scans++;
        } else {
          metrics.failed_scans++;
        }

        if (event.ip_address) {
          metrics.unique_visitors.add(event.ip_address);
        }
      }

      // Insert aggregated data
      const analyticsRecords = Array.from(storeMetrics.entries()).map(([storeId, metrics]) => ({
        store_id: storeId,
        time_bucket: startTime.toISOString(),
        total_scans: metrics.total_scans,
        successful_scans: metrics.successful_scans,
        failed_scans: metrics.failed_scans,
        unique_visitors: metrics.unique_visitors.size,
        success_rate: metrics.total_scans > 0 ? metrics.successful_scans / metrics.total_scans : 0
      }));

      if (analyticsRecords.length > 0) {
        const { error } = await qrDatabase
          .from('qr_analytics_5min')
          .insert(analyticsRecords);

        if (error) {
          throw new Error(`Failed to insert 5-minute analytics: ${error.message}`);
        }

        console.log(`Processed 5-minute analytics for ${analyticsRecords.length} stores, time bucket: ${startTime.toISOString()}`);
      }

    } catch (error) {
      console.error('Error processing 5-minute analytics:', error);
      throw error;
    }
  }

  /**
   * Process hourly analytics buckets
   */
  private async processHourlyAnalytics(): Promise<void> {
    try {
      const endTime = new Date();
      endTime.setMinutes(0, 0, 0); // Round down to the hour

      const startTime = new Date(endTime);
      startTime.setHours(startTime.getHours() - 1);

      // Check if already processed
      const { data: existingData } = await qrDatabase
        .from('qr_analytics_hourly')
        .select('time_bucket')
        .eq('time_bucket', startTime.toISOString())
        .limit(1);

      if (existingData && existingData.length > 0) {
        console.log(`Hourly analytics for ${startTime.toISOString()} already processed`);
        return;
      }

      // Aggregate from 5-minute buckets
      const { data: fiveMinuteData } = await qrDatabase
        .from('qr_analytics_5min')
        .select('store_id, total_scans, successful_scans, failed_scans, unique_visitors')
        .gte('time_bucket', startTime.toISOString())
        .lt('time_bucket', endTime.toISOString());

      if (!fiveMinuteData || fiveMinuteData.length === 0) {
        console.log(`No 5-minute data found for hourly bucket ${startTime.toISOString()}`);
        return;
      }

      // Aggregate by store
      const storeMetrics = new Map<string, {
        total_scans: number;
        successful_scans: number;
        failed_scans: number;
        unique_visitors: number;
      }>();

      for (const record of fiveMinuteData) {
        if (!storeMetrics.has(record.store_id)) {
          storeMetrics.set(record.store_id, {
            total_scans: 0,
            successful_scans: 0,
            failed_scans: 0,
            unique_visitors: 0
          });
        }

        const metrics = storeMetrics.get(record.store_id)!;
        metrics.total_scans += record.total_scans;
        metrics.successful_scans += record.successful_scans;
        metrics.failed_scans += record.failed_scans;
        metrics.unique_visitors = Math.max(metrics.unique_visitors, record.unique_visitors);
      }

      // Insert hourly analytics
      const analyticsRecords = Array.from(storeMetrics.entries()).map(([storeId, metrics]) => ({
        store_id: storeId,
        time_bucket: startTime.toISOString(),
        total_scans: metrics.total_scans,
        successful_scans: metrics.successful_scans,
        failed_scans: metrics.failed_scans,
        unique_visitors: metrics.unique_visitors,
        success_rate: metrics.total_scans > 0 ? metrics.successful_scans / metrics.total_scans : 0
      }));

      if (analyticsRecords.length > 0) {
        const { error } = await qrDatabase
          .from('qr_analytics_hourly')
          .insert(analyticsRecords);

        if (error) {
          throw new Error(`Failed to insert hourly analytics: ${error.message}`);
        }

        console.log(`Processed hourly analytics for ${analyticsRecords.length} stores, time bucket: ${startTime.toISOString()}`);
      }

    } catch (error) {
      console.error('Error processing hourly analytics:', error);
      throw error;
    }
  }

  /**
   * Process daily analytics buckets
   */
  private async processDailyAnalytics(): Promise<void> {
    try {
      const endTime = new Date();
      endTime.setHours(0, 0, 0, 0); // Start of today

      const startTime = new Date(endTime);
      startTime.setDate(startTime.getDate() - 1); // Yesterday

      // Check if already processed
      const { data: existingData } = await qrDatabase
        .from('qr_analytics_daily')
        .select('time_bucket')
        .eq('time_bucket', startTime.toISOString())
        .limit(1);

      if (existingData && existingData.length > 0) {
        console.log(`Daily analytics for ${startTime.toISOString()} already processed`);
        return;
      }

      // Aggregate from hourly buckets
      const { data: hourlyData } = await qrDatabase
        .from('qr_analytics_hourly')
        .select('store_id, total_scans, successful_scans, failed_scans, unique_visitors')
        .gte('time_bucket', startTime.toISOString())
        .lt('time_bucket', endTime.toISOString());

      if (!hourlyData || hourlyData.length === 0) {
        console.log(`No hourly data found for daily bucket ${startTime.toISOString()}`);
        return;
      }

      // Aggregate by store
      const storeMetrics = new Map<string, {
        total_scans: number;
        successful_scans: number;
        failed_scans: number;
        unique_visitors: number;
      }>();

      for (const record of hourlyData) {
        if (!storeMetrics.has(record.store_id)) {
          storeMetrics.set(record.store_id, {
            total_scans: 0,
            successful_scans: 0,
            failed_scans: 0,
            unique_visitors: 0
          });
        }

        const metrics = storeMetrics.get(record.store_id)!;
        metrics.total_scans += record.total_scans;
        metrics.successful_scans += record.successful_scans;
        metrics.failed_scans += record.failed_scans;
        metrics.unique_visitors = Math.max(metrics.unique_visitors, record.unique_visitors);
      }

      // Insert daily analytics
      const analyticsRecords = Array.from(storeMetrics.entries()).map(([storeId, metrics]) => ({
        store_id: storeId,
        time_bucket: startTime.toISOString(),
        total_scans: metrics.total_scans,
        successful_scans: metrics.successful_scans,
        failed_scans: metrics.failed_scans,
        unique_visitors: metrics.unique_visitors,
        success_rate: metrics.total_scans > 0 ? metrics.successful_scans / metrics.total_scans : 0
      }));

      if (analyticsRecords.length > 0) {
        const { error } = await qrDatabase
          .from('qr_analytics_daily')
          .insert(analyticsRecords);

        if (error) {
          throw new Error(`Failed to insert daily analytics: ${error.message}`);
        }

        console.log(`Processed daily analytics for ${analyticsRecords.length} stores, time bucket: ${startTime.toISOString()}`);
      }

    } catch (error) {
      console.error('Error processing daily analytics:', error);
      throw error;
    }
  }

  /**
   * Cleanup old data based on retention policies
   */
  private async cleanupOldData(): Promise<void> {
    try {
      console.log('Starting data cleanup...');

      // Cleanup old scan events
      await QRDatabaseUtils.cleanupOldScanEvents(QR_DATABASE_CONFIG.SCAN_EVENT_RETENTION_DAYS);

      // Cleanup old 5-minute analytics (keep for 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { error: cleanup5MinError } = await qrDatabase
        .from('qr_analytics_5min')
        .delete()
        .lt('time_bucket', sevenDaysAgo.toISOString());

      if (cleanup5MinError) {
        console.error('Error cleaning up 5-minute analytics:', cleanup5MinError);
      } else {
        console.log('Cleaned up old 5-minute analytics');
      }

      // Cleanup old hourly analytics (keep for 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error: cleanupHourlyError } = await qrDatabase
        .from('qr_analytics_hourly')
        .delete()
        .lt('time_bucket', thirtyDaysAgo.toISOString());

      if (cleanupHourlyError) {
        console.error('Error cleaning up hourly analytics:', cleanupHourlyError);
      } else {
        console.log('Cleaned up old hourly analytics');
      }

      // Cleanup old daily analytics (keep for 1 year)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const { error: cleanupDailyError } = await qrDatabase
        .from('qr_analytics_daily')
        .delete()
        .lt('time_bucket', oneYearAgo.toISOString());

      if (cleanupDailyError) {
        console.error('Error cleaning up daily analytics:', cleanupDailyError);
      } else {
        console.log('Cleaned up old daily analytics');
      }

      console.log('Data cleanup completed');

    } catch (error) {
      console.error('Error during data cleanup:', error);
    }
  }

  /**
   * Manual trigger for analytics processing (for testing/debugging)
   */
  public async triggerManualProcessing(): Promise<void> {
    console.log('Manual analytics processing triggered');
    await this.processAnalytics();
  }

  /**
   * Get job status
   */
  public getStatus(): {
    isRunning: boolean;
    isScheduled: boolean;
    lastProcessedTimestamp: string | null;
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.cronJob !== null,
      lastProcessedTimestamp: this.lastProcessedTimestamp
    };
  }

  /**
   * Process analytics for a specific time range (for backfilling)
   */
  public async backfillAnalytics(startDate: Date, endDate: Date): Promise<void> {
    console.log(`Starting backfill from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const current = new Date(startDate);
    current.setMinutes(Math.floor(current.getMinutes() / 5) * 5, 0, 0); // Round to 5-minute boundary

    while (current < endDate) {
      try {
        const bucketStart = new Date(current);
        const bucketEnd = new Date(current);
        bucketEnd.setMinutes(bucketEnd.getMinutes() + 5);

        // Process this 5-minute bucket
        await this.process5MinuteBucket(bucketStart, bucketEnd);

        current.setMinutes(current.getMinutes() + 5);
      } catch (error) {
        console.error(`Error processing bucket ${current.toISOString()}:`, error);
        current.setMinutes(current.getMinutes() + 5); // Continue with next bucket
      }
    }

    console.log('Backfill completed');
  }

  /**
   * Process a specific 5-minute bucket
   */
  private async process5MinuteBucket(startTime: Date, endTime: Date): Promise<void> {
    // Implementation similar to process5MinuteAnalytics but for specific time range
    const { data: scanEvents } = await qrDatabase
      .from('qr_scan_events')
      .select('store_id, scan_result, ip_address')
      .gte('scanned_at', startTime.toISOString())
      .lt('scanned_at', endTime.toISOString());

    if (!scanEvents || scanEvents.length === 0) {
      return;
    }

    // Same aggregation logic as process5MinuteAnalytics
    const storeMetrics = new Map<string, {
      total_scans: number;
      successful_scans: number;
      failed_scans: number;
      unique_visitors: Set<string>;
    }>();

    for (const event of scanEvents) {
      if (!storeMetrics.has(event.store_id)) {
        storeMetrics.set(event.store_id, {
          total_scans: 0,
          successful_scans: 0,
          failed_scans: 0,
          unique_visitors: new Set()
        });
      }

      const metrics = storeMetrics.get(event.store_id)!;
      metrics.total_scans++;
      
      if (event.scan_result === 'success') {
        metrics.successful_scans++;
      } else {
        metrics.failed_scans++;
      }

      if (event.ip_address) {
        metrics.unique_visitors.add(event.ip_address);
      }
    }

    const analyticsRecords = Array.from(storeMetrics.entries()).map(([storeId, metrics]) => ({
      store_id: storeId,
      time_bucket: startTime.toISOString(),
      total_scans: metrics.total_scans,
      successful_scans: metrics.successful_scans,
      failed_scans: metrics.failed_scans,
      unique_visitors: metrics.unique_visitors.size,
      success_rate: metrics.total_scans > 0 ? metrics.successful_scans / metrics.total_scans : 0
    }));

    if (analyticsRecords.length > 0) {
      const { error } = await qrDatabase
        .from('qr_analytics_5min')
        .upsert(analyticsRecords, { onConflict: 'store_id,time_bucket' });

      if (error) {
        throw new Error(`Failed to upsert 5-minute analytics: ${error.message}`);
      }
    }
  }
}

// Singleton instance
export const qrAnalyticsAggregator = new QRAnalyticsAggregatorJob();

export default qrAnalyticsAggregator;