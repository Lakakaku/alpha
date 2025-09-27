import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import QRCode from 'qrcode';
import { QRGeneratorService } from '../../src/services/qr/qr-generator.service';
import { QRDatabaseUtils } from '../../src/config/qr-database';

// Mock dependencies
jest.mock('qrcode');
jest.mock('../../src/config/qr-database');

const mockQRCode = QRCode as jest.Mocked<typeof QRCode>;
const mockQRDatabaseUtils = QRDatabaseUtils as jest.Mocked<typeof QRDatabaseUtils>;

describe('QRGeneratorService', () => {
  let qrGenerator: QRGeneratorService;
  const mockStoreId = 'store-123';
  const mockBusinessId = 'business-456';

  beforeEach(() => {
    qrGenerator = new QRGeneratorService();
    jest.clearAllMocks();
    
    // Mock QR code generation
    mockQRCode.toDataURL = jest.fn();
    mockQRCode.toString = jest.fn();
    
    // Mock database operations
    mockQRDatabaseUtils.getStoreQR = jest.fn();
    mockQRDatabaseUtils.updateStoreQR = jest.fn();
    mockQRDatabaseUtils.recordQRHistory = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateQRCode', () => {
    test('should generate QR code successfully with default options', async () => {
      // Arrange
      const expectedQRData = 'data:image/png;base64,mockbase64data';
      mockQRCode.toDataURL.mockResolvedValue(expectedQRData);

      // Act
      const result = await qrGenerator.generateQRCode(mockStoreId);

      // Assert
      expect(mockQRCode.toDataURL).toHaveBeenCalledWith(
        `https://vocilia.com/feedback/${mockStoreId}`,
        expect.objectContaining({
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          width: 256
        })
      );
      expect(result).toEqual({
        qrCodeData: expectedQRData,
        format: 'data_url',
        storeId: mockStoreId,
        version: expect.any(Number),
        generatedAt: expect.any(String)
      });
    });

    test('should generate QR code with custom options', async () => {
      // Arrange
      const customOptions = {
        size: 512,
        format: 'svg' as const,
        colors: { foreground: '#FF0000', background: '#00FF00' }
      };
      const expectedQRData = '<svg>mock svg content</svg>';
      mockQRCode.toString.mockResolvedValue(expectedQRData);

      // Act
      const result = await qrGenerator.generateQRCode(mockStoreId, customOptions);

      // Assert
      expect(mockQRCode.toString).toHaveBeenCalledWith(
        `https://vocilia.com/feedback/${mockStoreId}`,
        expect.objectContaining({
          type: 'svg',
          width: 512,
          color: {
            dark: '#FF0000',
            light: '#00FF00'
          }
        })
      );
      expect(result.format).toBe('svg');
    });

    test('should handle QR generation errors gracefully', async () => {
      // Arrange
      const error = new Error('QR generation failed');
      mockQRCode.toDataURL.mockRejectedValue(error);

      // Act & Assert
      await expect(qrGenerator.generateQRCode(mockStoreId)).rejects.toThrow(
        'Failed to generate QR code: QR generation failed'
      );
    });

    test('should generate QR code within performance threshold (<200ms)', async () => {
      // Arrange
      mockQRCode.toDataURL.mockResolvedValue('mock-qr-data');

      // Act
      const startTime = Date.now();
      await qrGenerator.generateQRCode(mockStoreId);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(200);
    });
  });

  describe('regenerateStoreQR', () => {
    test('should regenerate QR code and update store successfully', async () => {
      // Arrange
      const mockCurrentStore = {
        id: mockStoreId,
        name: 'Test Store',
        qr_code_data: 'old-qr-data',
        qr_code_version: 1,
        qr_last_generated: '2024-01-01T00:00:00Z',
        qr_status: 'active' as const,
        business_id: mockBusinessId
      };
      
      const mockNewQRData = 'data:image/png;base64,newqrdata';
      
      mockQRDatabaseUtils.getStoreQR.mockResolvedValue(mockCurrentStore);
      mockQRCode.toDataURL.mockResolvedValue(mockNewQRData);
      mockQRDatabaseUtils.updateStoreQR.mockResolvedValue({
        ...mockCurrentStore,
        qr_code_data: mockNewQRData,
        qr_code_version: 2,
        qr_status: 'active' as const
      });
      mockQRDatabaseUtils.recordQRHistory.mockResolvedValue({});

      // Act
      const result = await qrGenerator.regenerateStoreQR(
        mockStoreId,
        mockBusinessId,
        'Test regeneration'
      );

      // Assert
      expect(mockQRDatabaseUtils.getStoreQR).toHaveBeenCalledWith(mockStoreId, mockBusinessId);
      expect(mockQRDatabaseUtils.updateStoreQR).toHaveBeenCalledWith(
        mockStoreId,
        mockBusinessId,
        expect.objectContaining({
          qr_code_data: mockNewQRData,
          qr_code_version: 2,
          qr_status: 'active'
        })
      );
      expect(mockQRDatabaseUtils.recordQRHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: mockStoreId,
          old_qr_version: 1,
          new_qr_version: 2,
          change_type: 'regenerated',
          metadata: expect.objectContaining({
            reason: 'Test regeneration'
          })
        })
      );
      expect(result.success).toBe(true);
      expect(result.qr_code_version).toBe(2);
    });

    test('should handle transition period for QR regeneration', async () => {
      // Arrange
      const mockCurrentStore = {
        id: mockStoreId,
        name: 'Test Store',
        qr_code_data: 'old-qr-data',
        qr_code_version: 1,
        qr_last_generated: '2024-01-01T00:00:00Z',
        qr_status: 'active' as const,
        business_id: mockBusinessId
      };
      
      mockQRDatabaseUtils.getStoreQR.mockResolvedValue(mockCurrentStore);
      mockQRCode.toDataURL.mockResolvedValue('new-qr-data');
      mockQRDatabaseUtils.updateStoreQR.mockResolvedValue({
        ...mockCurrentStore,
        qr_status: 'transitioning' as const
      });
      mockQRDatabaseUtils.recordQRHistory.mockResolvedValue({});

      // Act
      const result = await qrGenerator.regenerateStoreQR(
        mockStoreId,
        mockBusinessId,
        'Test with transition',
        { transitionPeriod: 24 * 60 * 60 * 1000 } // 24 hours
      );

      // Assert
      expect(mockQRDatabaseUtils.updateStoreQR).toHaveBeenCalledWith(
        mockStoreId,
        mockBusinessId,
        expect.objectContaining({
          qr_status: 'transitioning'
        })
      );
      expect(result.transition_period_ms).toBe(24 * 60 * 60 * 1000);
    });

    test('should validate business ownership before regeneration', async () => {
      // Arrange
      mockQRDatabaseUtils.getStoreQR.mockRejectedValue(new Error('Store not found or access denied'));

      // Act & Assert
      await expect(
        qrGenerator.regenerateStoreQR(mockStoreId, 'wrong-business-id', 'Test')
      ).rejects.toThrow('Store not found or access denied');
    });
  });

  describe('bulkRegenerateQR', () => {
    test('should regenerate QR codes for multiple stores', async () => {
      // Arrange
      const storeIds = ['store-1', 'store-2', 'store-3'];
      const mockStores = storeIds.map((id, index) => ({
        id,
        name: `Store ${index + 1}`,
        qr_code_data: `old-data-${index}`,
        qr_code_version: 1,
        qr_last_generated: '2024-01-01T00:00:00Z',
        qr_status: 'active' as const,
        business_id: mockBusinessId
      }));

      mockQRDatabaseUtils.getStoreQR
        .mockResolvedValueOnce(mockStores[0])
        .mockResolvedValueOnce(mockStores[1])
        .mockResolvedValueOnce(mockStores[2]);
      
      mockQRCode.toDataURL
        .mockResolvedValueOnce('new-data-1')
        .mockResolvedValueOnce('new-data-2')
        .mockResolvedValueOnce('new-data-3');

      mockQRDatabaseUtils.updateStoreQR
        .mockResolvedValueOnce({ ...mockStores[0], qr_code_version: 2 })
        .mockResolvedValueOnce({ ...mockStores[1], qr_code_version: 2 })
        .mockResolvedValueOnce({ ...mockStores[2], qr_code_version: 2 });

      mockQRDatabaseUtils.recordQRHistory.mockResolvedValue({});

      // Act
      const result = await qrGenerator.bulkRegenerateQR(
        storeIds,
        mockBusinessId,
        'Bulk regeneration test'
      );

      // Assert
      expect(result.total_stores).toBe(3);
      expect(result.successful_regenerations).toBe(3);
      expect(result.failed_regenerations).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.results.every(r => r.success)).toBe(true);
    });

    test('should handle partial failures in bulk regeneration', async () => {
      // Arrange
      const storeIds = ['store-1', 'store-2', 'store-3'];
      
      mockQRDatabaseUtils.getStoreQR
        .mockResolvedValueOnce({
          id: 'store-1',
          name: 'Store 1',
          qr_code_data: 'old-data-1',
          qr_code_version: 1,
          qr_last_generated: '2024-01-01T00:00:00Z',
          qr_status: 'active' as const,
          business_id: mockBusinessId
        })
        .mockRejectedValueOnce(new Error('Store not found'))
        .mockResolvedValueOnce({
          id: 'store-3',
          name: 'Store 3',
          qr_code_data: 'old-data-3',
          qr_code_version: 1,
          qr_last_generated: '2024-01-01T00:00:00Z',
          qr_status: 'active' as const,
          business_id: mockBusinessId
        });

      mockQRCode.toDataURL
        .mockResolvedValueOnce('new-data-1')
        .mockResolvedValueOnce('new-data-3');

      mockQRDatabaseUtils.updateStoreQR.mockResolvedValue({});
      mockQRDatabaseUtils.recordQRHistory.mockResolvedValue({});

      // Act
      const result = await qrGenerator.bulkRegenerateQR(
        storeIds,
        mockBusinessId,
        'Bulk test with failures'
      );

      // Assert
      expect(result.total_stores).toBe(3);
      expect(result.successful_regenerations).toBe(2);
      expect(result.failed_regenerations).toBe(1);
      expect(result.results.filter(r => r.success)).toHaveLength(2);
      expect(result.results.filter(r => !r.success)).toHaveLength(1);
      expect(result.results.find(r => !r.success)?.error).toContain('Store not found');
    });

    test('should respect concurrency limits in bulk operations', async () => {
      // Arrange
      const storeIds = Array.from({ length: 10 }, (_, i) => `store-${i}`);
      let concurrentCalls = 0;
      let maxConcurrency = 0;

      mockQRDatabaseUtils.getStoreQR.mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrency = Math.max(maxConcurrency, concurrentCalls);
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 50));
        
        concurrentCalls--;
        return {
          id: 'mock-store',
          name: 'Mock Store',
          qr_code_data: 'mock-data',
          qr_code_version: 1,
          qr_last_generated: '2024-01-01T00:00:00Z',
          qr_status: 'active' as const,
          business_id: mockBusinessId
        };
      });

      mockQRCode.toDataURL.mockResolvedValue('mock-qr-data');
      mockQRDatabaseUtils.updateStoreQR.mockResolvedValue({});
      mockQRDatabaseUtils.recordQRHistory.mockResolvedValue({});

      // Act
      await qrGenerator.bulkRegenerateQR(storeIds, mockBusinessId, 'Concurrency test');

      // Assert
      expect(maxConcurrency).toBeLessThanOrEqual(5); // Default concurrency limit
    });
  });

  describe('getQRCodeInfo', () => {
    test('should retrieve QR code information for a store', async () => {
      // Arrange
      const mockStore = {
        id: mockStoreId,
        name: 'Test Store',
        qr_code_data: 'mock-qr-data',
        qr_code_version: 1,
        qr_last_generated: '2024-01-01T00:00:00Z',
        qr_status: 'active' as const,
        business_id: mockBusinessId
      };

      mockQRDatabaseUtils.getStoreQR.mockResolvedValue(mockStore);

      // Act
      const result = await qrGenerator.getQRCodeInfo(mockStoreId, mockBusinessId);

      // Assert
      expect(result).toEqual({
        store_id: mockStoreId,
        store_name: 'Test Store',
        qr_code_data: 'mock-qr-data',
        qr_code_version: 1,
        last_generated: '2024-01-01T00:00:00Z',
        status: 'active',
        qr_url: `https://vocilia.com/feedback/${mockStoreId}`
      });
    });

    test('should handle store not found', async () => {
      // Arrange
      mockQRDatabaseUtils.getStoreQR.mockRejectedValue(new Error('Store not found'));

      // Act & Assert
      await expect(
        qrGenerator.getQRCodeInfo(mockStoreId, mockBusinessId)
      ).rejects.toThrow('Store not found');
    });
  });

  describe('validateQRCode', () => {
    test('should validate a correctly formatted QR code', () => {
      // Arrange
      const validQRData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...';

      // Act
      const result = qrGenerator.validateQRCode(validQRData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('data_url');
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid QR code format', () => {
      // Arrange
      const invalidQRData = 'invalid-qr-data';

      // Act
      const result = qrGenerator.validateQRCode(invalidQRData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid QR code format');
    });

    test('should validate SVG QR code format', () => {
      // Arrange
      const svgQRData = '<svg xmlns="http://www.w3.org/2000/svg">...</svg>';

      // Act
      const result = qrGenerator.validateQRCode(svgQRData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('svg');
    });
  });

  describe('performance tests', () => {
    test('should generate QR code within 200ms threshold', async () => {
      // Arrange
      mockQRCode.toDataURL.mockImplementation(async () => {
        // Simulate realistic QR generation time
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'mock-qr-data';
      });

      // Act
      const startTime = Date.now();
      await qrGenerator.generateQRCode(mockStoreId);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(200);
    });

    test('should handle multiple concurrent QR generations efficiently', async () => {
      // Arrange
      const concurrentRequests = 10;
      mockQRCode.toDataURL.mockResolvedValue('mock-qr-data');

      // Act
      const startTime = Date.now();
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        qrGenerator.generateQRCode(`store-${i}`)
      );
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(1000); // Should complete all 10 within 1 second
      expect(mockQRCode.toDataURL).toHaveBeenCalledTimes(concurrentRequests);
    });
  });

  describe('error handling', () => {
    test('should handle QR library errors gracefully', async () => {
      // Arrange
      mockQRCode.toDataURL.mockRejectedValue(new Error('QR library error'));

      // Act & Assert
      await expect(qrGenerator.generateQRCode(mockStoreId)).rejects.toThrow(
        'Failed to generate QR code: QR library error'
      );
    });

    test('should handle database connection errors', async () => {
      // Arrange
      mockQRDatabaseUtils.getStoreQR.mockRejectedValue(new Error('Database connection error'));

      // Act & Assert
      await expect(
        qrGenerator.regenerateStoreQR(mockStoreId, mockBusinessId, 'Test')
      ).rejects.toThrow('Database connection error');
    });

    test('should provide detailed error information for debugging', async () => {
      // Arrange
      const complexError = new Error('Complex error with details');
      complexError.stack = 'Mock stack trace';
      mockQRCode.toDataURL.mockRejectedValue(complexError);

      // Act
      try {
        await qrGenerator.generateQRCode(mockStoreId);
        fail('Expected error to be thrown');
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to generate QR code');
        expect((error as Error).message).toContain('Complex error with details');
      }
    });
  });
});