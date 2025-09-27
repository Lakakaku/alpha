import { StoreModel } from '@vocilia/database/store/store';
import { StoreMetricsModel } from '@vocilia/database/store/store-metrics';
import { AuditLogModel } from '@vocilia/database/admin/audit-log';

export interface StoreMonitoringData {
  id: string;
  name: string;
  businessEmail: string;
  phoneNumber?: string;
  physicalAddress?: string;
  businessRegistrationNumber?: string;
  onlineStatus: boolean;
  syncStatus: 'pending' | 'success' | 'failed';
  lastSyncAt?: string;
  errorCount: number;
  performanceScore?: number;
  monitoringEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  recentMetrics?: {
    errorCount: number;
    avgPerformance: number;
    availabilityPercentage: number;
    syncSuccessRate: number;
  };
}

export interface DatabaseUploadRequest {
  storeId: string;
  adminId: string;
  weekStartDate: string;
  fileName: string;
  fileContent: Buffer;
  ipAddress: string;
  userAgent: string;
}

export interface DatabaseUploadResponse {
  success: boolean;
  uploadId?: string;
  recordsProcessed?: number;
  error?: string;
}

export interface StoreHealthCheck {
  storeId: string;
  isHealthy: boolean;
  issues: string[];
  lastChecked: string;
  responseTime?: number;
}

export class StoreMonitoringService {
  /**
   * Get comprehensive store monitoring data
   */
  static async getStoreMonitoringData(storeId: string): Promise<StoreMonitoringData | null> {
    try {
      const store = await StoreModel.getById(storeId);
      if (!store) {
        return null;
      }

      // Get recent metrics (last 24 hours)
      const recentMetrics = await StoreMetricsModel.getAggregatedMetrics(storeId, 24);

      return {
        id: store.id,
        name: store.name,
        businessEmail: store.business_email,
        phoneNumber: store.phone_number,
        physicalAddress: store.physical_address,
        businessRegistrationNumber: store.business_registration_number,
        onlineStatus: store.online_status || false,
        syncStatus: store.sync_status || 'pending',
        lastSyncAt: store.last_sync_at,
        errorCount: store.error_count || 0,
        performanceScore: store.performance_score,
        monitoringEnabled: store.monitoring_enabled ?? true,
        createdAt: store.created_at,
        updatedAt: store.updated_at,
        recentMetrics
      };
    } catch (error) {
      console.error('Error getting store monitoring data:', error);
      return null;
    }
  }

  /**
   * Get all stores with monitoring data
   */
  static async getAllStoresMonitoring(
    page = 1,
    limit = 20,
    filters?: {
      search?: string;
      onlineStatus?: boolean;
      syncStatus?: 'pending' | 'success' | 'failed';
      monitoringEnabled?: boolean;
    }
  ): Promise<{ stores: StoreMonitoringData[]; total: number }> {
    try {
      const { stores, total } = await StoreModel.getAll(page, limit, filters);

      const storesWithMonitoring = await Promise.all(
        stores.map(async (store) => {
          const recentMetrics = await StoreMetricsModel.getAggregatedMetrics(store.id, 24);
          
          return {
            id: store.id,
            name: store.name,
            businessEmail: store.business_email,
            phoneNumber: store.phone_number,
            physicalAddress: store.physical_address,
            businessRegistrationNumber: store.business_registration_number,
            onlineStatus: store.online_status || false,
            syncStatus: store.sync_status || 'pending',
            lastSyncAt: store.last_sync_at,
            errorCount: store.error_count || 0,
            performanceScore: store.performance_score,
            monitoringEnabled: store.monitoring_enabled ?? true,
            createdAt: store.created_at,
            updatedAt: store.updated_at,
            recentMetrics
          };
        })
      );

      return { stores: storesWithMonitoring, total };
    } catch (error) {
      console.error('Error getting all stores monitoring:', error);
      return { stores: [], total: 0 };
    }
  }

  /**
   * Update store monitoring status
   */
  static async updateStoreStatus(
    storeId: string,
    updates: {
      onlineStatus?: boolean;
      syncStatus?: 'pending' | 'success' | 'failed';
      performanceScore?: number;
      monitoringEnabled?: boolean;
    },
    adminId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<boolean> {
    try {
      // Update store
      const updatedStore = await StoreModel.update(storeId, updates);
      if (!updatedStore) {
        return false;
      }

      // Record metrics based on updates
      if (updates.onlineStatus !== undefined) {
        await StoreMetricsModel.recordAvailability(storeId, updates.onlineStatus);
      }

      if (updates.performanceScore !== undefined) {
        await StoreMetricsModel.recordPerformance(storeId, updates.performanceScore);
      }

      // Log admin action
      await AuditLogModel.logStoreUpdate(
        adminId,
        storeId,
        updates,
        ipAddress,
        userAgent,
        true
      );

      return true;
    } catch (error) {
      console.error('Error updating store status:', error);
      
      // Log failed action
      await AuditLogModel.logStoreUpdate(
        adminId,
        storeId,
        updates,
        ipAddress,
        userAgent,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return false;
    }
  }

  /**
   * Process database upload
   */
  static async processDatabaseUpload(request: DatabaseUploadRequest): Promise<DatabaseUploadResponse> {
    try {
      // Validate file format (CSV)
      if (!request.fileName.endsWith('.csv')) {
        return {
          success: false,
          error: 'File must be CSV format'
        };
      }

      // Parse CSV content
      const csvContent = request.fileContent.toString('utf-8');
      const records = this.parseCSV(csvContent);

      if (records.length === 0) {
        return {
          success: false,
          error: 'No valid records found in CSV file'
        };
      }

      // Validate CSV structure
      const validationResult = this.validateCSVRecords(records);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `Invalid CSV format: ${validationResult.errors.join(', ')}`
        };
      }

      // Generate upload ID
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      // Process records (this would integrate with your verification system)
      const processedRecords = await this.processVerificationRecords(
        request.storeId,
        records,
        request.weekStartDate,
        uploadId
      );

      // Update store sync status
      await StoreModel.updateSyncStatus(request.storeId, 'success', new Date().toISOString());

      // Record sync metric
      await StoreMetricsModel.recordSync(
        request.storeId,
        true,
        undefined,
        processedRecords
      );

      // Log upload action
      await AuditLogModel.logDatabaseUpload(
        request.adminId,
        request.storeId,
        {
          fileName: request.fileName,
          recordCount: processedRecords,
          weekStart: request.weekStartDate,
          uploadId
        },
        request.ipAddress,
        request.userAgent,
        true
      );

      return {
        success: true,
        uploadId,
        recordsProcessed: processedRecords
      };
    } catch (error) {
      console.error('Error processing database upload:', error);

      // Update store sync status to failed
      await StoreModel.updateSyncStatus(request.storeId, 'failed');
      await StoreModel.incrementErrorCount(request.storeId);

      // Record failed sync metric
      await StoreMetricsModel.recordSync(request.storeId, false);

      // Log failed upload
      await AuditLogModel.logDatabaseUpload(
        request.adminId,
        request.storeId,
        {
          fileName: request.fileName,
          recordCount: 0,
          weekStart: request.weekStartDate
        },
        request.ipAddress,
        request.userAgent,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Perform health check on store
   */
  static async performHealthCheck(storeId: string): Promise<StoreHealthCheck> {
    try {
      const store = await StoreModel.getById(storeId);
      if (!store) {
        return {
          storeId,
          isHealthy: false,
          issues: ['Store not found'],
          lastChecked: new Date().toISOString()
        };
      }

      const issues: string[] = [];
      let isHealthy = true;

      // Check if monitoring is enabled
      if (!store.monitoring_enabled) {
        issues.push('Monitoring is disabled');
        isHealthy = false;
      }

      // Check online status
      if (!store.online_status) {
        issues.push('Store is offline');
        isHealthy = false;
      }

      // Check sync status
      if (store.sync_status === 'failed') {
        issues.push('Last sync failed');
        isHealthy = false;
      }

      // Check error count
      if ((store.error_count || 0) > 5) {
        issues.push(`High error count: ${store.error_count}`);
        isHealthy = false;
      }

      // Check last sync time (should be within last 7 days)
      if (store.last_sync_at) {
        const lastSync = new Date(store.last_sync_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        if (lastSync < weekAgo) {
          issues.push('Last sync was more than 7 days ago');
          isHealthy = false;
        }
      } else {
        issues.push('No sync recorded');
        isHealthy = false;
      }

      // Record availability metric
      await StoreMetricsModel.recordAvailability(storeId, isHealthy);

      return {
        storeId,
        isHealthy,
        issues,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error performing health check:', error);
      return {
        storeId,
        isHealthy: false,
        issues: ['Health check failed'],
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Get store metrics for date range
   */
  static async getStoreMetrics(
    storeId: string,
    startDate: string,
    endDate: string,
    metricType?: 'sync' | 'error' | 'performance' | 'availability'
  ) {
    try {
      return await StoreMetricsModel.getByDateRange(storeId, startDate, endDate, metricType);
    } catch (error) {
      console.error('Error getting store metrics:', error);
      return [];
    }
  }

  /**
   * Get monitoring dashboard data
   */
  static async getMonitoringDashboard() {
    try {
      const [
        storeStats,
        onlineStores,
        storesWithErrors,
        storesNeedingSync
      ] = await Promise.all([
        StoreModel.getStatistics(),
        StoreModel.getOnlineStores(),
        StoreModel.getStoresWithErrors(1),
        StoreModel.getStoresNeedingSync()
      ]);

      return {
        statistics: storeStats,
        onlineCount: onlineStores.length,
        errorCount: storesWithErrors.length,
        syncPendingCount: storesNeedingSync.length,
        recentErrors: storesWithErrors.slice(0, 10),
        pendingSyncs: storesNeedingSync.slice(0, 10)
      };
    } catch (error) {
      console.error('Error getting monitoring dashboard:', error);
      return {
        statistics: {
          total: 0,
          online: 0,
          offline: 0,
          syncPending: 0,
          syncSuccess: 0,
          syncFailed: 0,
          withErrors: 0,
          monitoringEnabled: 0,
          avgPerformanceScore: 0
        },
        onlineCount: 0,
        errorCount: 0,
        syncPendingCount: 0,
        recentErrors: [],
        pendingSyncs: []
      };
    }
  }

  /**
   * Parse CSV content into records
   */
  private static parseCSV(csvContent: string): any[] {
    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map(h => h.trim());
      const records = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
          const record: any = {};
          headers.forEach((header, index) => {
            record[header] = values[index];
          });
          records.push(record);
        }
      }

      return records;
    } catch (error) {
      console.error('Error parsing CSV:', error);
      return [];
    }
  }

  /**
   * Validate CSV records structure
   */
  private static validateCSVRecords(records: any[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const requiredFields = ['transaction_id', 'amount', 'timestamp', 'pos_reference'];

    if (records.length === 0) {
      errors.push('No records found');
      return { isValid: false, errors };
    }

    // Check first record for required fields
    const firstRecord = records[0];
    requiredFields.forEach(field => {
      if (!firstRecord.hasOwnProperty(field)) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validate data types in first few records
    const sampleSize = Math.min(5, records.length);
    for (let i = 0; i < sampleSize; i++) {
      const record = records[i];
      
      // Validate transaction_id is not empty
      if (!record.transaction_id || record.transaction_id.trim() === '') {
        errors.push(`Row ${i + 2}: transaction_id is required`);
      }

      // Validate amount is numeric
      if (isNaN(parseFloat(record.amount))) {
        errors.push(`Row ${i + 2}: amount must be numeric`);
      }

      // Validate timestamp format (basic check)
      if (!record.timestamp || isNaN(Date.parse(record.timestamp))) {
        errors.push(`Row ${i + 2}: timestamp is invalid`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process verification records (integrate with your verification system)
   */
  private static async processVerificationRecords(
    storeId: string,
    records: any[],
    weekStartDate: string,
    uploadId: string
  ): Promise<number> {
    try {
      // This would integrate with your actual verification system
      // For now, we'll just return the count of records
      console.log(`Processing ${records.length} records for store ${storeId}, week ${weekStartDate}, upload ${uploadId}`);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return records.length;
    } catch (error) {
      console.error('Error processing verification records:', error);
      throw error;
    }
  }
}