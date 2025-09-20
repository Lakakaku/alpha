import { describe, test, expect, beforeEach } from '@jest/globals';
import { TransactionQueries } from '../../src/queries/transaction.js';
import { Transaction, TransactionVerificationResult } from '../../src/types/index.js';
import { dbTestClient } from '../setup.js';

describe('Tolerance Matching', () => {
  let transactionQueries: TransactionQueries;

  beforeEach(() => {
    transactionQueries = new TransactionQueries(dbTestClient);
  });

  describe('Time Tolerance Range Creation', () => {
    test('createFallbackTimeRange creates ±2 minute range', () => {
      const testTime = '2024-01-15T14:30:00.000Z';

      // Access private method for testing via type assertion
      const instance = transactionQueries as any;
      const timeRange = instance.createFallbackTimeRange(testTime);

      expect(timeRange).toMatch(/^\[.+,\s*.+\)$/);

      // Parse the range to verify it's exactly ±2 minutes
      const match = timeRange.match(/\[([^,]+),\s*([^)]+)\)/);
      expect(match).not.toBeNull();

      const startTime = new Date(match![1].trim());
      const endTime = new Date(match![2].trim());
      const customerTime = new Date(testTime);

      // Should be exactly 2 minutes before and after
      expect(startTime.getTime()).toBe(customerTime.getTime() - 2 * 60000);
      expect(endTime.getTime()).toBe(customerTime.getTime() + 2 * 60000);
    });

    test('createFallbackTimeRange handles edge cases', () => {
      const instance = transactionQueries as any;

      // Test with different time formats
      const testCases = [
        '2024-01-15T00:00:00.000Z', // Midnight
        '2024-01-15T23:59:59.999Z', // Near midnight
        '2024-12-31T23:59:59.999Z'  // End of year
      ];

      testCases.forEach(testTime => {
        const timeRange = instance.createFallbackTimeRange(testTime);
        expect(timeRange).toMatch(/^\[.+,\s*.+\)$/);

        const match = timeRange.match(/\[([^,]+),\s*([^)]+)\)/);
        const startTime = new Date(match![1].trim());
        const endTime = new Date(match![2].trim());
        const customerTime = new Date(testTime);

        expect(endTime.getTime() - startTime.getTime()).toBe(4 * 60000); // 4 minutes total
        expect(startTime.getTime()).toBeLessThan(customerTime.getTime());
        expect(endTime.getTime()).toBeGreaterThan(customerTime.getTime());
      });
    });
  });

  describe('Amount Tolerance Range Creation', () => {
    test('createFallbackAmountRange creates ±2 SEK range', () => {
      const instance = transactionQueries as any;

      const testCases = [
        { amount: 100, expected: '[98, 102]' },
        { amount: 50.5, expected: '[48.5, 52.5]' },
        { amount: 2.5, expected: '[0.5, 4.5]' },
        { amount: 1.0, expected: '[0, 3]' },
        { amount: 0.5, expected: '[0, 2.5]' }
      ];

      testCases.forEach(({ amount, expected }) => {
        const amountRange = instance.createFallbackAmountRange(amount);
        expect(amountRange).toBe(expected);
      });
    });

    test('createFallbackAmountRange prevents negative amounts', () => {
      const instance = transactionQueries as any;

      // When customer amount is less than tolerance, min should be 0
      const testCases = [
        { amount: 1.5, expectedMin: 0, expectedMax: 3.5 },
        { amount: 0.5, expectedMin: 0, expectedMax: 2.5 },
        { amount: 2.0, expectedMin: 0, expectedMax: 4.0 }
      ];

      testCases.forEach(({ amount, expectedMin, expectedMax }) => {
        const amountRange = instance.createFallbackAmountRange(amount);
        expect(amountRange).toBe(`[${expectedMin}, ${expectedMax}]`);
      });
    });
  });

  describe('Range Parsing', () => {
    test('parseTimeRange correctly parses PostgreSQL tsrange format', () => {
      const instance = transactionQueries as any;

      const testRange = '[2024-01-15T14:28:00.000Z, 2024-01-15T14:32:00.000Z)';
      const parsed = instance.parseTimeRange(testRange);

      expect(parsed.start).toEqual(new Date('2024-01-15T14:28:00.000Z'));
      expect(parsed.end).toEqual(new Date('2024-01-15T14:32:00.000Z'));
    });

    test('parseTimeRange handles various formats', () => {
      const instance = transactionQueries as any;

      const testCases = [
        '[2024-01-15T14:28:00.000Z, 2024-01-15T14:32:00.000Z)',
        '[2024-01-15T14:28:00Z, 2024-01-15T14:32:00Z)',
        '[2024-12-31T23:58:00.000Z, 2025-01-01T00:02:00.000Z)'
      ];

      testCases.forEach(timeRange => {
        expect(() => instance.parseTimeRange(timeRange)).not.toThrow();
        const parsed = instance.parseTimeRange(timeRange);
        expect(parsed.start).toBeInstanceOf(Date);
        expect(parsed.end).toBeInstanceOf(Date);
        expect(parsed.end.getTime()).toBeGreaterThan(parsed.start.getTime());
      });
    });

    test('parseTimeRange throws on invalid format', () => {
      const instance = transactionQueries as any;

      const invalidFormats = [
        'invalid',
        '[2024-01-15T14:28:00.000Z',
        '2024-01-15T14:28:00.000Z, 2024-01-15T14:32:00.000Z)',
        '[not-a-date, 2024-01-15T14:32:00.000Z)',
        ''
      ];

      invalidFormats.forEach(invalidFormat => {
        expect(() => instance.parseTimeRange(invalidFormat)).toThrow('Invalid time range format');
      });
    });

    test('parseAmountRange correctly parses PostgreSQL numrange format', () => {
      const instance = transactionQueries as any;

      const testRange = '[98, 102]';
      const parsed = instance.parseAmountRange(testRange);

      expect(parsed.min).toBe(98);
      expect(parsed.max).toBe(102);
    });

    test('parseAmountRange handles decimal values', () => {
      const instance = transactionQueries as any;

      const testCases = [
        { range: '[98.5, 102.5]', expectedMin: 98.5, expectedMax: 102.5 },
        { range: '[0, 3]', expectedMin: 0, expectedMax: 3 },
        { range: '[48.75, 52.25]', expectedMin: 48.75, expectedMax: 52.25 }
      ];

      testCases.forEach(({ range, expectedMin, expectedMax }) => {
        const parsed = instance.parseAmountRange(range);
        expect(parsed.min).toBe(expectedMin);
        expect(parsed.max).toBe(expectedMax);
      });
    });

    test('parseAmountRange throws on invalid format', () => {
      const instance = transactionQueries as any;

      const invalidFormats = [
        'invalid',
        '[98, 102',
        '98, 102]',
        '[not-a-number, 102]',
        '[98, not-a-number]',
        ''
      ];

      invalidFormats.forEach(invalidFormat => {
        expect(() => instance.parseAmountRange(invalidFormat)).toThrow('Invalid amount range format');
      });
    });
  });

  describe('Tolerance Match Checking', () => {
    test('checkToleranceMatch identifies exact matches', async () => {
      const instance = transactionQueries as any;

      const mockTransaction: Transaction = {
        id: 'test-transaction-1',
        store_id: 'test-store-1',
        customer_time_range: '[2024-01-15T14:28:00.000Z, 2024-01-15T14:32:00.000Z)',
        customer_amount_range: '[98, 102]',
        actual_amount: null,
        actual_time: null,
        verification_status: 'pending',
        is_verified: false,
        created_at: '2024-01-15T14:00:00.000Z'
      };

      // Test exact match in the middle of both ranges
      const result = await instance.checkToleranceMatch(
        mockTransaction,
        100, // Within [98, 102]
        '2024-01-15T14:30:00.000Z' // Within time range
      );

      expect(result.is_match).toBe(true);
      expect(result.confidence_score).toBe(1.0);
      expect(result.time_difference_minutes).toBeLessThan(2);
      expect(result.amount_difference_sek).toBeLessThan(2);
    });

    test('checkToleranceMatch identifies boundary matches', async () => {
      const instance = transactionQueries as any;

      const mockTransaction: Transaction = {
        id: 'test-transaction-2',
        store_id: 'test-store-1',
        customer_time_range: '[2024-01-15T14:28:00.000Z, 2024-01-15T14:32:00.000Z)',
        customer_amount_range: '[98, 102]',
        actual_amount: null,
        actual_time: null,
        verification_status: 'pending',
        is_verified: false,
        created_at: '2024-01-15T14:00:00.000Z'
      };

      // Test boundary cases that should match
      const boundaryTests = [
        { amount: 98, time: '2024-01-15T14:28:00.000Z' }, // Lower bounds
        { amount: 102, time: '2024-01-15T14:31:59.999Z' }, // Upper bounds
        { amount: 98.001, time: '2024-01-15T14:28:00.001Z' }, // Just inside bounds
        { amount: 101.999, time: '2024-01-15T14:31:59.900Z' }  // Just inside bounds
      ];

      for (const { amount, time } of boundaryTests) {
        const result = await instance.checkToleranceMatch(mockTransaction, amount, time);
        expect(result.is_match).toBe(true);
        expect(result.confidence_score).toBeGreaterThan(0.8);
      }
    });

    test('checkToleranceMatch identifies non-matches', async () => {
      const instance = transactionQueries as any;

      const mockTransaction: Transaction = {
        id: 'test-transaction-3',
        store_id: 'test-store-1',
        customer_time_range: '[2024-01-15T14:28:00.000Z, 2024-01-15T14:32:00.000Z)',
        customer_amount_range: '[98, 102]',
        actual_amount: null,
        actual_time: null,
        verification_status: 'pending',
        is_verified: false,
        created_at: '2024-01-15T14:00:00.000Z'
      };

      // Test cases that should not match
      const nonMatchTests = [
        { amount: 95, time: '2024-01-15T14:30:00.000Z', reason: 'amount too low' },
        { amount: 105, time: '2024-01-15T14:30:00.000Z', reason: 'amount too high' },
        { amount: 100, time: '2024-01-15T14:25:00.000Z', reason: 'time too early' },
        { amount: 100, time: '2024-01-15T14:35:00.000Z', reason: 'time too late' },
        { amount: 95, time: '2024-01-15T14:25:00.000Z', reason: 'both outside tolerance' }
      ];

      for (const { amount, time, reason } of nonMatchTests) {
        const result = await instance.checkToleranceMatch(mockTransaction, amount, time);
        expect(result.is_match).toBe(false);
        expect(result.confidence_score).toBeLessThan(1.0);
      }
    });

    test('checkToleranceMatch calculates confidence scores correctly', async () => {
      const instance = transactionQueries as any;

      const mockTransaction: Transaction = {
        id: 'test-transaction-4',
        store_id: 'test-store-1',
        customer_time_range: '[2024-01-15T14:28:00.000Z, 2024-01-15T14:32:00.000Z)',
        customer_amount_range: '[98, 102]',
        actual_amount: null,
        actual_time: null,
        verification_status: 'pending',
        is_verified: false,
        created_at: '2024-01-15T14:00:00.000Z'
      };

      // Test confidence scoring for near misses
      const confidenceTests = [
        {
          amount: 100,
          time: '2024-01-15T14:30:00.000Z',
          expectedConfidence: 1.0,
          description: 'perfect match'
        },
        {
          amount: 103,
          time: '2024-01-15T14:30:00.000Z',
          expectedMinConfidence: 0.4,
          expectedMaxConfidence: 0.6,
          description: 'amount slightly outside, time perfect'
        },
        {
          amount: 100,
          time: '2024-01-15T14:35:00.000Z',
          expectedMinConfidence: 0.4,
          expectedMaxConfidence: 0.6,
          description: 'time slightly outside, amount perfect'
        }
      ];

      for (const { amount, time, expectedConfidence, expectedMinConfidence, expectedMaxConfidence, description } of confidenceTests) {
        const result = await instance.checkToleranceMatch(mockTransaction, amount, time);

        if (expectedConfidence !== undefined) {
          expect(result.confidence_score).toBe(expectedConfidence);
        } else {
          expect(result.confidence_score).toBeGreaterThanOrEqual(expectedMinConfidence!);
          expect(result.confidence_score).toBeLessThanOrEqual(expectedMaxConfidence!);
        }
      }
    });

    test('checkToleranceMatch calculates time differences correctly', async () => {
      const instance = transactionQueries as any;

      const mockTransaction: Transaction = {
        id: 'test-transaction-5',
        store_id: 'test-store-1',
        customer_time_range: '[2024-01-15T14:28:00.000Z, 2024-01-15T14:32:00.000Z)',
        customer_amount_range: '[98, 102]',
        actual_amount: null,
        actual_time: null,
        verification_status: 'pending',
        is_verified: false,
        created_at: '2024-01-15T14:00:00.000Z'
      };

      // Test time difference calculations
      const timeDifferenceTests = [
        {
          actualTime: '2024-01-15T14:30:00.000Z', // Exact middle
          expectedTimeDiff: 2.0 // 2 minutes from either boundary
        },
        {
          actualTime: '2024-01-15T14:28:00.000Z', // Start boundary
          expectedTimeDiff: 0.0
        },
        {
          actualTime: '2024-01-15T14:26:00.000Z', // 2 minutes before start
          expectedTimeDiff: 2.0
        },
        {
          actualTime: '2024-01-15T14:34:00.000Z', // 2 minutes after end
          expectedTimeDiff: 2.0
        }
      ];

      for (const { actualTime, expectedTimeDiff } of timeDifferenceTests) {
        const result = await instance.checkToleranceMatch(mockTransaction, 100, actualTime);
        expect(Math.abs(result.time_difference_minutes - expectedTimeDiff)).toBeLessThan(0.1);
      }
    });

    test('checkToleranceMatch calculates amount differences correctly', async () => {
      const instance = transactionQueries as any;

      const mockTransaction: Transaction = {
        id: 'test-transaction-6',
        store_id: 'test-store-1',
        customer_time_range: '[2024-01-15T14:28:00.000Z, 2024-01-15T14:32:00.000Z)',
        customer_amount_range: '[98, 102]',
        actual_amount: null,
        actual_time: null,
        verification_status: 'pending',
        is_verified: false,
        created_at: '2024-01-15T14:00:00.000Z'
      };

      // Test amount difference calculations
      const amountDifferenceTests = [
        {
          actualAmount: 100, // Exact middle
          expectedAmountDiff: 2.0 // 2 SEK from either boundary
        },
        {
          actualAmount: 98, // Lower boundary
          expectedAmountDiff: 0.0
        },
        {
          actualAmount: 102, // Upper boundary
          expectedAmountDiff: 0.0
        },
        {
          actualAmount: 95, // 3 SEK below lower boundary
          expectedAmountDiff: 3.0
        },
        {
          actualAmount: 105, // 3 SEK above upper boundary
          expectedAmountDiff: 3.0
        }
      ];

      for (const { actualAmount, expectedAmountDiff } of amountDifferenceTests) {
        const result = await instance.checkToleranceMatch(mockTransaction, actualAmount, '2024-01-15T14:30:00.000Z');
        expect(Math.abs(result.amount_difference_sek - expectedAmountDiff)).toBeLessThan(0.1);
      }
    });
  });

  describe('Integration with Transaction Verification', () => {
    test('tolerance constants match specification', () => {
      const instance = transactionQueries as any;

      // Test that our tolerance constants match the ±2 minute, ±2 SEK specification
      const testTime = '2024-01-15T14:30:00.000Z';
      const testAmount = 100;

      const timeRange = instance.createFallbackTimeRange(testTime);
      const amountRange = instance.createFallbackAmountRange(testAmount);

      // Parse and verify the ranges
      const parsedTimeRange = instance.parseTimeRange(timeRange);
      const parsedAmountRange = instance.parseAmountRange(amountRange);

      const customerTime = new Date(testTime);
      const timeDiffMinutes = (parsedTimeRange.end.getTime() - parsedTimeRange.start.getTime()) / (1000 * 60);
      const amountDiffSEK = parsedAmountRange.max - parsedAmountRange.min;

      expect(timeDiffMinutes).toBe(4); // ±2 minutes = 4 minutes total range
      expect(amountDiffSEK).toBe(4); // ±2 SEK = 4 SEK total range

      // Verify the center points
      const centerTime = new Date((parsedTimeRange.start.getTime() + parsedTimeRange.end.getTime()) / 2);
      const centerAmount = (parsedAmountRange.min + parsedAmountRange.max) / 2;

      expect(Math.abs(centerTime.getTime() - customerTime.getTime())).toBeLessThan(1000); // Within 1 second
      expect(centerAmount).toBe(testAmount);
    });

    test('tolerance matching supports edge cases from real transactions', () => {
      const instance = transactionQueries as any;

      // Test cases based on real-world scenarios
      const edgeCases = [
        {
          description: 'transaction at midnight crossing day boundary',
          customerTime: '2024-01-15T23:59:00.000Z',
          customerAmount: 25.50,
          actualTime: '2024-01-16T00:01:00.000Z',
          actualAmount: 25.50,
          shouldMatch: true
        },
        {
          description: 'small amount transaction',
          customerTime: '2024-01-15T14:30:00.000Z',
          customerAmount: 1.00,
          actualTime: '2024-01-15T14:31:00.000Z',
          actualAmount: 1.00,
          shouldMatch: true
        },
        {
          description: 'large amount transaction',
          customerTime: '2024-01-15T14:30:00.000Z',
          customerAmount: 999.99,
          actualTime: '2024-01-15T14:31:00.000Z',
          actualAmount: 999.99,
          shouldMatch: true
        }
      ];

      edgeCases.forEach(async ({ description, customerTime, customerAmount, actualTime, actualAmount, shouldMatch }) => {
        const timeRange = instance.createFallbackTimeRange(customerTime);
        const amountRange = instance.createFallbackAmountRange(customerAmount);

        const mockTransaction: Transaction = {
          id: `test-${description.replace(/\s+/g, '-')}`,
          store_id: 'test-store-1',
          customer_time_range: timeRange,
          customer_amount_range: amountRange,
          actual_amount: null,
          actual_time: null,
          verification_status: 'pending',
          is_verified: false,
          created_at: customerTime
        };

        const result = await instance.checkToleranceMatch(mockTransaction, actualAmount, actualTime);
        expect(result.is_match).toBe(shouldMatch);
      });
    });
  });
});