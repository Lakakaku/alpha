import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import cron from 'node-cron';
import { QRAnalyticsAggregatorJob } from '../../src/jobs/qr-analytics-aggregator.job';
import { qrDatabase, QR_DATABASE_CONFIG } from '../../src/config/qr-database';

// Mock dependencies
jest.mock('node-cron');
jest.mock('../../src/config/qr-database');

const mockCron = cron as jest.Mocked<typeof cron>;
const mockQrDatabase = qrDatabase as jest.Mocked<typeof qrDatabase>;

describe('QRAnalyticsAggregatorJob', () => {
  let aggregatorJob: QRAnalyticsAggregatorJob;
  let mockScheduledTask: jest.Mocked<cron.ScheduledTask>;

  beforeEach(() => {
    aggregatorJob = new QRAnalyticsAggregatorJob();
    jest.clearAllMocks();

    // Mock scheduled task
    mockScheduledTask = {
      start: jest.fn(),
      stop: jest.fn(),
      getStatus: jest.fn(),
      now: jest.fn()
    } as any;

    mockCron.schedule.mockReturnValue(mockScheduledTask);

    // Mock database methods
    mockQrDatabase.from = jest.fn().mockReturnThis();
    mockQrDatabase.select = jest.fn().mockReturnThis();
    mockQrDatabase.eq = jest.fn().mockReturnThis();
    mockQrDatabase.gte = jest.fn().mockReturnThis();
    mockQrDatabase.lt = jest.fn().mockReturnThis();
    mockQrDatabase.lte = jest.fn().mockReturnThis();
    mockQrDatabase.limit = jest.fn().mockReturnThis();
    mockQrDatabase.insert = jest.fn().mockReturnThis();
    mockQrDatabase.upsert = jest.fn().mockReturnThis();
    mockQrDatabase.delete = jest.fn().mockReturnThis();
    mockQrDatabase.order = jest.fn().mockReturnThis();
    mockQrDatabase.single = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('start', () => {
    test('should start cron job with correct schedule', () => {
      // Act
      aggregatorJob.start();

      // Assert
      expect(mockCron.schedule).toHaveBeenCalledWith(
        '*/5 * * * *', // Every 5 minutes
        expect.any(Function),
        { scheduled: false }
      );
      expect(mockScheduledTask.start).toHaveBeenCalled();
    });

    test('should schedule initial run after 5 seconds', () => {
      // Arrange
      jest.useFakeTimers();
      const processAnalyticsSpy = jest.spyOn(aggregatorJob as any, 'processAnalytics').mockResolvedValue(undefined);

      // Act
      aggregatorJob.start();
      jest.advanceTimersByTime(5000);

      // Assert
      expect(processAnalyticsSpy).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('stop', () => {
    test('should stop cron job', () => {
      // Arrange
      aggregatorJob.start();

      // Act
      aggregatorJob.stop();

      // Assert
      expect(mockScheduledTask.stop).toHaveBeenCalled();
    });
  });

  describe('process5MinuteAnalytics', () => {
    test('should process 5-minute analytics bucket successfully', async () => {
      // Arrange
      const mockScanEvents = [
        {
          store_id: 'store-1',
          scan_result: 'success',
          ip_address: '192.168.1.1'
        },
        {
          store_id: 'store-1',
          scan_result: 'success',
          ip_address: '192.168.1.2'
        },
        {
          store_id: 'store-1',
          scan_result: 'error',
          ip_address: '192.168.1.1'
        },
        {
          store_id: 'store-2',
          scan_result: 'success',
          ip_address: '192.168.1.3'
        }
      ];

      // Mock database responses
      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null }); // No existing data
      mockQrDatabase.select.mockResolvedValueOnce({ data: mockScanEvents, error: null });
      mockQrDatabase.insert.mockResolvedValueOnce({ data: [], error: null });

      // Act
      await (aggregatorJob as any).process5MinuteAnalytics();

      // Assert
      expect(mockQrDatabase.insert).toHaveBeenCalledWith([
        {
          store_id: 'store-1',
          time_bucket: expect.any(String),
          total_scans: 3,
          successful_scans: 2,
          failed_scans: 1,
          unique_visitors: 2,
          success_rate: 2/3
        },
        {
          store_id: 'store-2',
          time_bucket: expect.any(String),
          total_scans: 1,
          successful_scans: 1,
          failed_scans: 0,
          unique_visitors: 1,
          success_rate: 1
        }
      ]);
    });

    test('should skip processing if bucket already exists', async () => {
      // Arrange
      mockQrDatabase.single.mockResolvedValueOnce({ 
        data: [{ time_bucket: '2024-01-01T00:00:00Z' }], 
        error: null 
      });

      // Act
      await (aggregatorJob as any).process5MinuteAnalytics();

      // Assert
      expect(mockQrDatabase.insert).not.toHaveBeenCalled();
    });

    test('should handle empty scan events gracefully', async () => {
      // Arrange
      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockQrDatabase.select.mockResolvedValueOnce({ data: [], error: null });

      // Act
      await (aggregatorJob as any).process5MinuteAnalytics();

      // Assert
      expect(mockQrDatabase.insert).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      // Arrange
      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockQrDatabase.select.mockRejectedValueOnce(new Error('Database error'));

      // Act & Assert
      await expect((aggregatorJob as any).process5MinuteAnalytics()).rejects.toThrow('Database error');
    });
  });

  describe('processHourlyAnalytics', () => {
    test('should aggregate from 5-minute data into hourly buckets', async () => {
      // Arrange
      const mock5MinData = [
        {
          store_id: 'store-1',
          total_scans: 10,
          successful_scans: 8,
          failed_scans: 2,
          unique_visitors: 5
        },
        {
          store_id: 'store-1',
          total_scans: 15,
          successful_scans: 12,
          failed_scans: 3,
          unique_visitors: 7
        },
        {
          store_id: 'store-2',
          total_scans: 5,
          successful_scans: 4,
          failed_scans: 1,
          unique_visitors: 3
        }
      ];

      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null }); // No existing data
      mockQrDatabase.select.mockResolvedValueOnce({ data: mock5MinData, error: null });
      mockQrDatabase.insert.mockResolvedValueOnce({ data: [], error: null });

      // Act
      await (aggregatorJob as any).processHourlyAnalytics();

      // Assert
      expect(mockQrDatabase.insert).toHaveBeenCalledWith([
        {
          store_id: 'store-1',
          time_bucket: expect.any(String),
          total_scans: 25, // 10 + 15
          successful_scans: 20, // 8 + 12
          failed_scans: 5, // 2 + 3
          unique_visitors: 7, // Max of 5 and 7
          success_rate: 20/25
        },
        {
          store_id: 'store-2',
          time_bucket: expect.any(String),
          total_scans: 5,
          successful_scans: 4,
          failed_scans: 1,
          unique_visitors: 3,
          success_rate: 4/5
        }
      ]);
    });

    test('should only run in first 5 minutes of each hour', async () => {
      // Arrange
      const originalDate = Date;
      const mockDate = jest.fn(() => ({
        getMinutes: () => 10, // 10 minutes past the hour
        getHours: () => 1,
        setMinutes: jest.fn(),
        setHours: jest.fn(),
        toISOString: () => '2024-01-01T01:10:00Z'
      }));
      global.Date = mockDate as any;

      // Act
      await (aggregatorJob as any).processHourlyAnalytics();

      // Assert
      expect(mockQrDatabase.insert).not.toHaveBeenCalled();

      // Cleanup
      global.Date = originalDate;
    });
  });

  describe('processDailyAnalytics', () => {
    test('should aggregate from hourly data into daily buckets', async () => {
      // Arrange
      const mockHourlyData = [
        {
          store_id: 'store-1',
          total_scans: 100,
          successful_scans: 80,
          failed_scans: 20,
          unique_visitors: 50
        },
        {
          store_id: 'store-1',
          total_scans: 150,
          successful_scans: 120,
          failed_scans: 30,
          unique_visitors: 60
        }
      ];

      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockQrDatabase.select.mockResolvedValueOnce({ data: mockHourlyData, error: null });
      mockQrDatabase.insert.mockResolvedValueOnce({ data: [], error: null });

      // Act
      await (aggregatorJob as any).processDailyAnalytics();

      // Assert
      expect(mockQrDatabase.insert).toHaveBeenCalledWith([
        {
          store_id: 'store-1',
          time_bucket: expect.any(String),
          total_scans: 250, // 100 + 150
          successful_scans: 200, // 80 + 120
          failed_scans: 50, // 20 + 30
          unique_visitors: 60, // Max of 50 and 60
          success_rate: 200/250
        }
      ]);
    });

    test('should only run at 1 AM', async () => {
      // Arrange
      const originalDate = Date;
      const mockDate = jest.fn(() => ({
        getMinutes: () => 2,
        getHours: () => 14, // 2 PM, not 1 AM
        setHours: jest.fn(),
        setDate: jest.fn(),
        toISOString: () => '2024-01-01T14:02:00Z'
      }));
      global.Date = mockDate as any;

      // Act
      await (aggregatorJob as any).processDailyAnalytics();

      // Assert
      expect(mockQrDatabase.insert).not.toHaveBeenCalled();

      // Cleanup
      global.Date = originalDate;
    });
  });

  describe('cleanupOldData', () => {
    test('should cleanup old data according to retention policies', async () => {
      // Arrange
      mockQrDatabase.delete.mockResolvedValue({ data: [], error: null });

      // Act
      await (aggregatorJob as any).cleanupOldData();

      // Assert
      expect(mockQrDatabase.delete).toHaveBeenCalledTimes(4); // Scan events + 3 analytics tables
    });

    test('should handle cleanup errors gracefully', async () => {
      // Arrange
      mockQrDatabase.delete
        .mockResolvedValueOnce({ data: [], error: null }) // Scan events cleanup succeeds
        .mockResolvedValueOnce({ data: [], error: { message: '5-min cleanup error' } }) // 5-min cleanup fails
        .mockResolvedValueOnce({ data: [], error: null }) // Hourly cleanup succeeds
        .mockResolvedValueOnce({ data: [], error: null }); // Daily cleanup succeeds

      // Act
      await (aggregatorJob as any).cleanupOldData();

      // Assert - Should continue despite errors
      expect(mockQrDatabase.delete).toHaveBeenCalledTimes(4);
    });
  });

  describe('backfillAnalytics', () => {
    test('should backfill analytics for specified date range', async () => {
      // Arrange
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T01:00:00Z'); // 1 hour range = 12 five-minute buckets

      const mockScanEvents = [
        {
          store_id: 'store-1',
          scan_result: 'success',
          ip_address: '192.168.1.1'
        }
      ];

      mockQrDatabase.select.mockResolvedValue({ data: mockScanEvents, error: null });
      mockQrDatabase.upsert.mockResolvedValue({ data: [], error: null });

      // Act
      await aggregatorJob.backfillAnalytics(startDate, endDate);

      // Assert
      expect(mockQrDatabase.upsert).toHaveBeenCalledTimes(12); // 12 five-minute buckets
    });

    test('should handle backfill errors and continue processing', async () => {
      // Arrange
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T00:30:00Z'); // 30 minutes = 6 buckets

      mockQrDatabase.select
        .mockResolvedValueOnce({ data: [{ store_id: 'store-1', scan_result: 'success' }], error: null })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValue({ data: [{ store_id: 'store-1', scan_result: 'success' }], error: null });

      mockQrDatabase.upsert.mockResolvedValue({ data: [], error: null });

      // Act
      await aggregatorJob.backfillAnalytics(startDate, endDate);

      // Assert
      expect(mockQrDatabase.upsert).toHaveBeenCalledTimes(5); // 6 buckets, 1 failed
    });
  });

  describe('performance tests', () => {
    test('should process large datasets efficiently', async () => {
      // Arrange
      const largeScanEvents = Array.from({ length: 10000 }, (_, i) => ({
        store_id: `store-${i % 100}`, // 100 different stores
        scan_result: i % 3 === 0 ? 'error' : 'success',
        ip_address: `192.168.${Math.floor(i / 256)}.${i % 256}`
      }));

      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockQrDatabase.select.mockResolvedValueOnce({ data: largeScanEvents, error: null });
      mockQrDatabase.insert.mockResolvedValueOnce({ data: [], error: null });

      // Act
      const startTime = Date.now();
      await (aggregatorJob as any).process5MinuteAnalytics();
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockQrDatabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            store_id: expect.any(String),
            total_scans: expect.any(Number),
            unique_visitors: expect.any(Number)
          })
        ])
      );
    });

    test('should handle memory efficiently during aggregation', async () => {
      // Arrange
      const memoryBefore = process.memoryUsage().heapUsed;
      
      const largeScanEvents = Array.from({ length: 50000 }, (_, i) => ({
        store_id: `store-${i % 1000}`,
        scan_result: 'success',
        ip_address: `192.168.${i % 256}.${(i / 256) % 256}`
      }));

      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockQrDatabase.select.mockResolvedValueOnce({ data: largeScanEvents, error: null });
      mockQrDatabase.insert.mockResolvedValueOnce({ data: [], error: null });

      // Act
      await (aggregatorJob as any).process5MinuteAnalytics();
      
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024; // MB

      // Assert
      expect(memoryIncrease).toBeLessThan(100); // Should not increase by more than 100MB
    });
  });

  describe('error handling and resilience', () => {
    test('should handle database connection errors gracefully', async () => {
      // Arrange
      mockQrDatabase.single.mockRejectedValue(new Error('Connection timeout'));

      // Act & Assert
      await expect((aggregatorJob as any).process5MinuteAnalytics()).rejects.toThrow('Connection timeout');
    });

    test('should handle malformed scan event data', async () => {
      // Arrange
      const malformedScanEvents = [
        { store_id: null, scan_result: 'success' }, // Missing store_id
        { store_id: 'store-1', scan_result: null }, // Missing scan_result
        { store_id: 'store-1', scan_result: 'invalid' }, // Invalid scan_result
        { store_id: 'store-1', scan_result: 'success', ip_address: null } // Valid event
      ];

      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockQrDatabase.select.mockResolvedValueOnce({ data: malformedScanEvents, error: null });
      mockQrDatabase.insert.mockResolvedValueOnce({ data: [], error: null });

      // Act
      await (aggregatorJob as any).process5MinuteAnalytics();

      // Assert
      expect(mockQrDatabase.insert).toHaveBeenCalledWith([
        {
          store_id: 'store-1',
          time_bucket: expect.any(String),
          total_scans: 1, // Only one valid event processed
          successful_scans: 1,
          failed_scans: 0,
          unique_visitors: 0, // No IP address
          success_rate: 1
        }
      ]);
    });

    test('should prevent concurrent processing', async () => {
      // Arrange
      let callCount = 0;
      const slowProcessing = jest.fn().mockImplementation(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      aggregatorJob['processAnalytics'] = slowProcessing;

      // Act
      const promise1 = aggregatorJob.triggerManualProcessing();
      const promise2 = aggregatorJob.triggerManualProcessing(); // Should be skipped

      await Promise.all([promise1, promise2]);

      // Assert
      expect(callCount).toBe(1); // Only one should execute
    });
  });

  describe('getStatus', () => {
    test('should return correct job status', () => {
      // Arrange
      aggregatorJob.start();

      // Act
      const status = aggregatorJob.getStatus();

      // Assert
      expect(status).toEqual({
        isRunning: false, // Not running at the moment
        isScheduled: true, // Cron job is scheduled
        lastProcessedTimestamp: null
      });
    });
  });

  describe('configuration validation', () => {
    test('should use correct aggregation intervals', () => {
      // Assert
      expect(QR_DATABASE_CONFIG.ANALYTICS_AGGREGATION_INTERVAL).toBe(5 * 60 * 1000); // 5 minutes
      expect(QR_DATABASE_CONFIG.SCAN_EVENT_RETENTION_DAYS).toBe(90);
      expect(QR_DATABASE_CONFIG.ANALYTICS_RETENTION_DAYS).toBe(365);
    });

    test('should handle configuration edge cases', async () => {
      // Arrange
      const originalConfig = { ...QR_DATABASE_CONFIG };
      (QR_DATABASE_CONFIG as any).BATCH_SIZE = 0; // Invalid batch size

      // Act & Assert
      // Should handle gracefully without crashing
      await expect((aggregatorJob as any).process5MinuteAnalytics()).not.toThrow();

      // Cleanup
      Object.assign(QR_DATABASE_CONFIG, originalConfig);
    });
  });

  describe('data integrity', () => {
    test('should maintain data consistency across aggregation levels', async () => {
      // Arrange
      const scanEvents = [
        { store_id: 'store-1', scan_result: 'success', ip_address: '1.1.1.1' },
        { store_id: 'store-1', scan_result: 'success', ip_address: '1.1.1.2' },
        { store_id: 'store-1', scan_result: 'error', ip_address: '1.1.1.1' }
      ];

      // Test 5-minute aggregation
      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockQrDatabase.select.mockResolvedValueOnce({ data: scanEvents, error: null });
      mockQrDatabase.insert.mockResolvedValueOnce({ data: [], error: null });

      // Act
      await (aggregatorJob as any).process5MinuteAnalytics();

      // Assert
      const insertCall = mockQrDatabase.insert.mock.calls[0][0][0];
      expect(insertCall.total_scans).toBe(insertCall.successful_scans + insertCall.failed_scans);
      expect(insertCall.success_rate).toBe(insertCall.successful_scans / insertCall.total_scans);
      expect(insertCall.unique_visitors).toBe(2); // Two unique IPs
    });

    test('should handle zero division in success rate calculation', async () => {
      // Arrange
      const emptyScans: any[] = [];

      mockQrDatabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockQrDatabase.select.mockResolvedValueOnce({ data: emptyScans, error: null });

      // Act
      await (aggregatorJob as any).process5MinuteAnalytics();

      // Assert - Should not attempt to insert data for empty scans
      expect(mockQrDatabase.insert).not.toHaveBeenCalled();
    });
  });
});