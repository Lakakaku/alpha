import { describe, it, expect } from '@jest/globals';
import { validateAmountTolerance } from '../../src/services/validation/amount-tolerance';

describe('Amount Tolerance Validation Service', () => {
  describe('Valid amounts within tolerance (±2 SEK)', () => {
    const testCases = [
      { userAmount: 100.00, expectedAmount: 100.00, description: 'exact match' },
      { userAmount: 99.00, expectedAmount: 100.00, description: '1 SEK below' },
      { userAmount: 101.00, expectedAmount: 100.00, description: '1 SEK above' },
      { userAmount: 98.00, expectedAmount: 100.00, description: '2 SEK below (boundary)' },
      { userAmount: 102.00, expectedAmount: 100.00, description: '2 SEK above (boundary)' },
      { userAmount: 123.50, expectedAmount: 125.00, description: '1.50 SEK below' },
      { userAmount: 126.50, expectedAmount: 125.00, description: '1.50 SEK above' },
      { userAmount: 99.99, expectedAmount: 100.01, description: '0.02 SEK difference' },
    ];

    testCases.forEach(({ userAmount, expectedAmount, description }) => {
      it(`should validate ${description} as valid`, () => {
        const result = validateAmountTolerance(userAmount, expectedAmount);
        
        expect(result.isValid).toBe(true);
        expect(result.status).toBe('valid');
        expect(result.differenceSek).toBe(Math.abs(userAmount - expectedAmount));
        expect(result.toleranceRange).toMatch(/\d+\.?\d* - \d+\.?\d* SEK/);
        expect(result.errorMessage).toBeUndefined();
      });
    });
  });

  describe('Amounts outside tolerance (>2 SEK)', () => {
    const testCases = [
      { userAmount: 97.99, expectedAmount: 100.00, description: '2.01 SEK below' },
      { userAmount: 102.01, expectedAmount: 100.00, description: '2.01 SEK above' },
      { userAmount: 95.00, expectedAmount: 100.00, description: '5 SEK below' },
      { userAmount: 105.00, expectedAmount: 100.00, description: '5 SEK above' },
      { userAmount: 120.00, expectedAmount: 125.00, description: '5 SEK below expected' },
      { userAmount: 130.00, expectedAmount: 125.00, description: '5 SEK above expected' },
      { userAmount: 50.00, expectedAmount: 100.00, description: '50 SEK below' },
      { userAmount: 200.00, expectedAmount: 100.00, description: '100 SEK above' },
    ];

    testCases.forEach(({ userAmount, expectedAmount, description }) => {
      it(`should reject ${description} as out of tolerance`, () => {
        const result = validateAmountTolerance(userAmount, expectedAmount);
        
        expect(result.isValid).toBe(false);
        expect(result.status).toBe('out_of_tolerance');
        expect(result.differenceSek).toBe(Math.abs(userAmount - expectedAmount));
        expect(result.errorMessage).toContain('within 2 SEK');
      });
    });
  });

  describe('Invalid amounts', () => {
    const invalidCases = [
      { userAmount: -10.00, expectedAmount: 100.00, description: 'negative user amount' },
      { userAmount: 0, expectedAmount: 100.00, description: 'zero user amount' },
      { userAmount: 100.00, expectedAmount: -50.00, description: 'negative expected amount' },
      { userAmount: 100.00, expectedAmount: 0, description: 'zero expected amount' },
      { userAmount: -5.00, expectedAmount: -10.00, description: 'both amounts negative' },
    ];

    invalidCases.forEach(({ userAmount, expectedAmount, description }) => {
      it(`should reject ${description} as invalid`, () => {
        const result = validateAmountTolerance(userAmount, expectedAmount);
        
        expect(result.isValid).toBe(false);
        expect(result.status).toBe('invalid');
        expect(result.errorMessage).toContain('positive');
      });
    });
  });

  describe('Decimal precision handling', () => {
    it('should handle amounts with 2 decimal places correctly', () => {
      const result = validateAmountTolerance(99.99, 100.01);
      
      expect(result.isValid).toBe(true);
      expect(result.differenceSek).toBe(0.02);
    });

    it('should handle amounts with 1 decimal place correctly', () => {
      const result = validateAmountTolerance(99.5, 100.0);
      
      expect(result.isValid).toBe(true);
      expect(result.differenceSek).toBe(0.5);
    });

    it('should handle integer amounts correctly', () => {
      const result = validateAmountTolerance(99, 100);
      
      expect(result.isValid).toBe(true);
      expect(result.differenceSek).toBe(1);
    });

    it('should handle floating point precision issues', () => {
      // Test case that might cause floating point precision issues
      const result = validateAmountTolerance(100.1, 100.3);
      
      expect(result.isValid).toBe(true);
      expect(result.differenceSek).toBeCloseTo(0.2, 2);
    });

    it('should round difference to 2 decimal places', () => {
      const result = validateAmountTolerance(100.123, 100.456);
      
      expect(result.differenceSek).toBeCloseTo(0.33, 2);
    });
  });

  describe('Tolerance range calculation', () => {
    it('should provide correct tolerance range for whole numbers', () => {
      const result = validateAmountTolerance(100.00, 100.00);
      
      expect(result.toleranceRange).toBe('98.00 - 102.00 SEK');
    });

    it('should provide correct tolerance range for decimal amounts', () => {
      const result = validateAmountTolerance(125.50, 125.50);
      
      expect(result.toleranceRange).toBe('123.50 - 127.50 SEK');
    });

    it('should handle edge case where minimum would be negative', () => {
      const result = validateAmountTolerance(1.00, 1.00);
      
      expect(result.toleranceRange).toBe('0.00 - 3.00 SEK');
    });

    it('should format tolerance range with proper decimals', () => {
      const result = validateAmountTolerance(99.99, 99.99);
      
      expect(result.toleranceRange).toBe('97.99 - 101.99 SEK');
    });
  });

  describe('Large amounts', () => {
    it('should handle large amounts correctly', () => {
      const result = validateAmountTolerance(9999.99, 10000.00);
      
      expect(result.isValid).toBe(true);
      expect(result.differenceSek).toBe(0.01);
      expect(result.toleranceRange).toBe('9998.00 - 10002.00 SEK');
    });

    it('should handle maximum valid amount', () => {
      const result = validateAmountTolerance(99999.99, 99999.99);
      
      expect(result.isValid).toBe(true);
      expect(result.toleranceRange).toBe('99997.99 - 101001.99 SEK');
    });
  });

  describe('Error handling', () => {
    it('should handle null user amount gracefully', () => {
      const result = validateAmountTolerance(null as any, 100.00);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('required');
    });

    it('should handle undefined user amount gracefully', () => {
      const result = validateAmountTolerance(undefined as any, 100.00);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('required');
    });

    it('should handle null expected amount gracefully', () => {
      const result = validateAmountTolerance(100.00, null as any);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('required');
    });

    it('should handle non-numeric input gracefully', () => {
      const result = validateAmountTolerance('abc' as any, 100.00);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('number');
    });

    it('should handle NaN input gracefully', () => {
      const result = validateAmountTolerance(NaN, 100.00);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('valid number');
    });

    it('should handle Infinity input gracefully', () => {
      const result = validateAmountTolerance(Infinity, 100.00);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('finite number');
    });
  });

  describe('Edge cases', () => {
    it('should handle very small amounts correctly', () => {
      const result = validateAmountTolerance(0.01, 0.01);
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.toleranceRange).toBe('0.00 - 2.01 SEK');
    });

    it('should handle amounts with many decimal places', () => {
      const result = validateAmountTolerance(100.123456, 100.654321);
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.differenceSek).toBeCloseTo(0.53, 2);
    });

    it('should handle boundary condition at exactly 2 SEK difference', () => {
      const result = validateAmountTolerance(98.00, 100.00);
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.differenceSek).toBe(2.00);
    });

    it('should handle boundary condition at just over 2 SEK difference', () => {
      const result = validateAmountTolerance(97.99, 100.00);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('out_of_tolerance');
      expect(result.differenceSek).toBe(2.01);
    });
  });

  describe('User feedback messages', () => {
    it('should provide helpful error message for out of tolerance amounts', () => {
      const result = validateAmountTolerance(95.00, 100.00);
      
      expect(result.errorMessage).toContain('within 2 SEK');
      expect(result.errorMessage).toContain('98.00 - 102.00 SEK');
    });

    it('should provide helpful error message for negative amounts', () => {
      const result = validateAmountTolerance(-10.00, 100.00);
      
      expect(result.errorMessage).toContain('positive');
      expect(result.errorMessage).toContain('amount');
    });

    it('should provide context about the expected range', () => {
      const result = validateAmountTolerance(90.00, 100.00);
      
      expect(result.toleranceRange).toBe('98.00 - 102.00 SEK');
      expect(result.errorMessage).toContain('within 2 SEK');
    });
  });
});