import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import QRCode from 'qrcode';
import { QRGenerator } from '../../../../apps/customer/src/lib/qr/qr-generator';
import { QRConfig, QRGenerationOptions } from '@vocilia/types';

// Mock QRCode library
jest.mock('qrcode');
const mockQRCode = QRCode as jest.Mocked<typeof QRCode>;

describe('QRGenerator', () => {
  let qrGenerator: QRGenerator;

  beforeEach(() => {
    qrGenerator = new QRGenerator();
    jest.clearAllMocks();
  });

  describe('generateQRCode', () => {
    const mockConfig: QRConfig = {
      storeId: 'store-123',
      sessionId: 'session-456',
      apiBaseUrl: 'https://api.vocilia.com',
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    };

    it('should generate QR code with valid configuration', async () => {
      const mockDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      mockQRCode.toDataURL.mockResolvedValue(mockDataURL);

      const result = await qrGenerator.generateQRCode(mockConfig);

      expect(result).toEqual({
        dataURL: mockDataURL,
        config: mockConfig,
        generatedAt: expect.any(Date)
      });
    });

    it('should use correct QR code options for mobile scanning', async () => {
      const expectedOptions: QRGenerationOptions = {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      };

      await qrGenerator.generateQRCode(mockConfig);

      expect(mockQRCode.toDataURL).toHaveBeenCalledWith(
        expect.stringContaining(mockConfig.storeId),
        expectedOptions
      );
    });

    it('should include all required data in QR payload', async () => {
      await qrGenerator.generateQRCode(mockConfig);

      const capturedPayload = JSON.parse(
        (mockQRCode.toDataURL as jest.Mock).mock.calls[0][0]
      );

      expect(capturedPayload).toEqual({
        storeId: mockConfig.storeId,
        sessionId: mockConfig.sessionId,
        apiBaseUrl: mockConfig.apiBaseUrl,
        expiresAt: mockConfig.expiresAt.toISOString(),
        version: '1.0'
      });
    });

    it('should handle QR generation errors gracefully', async () => {
      const error = new Error('QR generation failed');
      mockQRCode.toDataURL.mockRejectedValue(error);

      await expect(qrGenerator.generateQRCode(mockConfig)).rejects.toThrow(
        'Failed to generate QR code: QR generation failed'
      );
    });

    it('should validate expiration time is in the future', async () => {
      const expiredConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      };

      await expect(qrGenerator.generateQRCode(expiredConfig)).rejects.toThrow(
        'QR code expiration time must be in the future'
      );
    });

    it('should enforce maximum expiration time limit', async () => {
      const tooLongConfig = {
        ...mockConfig,
        expiresAt: new Date(Date.now() + 25 * 60 * 60 * 1000) // 25 hours
      };

      await expect(qrGenerator.generateQRCode(tooLongConfig)).rejects.toThrow(
        'QR code cannot be valid for more than 24 hours'
      );
    });
  });

  describe('validateQRPayload', () => {
    it('should validate correctly formatted QR payload', () => {
      const validPayload = {
        storeId: 'store-123',
        sessionId: 'session-456',
        apiBaseUrl: 'https://api.vocilia.com',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        version: '1.0'
      };

      const result = qrGenerator.validateQRPayload(JSON.stringify(validPayload));
      expect(result.isValid).toBe(true);
      expect(result.payload).toEqual(validPayload);
    });

    it('should reject invalid JSON payload', () => {
      const result = qrGenerator.validateQRPayload('invalid-json');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid JSON format');
    });

    it('should reject payload with missing required fields', () => {
      const incompletePayload = {
        storeId: 'store-123'
        // Missing other required fields
      };

      const result = qrGenerator.validateQRPayload(JSON.stringify(incompletePayload));
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should reject expired QR codes', () => {
      const expiredPayload = {
        storeId: 'store-123',
        sessionId: 'session-456',
        apiBaseUrl: 'https://api.vocilia.com',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        version: '1.0'
      };

      const result = qrGenerator.validateQRPayload(JSON.stringify(expiredPayload));
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('QR code has expired');
    });

    it('should reject unsupported QR code versions', () => {
      const unsupportedPayload = {
        storeId: 'store-123',
        sessionId: 'session-456',
        apiBaseUrl: 'https://api.vocilia.com',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        version: '2.0' // Unsupported version
      };

      const result = qrGenerator.validateQRPayload(JSON.stringify(unsupportedPayload));
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Unsupported QR code version: 2.0');
    });
  });

  describe('refreshQRCode', () => {
    it('should generate new QR code with updated session', async () => {
      const originalConfig: QRConfig = {
        storeId: 'store-123',
        sessionId: 'session-456',
        apiBaseUrl: 'https://api.vocilia.com',
        expiresAt: new Date(Date.now() + 3600000)
      };

      const newSessionId = 'session-789';
      mockQRCode.toDataURL.mockResolvedValue('new-qr-data-url');

      const result = await qrGenerator.refreshQRCode(originalConfig, newSessionId);

      expect(result.config.sessionId).toBe(newSessionId);
      expect(result.config.storeId).toBe(originalConfig.storeId);
      expect(result.config.expiresAt.getTime()).toBeGreaterThan(originalConfig.expiresAt.getTime());
    });

    it('should extend expiration time by default refresh duration', async () => {
      const originalConfig: QRConfig = {
        storeId: 'store-123',
        sessionId: 'session-456',
        apiBaseUrl: 'https://api.vocilia.com',
        expiresAt: new Date(Date.now() + 1800000) // 30 minutes
      };

      const originalExpiration = originalConfig.expiresAt.getTime();
      mockQRCode.toDataURL.mockResolvedValue('refreshed-qr-data-url');

      const result = await qrGenerator.refreshQRCode(originalConfig, 'new-session');

      // Should extend by 1 hour (default refresh duration)
      const expectedExpiration = originalExpiration + 3600000;
      expect(result.config.expiresAt.getTime()).toBeCloseTo(expectedExpiration, -3); // Within 1 second
    });
  });
});