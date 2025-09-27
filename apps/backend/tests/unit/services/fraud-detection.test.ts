import { FraudDetector } from '../../../src/services/qr/fraud-detection';
import { QRDatabase } from '../../../src/config/qr-database';
import type { FraudDetectionLog } from '@vocilia/types';

// Mock the QR database
jest.mock('../../../src/config/qr-database');

describe('FraudDetector', () => {
  let fraudDetector: FraudDetector;
  let mockDatabase: jest.Mocked<QRDatabase>;

  beforeEach(() => {
    mockDatabase = new QRDatabase() as jest.Mocked<QRDatabase>;
    fraudDetector = new FraudDetector(mockDatabase);
    jest.clearAllMocks();

    // Mock current time for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-09-22T14:32:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('checkFraudRisk', () => {
    const mockStoreId = '550e8400-e29b-41d4-a716-446655440000';
    const mockIpAddress = '192.168.1.100';
    const mockUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)';

    it('should return low risk for first-time access', async () => {
      mockDatabase.getFraudDetectionLogs.mockResolvedValue([]);

      const result = await fraudDetector.checkFraudRisk(
        mockStoreId,
        mockIpAddress,
        mockUserAgent
      );

      expect(result).toEqual({
        risk_level: 'low',
        risk_score: 0,
        factors: [],
        warning: false
      });
    });

    it('should return medium risk for repeated IP access', async () => {
      const mockLogs: FraudDetectionLog[] = Array.from({ length: 5 }, (_, i) => ({
        log_id: `log-${i}`,
        store_id: mockStoreId,
        ip_address: mockIpAddress,
        user_agent: mockUserAgent,
        access_timestamp: new Date(Date.now() - (i + 1) * 10 * 60 * 1000), // 10, 20, 30, 40, 50 minutes ago
        risk_factors: ['repeated_ip'],
        session_token: `token-${i}`
      }));

      mockDatabase.getFraudDetectionLogs.mockResolvedValue(mockLogs);

      const result = await fraudDetector.checkFraudRisk(
        mockStoreId,
        mockIpAddress,
        mockUserAgent
      );

      expect(result.risk_level).toBe('medium');
      expect(result.risk_score).toBeGreaterThan(0);
      expect(result.factors).toContain('repeated_ip_access');
    });

    it('should return high risk for excessive access attempts', async () => {
      const mockLogs: FraudDetectionLog[] = Array.from({ length: 12 }, (_, i) => ({
        log_id: `log-${i}`,
        store_id: mockStoreId,
        ip_address: mockIpAddress,
        user_agent: mockUserAgent,
        access_timestamp: new Date(Date.now() - i * 5 * 60 * 1000), // Every 5 minutes
        risk_factors: ['excessive_attempts'],
        session_token: `token-${i}`
      }));

      mockDatabase.getFraudDetectionLogs.mockResolvedValue(mockLogs);

      const result = await fraudDetector.checkFraudRisk(
        mockStoreId,
        mockIpAddress,
        mockUserAgent
      );

      expect(result.risk_level).toBe('high');
      expect(result.risk_score).toBeGreaterThan(50);
      expect(result.factors).toContain('excessive_attempts');
      expect(result.warning).toBe(true);
    });

    it('should detect suspicious user agent patterns', async () => {
      const suspiciousUserAgent = 'Bot/1.0 (automated)';
      mockDatabase.getFraudDetectionLogs.mockResolvedValue([]);

      const result = await fraudDetector.checkFraudRisk(
        mockStoreId,
        mockIpAddress,
        suspiciousUserAgent
      );

      expect(result.factors).toContain('suspicious_user_agent');
      expect(result.risk_score).toBeGreaterThan(0);
    });

    it('should consider time-based access patterns', async () => {
      const mockLogs: FraudDetectionLog[] = Array.from({ length: 8 }, (_, i) => ({
        log_id: `log-${i}`,
        store_id: mockStoreId,
        ip_address: mockIpAddress,
        user_agent: mockUserAgent,
        access_timestamp: new Date(Date.now() - i * 2 * 60 * 1000), // Every 2 minutes
        risk_factors: ['rapid_succession'],
        session_token: `token-${i}`
      }));

      mockDatabase.getFraudDetectionLogs.mockResolvedValue(mockLogs);

      const result = await fraudDetector.checkFraudRisk(
        mockStoreId,
        mockIpAddress,
        mockUserAgent
      );

      expect(result.factors).toContain('rapid_succession');
      expect(result.risk_level).toBe('medium');
    });

    it('should apply rate limiting for high-risk scenarios', async () => {
      const mockLogs: FraudDetectionLog[] = Array.from({ length: 15 }, (_, i) => ({
        log_id: `log-${i}`,
        store_id: mockStoreId,
        ip_address: mockIpAddress,
        user_agent: mockUserAgent,
        access_timestamp: new Date(Date.now() - i * 3 * 60 * 1000),
        risk_factors: ['rate_limit_exceeded'],
        session_token: `token-${i}`
      }));

      mockDatabase.getFraudDetectionLogs.mockResolvedValue(mockLogs);

      const result = await fraudDetector.checkFraudRisk(
        mockStoreId,
        mockIpAddress,
        mockUserAgent
      );

      expect(result.risk_level).toBe('blocked');
      expect(result.factors).toContain('rate_limit_exceeded');
      expect(result.warning).toBe(true);
    });
  });

  describe('logFraudAttempt', () => {
    const mockStoreId = '550e8400-e29b-41d4-a716-446655440000';
    const mockIpAddress = '192.168.1.100';
    const mockUserAgent = 'Mozilla/5.0';
    const mockSessionToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
    const mockRiskFactors = ['repeated_ip_access', 'suspicious_timing'];

    it('should log fraud attempt with all details', async () => {
      mockDatabase.createFraudDetectionLog.mockResolvedValue({
        log_id: 'fraud-log-123',
        store_id: mockStoreId,
        ip_address: mockIpAddress,
        user_agent: mockUserAgent,
        access_timestamp: new Date(),
        risk_factors: mockRiskFactors,
        session_token: mockSessionToken
      });

      await fraudDetector.logFraudAttempt(
        mockStoreId,
        mockIpAddress,
        mockUserAgent,
        mockSessionToken,
        mockRiskFactors
      );

      expect(mockDatabase.createFraudDetectionLog).toHaveBeenCalledWith({
        store_id: mockStoreId,
        ip_address: mockIpAddress,
        user_agent: mockUserAgent,
        session_token: mockSessionToken,
        risk_factors: mockRiskFactors,
        access_timestamp: expect.any(Date)
      });
    });

    it('should handle database errors gracefully', async () => {
      mockDatabase.createFraudDetectionLog.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Should not throw, but log the error internally
      await expect(
        fraudDetector.logFraudAttempt(
          mockStoreId,
          mockIpAddress,
          mockUserAgent,
          mockSessionToken,
          mockRiskFactors
        )
      ).resolves.not.toThrow();
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate score based on risk factors', () => {
      const riskFactors = ['repeated_ip_access', 'suspicious_timing'];
      const score = fraudDetector.calculateRiskScore(riskFactors);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 0 for no risk factors', () => {
      const score = fraudDetector.calculateRiskScore([]);
      expect(score).toBe(0);
    });

    it('should cap score at 100 for excessive risk factors', () => {
      const manyRiskFactors = [
        'repeated_ip_access',
        'suspicious_timing',
        'excessive_attempts',
        'suspicious_user_agent',
        'rapid_succession',
        'rate_limit_exceeded'
      ];
      const score = fraudDetector.calculateRiskScore(manyRiskFactors);

      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('isBlocked', () => {
    const mockStoreId = '550e8400-e29b-41d4-a716-446655440000';
    const mockIpAddress = '192.168.1.100';

    it('should return false for non-blocked IP', async () => {
      mockDatabase.getFraudDetectionLogs.mockResolvedValue([]);

      const result = await fraudDetector.isBlocked(mockStoreId, mockIpAddress);
      expect(result).toBe(false);
    });

    it('should return true for blocked IP with excessive attempts', async () => {
      const mockLogs: FraudDetectionLog[] = Array.from({ length: 20 }, (_, i) => ({
        log_id: `log-${i}`,
        store_id: mockStoreId,
        ip_address: mockIpAddress,
        user_agent: 'Mozilla/5.0',
        access_timestamp: new Date(Date.now() - i * 60 * 1000),
        risk_factors: ['excessive_attempts'],
        session_token: `token-${i}`
      }));

      mockDatabase.getFraudDetectionLogs.mockResolvedValue(mockLogs);

      const result = await fraudDetector.isBlocked(mockStoreId, mockIpAddress);
      expect(result).toBe(true);
    });

    it('should consider time window for blocking decisions', async () => {
      // Old logs outside the blocking window
      const oldLogs: FraudDetectionLog[] = Array.from({ length: 20 }, (_, i) => ({
        log_id: `log-${i}`,
        store_id: mockStoreId,
        ip_address: mockIpAddress,
        user_agent: 'Mozilla/5.0',
        access_timestamp: new Date(Date.now() - (i + 120) * 60 * 1000), // 2+ hours ago
        risk_factors: ['excessive_attempts'],
        session_token: `token-${i}`
      }));

      mockDatabase.getFraudDetectionLogs.mockResolvedValue(oldLogs);

      const result = await fraudDetector.isBlocked(mockStoreId, mockIpAddress);
      expect(result).toBe(false);
    });
  });
});