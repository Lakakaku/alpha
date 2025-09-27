import { QRGeneratorService } from './qr-generator.service';
import { PDFTemplateService } from './pdf-template.service';
import { QRAnalyticsService } from './qr-analytics.service';
import { QRScanTrackerService } from './scan-tracker.service';
import { QRDatabase } from '../../config/qr-database';
import { QRLogger } from '../../utils/qr-logger';
import {
  QRCodeStore,
  QRRegenerateRequest,
  QRRegenerateResponse,
  QRBulkRequest,
  QRBulkResponse,
  QRDownloadRequest,
  QRDownloadResponse,
  QRValidationError,
  QRPermissionError,
  QRAnalyticsRequest
} from '@vocilia/types/qr';

/**
 * QR Management Service - Orchestrates QR code operations
 * Handles store QR management, analytics, and bulk operations
 */
export class QRManagementService {
  private qrGenerator: QRGeneratorService;
  private pdfTemplate: PDFTemplateService;
  private analytics: QRAnalyticsService;
  private scanTracker: QRScanTrackerService;
  private database: QRDatabase;
  private logger: QRLogger;

  constructor(
    qrGenerator: QRGeneratorService,
    pdfTemplate: PDFTemplateService,
    analytics: QRAnalyticsService,
    scanTracker: QRScanTrackerService,
    database: QRDatabase
  ) {
    this.qrGenerator = qrGenerator;
    this.pdfTemplate = pdfTemplate;
    this.analytics = analytics;
    this.scanTracker = scanTracker;
    this.database = database;
    this.logger = QRLogger.getInstance();
  }

  /**
   * Get store QR code information with analytics summary
   */
  async getStoreQR(
    storeId: string,
    businessId: string,
    includeAnalytics: boolean = true
  ): Promise<{
    store: QRCodeStore;
    qr_stats: {
      current_version: number;
      total_regenerations: number;
      last_regenerated: string | null;
      qr_data_size: number;
      status: string;
      transition_active: boolean;
      transition_until: string | null;
    };
    analytics_summary?: {
      today_scans: number;
      week_scans: number;
      unique_sessions_week: number;
      trend: 'up' | 'down' | 'stable';
    };
  }> {
    const startTime = Date.now();
    const operation = 'get_store_qr';

    try {
      this.logger.info({
        operation,
        storeId,
        businessId,
        metadata: { includeAnalytics },
        timestamp: new Date().toISOString()
      });

      // Validate permission - check if store belongs to business
      const store = await this.database.getStoreQR(storeId);
      if (!store) {
        throw new QRValidationError('Store not found', 'STORE_NOT_FOUND', { storeId });
      }

      if (store.business_id !== businessId) {
        throw new QRPermissionError('Access denied to store', storeId);
      }

      // Get QR statistics
      const qrStats = await this.qrGenerator.getQRCodeStats(storeId);

      let analyticsSummary;
      if (includeAnalytics) {
        try {
          // Get today's analytics
          const todayAnalytics = await this.analytics.getAnalytics(storeId, {
            period: 'day',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0]
          });

          // Get week analytics
          const weekStartDate = new Date();
          weekStartDate.setDate(weekStartDate.getDate() - 7);
          const weekAnalytics = await this.analytics.getAnalytics(storeId, {
            period: 'week',
            start_date: weekStartDate.toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0]
          });

          analyticsSummary = {
            today_scans: todayAnalytics.total_scans || 0,
            week_scans: weekAnalytics.total_scans || 0,
            unique_sessions_week: weekAnalytics.unique_sessions || 0,
            trend: 'stable' as const
          };
        } catch (error: any) {
          this.logger.warn({
            operation: `${operation}_analytics`,
            storeId,
            businessId,
            error,
            timestamp: new Date().toISOString()
          });
          // Continue without analytics rather than failing completely
          analyticsSummary = {
            today_scans: 0,
            week_scans: 0,
            unique_sessions_week: 0,
            trend: 'stable' as const
          };
        }
      }

      const result = {
        store,
        qr_stats: qrStats,
        analytics_summary: analyticsSummary
      };

      this.logger.info({
        operation,
        storeId,
        businessId,
        duration: Date.now() - startTime,
        metadata: {
          includeAnalytics,
          qrVersion: store.qr_version,
          qrStatus: store.qr_status,
          analyticsIncluded: !!analyticsSummary
        },
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error: any) {
      this.logger.error({
        operation,
        storeId,
        businessId,
        duration: Date.now() - startTime,
        error,
        metadata: { includeAnalytics },
        timestamp: new Date().toISOString()
      });

      if (error instanceof QRValidationError || error instanceof QRPermissionError) {
        throw error;
      }
      throw new QRValidationError(
        'Failed to get store QR information',
        'GET_STORE_QR_FAILED',
        { storeId, businessId, originalError: error.message }
      );
    }
  }

  /**
   * Regenerate QR code for a store
   */
  async regenerateStoreQR(
    storeId: string,
    businessId: string,
    request: QRRegenerateRequest
  ): Promise<QRRegenerateResponse> {
    const startTime = Date.now();
    const operation = 'regenerate_store_qr';

    try {
      this.logger.info({
        operation,
        storeId,
        businessId,
        metadata: { reason: request.reason, transitionHours: request.transition_hours },
        timestamp: new Date().toISOString()
      });

      // Validate permission
      const store = await this.database.getStoreQR(storeId);
      if (!store) {
        throw new QRValidationError('Store not found', 'STORE_NOT_FOUND', { storeId });
      }

      if (store.business_id !== businessId) {
        throw new QRPermissionError('Access denied to store', storeId);
      }

      // Regenerate QR code
      const result = await this.qrGenerator.regenerateQRCode(storeId, request.reason);

      this.logger.info({
        operation,
        storeId,
        businessId,
        duration: Date.now() - startTime,
        metadata: {
          oldVersion: store.qr_version,
          newVersion: result.new_qr_version,
          reason: request.reason
        },
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error: any) {
      this.logger.error({
        operation,
        storeId,
        businessId,
        duration: Date.now() - startTime,
        error,
        metadata: { reason: request.reason },
        timestamp: new Date().toISOString()
      });

      if (error instanceof QRValidationError || error instanceof QRPermissionError) {
        throw error;
      }
      throw new QRValidationError(
        'Failed to regenerate store QR code',
        'REGENERATE_QR_FAILED',
        { storeId, businessId, originalError: error.message }
      );
    }
  }

  /**
   * Perform bulk QR operations across multiple stores
   */
  async bulkOperation(
    businessId: string,
    request: QRBulkRequest
  ): Promise<QRBulkResponse> {
    const startTime = Date.now();
    const operation = 'bulk_qr_operation';

    try {
      this.logger.info({
        operation,
        businessId,
        metadata: {
          operation: request.operation,
          storeCount: request.store_ids.length,
          reason: request.reason
        },
        timestamp: new Date().toISOString()
      });

      // Validate all stores belong to business
      const stores = await this.database.getMultipleStoresQR(request.store_ids);
      const invalidStores = stores.filter(store => store.business_id !== businessId);
      
      if (invalidStores.length > 0) {
        throw new QRPermissionError(
          'Access denied to some stores',
          invalidStores.map(s => s.id).join(',')
        );
      }

      // Execute bulk operation
      const results = [];
      let successCount = 0;

      for (const storeId of request.store_ids) {
        try {
          if (request.operation === 'regenerate') {
            await this.qrGenerator.regenerateQRCode(storeId, request.reason);
          }
          results.push({ store_id: storeId, success: true });
          successCount++;
        } catch (error: any) {
          results.push({
            store_id: storeId,
            success: false,
            error_message: error.message
          });
        }
      }

      const response: QRBulkResponse = {
        success: successCount === request.store_ids.length,
        total_stores: request.store_ids.length,
        successful_operations: successCount,
        failed_operations: request.store_ids.length - successCount,
        batch_operation_id: `bulk_${Date.now()}`,
        results,
        message: `Bulk ${request.operation} completed: ${successCount}/${request.store_ids.length} successful`
      };

      this.logger.info({
        operation,
        businessId,
        duration: Date.now() - startTime,
        metadata: {
          operation: request.operation,
          totalStores: request.store_ids.length,
          successCount,
          failedCount: request.store_ids.length - successCount
        },
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error: any) {
      this.logger.error({
        operation,
        businessId,
        duration: Date.now() - startTime,
        error,
        metadata: { operation: request.operation, storeCount: request.store_ids.length },
        timestamp: new Date().toISOString()
      });

      if (error instanceof QRValidationError || error instanceof QRPermissionError) {
        throw error;
      }
      throw new QRValidationError(
        'Failed to execute bulk QR operation',
        'BULK_OPERATION_FAILED',
        { businessId, originalError: error.message }
      );
    }
  }

  /**
   * Download QR code as PDF
   */
  async downloadQR(
    storeId: string,
    businessId: string,
    request: QRDownloadRequest
  ): Promise<QRDownloadResponse> {
    const startTime = Date.now();
    const operation = 'download_qr';

    try {
      this.logger.info({
        operation,
        storeId,
        businessId,
        metadata: { templateId: request.template_id, pageSize: request.page_size },
        timestamp: new Date().toISOString()
      });

      // Validate permission
      const store = await this.database.getStoreQR(storeId);
      if (!store) {
        throw new QRValidationError('Store not found', 'STORE_NOT_FOUND', { storeId });
      }

      if (store.business_id !== businessId) {
        throw new QRPermissionError('Access denied to store', storeId);
      }

      // Get template
      let template;
      if (request.template_id) {
        template = await this.pdfTemplate.getTemplate(request.template_id);
      } else {
        template = await this.pdfTemplate.getDefaultTemplate(businessId);
      }

      // Generate PDF
      const pdfBuffer = await this.pdfTemplate.generatePDF(store, template);
      
      // Save to temp location and return download URL
      const fileName = `qr-${storeId}-${Date.now()}.pdf`;
      const downloadUrl = await this.database.saveTempFile(fileName, pdfBuffer);

      const response: QRDownloadResponse = {
        success: true,
        download_url: downloadUrl,
        file_name: fileName,
        file_size: pdfBuffer.length,
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
      };

      this.logger.info({
        operation,
        storeId,
        businessId,
        duration: Date.now() - startTime,
        metadata: {
          fileName,
          fileSize: pdfBuffer.length,
          templateId: template.id
        },
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error: any) {
      this.logger.error({
        operation,
        storeId,
        businessId,
        duration: Date.now() - startTime,
        error,
        metadata: { templateId: request.template_id },
        timestamp: new Date().toISOString()
      });

      if (error instanceof QRValidationError || error instanceof QRPermissionError) {
        throw error;
      }
      throw new QRValidationError(
        'Failed to download QR code',
        'DOWNLOAD_QR_FAILED',
        { storeId, businessId, originalError: error.message }
      );
    }
  }
}