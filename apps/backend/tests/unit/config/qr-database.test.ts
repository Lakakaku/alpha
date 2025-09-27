import { QRDatabase } from '../../../src/config/qr-database';
import { createClient } from '@supabase/supabase-js';
import type { 
  VerificationSession, 
  CustomerVerification, 
  FraudDetectionLog,
  VerificationSessionStatus 
} from '@vocilia/types';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

describe('QRDatabase', () => {
  let qrDatabase: QRDatabase;
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn()
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    qrDatabase = new QRDatabase();
    jest.clearAllMocks();
  });

  describe('getStoreById', () => {
    const mockStoreId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return store information for valid store ID', async () => {
      const mockStoreData = {
        store_id: mockStoreId,
        store_name: 'Test Store',
        business_name: 'Test Business',
        is_active: true
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockStoreData,
        error: null
      });

      const result = await qrDatabase.getStoreById(mockStoreId);

      expect(result).toEqual({
        store_id: mockStoreId,
        store_name: 'Test Store',
        business_name: 'Test Business'
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('stores');
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('store_id, store_name, business_name, is_active');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('store_id', mockStoreId);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should return null for non-existent store', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      });

      const result = await qrDatabase.getStoreById('invalid-store-id');

      expect(result).toBeNull();
    });

    it('should return null for inactive store', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await qrDatabase.getStoreById(mockStoreId);

      expect(result).toBeNull();
    });
  });

  describe('createVerificationSession', () => {
    const mockStoreId = '550e8400-e29b-41d4-a716-446655440000';
    const mockSessionToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
    const mockIpAddress = '192.168.1.100';
    const mockUserAgent = 'Mozilla/5.0';

    it('should create a new verification session', async () => {
      const mockCreatedSession = {
        session_token: mockSessionToken,
        store_id: mockStoreId,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        ip_address: mockIpAddress,
        user_agent: mockUserAgent
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockCreatedSession,
        error: null
      });

      const result = await qrDatabase.createVerificationSession(
        mockStoreId,
        mockSessionToken,
        mockIpAddress,
        mockUserAgent
      );

      expect(result.session_token).toBe(mockSessionToken);
      expect(result.expires_at).toBeInstanceOf(Date);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('verification_sessions');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        session_token: mockSessionToken,
        store_id: mockStoreId,
        status: 'pending',
        ip_address: mockIpAddress,
        user_agent: mockUserAgent,
        expires_at: expect.any(String)
      });
    });

    it('should handle database insertion errors', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate key violation' }
      });

      await expect(
        qrDatabase.createVerificationSession(
          mockStoreId,
          mockSessionToken,
          mockIpAddress,
          mockUserAgent
        )
      ).rejects.toThrow('Failed to create verification session');
    });
  });

  describe('getVerificationSession', () => {
    const mockSessionToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';

    it('should retrieve existing verification session', async () => {
      const mockSessionData = {
        session_token: mockSessionToken,
        store_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0'
      };

      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: mockSessionData,
        error: null
      });

      const result = await qrDatabase.getVerificationSession(mockSessionToken);

      expect(result).toEqual({
        session_token: mockSessionToken,
        store_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'pending',
        created_at: expect.any(Date),
        expires_at: expect.any(Date),
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0'
      });
    });

    it('should return null for non-existent session', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await qrDatabase.getVerificationSession('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('updateSessionStatus', () => {
    const mockSessionToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';

    it('should update session status successfully', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: { session_token: mockSessionToken, status: 'completed' },
        error: null
      });

      const result = await qrDatabase.updateSessionStatus(mockSessionToken, 'completed');

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('verification_sessions');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({ status: 'completed' });
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('session_token', mockSessionToken);
    });

    it('should handle non-existent session', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await qrDatabase.updateSessionStatus(mockSessionToken, 'failed');

      expect(result).toBe(false);
    });
  });

  describe('createCustomerVerification', () => {
    const mockVerificationData = {
      session_token: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
      transaction_time: '14:31',
      transaction_amount: 125.50,
      phone_number: '070-123 45 67',
      verification_status: 'completed' as const,
      validation_results: {
        time_validation: { status: 'valid' as const, difference_minutes: 1, tolerance_range: '±2 minutes' },
        amount_validation: { status: 'valid' as const, difference_sek: 0.50, tolerance_range: '±2 SEK' },
        phone_validation: { status: 'valid' as const, e164_format: '+46701234567', national_format: '070-123 45 67' },
        overall_valid: true
      }
    };

    it('should create customer verification record', async () => {
      const mockCreatedVerification = {
        verification_id: 'ver-123',
        ...mockVerificationData,
        submitted_at: new Date().toISOString()
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockCreatedVerification,
        error: null
      });

      const result = await qrDatabase.createCustomerVerification(mockVerificationData);

      expect(result.verification_id).toBe('ver-123');
      expect(result.session_token).toBe(mockVerificationData.session_token);
      expect(result.submitted_at).toBeInstanceOf(Date);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('customer_verifications');
    });

    it('should handle creation errors', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Foreign key constraint violation' }
      });

      await expect(
        qrDatabase.createCustomerVerification(mockVerificationData)
      ).rejects.toThrow('Failed to create customer verification');
    });
  });

  describe('getCustomerVerification', () => {
    const mockSessionToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';

    it('should retrieve customer verification by session token', async () => {
      const mockVerificationData = {
        verification_id: 'ver-123',
        session_token: mockSessionToken,
        transaction_time: '14:31',
        transaction_amount: 125.50,
        phone_number: '070-123 45 67',
        verification_status: 'completed',
        submitted_at: new Date().toISOString(),
        validation_results: {
          time_validation: { status: 'valid', difference_minutes: 1, tolerance_range: '±2 minutes' },
          amount_validation: { status: 'valid', difference_sek: 0.50, tolerance_range: '±2 SEK' },
          phone_validation: { status: 'valid', e164_format: '+46701234567', national_format: '070-123 45 67' },
          overall_valid: true
        }
      };

      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: mockVerificationData,
        error: null
      });

      const result = await qrDatabase.getCustomerVerification(mockSessionToken);

      expect(result?.verification_id).toBe('ver-123');
      expect(result?.submitted_at).toBeInstanceOf(Date);
    });

    it('should return null when no verification exists', async () => {
      mockSupabaseClient.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await qrDatabase.getCustomerVerification(mockSessionToken);

      expect(result).toBeNull();
    });
  });

  describe('createFraudDetectionLog', () => {
    const mockLogData = {
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0',
      session_token: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
      risk_factors: ['repeated_ip_access', 'suspicious_timing'],
      access_timestamp: new Date()
    };

    it('should create fraud detection log', async () => {
      const mockCreatedLog = {
        log_id: 'fraud-log-123',
        ...mockLogData,
        access_timestamp: mockLogData.access_timestamp.toISOString()
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockCreatedLog,
        error: null
      });

      const result = await qrDatabase.createFraudDetectionLog(mockLogData);

      expect(result.log_id).toBe('fraud-log-123');
      expect(result.access_timestamp).toBeInstanceOf(Date);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('fraud_detection_logs');
    });
  });

  describe('getFraudDetectionLogs', () => {
    const mockStoreId = '550e8400-e29b-41d4-a716-446655440000';
    const mockIpAddress = '192.168.1.100';

    it('should retrieve fraud detection logs within time window', async () => {
      const mockLogs = [
        {
          log_id: 'log-1',
          store_id: mockStoreId,
          ip_address: mockIpAddress,
          user_agent: 'Mozilla/5.0',
          access_timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          risk_factors: ['repeated_ip_access'],
          session_token: 'token-1'
        },
        {
          log_id: 'log-2',
          store_id: mockStoreId,
          ip_address: mockIpAddress,
          user_agent: 'Mozilla/5.0',
          access_timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          risk_factors: ['suspicious_timing'],
          session_token: 'token-2'
        }
      ];

      mockSupabaseClient.mockResolvedValue({
        data: mockLogs,
        error: null
      });

      const result = await qrDatabase.getFraudDetectionLogs(
        mockStoreId,
        mockIpAddress,
        60 // 60 minutes window
      );

      expect(result).toHaveLength(2);
      expect(result[0].access_timestamp).toBeInstanceOf(Date);
      expect(mockSupabaseClient.gte).toHaveBeenCalledWith(
        'access_timestamp',
        expect.any(String)
      );
    });

    it('should return empty array when no logs found', async () => {
      mockSupabaseClient.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await qrDatabase.getFraudDetectionLogs(
        mockStoreId,
        mockIpAddress,
        60
      );

      expect(result).toEqual([]);
    });
  });
});