// Using standard Jest globals
import { PhoneValidatorService } from '../../src/services/validation/phone-validator';

const { validateSwedishPhone } = PhoneValidatorService;

describe('Phone Validation Service', () => {
  describe('Valid Swedish mobile formats', () => {
    const validNumbers = [
      // Standard formats with 070 prefix
      '070-123 45 67',
      '070 123 45 67',
      '070-123-45-67',
      '0701234567',
      
      // International formats
      '+46 70 123 45 67',
      '+4670 123 45 67',
      '+46701234567',
      '0046 70 123 45 67',
      '004670 123 45 67',
      
      // Other valid prefixes (072, 073, 076, 079)
      '072-123 45 67',
      '073-123 45 67',
      '076-123 45 67',
      '079-123 45 67',
      
      // Mixed formatting
      '070 123-45 67',
      '+46 70-123 45 67',
      '0046-70 123 45 67'
    ];

    validNumbers.forEach(number => {
      it(`should validate ${number} as valid Swedish mobile`, () => {
        const result = validateSwedishPhone(number);
        
        expect(result.isValid).toBe(true);
        expect(result.status).toBe('valid');
        expect(result.e164Format).toMatch(/^\+467[02369]\d{7}$/);
        expect(result.nationalFormat).toMatch(/^07[02369]-\d{3} \d{2} \d{2}$/);
        expect(result.errorMessage).toBeUndefined();
      });
    });
  });

  describe('Invalid Swedish mobile formats', () => {
    const invalidNumbers = [
      // Wrong prefixes
      '060-123 45 67', // Invalid prefix 060
      '071-123 45 67', // Invalid prefix 071
      '074-123 45 67', // Invalid prefix 074
      '075-123 45 67', // Invalid prefix 075
      '077-123 45 67', // Invalid prefix 077
      '078-123 45 67', // Invalid prefix 078
      
      // Wrong length
      '070-123 45 6',    // Too short
      '070-123 45 678',  // Too long
      '070123456',       // Too short
      '07012345678',     // Too long
      
      // Swedish landline numbers
      '08-123 45 67',    // Stockholm landline
      '031-123 45 67',   // Gothenburg landline
      '040-123 45 67',   // Malmö landline
      
      // Completely invalid formats
      '123-456-7890',    // US format
      'abc-def gh ij',   // Letters
      '070-abc de fg',   // Mixed letters and numbers
      '',                // Empty string
      ' ',               // Whitespace only
      '070-',            // Incomplete
    ];

    invalidNumbers.forEach(number => {
      it(`should reject ${number} as invalid format`, () => {
        const result = validateSwedishPhone(number);
        
        expect(result.isValid).toBe(false);
        expect(result.status).toBe('invalid_format');
        expect(result.e164Format).toBeUndefined();
        expect(result.nationalFormat).toBeUndefined();
        expect(result.errorMessage).toContain('invalid format');
      });
    });
  });

  describe('Non-Swedish numbers', () => {
    const nonSwedishNumbers = [
      '+1-555-123-4567',     // US
      '+44 20 7946 0958',    // UK
      '+49 30 12345678',     // Germany
      '+33 1 42 34 56 78',   // France
      '+47 22 12 34 56',     // Norway
      '+45 32 12 34 56',     // Denmark
      '+358 9 1234 5678',    // Finland
    ];

    nonSwedishNumbers.forEach(number => {
      it(`should reject ${number} as non-Swedish`, () => {
        const result = validateSwedishPhone(number);
        
        expect(result.isValid).toBe(false);
        expect(result.status).toBe('not_swedish');
        expect(result.e164Format).toBeUndefined();
        expect(result.nationalFormat).toBeUndefined();
        expect(result.errorMessage).toContain('Swedish mobile number');
      });
    });
  });

  describe('E.164 format conversion', () => {
    const testCases = [
      {
        input: '070-123 45 67',
        expectedE164: '+46701234567'
      },
      {
        input: '+46 70 123 45 67',
        expectedE164: '+46701234567'
      },
      {
        input: '0046 70 123 45 67',
        expectedE164: '+46701234567'
      },
      {
        input: '072-987 65 43',
        expectedE164: '+46729876543'
      },
      {
        input: '079-555 11 22',
        expectedE164: '+46795551122'
      }
    ];

    testCases.forEach(({ input, expectedE164 }) => {
      it(`should convert ${input} to ${expectedE164}`, () => {
        const result = validateSwedishPhone(input);
        
        expect(result.isValid).toBe(true);
        expect(result.e164Format).toBe(expectedE164);
      });
    });
  });

  describe('National format standardization', () => {
    const testCases = [
      {
        input: '070-123 45 67',
        expectedNational: '070-123 45 67'
      },
      {
        input: '0701234567',
        expectedNational: '070-123 45 67'
      },
      {
        input: '+46 70 123 45 67',
        expectedNational: '070-123 45 67'
      },
      {
        input: '070 123-45 67',
        expectedNational: '070-123 45 67'
      },
      {
        input: '072-987-65-43',
        expectedNational: '072-987 65 43'
      }
    ];

    testCases.forEach(({ input, expectedNational }) => {
      it(`should standardize ${input} to ${expectedNational}`, () => {
        const result = validateSwedishPhone(input);
        
        expect(result.isValid).toBe(true);
        expect(result.nationalFormat).toBe(expectedNational);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle null input gracefully', () => {
      const result = validateSwedishPhone(null as any);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid_format');
      expect(result.errorMessage).toContain('required');
    });

    it('should handle undefined input gracefully', () => {
      const result = validateSwedishPhone(undefined as any);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid_format');
      expect(result.errorMessage).toContain('required');
    });

    it('should handle non-string input gracefully', () => {
      const result = validateSwedishPhone(12345 as any);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid_format');
      expect(result.errorMessage).toContain('string');
    });
  });

  describe('Edge cases', () => {
    it('should handle phone numbers with excessive whitespace', () => {
      const result = validateSwedishPhone('  070-123 45 67  ');
      
      expect(result.isValid).toBe(true);
      expect(result.e164Format).toBe('+46701234567');
      expect(result.nationalFormat).toBe('070-123 45 67');
    });

    it('should handle phone numbers with various separators', () => {
      const variations = [
        '070.123.45.67',
        '070/123/45/67',
        '070_123_45_67',
        '070 123 45 67'
      ];

      variations.forEach(number => {
        const result = validateSwedishPhone(number);
        expect(result.isValid).toBe(true);
        expect(result.e164Format).toBe('+46701234567');
      });
    });
  });
});