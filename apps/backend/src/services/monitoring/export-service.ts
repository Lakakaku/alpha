import { SystemMetricModel } from '@vocilia/database/monitoring/system-metrics';
import { FraudDetectionReportModel } from '@vocilia/database/monitoring/fraud-detection-reports';
import { RevenueAnalyticsModel } from '@vocilia/database/monitoring/revenue-analytics';
import { BusinessPerformanceMetricsModel } from '@vocilia/database/monitoring/business-performance-metrics';
import { ValidationError, InternalServerError } from '../../middleware/errorHandler';
import { loggingService } from '../loggingService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ExportRequest {
  data_type: 'system_metrics' | 'fraud_reports' | 'revenue_analytics' | 'business_performance';
  format: 'csv' | 'pdf' | 'json';
  date_range: {
    start_date: string;
    end_date: string;
  };
  filters?: {
    store_ids?: string[];
    service_names?: string[];
    business_ids?: string[];
    metric_types?: string[];
  };
  options?: {
    include_summary?: boolean;
    group_by?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  };
}

export interface ExportJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  export_request: ExportRequest;
  file_path?: string;
  download_url?: string;
  file_size?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  expires_at: string;
  requested_by: string;
}

export interface ExportProgress {
  job_id: string;
  status: ExportJob['status'];
  progress_percentage: number;
  current_step: string;
  estimated_completion?: string;
}

export class ExportService {
  private exportJobs: Map<string, ExportJob> = new Map();
  private readonly EXPORT_DIR = process.env.EXPORT_DIR || '/tmp/exports';
  private readonly EXPORT_EXPIRY_HOURS = 24;
  private readonly MAX_EXPORT_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_CONCURRENT_EXPORTS = 5;

  constructor() {
    // Ensure export directory exists
    this.ensureExportDirectory();

    // Start cleanup routine
    this.startCleanupRoutine();
  }

  /**
   * Create a new export job
   */
  async createExport(
    exportRequest: ExportRequest,
    requestedBy: string
  ): Promise<{
    export_id?: string;
    download_url?: string;
    expires_at?: string;
    file_size?: number;
    status: 'queued' | 'processing' | 'completed';
  }> {
    try {
      // Validate export request
      this.validateExportRequest(exportRequest);

      if (!requestedBy) {
        throw new ValidationError('Requested by user ID is required');
      }

      // Check concurrent export limit
      const activeExports = Array.from(this.exportJobs.values())
        .filter(job => job.status === 'processing' || job.status === 'queued')
        .length;

      if (activeExports >= this.MAX_CONCURRENT_EXPORTS) {
        throw new ValidationError('Maximum concurrent exports limit reached. Please try again later.');
      }

      // Create export job
      const exportId = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.EXPORT_EXPIRY_HOURS);

      const exportJob: ExportJob = {
        id: exportId,
        status: 'queued',
        export_request: exportRequest,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        requested_by: requestedBy,
      };

      this.exportJobs.set(exportId, exportJob);

      // For small exports, process immediately
      const estimatedSize = await this.estimateExportSize(exportRequest);

      if (estimatedSize < 10 * 1024 * 1024) { // 10MB
        // Process immediately for small exports
        const result = await this.processExportJob(exportId);
        return result;
      } else {
        // Queue for background processing
        this.processExportJobAsync(exportId);

        return {
          export_id: exportId,
          status: 'queued',
        };
      }
    } catch (error) {
      loggingService.error('Error creating export', error as Error, { exportRequest, requestedBy });
      throw error;
    }
  }

  /**
   * Get export job status and progress
   */
  async getExportStatus(exportId: string): Promise<ExportProgress> {
    try {
      if (!exportId) {
        throw new ValidationError('Export ID is required');
      }

      const job = this.exportJobs.get(exportId);
      if (!job) {
        throw new ValidationError('Export job not found');
      }

      // Calculate progress based on status
      let progressPercentage = 0;
      let currentStep = 'Initializing';

      switch (job.status) {
        case 'queued':
          progressPercentage = 0;
          currentStep = 'Waiting in queue';
          break;
        case 'processing':
          progressPercentage = 50;
          currentStep = 'Processing data';
          break;
        case 'completed':
          progressPercentage = 100;
          currentStep = 'Completed';
          break;
        case 'failed':
          progressPercentage = 0;
          currentStep = 'Failed';
          break;
      }

      return {
        job_id: exportId,
        status: job.status,
        progress_percentage: progressPercentage,
        current_step: currentStep,
        estimated_completion: job.completed_at,
      };
    } catch (error) {
      loggingService.error('Error getting export status', error as Error, { exportId });
      throw error;
    }
  }

  /**
   * Get download URL for completed export
   */
  async getDownloadUrl(exportId: string, requestedBy: string): Promise<{
    download_url: string;
    expires_at: string;
    file_size: number;
  }> {
    try {
      if (!exportId) {
        throw new ValidationError('Export ID is required');
      }

      const job = this.exportJobs.get(exportId);
      if (!job) {
        throw new ValidationError('Export job not found');
      }

      // Check if requester has access
      if (job.requested_by !== requestedBy) {
        throw new ValidationError('Access denied to this export');
      }

      if (job.status !== 'completed') {
        throw new ValidationError('Export is not yet completed');
      }

      if (!job.download_url || !job.file_size) {
        throw new InternalServerError('Export file information is missing');
      }

      // Check if export has expired
      if (new Date() > new Date(job.expires_at)) {
        throw new ValidationError('Export has expired');
      }

      // Log download access
      loggingService.info('Export download accessed', {
        exportId,
        requestedBy,
        dataType: job.export_request.data_type,
        format: job.export_request.format,
      });

      return {
        download_url: job.download_url,
        expires_at: job.expires_at,
        file_size: job.file_size,
      };
    } catch (error) {
      loggingService.error('Error getting download URL', error as Error, { exportId, requestedBy });
      throw error;
    }
  }

  /**
   * Cancel an export job
   */
  async cancelExport(exportId: string, requestedBy: string): Promise<void> {
    try {
      if (!exportId) {
        throw new ValidationError('Export ID is required');
      }

      const job = this.exportJobs.get(exportId);
      if (!job) {
        throw new ValidationError('Export job not found');
      }

      // Check if requester has access
      if (job.requested_by !== requestedBy) {
        throw new ValidationError('Access denied to this export');
      }

      if (job.status === 'completed') {
        throw new ValidationError('Cannot cancel completed export');
      }

      if (job.status === 'failed') {
        throw new ValidationError('Export already failed');
      }

      // Update job status
      job.status = 'failed';
      job.error_message = 'Cancelled by user';
      job.completed_at = new Date().toISOString();

      // Clean up any partial files
      if (job.file_path) {
        try {
          await fs.unlink(job.file_path);
        } catch (error) {
          // Ignore file deletion errors
        }
      }

      loggingService.info('Export cancelled', {
        exportId,
        requestedBy,
        dataType: job.export_request.data_type,
      });
    } catch (error) {
      loggingService.error('Error cancelling export', error as Error, { exportId, requestedBy });
      throw error;
    }
  }

  /**
   * List export jobs for a user
   */
  async listExports(
    requestedBy: string,
    limit = 20,
    offset = 0
  ): Promise<{
    exports: ExportJob[];
    total: number;
  }> {
    try {
      if (!requestedBy) {
        throw new ValidationError('Requested by user ID is required');
      }

      // Get user's export jobs
      const userExports = Array.from(this.exportJobs.values())
        .filter(job => job.requested_by === requestedBy)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const total = userExports.length;
      const exports = userExports.slice(offset, offset + limit);

      return {
        exports: exports.map(job => this.sanitizeExportJobForResponse(job)),
        total,
      };
    } catch (error) {
      loggingService.error('Error listing exports', error as Error, { requestedBy, limit, offset });
      throw error;
    }
  }

  /**
   * Get export statistics
   */
  async getExportStatistics(adminId: string): Promise<{
    total_exports: number;
    active_exports: number;
    completed_exports: number;
    failed_exports: number;
    exports_by_type: Record<string, number>;
    exports_by_format: Record<string, number>;
    total_data_exported_mb: number;
  }> {
    try {
      const allExports = Array.from(this.exportJobs.values());

      const statistics = {
        total_exports: allExports.length,
        active_exports: allExports.filter(job =>
          job.status === 'queued' || job.status === 'processing'
        ).length,
        completed_exports: allExports.filter(job => job.status === 'completed').length,
        failed_exports: allExports.filter(job => job.status === 'failed').length,
        exports_by_type: {} as Record<string, number>,
        exports_by_format: {} as Record<string, number>,
        total_data_exported_mb: 0,
      };

      // Calculate type and format statistics
      allExports.forEach(job => {
        const dataType = job.export_request.data_type;
        const format = job.export_request.format;

        statistics.exports_by_type[dataType] = (statistics.exports_by_type[dataType] || 0) + 1;
        statistics.exports_by_format[format] = (statistics.exports_by_format[format] || 0) + 1;

        if (job.file_size) {
          statistics.total_data_exported_mb += job.file_size / (1024 * 1024);
        }
      });

      return statistics;
    } catch (error) {
      loggingService.error('Error getting export statistics', error as Error, { adminId });
      throw error;
    }
  }

  // Private methods
  private async processExportJob(exportId: string): Promise<{
    export_id?: string;
    download_url?: string;
    expires_at?: string;
    file_size?: number;
    status: 'completed' | 'failed';
  }> {
    const job = this.exportJobs.get(exportId);
    if (!job) {
      throw new InternalServerError('Export job not found');
    }

    try {
      // Update status to processing
      job.status = 'processing';

      // Get data based on type
      const data = await this.fetchDataForExport(job.export_request);

      // Generate file based on format
      const filePath = await this.generateExportFile(data, job.export_request, exportId);

      // Get file size
      const fileStats = await fs.stat(filePath);
      const fileSize = fileStats.size;

      // Check size limit
      if (fileSize > this.MAX_EXPORT_SIZE) {
        throw new Error('Export file size exceeds maximum limit');
      }

      // Generate download URL (in production, this would be a signed URL to cloud storage)
      const downloadUrl = this.generateDownloadUrl(exportId, path.basename(filePath));

      // Update job with completion details
      job.status = 'completed';
      job.file_path = filePath;
      job.download_url = downloadUrl;
      job.file_size = fileSize;
      job.completed_at = new Date().toISOString();

      loggingService.info('Export completed', {
        exportId,
        dataType: job.export_request.data_type,
        format: job.export_request.format,
        fileSize,
      });

      return {
        download_url: downloadUrl,
        expires_at: job.expires_at,
        file_size: fileSize,
        status: 'completed',
      };
    } catch (error) {
      // Update job with failure details
      job.status = 'failed';
      job.error_message = error instanceof Error ? error.message : 'Unknown error';
      job.completed_at = new Date().toISOString();

      loggingService.error('Export failed', error as Error, {
        exportId,
        dataType: job.export_request.data_type,
      });

      return {
        export_id: exportId,
        status: 'failed',
      };
    }
  }

  private async processExportJobAsync(exportId: string): Promise<void> {
    // Process in background without blocking
    setTimeout(async () => {
      await this.processExportJob(exportId);
    }, 100);
  }

  private async fetchDataForExport(request: ExportRequest): Promise<any[]> {
    const { data_type, date_range, filters } = request;

    const startDate = date_range.start_date;
    const endDate = date_range.end_date;

    switch (data_type) {
      case 'system_metrics':
        return await this.fetchSystemMetrics(startDate, endDate, filters);
      case 'fraud_reports':
        return await this.fetchFraudReports(startDate, endDate, filters);
      case 'revenue_analytics':
        return await this.fetchRevenueAnalytics(startDate, endDate, filters);
      case 'business_performance':
        return await this.fetchBusinessPerformance(startDate, endDate, filters);
      default:
        throw new ValidationError(`Unsupported data type: ${data_type}`);
    }
  }

  private async fetchSystemMetrics(startDate: string, endDate: string, filters?: any): Promise<any[]> {
    const dbFilters = {
      startTime: startDate,
      endTime: endDate,
      serviceName: filters?.service_names?.[0],
      metricType: filters?.metric_types?.[0],
    };

    // Fetch all pages
    let allMetrics: any[] = [];
    let page = 1;
    const limit = 1000;

    while (true) {
      const { metrics, total } = await SystemMetricModel.getMetrics(dbFilters, page, limit);
      allMetrics = allMetrics.concat(metrics);

      if (allMetrics.length >= total) {
        break;
      }
      page++;
    }

    return allMetrics;
  }

  private async fetchFraudReports(startDate: string, endDate: string, filters?: any): Promise<any[]> {
    const dbFilters = {
      startDate,
      endDate,
      storeId: filters?.store_ids?.[0],
    };

    // Fetch all pages
    let allReports: any[] = [];
    let page = 1;
    const limit = 1000;

    while (true) {
      const { reports, total } = await FraudDetectionReportModel.getFraudReports(dbFilters, page, limit);
      allReports = allReports.concat(reports);

      if (allReports.length >= total) {
        break;
      }
      page++;
    }

    return allReports;
  }

  private async fetchRevenueAnalytics(startDate: string, endDate: string, filters?: any): Promise<any[]> {
    const dbFilters = {
      startDate,
      endDate,
      storeId: filters?.store_ids?.[0],
    };

    // Fetch all pages
    let allAnalytics: any[] = [];
    let page = 1;
    const limit = 1000;

    while (true) {
      const { analytics, total } = await RevenueAnalyticsModel.getRevenueAnalytics(dbFilters, page, limit);
      allAnalytics = allAnalytics.concat(analytics);

      if (allAnalytics.length >= total) {
        break;
      }
      page++;
    }

    return allAnalytics;
  }

  private async fetchBusinessPerformance(startDate: string, endDate: string, filters?: any): Promise<any[]> {
    const dbFilters = {
      storeId: filters?.store_ids?.[0],
      businessId: filters?.business_ids?.[0],
    };

    // Fetch all pages
    let allMetrics: any[] = [];
    let page = 1;
    const limit = 1000;

    while (true) {
      const { metrics, total } = await BusinessPerformanceMetricsModel.getPerformanceMetrics(dbFilters, page, limit);
      allMetrics = allMetrics.concat(metrics);

      if (allMetrics.length >= total) {
        break;
      }
      page++;
    }

    return allMetrics;
  }

  private async generateExportFile(
    data: any[],
    request: ExportRequest,
    exportId: string
  ): Promise<string> {
    const fileName = `export_${exportId}_${Date.now()}.${request.format}`;
    const filePath = path.join(this.EXPORT_DIR, fileName);

    switch (request.format) {
      case 'csv':
        await this.generateCsvFile(data, filePath, request);
        break;
      case 'json':
        await this.generateJsonFile(data, filePath, request);
        break;
      case 'pdf':
        await this.generatePdfFile(data, filePath, request);
        break;
      default:
        throw new ValidationError(`Unsupported export format: ${request.format}`);
    }

    return filePath;
  }

  private async generateCsvFile(data: any[], filePath: string, request: ExportRequest): Promise<void> {
    if (data.length === 0) {
      await fs.writeFile(filePath, 'No data available for the selected criteria\n');
      return;
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    let csvContent = headers.join(',') + '\n';

    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        // Escape commas and quotes in CSV
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return '"' + stringValue.replace(/"/g, '""') + '"';
        }
        return stringValue;
      });
      csvContent += values.join(',') + '\n';
    }

    await fs.writeFile(filePath, csvContent, 'utf-8');
  }

  private async generateJsonFile(data: any[], filePath: string, request: ExportRequest): Promise<void> {
    const exportData = {
      export_info: {
        data_type: request.data_type,
        date_range: request.date_range,
        filters: request.filters,
        exported_at: new Date().toISOString(),
        record_count: data.length,
      },
      data,
    };

    if (request.options?.include_summary) {
      exportData['summary'] = this.generateDataSummary(data, request.data_type);
    }

    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  }

  private async generatePdfFile(data: any[], filePath: string, request: ExportRequest): Promise<void> {
    // For now, generate a simple text-based PDF content
    // In production, you would use a proper PDF library like puppeteer or PDFKit
    const pdfContent = `
Vocilia Analytics Export Report
Data Type: ${request.data_type}
Date Range: ${request.date_range.start_date} to ${request.date_range.end_date}
Generated: ${new Date().toISOString()}
Record Count: ${data.length}

Data Summary:
${JSON.stringify(this.generateDataSummary(data, request.data_type), null, 2)}

Note: This is a simplified PDF export. Full PDF generation with charts and formatting would be implemented in production.
`;

    await fs.writeFile(filePath, pdfContent, 'utf-8');
  }

  private generateDataSummary(data: any[], dataType: string): any {
    if (data.length === 0) {
      return { message: 'No data available' };
    }

    const summary: any = {
      total_records: data.length,
      date_range: {
        earliest: data.reduce((min, item) => {
          const date = item.report_date || item.timestamp || item.created_at;
          return date < min ? date : min;
        }, data[0].report_date || data[0].timestamp || data[0].created_at),
        latest: data.reduce((max, item) => {
          const date = item.report_date || item.timestamp || item.created_at;
          return date > max ? date : max;
        }, data[0].report_date || data[0].timestamp || data[0].created_at),
      },
    };

    // Add type-specific summaries
    switch (dataType) {
      case 'revenue_analytics':
        const totalRevenue = data.reduce((sum, item) => sum + (item.net_revenue || 0), 0);
        summary.total_revenue = totalRevenue;
        summary.average_revenue_per_record = totalRevenue / data.length;
        break;
      case 'fraud_reports':
        const avgFailureRate = data.reduce((sum, item) => sum + (item.verification_failure_rate || 0), 0) / data.length;
        summary.average_failure_rate = avgFailureRate;
        summary.high_risk_stores = data.filter(item => item.verification_failure_rate > 20).length;
        break;
    }

    return summary;
  }

  private async estimateExportSize(request: ExportRequest): Promise<number> {
    // Estimate export size based on data type and date range
    const daysDiff = (new Date(request.date_range.end_date).getTime() -
                     new Date(request.date_range.start_date).getTime()) / (1000 * 60 * 60 * 24);

    // Rough estimation based on data type and time range
    let estimatedRecords = daysDiff * 100; // Base estimate

    switch (request.data_type) {
      case 'system_metrics':
        estimatedRecords = daysDiff * 1440; // ~1 metric per minute
        break;
      case 'revenue_analytics':
        estimatedRecords = daysDiff * 10; // ~10 stores per day
        break;
    }

    // Estimate size per record based on format
    let bytesPerRecord = 100; // Base estimate
    switch (request.format) {
      case 'csv':
        bytesPerRecord = 80;
        break;
      case 'json':
        bytesPerRecord = 150;
        break;
      case 'pdf':
        bytesPerRecord = 200;
        break;
    }

    return estimatedRecords * bytesPerRecord;
  }

  private generateDownloadUrl(exportId: string, fileName: string): string {
    // In production, this would generate a signed URL to cloud storage
    return `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/monitoring/export/${exportId}/download`;
  }

  private sanitizeExportJobForResponse(job: ExportJob): any {
    return {
      id: job.id,
      status: job.status,
      data_type: job.export_request.data_type,
      format: job.export_request.format,
      date_range: job.export_request.date_range,
      file_size: job.file_size,
      error_message: job.error_message,
      created_at: job.created_at,
      completed_at: job.completed_at,
      expires_at: job.expires_at,
    };
  }

  private validateExportRequest(request: ExportRequest): void {
    if (!request.data_type) {
      throw new ValidationError('Data type is required');
    }

    if (!['system_metrics', 'fraud_reports', 'revenue_analytics', 'business_performance'].includes(request.data_type)) {
      throw new ValidationError('Invalid data type');
    }

    if (!request.format) {
      throw new ValidationError('Export format is required');
    }

    if (!['csv', 'pdf', 'json'].includes(request.format)) {
      throw new ValidationError('Invalid export format');
    }

    if (!request.date_range || !request.date_range.start_date || !request.date_range.end_date) {
      throw new ValidationError('Date range with start_date and end_date is required');
    }

    const startDate = new Date(request.date_range.start_date);
    const endDate = new Date(request.date_range.end_date);

    if (startDate >= endDate) {
      throw new ValidationError('Start date must be before end date');
    }

    // Limit export range to prevent excessive data retrieval
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new ValidationError('Export date range cannot exceed 365 days');
    }
  }

  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.access(this.EXPORT_DIR);
    } catch {
      await fs.mkdir(this.EXPORT_DIR, { recursive: true });
    }
  }

  private startCleanupRoutine(): void {
    // Clean up expired exports every hour
    setInterval(async () => {
      const now = new Date();
      const expiredJobs: string[] = [];

      for (const [jobId, job] of this.exportJobs.entries()) {
        if (new Date(job.expires_at) <= now) {
          expiredJobs.push(jobId);

          // Delete file if it exists
          if (job.file_path) {
            try {
              await fs.unlink(job.file_path);
            } catch (error) {
              // Ignore file deletion errors
            }
          }
        }
      }

      // Remove expired jobs from memory
      expiredJobs.forEach(jobId => {
        this.exportJobs.delete(jobId);
      });

      if (expiredJobs.length > 0) {
        loggingService.info('Cleaned up expired exports', {
          expiredCount: expiredJobs.length,
        });
      }
    }, 60 * 60 * 1000); // Every hour
  }
}

// Singleton instance
export const exportService = new ExportService();