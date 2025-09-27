// Using standard Jest globals
import { TimeToleranceValidatorService } from '../../src/services/validation/time-tolerance-validator';

const { validateCurrentTimeTolerance } = TimeToleranceValidatorService;

describe('Time Tolerance Validation Service', () => {
  beforeEach(() => {
    // Reset any mocked timers
    jest.useRealTimers();
  });

  describe('Valid time within tolerance (±2 minutes)', () => {
    it('should validate current time as valid', () => {
      const now = new Date();
      
      const result = validateCurrentTimeTolerance(now);
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('within_tolerance');
      expect(Math.abs(result.timeDifferenceSeconds || 0)).toBeLessThanOrEqual(1);
      expect(result.errorMessage).toBeUndefined();
    });

    it('should validate time 1 minute ago as valid', () => {
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
      const timeString = oneMinuteAgo.toTimeString().substring(0, 5);
      
      const result = validateTimeTolerance(timeString);
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.differenceMinutes).toBe(1);
    });

    it('should validate time 2 minutes ago as valid', () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const timeString = twoMinutesAgo.toTimeString().substring(0, 5);
      
      const result = validateTimeTolerance(timeString);
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.differenceMinutes).toBe(2);
    });

    it('should validate time 1 minute in future as valid', () => {
      const oneMinuteAhead = new Date(Date.now() + 1 * 60 * 1000);
      const timeString = oneMinuteAhead.toTimeString().substring(0, 5);
      
      const result = validateTimeTolerance(timeString);
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.differenceMinutes).toBe(1);
    });

    it('should validate time 2 minutes in future as valid', () => {
      const twoMinutesAhead = new Date(Date.now() + 2 * 60 * 1000);
      const timeString = twoMinutesAhead.toTimeString().substring(0, 5);
      
      const result = validateTimeTolerance(timeString);
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.differenceMinutes).toBe(2);
    });
  });

  describe('Time outside tolerance (>2 minutes)', () => {
    it('should reject time 3 minutes ago as out of tolerance', () => {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      const timeString = threeMinutesAgo.toTimeString().substring(0, 5);
      
      const result = validateTimeTolerance(timeString);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('out_of_tolerance');
      expect(result.differenceMinutes).toBe(3);
      expect(result.errorMessage).toContain('within 2 minutes');
    });

    it('should reject time 5 minutes ago as out of tolerance', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const timeString = fiveMinutesAgo.toTimeString().substring(0, 5);
      
      const result = validateTimeTolerance(timeString);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('out_of_tolerance');
      expect(result.differenceMinutes).toBe(5);
    });

    it('should reject time 3 minutes in future as out of tolerance', () => {
      const threeMinutesAhead = new Date(Date.now() + 3 * 60 * 1000);
      const timeString = threeMinutesAhead.toTimeString().substring(0, 5);
      
      const result = validateTimeTolerance(timeString);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('out_of_tolerance');
      expect(result.differenceMinutes).toBe(3);
    });

    it('should reject time 30 minutes ago as out of tolerance', () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const timeString = thirtyMinutesAgo.toTimeString().substring(0, 5);
      
      const result = validateTimeTolerance(timeString);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('out_of_tolerance');
      expect(result.differenceMinutes).toBe(30);
    });
  });

  describe('Invalid time formats', () => {
    const invalidFormats = [
      'invalid-time',
      '25:30',        // Invalid hour
      '12:70',        // Invalid minute
      '12:30:45',     // Includes seconds
      '12',           // Missing minutes
      '12:',          // Incomplete
      ':30',          // Missing hour
      '12.30',        // Wrong separator
      '12-30',        // Wrong separator
      '',             // Empty string
      ' ',            // Whitespace only
      'noon',         // Text
      '12:30 PM',     // 12-hour format
    ];

    invalidFormats.forEach(timeString => {
      it(`should reject invalid format: "${timeString}"`, () => {
        const result = validateTimeTolerance(timeString);
        
        expect(result.isValid).toBe(false);
        expect(result.status).toBe('invalid');
        expect(result.differenceMinutes).toBeUndefined();
        expect(result.errorMessage).toContain('valid time format');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle midnight crossing correctly', () => {
      // Mock time to be 23:59
      const mockNow = new Date();
      mockNow.setHours(23, 59, 0, 0);
      jest.useFakeTimers();
      jest.setSystemTime(mockNow);

      // Test time at 00:01 (2 minutes later)
      const result = validateTimeTolerance('00:01');
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.differenceMinutes).toBe(2);

      jest.useRealTimers();
    });

    it('should handle noon transition correctly', () => {
      // Mock time to be 11:59
      const mockNow = new Date();
      mockNow.setHours(11, 59, 0, 0);
      jest.useFakeTimers();
      jest.setSystemTime(mockNow);

      // Test time at 12:01 (2 minutes later)
      const result = validateTimeTolerance('12:01');
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.differenceMinutes).toBe(2);

      jest.useRealTimers();
    });

    it('should handle daylight saving time transition gracefully', () => {
      // This is a complex edge case - the service should handle it but
      // for now we just test that it doesn't crash
      const result = validateTimeTolerance('14:30');
      
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('differenceMinutes');
    });
  });

  describe('Tolerance range calculation', () => {
    it('should provide correct tolerance range for current time', () => {
      const now = new Date();
      const currentTimeString = now.toTimeString().substring(0, 5);
      
      const result = validateTimeTolerance(currentTimeString);
      
      expect(result.toleranceRange).toBeDefined();
      expect(result.toleranceRange).toMatch(/^\d{2}:\d{2} - \d{2}:\d{2}$/);

      // Parse the range and verify it's correct
      const [startTime, endTime] = result.toleranceRange!.split(' - ');
      const startMinutes = timeStringToMinutes(startTime);
      const endMinutes = timeStringToMinutes(endTime);
      const currentMinutes = timeStringToMinutes(currentTimeString);

      // Handle day crossing
      if (endMinutes < startMinutes) {
        // Range crosses midnight
        expect(currentMinutes >= startMinutes || currentMinutes <= endMinutes).toBe(true);
      } else {
        expect(currentMinutes).toBeGreaterThanOrEqual(startMinutes);
        expect(currentMinutes).toBeLessThanOrEqual(endMinutes);
      }
    });
  });

  describe('Error handling', () => {
    it('should handle null input gracefully', () => {
      const result = validateTimeTolerance(null as any);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('required');
    });

    it('should handle undefined input gracefully', () => {
      const result = validateTimeTolerance(undefined as any);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('required');
    });

    it('should handle non-string input gracefully', () => {
      const result = validateTimeTolerance(1430 as any);
      
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.errorMessage).toContain('string');
    });
  });

  describe('Whitespace handling', () => {
    it('should handle time with leading/trailing whitespace', () => {
      const now = new Date();
      const currentTimeString = '  ' + now.toTimeString().substring(0, 5) + '  ';
      
      const result = validateTimeTolerance(currentTimeString);
      
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('valid');
    });
  });
});

// Helper function to convert HH:MM to total minutes
function timeStringToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}