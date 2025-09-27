import { VerificationValidator } from '../../../src/services/validation-scoring';
import type { VerificationSubmissionRequest, ValidationResults } from '@vocilia/types';

describe('VerificationValidator', () => {
  let validator: VerificationValidator;

  beforeEach(() => {
    validator = new VerificationValidator();
    // Mock current time for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-09-22T14:32:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('validateTime', () => {
    it('should validate time within 2-minute tolerance', () => {
      const submissionTime = '14:31'; // 1 minute ago
      const result = validator.validateTime(submissionTime);

      expect(result).toEqual({
        status: 'valid',
        difference_minutes: 1,
        tolerance_range: '±2 minutes'
      });
    });

    it('should reject time outside 2-minute tolerance', () => {
      const submissionTime = '14:28'; // 4 minutes ago
      const result = validator.validateTime(submissionTime);

      expect(result).toEqual({
        status: 'out_of_tolerance',
        difference_minutes: 4,
        tolerance_range: '±2 minutes'
      });
    });

    it('should validate exact current time', () => {
      const submissionTime = '14:32'; // Exact current time
      const result = validator.validateTime(submissionTime);

      expect(result).toEqual({
        status: 'valid',
        difference_minutes: 0,
        tolerance_range: '±2 minutes'
      });
    });

    it('should validate future time within tolerance', () => {
      const submissionTime = '14:34'; // 2 minutes in future
      const result = validator.validateTime(submissionTime);

      expect(result).toEqual({
        status: 'valid',
        difference_minutes: 2,
        tolerance_range: '±2 minutes'
      });
    });

    it('should handle edge case at exactly 2 minutes', () => {
      const submissionTime = '14:30'; // Exactly 2 minutes ago
      const result = validator.validateTime(submissionTime);

      expect(result).toEqual({
        status: 'valid',
        difference_minutes: 2,
        tolerance_range: '±2 minutes'
      });
    });

    it('should handle invalid time format', () => {
      const submissionTime = '25:99'; // Invalid time
      const result = validator.validateTime(submissionTime);

      expect(result.status).toBe('invalid_format');
    });
  });

  describe('validateAmount', () => {
    const expectedAmount = 125.50;

    it('should validate amount within 2 SEK tolerance', () => {
      const submissionAmount = 126.50; // 1 SEK difference
      const result = validator.validateAmount(submissionAmount, expectedAmount);

      expect(result).toEqual({
        status: 'valid',
        difference_sek: 1.00,
        tolerance_range: '±2 SEK'
      });
    });

    it('should reject amount outside 2 SEK tolerance', () => {
      const submissionAmount = 120.00; // 5.50 SEK difference
      const result = validator.validateAmount(submissionAmount, expectedAmount);

      expect(result).toEqual({
        status: 'out_of_tolerance',
        difference_sek: 5.50,
        tolerance_range: '±2 SEK'
      });
    });

    it('should validate exact amount', () => {
      const submissionAmount = 125.50; // Exact match
      const result = validator.validateAmount(submissionAmount, expectedAmount);

      expect(result).toEqual({
        status: 'valid',
        difference_sek: 0.00,
        tolerance_range: '±2 SEK'
      });
    });

    it('should handle edge case at exactly 2 SEK difference', () => {
      const submissionAmount = 123.50; // Exactly 2 SEK difference
      const result = validator.validateAmount(submissionAmount, expectedAmount);

      expect(result).toEqual({
        status: 'valid',
        difference_sek: 2.00,
        tolerance_range: '±2 SEK'
      });
    });

    it('should round differences to 2 decimal places', () => {
      const submissionAmount = 125.33; // 0.17 SEK difference
      const result = validator.validateAmount(submissionAmount, expectedAmount);

      expect(result.difference_sek).toBe(0.17);
    });
  });

  describe('validateSwedishPhoneNumber', () => {
    it('should validate correctly formatted Swedish mobile number', () => {
      const phoneNumber = '070-123 45 67';
      const result = validator.validateSwedishPhoneNumber(phoneNumber);

      expect(result).toEqual({
        status: 'valid',
        e164_format: '+46701234567',
        national_format: '070-123 45 67'
      });
    });

    it('should validate Swedish number without formatting', () => {
      const phoneNumber = '0701234567';
      const result = validator.validateSwedishPhoneNumber(phoneNumber);

      expect(result).toEqual({
        status: 'valid',
        e164_format: '+46701234567',
        national_format: '070-123 45 67'
      });
    });

    it('should validate Swedish number with +46 prefix', () => {
      const phoneNumber = '+46701234567';
      const result = validator.validateSwedishPhoneNumber(phoneNumber);

      expect(result).toEqual({
        status: 'valid',
        e164_format: '+46701234567',
        national_format: '070-123 45 67'
      });
    });

    it('should reject non-Swedish number', () => {
      const phoneNumber = '+1234567890'; // US number
      const result = validator.validateSwedishPhoneNumber(phoneNumber);

      expect(result).toEqual({
        status: 'not_swedish'
      });
    });

    it('should reject invalid format', () => {
      const phoneNumber = '123-456'; // Too short
      const result = validator.validateSwedishPhoneNumber(phoneNumber);

      expect(result).toEqual({
        status: 'invalid_format'
      });
    });

    it('should reject landline numbers', () => {
      const phoneNumber = '08-123 456 78'; // Stockholm landline
      const result = validator.validateSwedishPhoneNumber(phoneNumber);

      expect(result).toEqual({
        status: 'not_mobile'
      });
    });
  });

  describe('validateSubmission', () => {
    const mockSubmission: VerificationSubmissionRequest = {
      transaction_time: '14:31',
      transaction_amount: 126.00,
      phone_number: '070-123 45 67'
    };

    const mockExpectedAmount = 125.50;

    it('should return overall valid for all valid fields', () => {
      const result = validator.validateSubmission(mockSubmission, mockExpectedAmount);

      expect(result.overall_valid).toBe(true);
      expect(result.time_validation.status).toBe('valid');
      expect(result.amount_validation.status).toBe('valid');
      expect(result.phone_validation.status).toBe('valid');
    });

    it('should return overall invalid when time is out of tolerance', () => {
      const invalidSubmission = {
        ...mockSubmission,
        transaction_time: '14:25' // More than 2 minutes ago
      };

      const result = validator.validateSubmission(invalidSubmission, mockExpectedAmount);

      expect(result.overall_valid).toBe(false);
      expect(result.time_validation.status).toBe('out_of_tolerance');
    });

    it('should return overall invalid when amount is out of tolerance', () => {
      const invalidSubmission = {
        ...mockSubmission,
        transaction_amount: 120.00 // More than 2 SEK difference
      };

      const result = validator.validateSubmission(invalidSubmission, mockExpectedAmount);

      expect(result.overall_valid).toBe(false);
      expect(result.amount_validation.status).toBe('out_of_tolerance');
    });

    it('should return overall invalid when phone is invalid', () => {
      const invalidSubmission = {
        ...mockSubmission,
        phone_number: '+1234567890' // Non-Swedish number
      };

      const result = validator.validateSubmission(invalidSubmission, mockExpectedAmount);

      expect(result.overall_valid).toBe(false);
      expect(result.phone_validation.status).toBe('not_swedish');
    });

    it('should return detailed validation results for all fields', () => {
      const result = validator.validateSubmission(mockSubmission, mockExpectedAmount);

      expect(result).toHaveProperty('time_validation');
      expect(result).toHaveProperty('amount_validation');
      expect(result).toHaveProperty('phone_validation');
      expect(result).toHaveProperty('overall_valid');

      expect(result.time_validation).toHaveProperty('status');
      expect(result.time_validation).toHaveProperty('difference_minutes');
      expect(result.amount_validation).toHaveProperty('difference_sek');
      expect(result.phone_validation).toHaveProperty('e164_format');
    });
  });
});