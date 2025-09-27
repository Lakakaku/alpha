import { VerificationDatabaseModel, VerificationRecordModel } from '@vocilia/database';
import type { VerificationDatabase, VerificationRecord } from '@vocilia/types/verification';
import * as XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json';
  includeMetadata?: boolean;
  sanitizeData?: boolean;
  fileName?: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
}

export class FileExportService {
  private readonly exportDir: string;

  constructor(exportDir?: string) {
    this.exportDir = exportDir || process.env.EXPORT_DIR || './exports';
  }

  /**
   * Export verification database to specified format
   */
  async exportDatabase(
    databaseId: string, 
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Ensure export directory exists
      await this.ensureExportDirectory();

      // Get database and records
      const database = await VerificationDatabaseModel.getById(databaseId);
      if (!database) {
        return {
          success: false,
          error: 'Verification database not found'
        };
      }

      const records = await VerificationRecordModel.getByDatabaseId(databaseId);

      // Generate filename if not provided
      const fileName = options.fileName || this.generateFileName(database, options.format);
      const filePath = path.join(this.exportDir, fileName);

      // Export based on format
      let result: ExportResult;
      switch (options.format) {
        case 'csv':
          result = await this.exportToCsv(database, records, filePath, options);
          break;
        case 'xlsx':
          result = await this.exportToXlsx(database, records, filePath, options);
          break;
        case 'json':
          result = await this.exportToJson(database, records, filePath, options);
          break;
        default:
          return {
            success: false,
            error: `Unsupported export format: ${options.format}`
          };
      }

      return {
        ...result,
        fileName,
        recordCount: records.length
      };

    } catch (error) {
      console.error('Export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  /**
   * Export to CSV format
   */
  private async exportToCsv(
    database: VerificationDatabase,
    records: VerificationRecord[],
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const csvData = this.prepareDataForExport(database, records, options);
      
      if (csvData.length === 0) {
        return {
          success: false,
          error: 'No data to export'
        };
      }

      // Create CSV writer
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: Object.keys(csvData[0]).map(key => ({
          id: key,
          title: this.formatColumnHeader(key)
        }))
      });

      // Write data
      await csvWriter.writeRecords(csvData);

      // Get file stats
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        fileSize: stats.size
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CSV export failed'
      };
    }
  }

  /**
   * Export to Excel format
   */
  private async exportToXlsx(
    database: VerificationDatabase,
    records: VerificationRecord[],
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const exportData = this.prepareDataForExport(database, records, options);

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Create verification records sheet
      const recordsSheet = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(workbook, recordsSheet, 'Verification Records');

      // Add metadata sheet if requested
      if (options.includeMetadata) {
        const metadataSheet = XLSX.utils.json_to_sheet([{
          'Database ID': database.id,
          'Cycle ID': database.weekly_verification_cycle_id,
          'Business ID': database.business_id,
          'Store ID': database.store_id,
          'Transaction Count': database.transaction_count,
          'Status': database.status,
          'Deadline': database.deadline_date,
          'Created At': database.created_at,
          'Export Date': new Date().toISOString()
        }]);
        XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
      }

      // Write file
      XLSX.writeFile(workbook, filePath);

      // Get file stats
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        fileSize: stats.size
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Excel export failed'
      };
    }
  }

  /**
   * Export to JSON format
   */
  private async exportToJson(
    database: VerificationDatabase,
    records: VerificationRecord[],
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const exportData = {
        metadata: options.includeMetadata ? {
          database_id: database.id,
          cycle_id: database.weekly_verification_cycle_id,
          business_id: database.business_id,
          store_id: database.store_id,
          transaction_count: database.transaction_count,
          status: database.status,
          deadline: database.deadline_date,
          created_at: database.created_at,
          exported_at: new Date().toISOString()
        } : undefined,
        records: this.prepareDataForExport(database, records, options)
      };

      // Write JSON file
      await fs.writeFile(
        filePath, 
        JSON.stringify(exportData, null, 2), 
        'utf8'
      );

      // Get file stats
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        fileSize: stats.size
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'JSON export failed'
      };
    }
  }

  /**
   * Prepare data for export based on options
   */
  private prepareDataForExport(
    database: VerificationDatabase,
    records: VerificationRecord[],
    options: ExportOptions
  ): any[] {
    return records.map(record => {
      const exportRecord: any = {
        record_id: record.id,
        phone_number: options.sanitizeData !== false ? record.phone_number : record.phone_number,
        amount: record.amount,
        transaction_date: record.transaction_date,
        status: record.status,
        store_name: record.store_context?.store_name || '',
        location: record.store_context?.location || '',
        category: record.store_context?.category || ''
      };

      // Add timestamps if metadata is included
      if (options.includeMetadata) {
        exportRecord.created_at = record.created_at;
        exportRecord.updated_at = record.updated_at;
        exportRecord.verified_at = record.verified_at;
      }

      // Add verification details if available
      if (record.verification_details) {
        exportRecord.verification_notes = JSON.stringify(record.verification_details);
      }

      return exportRecord;
    });
  }

  /**
   * Generate filename for export
   */
  private generateFileName(database: VerificationDatabase, format: string): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const storeId = database.store_id.substring(0, 8);
    return `verification_${storeId}_${timestamp}.${format}`;
  }

  /**
   * Format column headers for better readability
   */
  private formatColumnHeader(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Ensure export directory exists
   */
  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.access(this.exportDir);
    } catch {
      await fs.mkdir(this.exportDir, { recursive: true });
    }
  }

  /**
   * Bulk export multiple databases
   */
  async bulkExport(
    databaseIds: string[],
    options: ExportOptions
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];

    for (const databaseId of databaseIds) {
      const result = await this.exportDatabase(databaseId, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Export customer reward data after verification
   */
  async exportCustomerRewards(
    cycleId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      await this.ensureExportDirectory();

      // Get all databases for the cycle
      const databases = await VerificationDatabaseModel.getByCycleId(cycleId);
      
      // Get all verified records
      const allRewards: any[] = [];
      
      for (const database of databases) {
        const verifiedRecords = await VerificationRecordModel.getByDatabaseId(
          database.id, 
          { status: 'verified' }
        );

        const rewards = verifiedRecords.map(record => ({
          phone_number: record.phone_number,
          reward_amount: this.calculateRewardAmount(record.amount),
          business_name: database.business_id,
          store_location: record.store_context?.location || '',
          transaction_amount: record.amount,
          transaction_date: record.transaction_date,
          verified_date: record.verified_at,
          reward_type: this.determineRewardType(record.amount)
        }));

        allRewards.push(...rewards);
      }

      if (allRewards.length === 0) {
        return {
          success: false,
          error: 'No verified transactions found for rewards'
        };
      }

      // Generate filename
      const fileName = options.fileName || `customer_rewards_${cycleId}_${Date.now()}.${options.format}`;
      const filePath = path.join(this.exportDir, fileName);

      // Export based on format
      let result: ExportResult;
      switch (options.format) {
        case 'csv':
          result = await this.exportRewardsToCsv(allRewards, filePath);
          break;
        case 'xlsx':
          result = await this.exportRewardsToXlsx(allRewards, filePath);
          break;
        case 'json':
          result = await this.exportRewardsToJson(allRewards, filePath);
          break;
        default:
          return {
            success: false,
            error: `Unsupported format: ${options.format}`
          };
      }

      return {
        ...result,
        fileName,
        recordCount: allRewards.length
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rewards export failed'
      };
    }
  }

  /**
   * Calculate reward amount based on transaction amount
   */
  private calculateRewardAmount(transactionAmount: number): number {
    // 2% reward rate
    return Math.round(transactionAmount * 0.02 * 100) / 100;
  }

  /**
   * Determine reward type based on transaction amount
   */
  private determineRewardType(amount: number): string {
    if (amount >= 1000) return 'Premium';
    if (amount >= 500) return 'Standard';
    return 'Basic';
  }

  /**
   * Export rewards to CSV
   */
  private async exportRewardsToCsv(rewards: any[], filePath: string): Promise<ExportResult> {
    try {
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'phone_number', title: 'Phone Number' },
          { id: 'reward_amount', title: 'Reward Amount' },
          { id: 'business_name', title: 'Business' },
          { id: 'store_location', title: 'Store Location' },
          { id: 'transaction_amount', title: 'Transaction Amount' },
          { id: 'transaction_date', title: 'Transaction Date' },
          { id: 'verified_date', title: 'Verified Date' },
          { id: 'reward_type', title: 'Reward Type' }
        ]
      });

      await csvWriter.writeRecords(rewards);
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        fileSize: stats.size
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CSV export failed'
      };
    }
  }

  /**
   * Export rewards to Excel
   */
  private async exportRewardsToXlsx(rewards: any[], filePath: string): Promise<ExportResult> {
    try {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rewards);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Rewards');
      XLSX.writeFile(workbook, filePath);

      const stats = await fs.stat(filePath);
      return {
        success: true,
        filePath,
        fileSize: stats.size
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Excel export failed'
      };
    }
  }

  /**
   * Export rewards to JSON
   */
  private async exportRewardsToJson(rewards: any[], filePath: string): Promise<ExportResult> {
    try {
      const exportData = {
        export_date: new Date().toISOString(),
        total_rewards: rewards.length,
        total_amount: rewards.reduce((sum, reward) => sum + reward.reward_amount, 0),
        rewards
      };

      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        fileSize: stats.size
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'JSON export failed'
      };
    }
  }

  /**
   * Clean up old export files
   */
  async cleanupExports(olderThanDays: number = 30): Promise<{
    deletedFiles: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let deletedFiles = 0;

    try {
      const files = await fs.readdir(this.exportDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      for (const file of files) {
        try {
          const filePath = path.join(this.exportDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            deletedFiles++;
          }
        } catch (error) {
          errors.push(`Failed to delete ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to read export directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      deletedFiles,
      errors
    };
  }
}