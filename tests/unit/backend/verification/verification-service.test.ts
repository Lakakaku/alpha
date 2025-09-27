import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { VerificationService } from '../../../../apps/backend/src/services/verification/verification-service';
import { VerificationRecordModel } from '@vocilia/database';
import { VerificationStatus, VerificationMethod, VerificationRecord } from '@vocilia/types';

// Mock dependencies
jest.mock('@vocilia/database');
const mockVerificationModel = VerificationRecordModel as jest.Mocked<typeof VerificationRecordModel>;

describe('VerificationService', () => {
  let verificationService: VerificationService;
  const mockUserId = 'user-123';
  const mockStoreId = 'store-456';
  const mockSessionId = 'session-789';

  beforeEach(() => {
    verificationService = new VerificationService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initiateVerification', () => {
    const verificationData = {
      userId: mockUserId,
      storeId: mockStoreId,
      sessionId: mockSessionId,
      method: 'phone' as VerificationMethod,
      phoneNumber: '+46701234567'
    };

    it('should create verification record with pending status', async () => {
      const mockRecord: VerificationRecord = {
        id: 'verification-123',
        userId: mockUserId,
        storeId: mockStoreId,
        sessionId: mockSessionId,
        method: 'phone',
        status: 'pending',
        phoneNumber: '+46701234567',
        verificationCode: '123456',
        expiresAt: new Date(Date.now() + 600000), // 10 minutes
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVerificationModel.create.mockResolvedValue(mockRecord);

      const result = await verificationService.initiateVerification(verificationData);

      expect(mockVerificationModel.create).toHaveBeenCalledWith({
        ...verificationData,
        status: 'pending',
        verificationCode: expect.stringMatching(/^\d{6}$/),
        expiresAt: expect.any(Date)
      });
      expect(result).toEqual(mockRecord);
    });

    it('should generate 6-digit verification code', async () => {
      mockVerificationModel.create.mockResolvedValue({} as VerificationRecord);

      await verificationService.initiateVerification(verificationData);

      const createCall = mockVerificationModel.create.mock.calls[0][0];
      expect(createCall.verificationCode).toMatch(/^\d{6}$/);
    });

    it('should set expiration time to 10 minutes from now', async () => {
      const beforeCall = Date.now();
      mockVerificationModel.create.mockResolvedValue({} as VerificationRecord);

      await verificationService.initiateVerification(verificationData);

      const createCall = mockVerificationModel.create.mock.calls[0][0];
      const expirationTime = createCall.expiresAt.getTime();
      const expectedExpiration = beforeCall + 600000; // 10 minutes
      
      expect(expirationTime).toBeCloseTo(expectedExpiration, -3); // Within 1 second
    });

    it('should validate Swedish phone number format', async () => {
      const invalidPhoneData = {
        ...verificationData,
        phoneNumber: '+1234567890' // Non-Swedish number
      };

      await expect(verificationService.initiateVerification(invalidPhoneData))
        .rejects.toThrow('Invalid Swedish phone number format');
    });

    it('should prevent duplicate active verifications', async () => {
      mockVerificationModel.findBySessionAndStatus.mockResolvedValue({
        id: 'existing-verification',
        status: 'pending'
      } as VerificationRecord);

      await expect(verificationService.initiateVerification(verificationData))
        .rejects.toThrow('Active verification already exists for this session');
    });
  });

  describe('verifyCode', () => {
    const mockVerificationId = 'verification-123';
    const correctCode = '123456';

    it('should successfully verify correct code', async () => {
      const mockRecord: VerificationRecord = {
        id: mockVerificationId,
        userId: mockUserId,
        storeId: mockStoreId,
        sessionId: mockSessionId,
        method: 'phone',
        status: 'pending',
        phoneNumber: '+46701234567',
        verificationCode: correctCode,
        expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVerificationModel.findById.mockResolvedValue(mockRecord);
      mockVerificationModel.updateStatus.mockResolvedValue({
        ...mockRecord,
        status: 'verified',
        verifiedAt: new Date()
      });

      const result = await verificationService.verifyCode(mockVerificationId, correctCode);

      expect(result.success).toBe(true);
      expect(mockVerificationModel.updateStatus).toHaveBeenCalledWith(
        mockVerificationId,
        'verified',
        expect.any(Date)
      );
    });

    it('should reject incorrect verification code', async () => {
      const mockRecord: VerificationRecord = {
        id: mockVerificationId,
        userId: mockUserId,
        storeId: mockStoreId,
        sessionId: mockSessionId,
        method: 'phone',
        status: 'pending',
        phoneNumber: '+46701234567',
        verificationCode: correctCode,
        expiresAt: new Date(Date.now() + 300000),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVerificationModel.findById.mockResolvedValue(mockRecord);

      const result = await verificationService.verifyCode(mockVerificationId, '654321');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code');
    });

    it('should reject expired verification codes', async () => {
      const expiredRecord: VerificationRecord = {
        id: mockVerificationId,
        userId: mockUserId,
        storeId: mockStoreId,
        sessionId: mockSessionId,
        method: 'phone',
        status: 'pending',
        phoneNumber: '+46701234567',
        verificationCode: correctCode,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVerificationModel.findById.mockResolvedValue(expiredRecord);

      const result = await verificationService.verifyCode(mockVerificationId, correctCode);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Verification code has expired');
    });

    it('should increment attempt count on failed verification', async () => {
      const mockRecord: VerificationRecord = {
        id: mockVerificationId,
        userId: mockUserId,
        storeId: mockStoreId,
        sessionId: mockSessionId,
        method: 'phone',
        status: 'pending',
        phoneNumber: '+46701234567',
        verificationCode: correctCode,
        expiresAt: new Date(Date.now() + 300000),
        attemptCount: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVerificationModel.findById.mockResolvedValue(mockRecord);
      mockVerificationModel.incrementAttempts.mockResolvedValue();

      await verificationService.verifyCode(mockVerificationId, '654321');

      expect(mockVerificationModel.incrementAttempts).toHaveBeenCalledWith(mockVerificationId);
    });

    it('should block verification after max attempts', async () => {
      const mockRecord: VerificationRecord = {
        id: mockVerificationId,
        userId: mockUserId,
        storeId: mockStoreId,
        sessionId: mockSessionId,
        method: 'phone',
        status: 'pending',
        phoneNumber: '+46701234567',
        verificationCode: correctCode,
        expiresAt: new Date(Date.now() + 300000),
        attemptCount: 3, // Max attempts reached
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVerificationModel.findById.mockResolvedValue(mockRecord);

      const result = await verificationService.verifyCode(mockVerificationId, '654321');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Maximum verification attempts exceeded');
      expect(mockVerificationModel.updateStatus).toHaveBeenCalledWith(
        mockVerificationId,
        'blocked'
      );
    });
  });

  describe('getVerificationStatus', () => {
    it('should return current verification status', async () => {
      const mockRecord: VerificationRecord = {
        id: 'verification-123',
        userId: mockUserId,
        storeId: mockStoreId,
        sessionId: mockSessionId,
        method: 'phone',
        status: 'verified',
        phoneNumber: '+46701234567',
        verificationCode: '123456',
        expiresAt: new Date(),
        verifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVerificationModel.findBySession.mockResolvedValue(mockRecord);

      const status = await verificationService.getVerificationStatus(mockSessionId);

      expect(status).toEqual({
        verificationId: mockRecord.id,
        status: 'verified',
        method: 'phone',
        verifiedAt: mockRecord.verifiedAt,
        expiresAt: mockRecord.expiresAt
      });
    });

    it('should return null for non-existent verification', async () => {
      mockVerificationModel.findBySession.mockResolvedValue(null);

      const status = await verificationService.getVerificationStatus('nonexistent-session');

      expect(status).toBeNull();
    });
  });

  describe('resendVerification', () => {
    it('should generate new code and reset expiration', async () => {
      const mockRecord: VerificationRecord = {
        id: 'verification-123',
        userId: mockUserId,
        storeId: mockStoreId,
        sessionId: mockSessionId,
        method: 'phone',
        status: 'pending',
        phoneNumber: '+46701234567',
        verificationCode: '123456',
        expiresAt: new Date(Date.now() + 300000),
        attemptCount: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVerificationModel.findBySession.mockResolvedValue(mockRecord);
      mockVerificationModel.updateVerificationCode.mockResolvedValue({
        ...mockRecord,
        verificationCode: '654321',
        expiresAt: new Date(Date.now() + 600000),
        attemptCount: 0
      });

      const result = await verificationService.resendVerification(mockSessionId);

      expect(result.success).toBe(true);
      expect(mockVerificationModel.updateVerificationCode).toHaveBeenCalledWith(
        mockRecord.id,
        expect.stringMatching(/^\d{6}$/),
        expect.any(Date)
      );
    });

    it('should enforce resend rate limiting', async () => {
      const recentRecord: VerificationRecord = {
        id: 'verification-123',
        userId: mockUserId,
        storeId: mockStoreId,
        sessionId: mockSessionId,
        method: 'phone',
        status: 'pending',
        phoneNumber: '+46701234567',
        verificationCode: '123456',
        expiresAt: new Date(Date.now() + 300000),
        lastResendAt: new Date(Date.now() - 30000), // 30 seconds ago
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVerificationModel.findBySession.mockResolvedValue(recentRecord);

      const result = await verificationService.resendVerification(mockSessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Please wait before requesting another verification code');
    });
  });
});