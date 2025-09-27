import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import type { 
  VerificationSubmissionRequest, 
  ValidationResults,
  TimeValidationResult,
  AmountValidationResult,
  PhoneValidationResult
} from '@vocilia/types';

/**
 * Verification Validation Service
 * Handles validation of customer transaction submissions with tolerance checking
 */
export class VerificationValidator {
  private readonly timeToleranceMinutes: number;
  private readonly amountToleranceSEK: number;

  constructor() {
    this.timeToleranceMinutes = parseInt(process.env.VERIFICATION_TIME_TOLERANCE_MINUTES || '2');
    this.amountToleranceSEK = parseFloat(process.env.VERIFICATION_AMOUNT_TOLERANCE_SEK || '2');
  }

  /**
   * Validate complete submission against expected values
   */
  validateSubmission(
    submission: VerificationSubmissionRequest,
    expectedAmount: number
  ): ValidationResults {
    const timeValidation = this.validateTime(submission.transaction_time);
    const amountValidation = this.validateAmount(submission.transaction_amount, expectedAmount);
    const phoneValidation = this.validateSwedishPhoneNumber(submission.phone_number);

    const overallValid = timeValidation.status === 'valid' && 
                        amountValidation.status === 'valid' && 
                        phoneValidation.status === 'valid';

    return {
      time_validation: timeValidation,
      amount_validation: amountValidation,
      phone_validation: phoneValidation,
      overall_valid: overallValid
    };
  }

  /**
   * Validate transaction time against current time with tolerance
   */
  validateTime(submissionTime: string): TimeValidationResult {
    try {
      // Parse submission time (HH:MM format)
      const timeMatch = submissionTime.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch) {
        return {
          status: 'invalid_format',
          difference_minutes: 0,
          tolerance_range: `±${this.timeToleranceMinutes} minutes`
        };
      }

      const submissionHour = parseInt(timeMatch[1]);
      const submissionMinute = parseInt(timeMatch[2]);

      // Validate time format
      if (submissionHour > 23 || submissionMinute > 59) {
        return {
          status: 'invalid_format',
          difference_minutes: 0,
          tolerance_range: `±${this.timeToleranceMinutes} minutes`
        };
      }

      // Get current time
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Calculate submission time for today
      const submissionDate = new Date();
      submissionDate.setHours(submissionHour, submissionMinute, 0, 0);

      // Calculate current time for today
      const currentDate = new Date();
      currentDate.setHours(currentHour, currentMinute, 0, 0);

      // Calculate difference in minutes
      const differenceMs = Math.abs(currentDate.getTime() - submissionDate.getTime());
      const differenceMinutes = Math.floor(differenceMs / (1000 * 60));

      // Check if within tolerance
      const isValid = differenceMinutes <= this.timeToleranceMinutes;

      return {
        status: isValid ? 'valid' : 'out_of_tolerance',
        difference_minutes: differenceMinutes,
        tolerance_range: `±${this.timeToleranceMinutes} minutes`
      };

    } catch (error) {
      return {
        status: 'invalid_format',
        difference_minutes: 0,
        tolerance_range: `±${this.timeToleranceMinutes} minutes`
      };
    }
  }

  /**
   * Validate transaction amount against expected amount with tolerance
   */
  validateAmount(
    submissionAmount: number, 
    expectedAmount: number
  ): AmountValidationResult {
    // Calculate difference
    const difference = Math.abs(submissionAmount - expectedAmount);
    const differenceRounded = Math.round(difference * 100) / 100; // Round to 2 decimal places

    // Check if within tolerance
    const isValid = differenceRounded <= this.amountToleranceSEK;

    return {
      status: isValid ? 'valid' : 'out_of_tolerance',
      difference_sek: differenceRounded,
      tolerance_range: `±${this.amountToleranceSEK} SEK`
    };
  }

  /**
   * Validate Swedish phone number and format
   */
  validateSwedishPhoneNumber(phoneNumber: string): PhoneValidationResult {
    try {
      // Clean the phone number
      const cleanedNumber = phoneNumber.replace(/\s/g, '').replace(/-/g, '');

      // Try to parse as Swedish number
      const parsed = parsePhoneNumber(cleanedNumber, 'SE');

      if (!parsed) {
        return { status: 'invalid_format' };
      }

      // Check if it's a valid phone number
      if (!parsed.isValid()) {
        return { status: 'invalid_format' };
      }

      // Check if it's actually a Swedish number
      if (parsed.country !== 'SE') {
        return { status: 'not_swedish' };
      }

      // Check if it's a mobile number (Swedish mobile numbers start with 07)
      const nationalNumber = parsed.nationalNumber;
      if (!nationalNumber.startsWith('7')) {
        return { status: 'not_mobile' };
      }

      // Return valid result with formatted numbers
      return {
        status: 'valid',
        e164_format: parsed.format('E.164'),
        national_format: parsed.format('NATIONAL')
      };

    } catch (error) {
      // If libphonenumber throws an error, try basic validation
      return this.validateSwedishPhoneNumberBasic(phoneNumber);
    }
  }

  /**
   * Basic Swedish phone number validation (fallback)
   */
  private validateSwedishPhoneNumberBasic(phoneNumber: string): PhoneValidationResult {
    // Remove spaces and dashes
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Check for valid Swedish mobile patterns
    const swedishMobilePatterns = [
      /^07[0-9]{8}$/, // 0701234567
      /^\+467[0-9]{8}$/, // +46701234567
    ];

    const isValidPattern = swedishMobilePatterns.some(pattern => pattern.test(cleaned));

    if (!isValidPattern) {
      if (cleaned.length < 8) {
        return { status: 'invalid_format' };
      }
      if (!cleaned.startsWith('07') && !cleaned.startsWith('+467')) {
        return { status: 'not_swedish' };
      }
      return { status: 'invalid_format' };
    }

    // Format the number
    let e164Format: string;
    let nationalFormat: string;

    if (cleaned.startsWith('+46')) {
      e164Format = cleaned;
      nationalFormat = '0' + cleaned.substring(3);
    } else {
      e164Format = '+46' + cleaned.substring(1);
      nationalFormat = cleaned;
    }

    // Format national format with spaces
    if (nationalFormat.length === 10) {
      nationalFormat = nationalFormat.substring(0, 3) + '-' + 
                      nationalFormat.substring(3, 6) + ' ' + 
                      nationalFormat.substring(6, 8) + ' ' + 
                      nationalFormat.substring(8);
    }

    return {
      status: 'valid',
      e164_format: e164Format,
      national_format: nationalFormat
    };
  }

  /**
   * Validate individual time format
   */
  validateTimeFormat(time: string): boolean {
    const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timePattern.test(time);
  }

  /**
   * Validate individual amount format
   */
  validateAmountFormat(amount: number): boolean {
    return typeof amount === 'number' && 
           amount >= 0 && 
           amount <= 999999.99 &&
           Number.isInteger(amount * 100); // Max 2 decimal places
  }

  /**
   * Get time difference in minutes between two HH:MM strings
   */
  getTimeDifferenceMinutes(time1: string, time2: string): number | null {
    try {
      const parseTime = (timeStr: string): Date => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
      };

      const date1 = parseTime(time1);
      const date2 = parseTime(time2);

      return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
    } catch {
      return null;
    }
  }

  /**
   * Get current time in HH:MM format
   */
  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Check if phone number format is valid for any region (basic check)
   */
  isValidPhoneNumberFormat(phoneNumber: string): boolean {
    try {
      return isValidPhoneNumber(phoneNumber);
    } catch {
      return false;
    }
  }

  /**
   * Parse and normalize Swedish phone number
   */
  normalizeSwedishPhoneNumber(phoneNumber: string): string | null {
    const result = this.validateSwedishPhoneNumber(phoneNumber);
    return result.status === 'valid' ? result.e164_format! : null;
  }

  /**
   * Get validation configuration
   */
  getValidationConfig(): {
    timeToleranceMinutes: number;
    amountToleranceSEK: number;
  } {
    return {
      timeToleranceMinutes: this.timeToleranceMinutes,
      amountToleranceSEK: this.amountToleranceSEK
    };
  }
}