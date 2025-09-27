import { CustomerVerificationService } from '../../../src/services/questions/customer-verification';
import { QRDatabase } from '../../../src/config/qr-database';
import { VerificationValidator } from '../../../src/services/validation-scoring';
import type { VerificationSubmissionRequest, CustomerVerification } from '@vocilia/types';

// Mock dependencies
jest.mock('../../../src/config/qr-database');
jest.mock('../../../src/services/validation-scoring');

describe('CustomerVerificationService', () => {
  let verificationService: CustomerVerificationService;
  let mockDatabase: jest.Mocked<QRDatabase>;
  let mockValidator: jest.Mocked<VerificationValidator>;

  beforeEach(() => {
    mockDatabase = new QRDatabase() as jest.Mocked<QRDatabase>;
    mockValidator = new VerificationValidator() as jest.Mocked<VerificationValidator>;
    verificationService = new CustomerVerificationService(mockDatabase, mockValidator);
    jest.clearAllMocks();

    // Mock current time for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-09-22T14:32:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('submitVerification', () => {
    const mockSessionToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
    const mockExpectedAmount = 125.50;
    const mockSubmission: VerificationSubmissionRequest = {
      transaction_time: '14:31',
      transaction_amount: 126.00,
      phone_number: '070-123 45 67'
    };

    it('should create verification for valid submission', async () => {
      const mockValidationResults = {
        time_validation: {
          status: 'valid' as const,
          difference_minutes: 1,
          tolerance_range: '±2 minutes'
        },
        amount_validation: {
          status: 'valid' as const,
          difference_sek: 0.50,
          tolerance_range: '±2 SEK'
        },
        phone_validation: {
          status: 'valid' as const,
          e164_format: '+46701234567',
          national_format: '070-123 45 67'
        },
        overall_valid: true
      };

      const mockVerification: CustomerVerification = {
        verification_id: 'ver-123',
        session_token: mockSessionToken,
        transaction_time: mockSubmission.transaction_time,
        transaction_amount: mockSubmission.transaction_amount,
        phone_number: mockSubmission.phone_number,
        verification_status: 'completed',
        submitted_at: new Date(),
        validation_results: mockValidationResults
      };

      mockValidator.validateSubmission.mockReturnValue(mockValidationResults);
      mockDatabase.createCustomerVerification.mockResolvedValue(mockVerification);

      const result = await verificationService.submitVerification(
        mockSessionToken,
        mockSubmission,
        mockExpectedAmount
      );

      expect(result.verification_id).toBe('ver-123');
      expect(result.verification_status).toBe('completed');
      expect(result.validation_results.overall_valid).toBe(true);
      expect(mockDatabase.createCustomerVerification).toHaveBeenCalledWith({
        session_token: mockSessionToken,
        transaction_time: mockSubmission.transaction_time,
        transaction_amount: mockSubmission.transaction_amount,
        phone_number: mockSubmission.phone_number,
        verification_status: 'completed',
        validation_results: mockValidationResults
      });
    });

    it('should create failed verification for invalid submission', async () => {
      const mockValidationResults = {
        time_validation: {
          status: 'out_of_tolerance' as const,
          difference_minutes: 5,
          tolerance_range: '±2 minutes'
        },
        amount_validation: {
          status: 'valid' as const,
          difference_sek: 0.50,
          tolerance_range: '±2 SEK'
        },
        phone_validation: {
          status: 'valid' as const,
          e164_format: '+46701234567',
          national_format: '070-123 45 67'
        },
        overall_valid: false
      };

      const mockVerification: CustomerVerification = {
        verification_id: 'ver-124',
        session_token: mockSessionToken,
        transaction_time: mockSubmission.transaction_time,
        transaction_amount: mockSubmission.transaction_amount,
        phone_number: mockSubmission.phone_number,
        verification_status: 'failed',
        submitted_at: new Date(),
        validation_results: mockValidationResults
      };

      mockValidator.validateSubmission.mockReturnValue(mockValidationResults);
      mockDatabase.createCustomerVerification.mockResolvedValue(mockVerification);

      const result = await verificationService.submitVerification(
        mockSessionToken,
        mockSubmission,
        mockExpectedAmount
      );

      expect(result.verification_status).toBe('failed');
      expect(result.validation_results.overall_valid).toBe(false);
    });

    it('should generate unique verification ID', async () => {
      const mockValidationResults = {
        time_validation: { status: 'valid' as const, difference_minutes: 0, tolerance_range: '±2 minutes' },
        amount_validation: { status: 'valid' as const, difference_sek: 0, tolerance_range: '±2 SEK' },
        phone_validation: { status: 'valid' as const, e164_format: '+46701234567', national_format: '070-123 45 67' },
        overall_valid: true
      };

      mockValidator.validateSubmission.mockReturnValue(mockValidationResults);
      mockDatabase.createCustomerVerification
        .mockResolvedValueOnce({
          verification_id: 'ver-first',
          session_token: mockSessionToken,
          transaction_time: mockSubmission.transaction_time,
          transaction_amount: mockSubmission.transaction_amount,
          phone_number: mockSubmission.phone_number,
          verification_status: 'completed',
          submitted_at: new Date(),
          validation_results: mockValidationResults
        })
        .mockResolvedValueOnce({
          verification_id: 'ver-second',
          session_token: mockSessionToken,
          transaction_time: mockSubmission.transaction_time,
          transaction_amount: mockSubmission.transaction_amount,
          phone_number: mockSubmission.phone_number,
          verification_status: 'completed',
          submitted_at: new Date(),
          validation_results: mockValidationResults
        });

      const result1 = await verificationService.submitVerification(
        mockSessionToken,
        mockSubmission,
        mockExpectedAmount
      );
      const result2 = await verificationService.submitVerification(
        mockSessionToken,
        mockSubmission,
        mockExpectedAmount
      );

      expect(result1.verification_id).not.toBe(result2.verification_id);
    });
  });

  describe('getVerification', () => {
    const mockSessionToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';

    it('should retrieve existing verification', async () => {
      const mockVerification: CustomerVerification = {
        verification_id: 'ver-123',
        session_token: mockSessionToken,
        transaction_time: '14:31',
        transaction_amount: 125.50,
        phone_number: '070-123 45 67',
        verification_status: 'completed',
        submitted_at: new Date(),
        validation_results: {
          time_validation: { status: 'valid', difference_minutes: 1, tolerance_range: '±2 minutes' },
          amount_validation: { status: 'valid', difference_sek: 0, tolerance_range: '±2 SEK' },
          phone_validation: { status: 'valid', e164_format: '+46701234567', national_format: '070-123 45 67' },
          overall_valid: true
        }
      };

      mockDatabase.getCustomerVerification.mockResolvedValue(mockVerification);

      const result = await verificationService.getVerification(mockSessionToken);

      expect(result).toEqual(mockVerification);
      expect(mockDatabase.getCustomerVerification).toHaveBeenCalledWith(mockSessionToken);
    });

    it('should return null for non-existent verification', async () => {
      mockDatabase.getCustomerVerification.mockResolvedValue(null);

      const result = await verificationService.getVerification(mockSessionToken);

      expect(result).toBeNull();
    });
  });

  describe('getVerificationById', () => {
    const mockVerificationId = 'ver-123';

    it('should retrieve verification by ID', async () => {
      const mockVerification: CustomerVerification = {
        verification_id: mockVerificationId,
        session_token: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
        transaction_time: '14:31',
        transaction_amount: 125.50,
        phone_number: '070-123 45 67',
        verification_status: 'completed',
        submitted_at: new Date(),
        validation_results: {
          time_validation: { status: 'valid', difference_minutes: 1, tolerance_range: '±2 minutes' },
          amount_validation: { status: 'valid', difference_sek: 0, tolerance_range: '±2 SEK' },
          phone_validation: { status: 'valid', e164_format: '+46701234567', national_format: '070-123 45 67' },
          overall_valid: true
        }
      };

      mockDatabase.getCustomerVerificationById.mockResolvedValue(mockVerification);

      const result = await verificationService.getVerificationById(mockVerificationId);

      expect(result).toEqual(mockVerification);
      expect(mockDatabase.getCustomerVerificationById).toHaveBeenCalledWith(mockVerificationId);
    });

    it('should return null for non-existent verification ID', async () => {
      mockDatabase.getCustomerVerificationById.mockResolvedValue(null);

      const result = await verificationService.getVerificationById('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('updateVerificationStatus', () => {
    const mockVerificationId = 'ver-123';

    it('should update verification status successfully', async () => {
      mockDatabase.updateVerificationStatus.mockResolvedValue(true);

      await verificationService.updateVerificationStatus(mockVerificationId, 'completed');

      expect(mockDatabase.updateVerificationStatus).toHaveBeenCalledWith(
        mockVerificationId,
        'completed'
      );
    });

    it('should handle failed status update', async () => {
      mockDatabase.updateVerificationStatus.mockResolvedValue(false);

      const result = await verificationService.updateVerificationStatus(
        mockVerificationId,
        'failed'
      );

      expect(result).toBe(false);
    });
  });

  describe('listVerifications', () => {
    const mockStoreId = '550e8400-e29b-41d4-a716-446655440000';

    it('should retrieve verifications for store', async () => {
      const mockVerifications: CustomerVerification[] = [
        {
          verification_id: 'ver-1',
          session_token: 'token-1',
          transaction_time: '14:30',
          transaction_amount: 125.00,
          phone_number: '070-111 11 11',
          verification_status: 'completed',
          submitted_at: new Date(),
          validation_results: {
            time_validation: { status: 'valid', difference_minutes: 0, tolerance_range: '±2 minutes' },
            amount_validation: { status: 'valid', difference_sek: 0, tolerance_range: '±2 SEK' },
            phone_validation: { status: 'valid', e164_format: '+46701111111', national_format: '070-111 11 11' },
            overall_valid: true
          }
        },
        {
          verification_id: 'ver-2',
          session_token: 'token-2',
          transaction_time: '14:25',
          transaction_amount: 120.00,
          phone_number: '070-222 22 22',
          verification_status: 'failed',
          submitted_at: new Date(),
          validation_results: {
            time_validation: { status: 'valid', difference_minutes: 1, tolerance_range: '±2 minutes' },
            amount_validation: { status: 'out_of_tolerance', difference_sek: 5, tolerance_range: '±2 SEK' },
            phone_validation: { status: 'valid', e164_format: '+46702222222', national_format: '070-222 22 22' },
            overall_valid: false
          }
        }
      ];

      mockDatabase.getVerificationsByStore.mockResolvedValue(mockVerifications);

      const result = await verificationService.listVerifications(mockStoreId);

      expect(result).toEqual(mockVerifications);
      expect(mockDatabase.getVerificationsByStore).toHaveBeenCalledWith(mockStoreId);
    });

    it('should return empty array for store with no verifications', async () => {
      mockDatabase.getVerificationsByStore.mockResolvedValue([]);

      const result = await verificationService.listVerifications(mockStoreId);

      expect(result).toEqual([]);
    });
  });
});