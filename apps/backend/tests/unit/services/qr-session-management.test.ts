import { QRSessionManager } from '../../../src/services/qr/session-management';
import { QRDatabase } from '../../../src/config/qr-database';
import type { VerificationSession, QRVerificationRequest } from '@vocilia/types';

// Mock the QR database
jest.mock('../../../src/config/qr-database');

describe('QRSessionManager', () => {
  let sessionManager: QRSessionManager;
  let mockDatabase: jest.Mocked<QRDatabase>;

  beforeEach(() => {
    mockDatabase = new QRDatabase() as jest.Mocked<QRDatabase>;
    sessionManager = new QRSessionManager(mockDatabase);
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    const mockStoreId = '550e8400-e29b-41d4-a716-446655440000';
    const mockRequest: QRVerificationRequest = {
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
    };

    it('should create a new session with 64-character token', async () => {
      const mockStoreInfo = {
        store_id: mockStoreId,
        store_name: 'Test Store',
        business_name: 'Test Business'
      };

      mockDatabase.getStoreById.mockResolvedValue(mockStoreInfo);
      mockDatabase.createVerificationSession.mockResolvedValue({
        session_token: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
        expires_at: new Date(Date.now() + 30 * 60 * 1000)
      });

      const result = await sessionManager.createSession(mockStoreId, mockRequest);

      expect(result.session_token).toHaveLength(64);
      expect(result.session_token).toMatch(/^[a-z0-9]+$/);
      expect(mockDatabase.createVerificationSession).toHaveBeenCalledWith(
        mockStoreId,
        expect.stringMatching(/^[a-z0-9]{64}$/),
        mockRequest.ip_address,
        mockRequest.user_agent
      );
    });

    it('should set session expiry to 30 minutes from creation', async () => {
      const mockStoreInfo = {
        store_id: mockStoreId,
        store_name: 'Test Store',
        business_name: 'Test Business'
      };

      const mockExpiryTime = new Date(Date.now() + 30 * 60 * 1000);
      mockDatabase.getStoreById.mockResolvedValue(mockStoreInfo);
      mockDatabase.createVerificationSession.mockResolvedValue({
        session_token: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
        expires_at: mockExpiryTime
      });

      const result = await sessionManager.createSession(mockStoreId, mockRequest);

      expect(result.expires_at).toBeInstanceOf(Date);
      expect(result.expires_at.getTime()).toBeCloseTo(mockExpiryTime.getTime(), -3);
    });

    it('should throw error for non-existent store', async () => {
      mockDatabase.getStoreById.mockResolvedValue(null);

      await expect(
        sessionManager.createSession('invalid-store-id', mockRequest)
      ).rejects.toThrow('Store not found');
    });

    it('should generate unique session tokens', async () => {
      const mockStoreInfo = {
        store_id: mockStoreId,
        store_name: 'Test Store',
        business_name: 'Test Business'
      };

      mockDatabase.getStoreById.mockResolvedValue(mockStoreInfo);
      mockDatabase.createVerificationSession
        .mockResolvedValueOnce({
          session_token: 'first123def456ghi789jkl012mno345pqr678stu901vwx234yz',
          expires_at: new Date()
        })
        .mockResolvedValueOnce({
          session_token: 'second23def456ghi789jkl012mno345pqr678stu901vwx234yz',
          expires_at: new Date()
        });

      const result1 = await sessionManager.createSession(mockStoreId, mockRequest);
      const result2 = await sessionManager.createSession(mockStoreId, mockRequest);

      expect(result1.session_token).not.toBe(result2.session_token);
      expect(result1.session_token).toHaveLength(64);
      expect(result2.session_token).toHaveLength(64);
    });
  });

  describe('getSession', () => {
    const mockSessionToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';

    it('should retrieve existing session', async () => {
      const mockSession: VerificationSession = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        store_id: '550e8400-e29b-41d4-a716-446655440000',
        qr_version: 1,
        scan_timestamp: new Date().toISOString(),
        session_token: mockSessionToken,
        status: 'pending',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockDatabase.getVerificationSession.mockResolvedValue(mockSession);

      const result = await sessionManager.getSession(mockSessionToken);

      expect(result).toEqual(mockSession);
      expect(mockDatabase.getVerificationSession).toHaveBeenCalledWith(mockSessionToken);
    });

    it('should return null for non-existent session', async () => {
      mockDatabase.getVerificationSession.mockResolvedValue(null);

      const result = await sessionManager.getSession('invalid-token');

      expect(result).toBeNull();
    });

    it('should handle expired sessions', async () => {
      const expiredSession: VerificationSession = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        store_id: '550e8400-e29b-41d4-a716-446655440000',
        qr_version: 1,
        scan_timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        session_token: mockSessionToken,
        status: 'expired',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      };

      mockDatabase.getVerificationSession.mockResolvedValue(expiredSession);

      const result = await sessionManager.getSession(mockSessionToken);

      expect(result?.status).toBe('expired');
    });
  });

  describe('isSessionValid', () => {
    it('should return true for valid pending session', () => {
      const validSession: VerificationSession = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        store_id: 'store-id',
        qr_version: 1,
        scan_timestamp: new Date().toISOString(),
        session_token: 'valid123',
        status: 'pending',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(sessionManager.isSessionValid(validSession)).toBe(true);
    });

    it('should return false for expired session', () => {
      const expiredSession: VerificationSession = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        store_id: 'store-id',
        qr_version: 1,
        scan_timestamp: new Date().toISOString(),
        session_token: 'expired123',
        status: 'pending',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(sessionManager.isSessionValid(expiredSession)).toBe(false);
    });

    it('should return false for completed session', () => {
      const completedSession: VerificationSession = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        store_id: 'store-id',
        qr_version: 1,
        scan_timestamp: new Date().toISOString(),
        session_token: 'completed123',
        status: 'completed',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(sessionManager.isSessionValid(completedSession)).toBe(false);
    });
  });

  describe('updateSessionStatus', () => {
    const mockSessionToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';

    it('should update session status to completed', async () => {
      mockDatabase.updateSessionStatus.mockResolvedValue(true);

      await sessionManager.updateSessionStatus(mockSessionToken, 'completed');

      expect(mockDatabase.updateSessionStatus).toHaveBeenCalledWith(
        mockSessionToken,
        'completed'
      );
    });

    it('should update session status to failed', async () => {
      mockDatabase.updateSessionStatus.mockResolvedValue(true);

      await sessionManager.updateSessionStatus(mockSessionToken, 'failed');

      expect(mockDatabase.updateSessionStatus).toHaveBeenCalledWith(
        mockSessionToken,
        'failed'
      );
    });
  });
});