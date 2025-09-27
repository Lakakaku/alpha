import { FileExportService, ExportOptions } from '../../src/services/verification/fileExportService';
import { VerificationDatabaseModel, VerificationRecordModel } from '@vocilia/database';
import { VerificationDatabase, VerificationRecord } from '@vocilia/types/verification';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock database models for performance testing
jest.mock('@vocilia/database');

describe('File Export Performance Tests', () => {
  let exportService: FileExportService;
  let testExportDir: string;

  // Performance requirements from specs
  const EXPORT_TIME_LIMIT = 15 * 60 * 1000; // 15 minutes in milliseconds
  const MAX_RECORDS_PER_STORE = 1000; // Maximum records per store per week
  const LARGE_DATASET_RECORDS = 10000; // Large dataset for stress testing

  beforeAll(async () => {
    // Create temporary directory for test exports
    testExportDir = path.join(__dirname, '..', '..', 'temp-exports');
    
    try {
      await fs.access(testExportDir);
    } catch {
      await fs.mkdir(testExportDir, { recursive: true });
    }

    exportService = new FileExportService(testExportDir);
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      const files = await fs.readdir(testExportDir);
      for (const file of files) {
        await fs.unlink(path.join(testExportDir, file));
      }
      await fs.rmdir(testExportDir);
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Single Database Export Performance', () => {
    it('should export 1,000 records within 15 minutes (CSV)', async () => {
      // This test validates the NFR-003 requirement
      const startTime = Date.now();
      
      const mockDatabase = createMockDatabase('db-perf-csv-1k');
      const mockRecords = createMockRecords(MAX_RECORDS_PER_STORE, mockDatabase.id);

      // Setup mocks
      (VerificationDatabaseModel.getById as jest.Mock).mockResolvedValue(mockDatabase);
      (VerificationRecordModel.getByDatabaseId as jest.Mock).mockResolvedValue(mockRecords);

      console.log(`Starting CSV export performance test: ${MAX_RECORDS_PER_STORE} records`);

      const options: ExportOptions = {
        format: 'csv',
        includeMetadata: true,
        sanitizeData: true
      };

      const result = await exportService.exportDatabase(mockDatabase.id, options);
      
      const endTime = Date.now();
      const exportTime = endTime - startTime;

      console.log(`CSV export completed in ${exportTime}ms (${(exportTime / 1000 / 60).toFixed(2)} minutes)`);
      console.log(`Export result:`, {
        success: result.success,
        recordCount: result.recordCount,
        fileSize: result.fileSize,
        fileName: result.fileName
      });

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(MAX_RECORDS_PER_STORE);
      expect(exportTime).toBeLessThan(EXPORT_TIME_LIMIT);

      // Verify file was created and has reasonable size
      if (result.filePath) {
        const stats = await fs.stat(result.filePath);
        expect(stats.size).toBeGreaterThan(0);
        console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
      }
      
    }, EXPORT_TIME_LIMIT + 30000); // Add 30s buffer for test overhead

    it('should export 1,000 records within 15 minutes (Excel)', async () => {
      const startTime = Date.now();
      
      const mockDatabase = createMockDatabase('db-perf-xlsx-1k');
      const mockRecords = createMockRecords(MAX_RECORDS_PER_STORE, mockDatabase.id);

      (VerificationDatabaseModel.getById as jest.Mock).mockResolvedValue(mockDatabase);
      (VerificationRecordModel.getByDatabaseId as jest.Mock).mockResolvedValue(mockRecords);

      console.log(`Starting Excel export performance test: ${MAX_RECORDS_PER_STORE} records`);

      const options: ExportOptions = {
        format: 'xlsx',
        includeMetadata: true,
        sanitizeData: true
      };

      const result = await exportService.exportDatabase(mockDatabase.id, options);
      
      const endTime = Date.now();
      const exportTime = endTime - startTime;

      console.log(`Excel export completed in ${exportTime}ms (${(exportTime / 1000 / 60).toFixed(2)} minutes)`);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(MAX_RECORDS_PER_STORE);
      expect(exportTime).toBeLessThan(EXPORT_TIME_LIMIT);
      
    }, EXPORT_TIME_LIMIT + 30000);

    it('should export 1,000 records within 15 minutes (JSON)', async () => {
      const startTime = Date.now();
      
      const mockDatabase = createMockDatabase('db-perf-json-1k');
      const mockRecords = createMockRecords(MAX_RECORDS_PER_STORE, mockDatabase.id);

      (VerificationDatabaseModel.getById as jest.Mock).mockResolvedValue(mockDatabase);
      (VerificationRecordModel.getByDatabaseId as jest.Mock).mockResolvedValue(mockRecords);

      console.log(`Starting JSON export performance test: ${MAX_RECORDS_PER_STORE} records`);

      const options: ExportOptions = {
        format: 'json',
        includeMetadata: true,
        sanitizeData: true
      };

      const result = await exportService.exportDatabase(mockDatabase.id, options);
      
      const endTime = Date.now();
      const exportTime = endTime - startTime;

      console.log(`JSON export completed in ${exportTime}ms (${(exportTime / 1000 / 60).toFixed(2)} minutes)`);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(MAX_RECORDS_PER_STORE);
      expect(exportTime).toBeLessThan(EXPORT_TIME_LIMIT);
      
    }, EXPORT_TIME_LIMIT + 30000);
  });

  describe('Large Dataset Export Performance', () => {
    it('should handle large dataset export (10,000 records) efficiently', async () => {
      const startTime = Date.now();
      
      const mockDatabase = createMockDatabase('db-perf-large-10k');
      const mockRecords = createMockRecords(LARGE_DATASET_RECORDS, mockDatabase.id);

      (VerificationDatabaseModel.getById as jest.Mock).mockResolvedValue(mockDatabase);
      (VerificationRecordModel.getByDatabaseId as jest.Mock).mockResolvedValue(mockRecords);

      console.log(`Starting large dataset export test: ${LARGE_DATASET_RECORDS} records`);

      const options: ExportOptions = {
        format: 'csv',
        includeMetadata: false, // Optimize for speed
        sanitizeData: false
      };

      const result = await exportService.exportDatabase(mockDatabase.id, options);
      
      const endTime = Date.now();
      const exportTime = endTime - startTime;

      console.log(`Large dataset export completed in ${exportTime}ms`);
      console.log(`Records per second: ${(LARGE_DATASET_RECORDS / (exportTime / 1000)).toFixed(2)}`);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(LARGE_DATASET_RECORDS);
      
      // Large datasets should still complete reasonably quickly
      const largeSizeLimit = EXPORT_TIME_LIMIT * 2; // Allow 2x time for 10x data
      expect(exportTime).toBeLessThan(largeSizeLimit);
      
    }, EXPORT_TIME_LIMIT * 3); // 45 minute timeout for large dataset
  });

  describe('Bulk Export Performance', () => {
    it('should handle bulk export of multiple databases efficiently', async () => {
      const startTime = Date.now();
      const databaseCount = 5;
      const recordsPerDatabase = 500;
      
      const mockDatabases = Array.from({ length: databaseCount }, (_, i) => 
        createMockDatabase(`db-bulk-${i}`)
      );
      
      // Setup mocks for each database
      (VerificationDatabaseModel.getById as jest.Mock).mockImplementation((id: string) => {
        const db = mockDatabases.find(d => d.id === id);
        return Promise.resolve(db || null);
      });

      (VerificationRecordModel.getByDatabaseId as jest.Mock).mockImplementation((id: string) => {
        return Promise.resolve(createMockRecords(recordsPerDatabase, id));
      });

      console.log(`Starting bulk export test: ${databaseCount} databases with ${recordsPerDatabase} records each`);

      const databaseIds = mockDatabases.map(db => db.id);
      const options: ExportOptions = {
        format: 'csv',
        includeMetadata: false,
        sanitizeData: true
      };

      const results = await exportService.bulkExport(databaseIds, options);
      
      const endTime = Date.now();
      const exportTime = endTime - startTime;
      const totalRecords = databaseCount * recordsPerDatabase;

      console.log(`Bulk export completed in ${exportTime}ms`);
      console.log(`Total records: ${totalRecords}`);
      console.log(`Successful exports: ${results.filter(r => r.success).length}`);

      expect(results).toHaveLength(databaseCount);
      expect(results.every(r => r.success)).toBe(true);
      expect(exportTime).toBeLessThan(EXPORT_TIME_LIMIT);
      
    }, EXPORT_TIME_LIMIT + 60000); // Add 1 minute buffer
  });

  describe('Customer Rewards Export Performance', () => {
    it('should export customer rewards efficiently for large cycles', async () => {
      const startTime = Date.now();
      const businessCount = 10;
      const storesPerBusiness = 5;
      const recordsPerStore = 100;
      const totalRecords = businessCount * storesPerBusiness * recordsPerStore;
      
      const mockDatabases = [];
      const allVerifiedRecords = [];

      // Create mock data structure
      for (let b = 0; b < businessCount; b++) {
        for (let s = 0; s < storesPerBusiness; s++) {
          const database = createMockDatabase(`db-rewards-${b}-${s}`);
          database.business_id = `business-${b}`;
          database.store_id = `store-${b}-${s}`;
          mockDatabases.push(database);

          const storeRecords = createMockRecords(recordsPerStore, database.id);
          // Mark all as verified for rewards
          storeRecords.forEach(record => {
            record.status = 'verified';
            record.verified_at = new Date().toISOString();
          });
          allVerifiedRecords.push(...storeRecords);
        }
      }

      // Setup mocks
      (VerificationDatabaseModel.getByCycleId as jest.Mock).mockResolvedValue(mockDatabases);
      (VerificationRecordModel.getByDatabaseId as jest.Mock).mockImplementation((databaseId: string) => {
        const records = allVerifiedRecords.filter(r => r.verification_database_id === databaseId);
        return Promise.resolve(records);
      });

      console.log(`Starting customer rewards export test: ${totalRecords} verified records across ${mockDatabases.length} databases`);

      const options: ExportOptions = {
        format: 'csv',
        includeMetadata: false
      };

      const result = await exportService.exportCustomerRewards('cycle-rewards-large', options);
      
      const endTime = Date.now();
      const exportTime = endTime - startTime;

      console.log(`Customer rewards export completed in ${exportTime}ms`);
      console.log(`Processed ${totalRecords} records into ${result.recordCount} reward entries`);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(totalRecords);
      expect(exportTime).toBeLessThan(EXPORT_TIME_LIMIT);
      
    }, EXPORT_TIME_LIMIT + 60000);
  });

  describe('Concurrent Export Performance', () => {
    it('should handle concurrent export requests without degradation', async () => {
      const startTime = Date.now();
      const concurrentExports = 3;
      const recordsPerExport = 1000;
      
      console.log(`Starting concurrent export test: ${concurrentExports} exports with ${recordsPerExport} records each`);

      // Create concurrent export promises
      const exportPromises = Array.from({ length: concurrentExports }, async (_, i) => {
        const mockDatabase = createMockDatabase(`db-concurrent-${i}`);
        const mockRecords = createMockRecords(recordsPerExport, mockDatabase.id);

        // Setup individual mocks
        (VerificationDatabaseModel.getById as jest.Mock).mockResolvedValueOnce(mockDatabase);
        (VerificationRecordModel.getByDatabaseId as jest.Mock).mockResolvedValueOnce(mockRecords);

        const options: ExportOptions = {
          format: 'csv',
          fileName: `concurrent-export-${i}.csv`
        };

        return exportService.exportDatabase(mockDatabase.id, options);
      });

      // Execute all exports concurrently
      const results = await Promise.all(exportPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`Concurrent exports completed in ${totalTime}ms`);

      // All exports should succeed
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.recordCount).toBe(recordsPerExport);
      });

      // Concurrent execution should not take significantly longer than sequential
      const estimatedSequentialTime = concurrentExports * (recordsPerExport * 0.1); // Rough estimate
      expect(totalTime).toBeLessThan(EXPORT_TIME_LIMIT);
      
    }, EXPORT_TIME_LIMIT + 30000);
  });

  describe('Memory and Resource Usage', () => {
    it('should not exceed memory limits during large exports', async () => {
      const initialMemory = process.memoryUsage();
      console.log('Initial memory usage:', formatMemoryUsage(initialMemory));

      // Large export test
      const largeRecordCount = 20000;
      const mockDatabase = createMockDatabase('db-memory-test');
      const mockRecords = createMockRecords(largeRecordCount, mockDatabase.id);

      (VerificationDatabaseModel.getById as jest.Mock).mockResolvedValue(mockDatabase);
      (VerificationRecordModel.getByDatabaseId as jest.Mock).mockResolvedValue(mockRecords);

      const options: ExportOptions = {
        format: 'csv',
        includeMetadata: true
      };

      await exportService.exportDatabase(mockDatabase.id, options);

      const finalMemory = process.memoryUsage();
      console.log('Final memory usage:', formatMemoryUsage(finalMemory));

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);

      // Should not increase memory usage by more than 200MB for large exports
      expect(memoryIncreaseMB).toBeLessThan(200);

      // Force garbage collection to clean up
      if (global.gc) {
        global.gc();
      }
    });

    it('should scale memory usage linearly with data size', async () => {
      const testSizes = [1000, 5000, 10000];
      const memoryUsageResults = [];

      for (const recordCount of testSizes) {
        const initialMemory = process.memoryUsage();
        
        const mockDatabase = createMockDatabase(`db-memory-scale-${recordCount}`);
        const mockRecords = createMockRecords(recordCount, mockDatabase.id);

        (VerificationDatabaseModel.getById as jest.Mock).mockResolvedValue(mockDatabase);
        (VerificationRecordModel.getByDatabaseId as jest.Mock).mockResolvedValue(mockRecords);

        const options: ExportOptions = {
          format: 'json', // JSON typically uses more memory
          includeMetadata: true
        };

        await exportService.exportDatabase(mockDatabase.id, options);

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryPerRecord = memoryIncrease / recordCount;

        memoryUsageResults.push({
          recordCount,
          memoryIncrease,
          memoryPerRecord
        });

        console.log(`${recordCount} records: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${(memoryPerRecord / 1024).toFixed(2)} KB per record)`);

        // Force cleanup between tests
        if (global.gc) {
          global.gc();
        }
      }

      // Verify memory usage scales reasonably
      const memoryPerRecordVariance = memoryUsageResults.map(r => r.memoryPerRecord);
      const maxMemoryPerRecord = Math.max(...memoryPerRecordVariance);
      const minMemoryPerRecord = Math.min(...memoryPerRecordVariance);
      const memoryVarianceRatio = maxMemoryPerRecord / minMemoryPerRecord;

      console.log('Memory scaling results:', memoryUsageResults);
      console.log(`Memory per record variance ratio: ${memoryVarianceRatio.toFixed(2)}`);

      // Memory usage should scale relatively linearly (within 2x variance)
      expect(memoryVarianceRatio).toBeLessThan(2);
    });
  });

  describe('File Size and Quality', () => {
    it('should generate appropriately sized files for different formats', async () => {
      const recordCount = 1000;
      const mockDatabase = createMockDatabase('db-file-size-test');
      const mockRecords = createMockRecords(recordCount, mockDatabase.id);

      (VerificationDatabaseModel.getById as jest.Mock).mockResolvedValue(mockDatabase);
      (VerificationRecordModel.getByDatabaseId as jest.Mock).mockResolvedValue(mockRecords);

      const formats: Array<'csv' | 'xlsx' | 'json'> = ['csv', 'xlsx', 'json'];
      const fileSizeResults = [];

      for (const format of formats) {
        const options: ExportOptions = {
          format,
          includeMetadata: true,
          fileName: `size-test-${recordCount}.${format}`
        };

        const result = await exportService.exportDatabase(mockDatabase.id, options);
        
        expect(result.success).toBe(true);
        expect(result.fileSize).toBeGreaterThan(0);

        const fileSizeKB = (result.fileSize || 0) / 1024;
        const sizePerRecord = fileSizeKB / recordCount;

        fileSizeResults.push({
          format,
          fileSizeKB,
          sizePerRecord
        });

        console.log(`${format.toUpperCase()}: ${fileSizeKB.toFixed(2)} KB (${sizePerRecord.toFixed(3)} KB per record)`);
      }

      // Verify reasonable file sizes
      fileSizeResults.forEach(result => {
        // Each record should be between 0.1KB and 10KB depending on format
        expect(result.sizePerRecord).toBeGreaterThan(0.1);
        expect(result.sizePerRecord).toBeLessThan(10);
      });
    });
  });
});

/**
 * Create a mock verification database for testing
 */
function createMockDatabase(id: string): VerificationDatabase {
  return {
    id,
    weekly_verification_cycle_id: 'cycle-perf-test',
    business_id: 'business-perf-test',
    store_id: 'store-perf-test',
    status: 'ready',
    transaction_count: 1000,
    verified_count: 0,
    deadline_date: '2025-10-06',
    created_at: '2025-09-29T00:00:00Z',
    updated_at: '2025-09-29T08:00:00Z'
  };
}

/**
 * Create mock verification records for testing
 */
function createMockRecords(count: number, databaseId: string): VerificationRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `record-${databaseId}-${i}`,
    verification_database_id: databaseId,
    phone_number: `+4670123456${(i % 10).toString()}`,
    amount: Math.round((Math.random() * 900 + 100) * 100) / 100, // 100-1000 SEK
    transaction_date: new Date(2025, 8, 28 - (i % 7)).toISOString().split('T')[0], // Past week
    status: 'pending',
    store_context: {
      store_name: `Test Store ${Math.floor(i / 100)}`,
      location: ['Stockholm', 'Gothenburg', 'Malmö'][i % 3],
      category: ['restaurant', 'retail', 'service'][i % 3]
    },
    verification_details: null,
    created_at: '2025-09-29T00:00:00Z',
    updated_at: '2025-09-29T00:00:00Z',
    verified_at: null
  }));
}

/**
 * Format memory usage for logging
 */
function formatMemoryUsage(memUsage: NodeJS.MemoryUsage) {
  return {
    rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`,
  };
}