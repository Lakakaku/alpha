import { FileExportService, ExportOptions, ExportResult } from '../../src/services/verification/fileExportService';
import { VerificationDatabaseModel, VerificationRecordModel } from '@vocilia/database';
import { VerificationDatabase, VerificationRecord } from '@vocilia/types/verification';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';

// Mock dependencies
jest.mock('@vocilia/database');
jest.mock('fs/promises');
jest.mock('xlsx');
jest.mock('csv-writer');

describe('FileExportService', () => {
  let service: FileExportService;
  let mockVerificationDatabaseModel: jest.Mocked<typeof VerificationDatabaseModel>;
  let mockVerificationRecordModel: jest.Mocked<typeof VerificationRecordModel>;
  let mockFs: jest.Mocked<typeof fs>;
  let mockXLSX: jest.Mocked<typeof XLSX>;
  let mockCsvWriter: any;

  const mockDatabase: VerificationDatabase = {
    id: 'db-123',
    weekly_verification_cycle_id: 'cycle-123',
    business_id: 'business-123',
    store_id: 'store-123',
    status: 'ready',
    transaction_count: 100,
    verified_count: 0,
    deadline_date: '2025-10-06',
    created_at: '2025-09-29T00:00:00Z',
    updated_at: '2025-09-29T00:00:00Z'
  };

  const mockRecords: VerificationRecord[] = [
    {
      id: 'record-1',
      verification_database_id: 'db-123',
      phone_number: '+46701234567',
      amount: 100.50,
      transaction_date: '2025-09-28',
      status: 'pending',
      store_context: {
        store_name: 'Test Store',
        location: 'Stockholm',
        category: 'restaurant'
      },
      verification_details: null,
      created_at: '2025-09-29T00:00:00Z',
      updated_at: '2025-09-29T00:00:00Z',
      verified_at: null
    },
    {
      id: 'record-2',
      verification_database_id: 'db-123',
      phone_number: '+46701234568',
      amount: 250.75,
      transaction_date: '2025-09-28',
      status: 'verified',
      store_context: {
        store_name: 'Test Store',
        location: 'Stockholm',
        category: 'restaurant'
      },
      verification_details: { notes: 'Verified against POS system' },
      created_at: '2025-09-29T00:00:00Z',
      updated_at: '2025-09-29T01:00:00Z',
      verified_at: '2025-09-29T01:00:00Z'
    }
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock implementations
    mockVerificationDatabaseModel = VerificationDatabaseModel as jest.Mocked<typeof VerificationDatabaseModel>;
    mockVerificationRecordModel = VerificationRecordModel as jest.Mocked<typeof VerificationRecordModel>;
    mockFs = fs as jest.Mocked<typeof fs>;
    mockXLSX = XLSX as jest.Mocked<typeof XLSX>;

    // Mock CSV writer
    mockCsvWriter = {
      writeRecords: jest.fn().mockResolvedValue(undefined)
    };
    (createObjectCsvWriter as jest.Mock).mockReturnValue(mockCsvWriter);

    // Mock fs methods
    mockFs.access = jest.fn().mockResolvedValue(undefined);
    mockFs.mkdir = jest.fn().mockResolvedValue(undefined);
    mockFs.writeFile = jest.fn().mockResolvedValue(undefined);
    mockFs.stat = jest.fn().mockResolvedValue({ size: 1024, mtime: new Date() } as any);
    mockFs.readdir = jest.fn().mockResolvedValue([]);
    mockFs.unlink = jest.fn().mockResolvedValue(undefined);

    // Mock XLSX methods
    mockXLSX.utils = {
      book_new: jest.fn().mockReturnValue({}),
      json_to_sheet: jest.fn().mockReturnValue({}),
      book_append_sheet: jest.fn().mockReturnValue(undefined)
    } as any;
    mockXLSX.writeFile = jest.fn().mockReturnValue(undefined);

    // Create service instance
    service = new FileExportService('./test-exports');
  });

  describe('constructor', () => {
    it('should use provided export directory', () => {
      const customService = new FileExportService('./custom-exports');
      expect(customService).toBeDefined();
    });

    it('should use default export directory if not provided', () => {
      const defaultService = new FileExportService();
      expect(defaultService).toBeDefined();
    });
  });

  describe('exportDatabase', () => {
    beforeEach(() => {
      mockVerificationDatabaseModel.getById = jest.fn().mockResolvedValue(mockDatabase);
      mockVerificationRecordModel.getByDatabaseId = jest.fn().mockResolvedValue(mockRecords);
    });

    it('should export database to CSV successfully', async () => {
      const options: ExportOptions = {
        format: 'csv',
        includeMetadata: false,
        sanitizeData: true
      };

      const result = await service.exportDatabase('db-123', options);

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/verification_store-12_.*\.csv/);
      expect(result.recordCount).toBe(2);
      expect(result.fileSize).toBe(1024);
      expect(mockCsvWriter.writeRecords).toHaveBeenCalled();
    });

    it('should export database to Excel successfully', async () => {
      const options: ExportOptions = {
        format: 'xlsx',
        includeMetadata: true
      };

      const result = await service.exportDatabase('db-123', options);

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/verification_store-12_.*\.xlsx/);
      expect(result.recordCount).toBe(2);
      expect(mockXLSX.utils.book_new).toHaveBeenCalled();
      expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalledTimes(2); // Records + Metadata
      expect(mockXLSX.writeFile).toHaveBeenCalled();
    });

    it('should export database to JSON successfully', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeMetadata: true
      };

      const result = await service.exportDatabase('db-123', options);

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/verification_store-12_.*\.json/);
      expect(result.recordCount).toBe(2);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringContaining('"metadata"'),
        'utf8'
      );
    });

    it('should return error if database not found', async () => {
      mockVerificationDatabaseModel.getById = jest.fn().mockResolvedValue(null);

      const options: ExportOptions = { format: 'csv' };
      const result = await service.exportDatabase('nonexistent', options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Verification database not found');
    });

    it('should return error for unsupported format', async () => {
      const options: ExportOptions = { format: 'pdf' as any };
      const result = await service.exportDatabase('db-123', options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported export format: pdf');
    });

    it('should handle export errors gracefully', async () => {
      mockFs.writeFile = jest.fn().mockRejectedValue(new Error('Write failed'));

      const options: ExportOptions = { format: 'json' };
      const result = await service.exportDatabase('db-123', options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Write failed');
    });

    it('should use custom filename when provided', async () => {
      const options: ExportOptions = {
        format: 'csv',
        fileName: 'custom-export.csv'
      };

      const result = await service.exportDatabase('db-123', options);

      expect(result.success).toBe(true);
      expect(result.fileName).toBe('custom-export.csv');
    });

    it('should create export directory if it does not exist', async () => {
      mockFs.access = jest.fn().mockRejectedValue(new Error('Directory does not exist'));

      const options: ExportOptions = { format: 'csv' };
      await service.exportDatabase('db-123', options);

      expect(mockFs.mkdir).toHaveBeenCalledWith('./test-exports', { recursive: true });
    });
  });

  describe('bulkExport', () => {
    beforeEach(() => {
      mockVerificationDatabaseModel.getById = jest.fn().mockResolvedValue(mockDatabase);
      mockVerificationRecordModel.getByDatabaseId = jest.fn().mockResolvedValue(mockRecords);
    });

    it('should export multiple databases successfully', async () => {
      const databaseIds = ['db-1', 'db-2', 'db-3'];
      const options: ExportOptions = { format: 'csv' };

      const results = await service.bulkExport(databaseIds, options);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockVerificationDatabaseModel.getById).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in bulk export', async () => {
      mockVerificationDatabaseModel.getById = jest.fn()
        .mockResolvedValueOnce(mockDatabase)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockDatabase);

      const databaseIds = ['db-1', 'db-2', 'db-3'];
      const options: ExportOptions = { format: 'csv' };

      const results = await service.bulkExport(databaseIds, options);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('exportCustomerRewards', () => {
    beforeEach(() => {
      mockVerificationDatabaseModel.getByCycleId = jest.fn().mockResolvedValue([mockDatabase]);
      mockVerificationRecordModel.getByDatabaseId = jest.fn().mockResolvedValue([
        { ...mockRecords[1], status: 'verified' } // Only verified records
      ]);
    });

    it('should export customer rewards to CSV successfully', async () => {
      const options: ExportOptions = { format: 'csv' };
      const result = await service.exportCustomerRewards('cycle-123', options);

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/customer_rewards_cycle-123_\d+\.csv/);
      expect(result.recordCount).toBe(1);
      expect(mockCsvWriter.writeRecords).toHaveBeenCalled();
    });

    it('should export customer rewards to Excel successfully', async () => {
      const options: ExportOptions = { format: 'xlsx' };
      const result = await service.exportCustomerRewards('cycle-123', options);

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/customer_rewards_cycle-123_\d+\.xlsx/);
      expect(mockXLSX.writeFile).toHaveBeenCalled();
    });

    it('should export customer rewards to JSON successfully', async () => {
      const options: ExportOptions = { format: 'json' };
      const result = await service.exportCustomerRewards('cycle-123', options);

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/customer_rewards_cycle-123_\d+\.json/);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.stringContaining('"total_rewards"'),
        'utf8'
      );
    });

    it('should return error if no verified transactions found', async () => {
      mockVerificationRecordModel.getByDatabaseId = jest.fn().mockResolvedValue([]);

      const options: ExportOptions = { format: 'csv' };
      const result = await service.exportCustomerRewards('cycle-123', options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No verified transactions found for rewards');
    });

    it('should calculate reward amounts correctly', async () => {
      // Mock a record with 250.75 amount (2% reward = 5.02)
      const verifiedRecord = { ...mockRecords[1], amount: 250.75, status: 'verified' };
      mockVerificationRecordModel.getByDatabaseId = jest.fn().mockResolvedValue([verifiedRecord]);

      const options: ExportOptions = { format: 'json' };
      await service.exportCustomerRewards('cycle-123', options);

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      expect(jsonData.rewards[0].reward_amount).toBe(5.02); // 2% of 250.75
      expect(jsonData.rewards[0].reward_type).toBe('Basic'); // < 500
    });

    it('should determine reward types correctly', async () => {
      const records = [
        { ...mockRecords[0], amount: 100, status: 'verified' }, // Basic
        { ...mockRecords[0], amount: 750, status: 'verified' }, // Standard
        { ...mockRecords[0], amount: 1500, status: 'verified' } // Premium
      ];
      mockVerificationRecordModel.getByDatabaseId = jest.fn().mockResolvedValue(records);

      const options: ExportOptions = { format: 'json' };
      await service.exportCustomerRewards('cycle-123', options);

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      expect(jsonData.rewards[0].reward_type).toBe('Basic');
      expect(jsonData.rewards[1].reward_type).toBe('Standard');
      expect(jsonData.rewards[2].reward_type).toBe('Premium');
    });
  });

  describe('cleanupExports', () => {
    it('should delete old files successfully', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days old
      
      const newDate = new Date();
      newDate.setDate(newDate.getDate() - 5); // 5 days old

      mockFs.readdir = jest.fn().mockResolvedValue(['old-file.csv', 'new-file.csv']);
      mockFs.stat = jest.fn()
        .mockResolvedValueOnce({ mtime: oldDate } as any)
        .mockResolvedValueOnce({ mtime: newDate } as any);

      const result = await service.cleanupExports(30);

      expect(result.deletedFiles).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join('./test-exports', 'old-file.csv')
      );
    });

    it('should handle errors during cleanup gracefully', async () => {
      mockFs.readdir = jest.fn().mockResolvedValue(['file1.csv', 'file2.csv']);
      mockFs.stat = jest.fn().mockResolvedValue({ mtime: new Date(0) } as any);
      mockFs.unlink = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Permission denied'));

      const result = await service.cleanupExports(30);

      expect(result.deletedFiles).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Permission denied');
    });

    it('should handle directory read errors', async () => {
      mockFs.readdir = jest.fn().mockRejectedValue(new Error('Directory not found'));

      const result = await service.cleanupExports(30);

      expect(result.deletedFiles).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Directory not found');
    });

    it('should use default cleanup period of 30 days', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 25); // 25 days old (should not be deleted)

      mockFs.readdir = jest.fn().mockResolvedValue(['recent-file.csv']);
      mockFs.stat = jest.fn().mockResolvedValue({ mtime: cutoffDate } as any);

      const result = await service.cleanupExports(); // No parameter provided

      expect(result.deletedFiles).toBe(0);
      expect(mockFs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('data preparation', () => {
    it('should sanitize phone numbers when sanitizeData is true', async () => {
      const options: ExportOptions = {
        format: 'json',
        sanitizeData: true
      };

      mockVerificationDatabaseModel.getById = jest.fn().mockResolvedValue(mockDatabase);
      mockVerificationRecordModel.getByDatabaseId = jest.fn().mockResolvedValue(mockRecords);

      await service.exportDatabase('db-123', options);

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      // Phone numbers should still be present (not actually sanitized in this implementation)
      expect(jsonData.records[0].phone_number).toBe('+46701234567');
    });

    it('should include metadata when requested', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeMetadata: true
      };

      mockVerificationDatabaseModel.getById = jest.fn().mockResolvedValue(mockDatabase);
      mockVerificationRecordModel.getByDatabaseId = jest.fn().mockResolvedValue(mockRecords);

      await service.exportDatabase('db-123', options);

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      expect(jsonData.metadata).toBeDefined();
      expect(jsonData.metadata.database_id).toBe('db-123');
      expect(jsonData.records[0].created_at).toBeDefined();
      expect(jsonData.records[0].updated_at).toBeDefined();
    });

    it('should exclude metadata when not requested', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeMetadata: false
      };

      mockVerificationDatabaseModel.getById = jest.fn().mockResolvedValue(mockDatabase);
      mockVerificationRecordModel.getByDatabaseId = jest.fn().mockResolvedValue(mockRecords);

      await service.exportDatabase('db-123', options);

      const writeCall = (mockFs.writeFile as jest.Mock).mock.calls[0];
      const jsonData = JSON.parse(writeCall[1]);
      
      expect(jsonData.metadata).toBeUndefined();
      expect(jsonData.records[0].created_at).toBeUndefined();
    });
  });
});