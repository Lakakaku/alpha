import { parsePhoneNumber, isValidPhoneNumber, PhoneNumber } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  status: 'valid' | 'invalid_format' | 'not_swedish' | 'not_mobile' | 'unsupported_carrier';
  e164Format?: string;
  nationalFormat?: string;
  errorMessage?: string;
}

export class PhoneValidatorService {
  private static readonly SWEDEN_COUNTRY_CODE = 'SE';
  private static readonly VALID_MOBILE_PREFIXES = [
    '070', '072', '073', '076', '079'  // Swedish mobile prefixes compatible with Swish
  ];

  /**
   * Validates a Swedish phone number for Swish compatibility
   * @param phoneNumber Raw phone number input
   * @returns Validation result with normalized E.164 format if valid
   */
  public static validateSwedishPhone(phoneNumber: string): PhoneValidationResult {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return {
        isValid: false,
        status: 'invalid_format',
        errorMessage: 'Phone number is required and must be a string'
      };
    }

    // Clean input: remove spaces, dashes, dots, slashes, underscores, parentheses and trim
    const cleanedNumber = phoneNumber.replace(/[\s\-\.\/_\(\)]/g, '').trim();
    
    if (cleanedNumber.length === 0) {
      return {
        isValid: false,
        status: 'invalid_format',
        errorMessage: 'Phone number cannot be empty'
      };
    }

    try {
      // Parse with explicit Sweden country code
      const parsed = parsePhoneNumber(cleanedNumber, this.SWEDEN_COUNTRY_CODE);
      
      if (!parsed) {
        return {
          isValid: false,
          status: 'invalid_format',
          errorMessage: 'Unable to parse phone number'
        };
      }

      // Check if it's a Swedish number
      if (parsed.country !== 'SE') {
        return {
          isValid: false,
          status: 'not_swedish',
          errorMessage: 'Only Swedish mobile numbers are supported'
        };
      }

      // Validate basic phone number format
      if (!isValidPhoneNumber(cleanedNumber, this.SWEDEN_COUNTRY_CODE)) {
        return {
          isValid: false,
          status: 'invalid_format',
          errorMessage: 'Invalid Swedish phone number format'
        };
      }

      // Check if it's a mobile number by checking length and prefix
      const nationalNumber = parsed.nationalNumber;
      if (!nationalNumber || nationalNumber.length !== 9) {
        return {
          isValid: false,
          status: 'invalid_format',
          errorMessage: 'Invalid Swedish phone number length'
        };
      }

      // Verify mobile prefix for Swish compatibility (add leading zero back)
      const prefix = '0' + nationalNumber.substring(0, 2);
      
      if (!this.VALID_MOBILE_PREFIXES.includes(prefix)) {
        return {
          isValid: false,
          status: 'not_mobile',
          errorMessage: `Prefix ${prefix} is not a Swedish mobile prefix. Only ${this.VALID_MOBILE_PREFIXES.join(', ')} are supported.`
        };
      }

      // Return valid result with both formats
      return {
        isValid: true,
        status: 'valid',
        e164Format: parsed.format('E.164'),
        nationalFormat: parsed.format('NATIONAL')
      };

    } catch (error: any) {
      return {
        isValid: false,
        status: 'invalid_format',
        errorMessage: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Validates multiple phone numbers in batch
   * @param phoneNumbers Array of phone numbers to validate
   * @returns Array of validation results in same order
   */
  public static validateMultiple(phoneNumbers: string[]): PhoneValidationResult[] {
    return phoneNumbers.map(phone => this.validateSwedishPhone(phone));
  }

  /**
   * Extracts just the valid normalized numbers from validation results
   * @param phoneNumbers Array of phone numbers to validate
   * @returns Array of normalized E.164 numbers (only valid ones)
   */
  public static getValidNumbers(phoneNumbers: string[]): string[] {
    return this.validateMultiple(phoneNumbers)
      .filter(result => result.isValid)
      .map(result => result.e164Format!)
      .filter(Boolean);
  }

  /**
   * Quick validation check without detailed error information
   * @param phoneNumber Phone number to check
   * @returns true if valid Swedish mobile number
   */
  public static isValidSwedishMobile(phoneNumber: string): boolean {
    return this.validateSwedishPhone(phoneNumber).isValid;
  }
}