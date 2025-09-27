export interface TimeToleranceValidationResult {
  isValid: boolean;
  status: 'within_tolerance' | 'too_early' | 'too_late' | 'invalid_format';
  timeDifferenceSeconds?: number;
  actualTime?: Date;
  expectedTime?: Date;
  errorMessage?: string;
}

export class TimeToleranceValidatorService {
  private static readonly TOLERANCE_MINUTES = 2;
  private static readonly TOLERANCE_SECONDS = TimeToleranceValidatorService.TOLERANCE_MINUTES * 60;

  /**
   * Validates if the actual time is within ±2 minutes of expected time
   * @param actualTimeInput Actual timestamp (Date, number, or ISO string)
   * @param expectedTimeInput Expected timestamp (Date, number, or ISO string), defaults to current time
   * @returns Validation result with tolerance details
   */
  public static validateTimeTolerance(
    actualTimeInput: Date | number | string,
    expectedTimeInput?: Date | number | string
  ): TimeToleranceValidationResult {
    try {
      // Parse actual time
      const actualTime = this.parseTime(actualTimeInput);
      if (!actualTime) {
        return {
          isValid: false,
          status: 'invalid_format',
          errorMessage: 'Invalid actual time format'
        };
      }

      // Parse expected time (default to current time)
      const expectedTime = expectedTimeInput ? this.parseTime(expectedTimeInput) : new Date();
      if (!expectedTime) {
        return {
          isValid: false,
          status: 'invalid_format',
          errorMessage: 'Invalid expected time format'
        };
      }

      // Calculate difference in seconds
      const timeDifferenceMs = actualTime.getTime() - expectedTime.getTime();
      const timeDifferenceSeconds = Math.round(timeDifferenceMs / 1000);
      const absoluteDifferenceSeconds = Math.abs(timeDifferenceSeconds);

      // Check if within tolerance
      if (absoluteDifferenceSeconds <= this.TOLERANCE_SECONDS) {
        return {
          isValid: true,
          status: 'within_tolerance',
          timeDifferenceSeconds,
          actualTime,
          expectedTime
        };
      }

      // Determine if too early or too late
      const status = timeDifferenceSeconds < 0 ? 'too_early' : 'too_late';
      const errorMessage = status === 'too_early' 
        ? `Time is ${absoluteDifferenceSeconds} seconds too early (limit: ${this.TOLERANCE_SECONDS}s)`
        : `Time is ${absoluteDifferenceSeconds} seconds too late (limit: ${this.TOLERANCE_SECONDS}s)`;

      return {
        isValid: false,
        status,
        timeDifferenceSeconds,
        actualTime,
        expectedTime,
        errorMessage
      };

    } catch (error) {
      return {
        isValid: false,
        status: 'invalid_format',
        errorMessage: error instanceof Error ? error.message : 'Unknown time validation error'
      };
    }
  }

  /**
   * Validates if the current time is within tolerance of expected time
   * @param expectedTimeInput Expected timestamp (Date, number, or ISO string)
   * @returns Validation result
   */
  public static validateCurrentTimeTolerance(
    expectedTimeInput: Date | number | string
  ): TimeToleranceValidationResult {
    return this.validateTimeTolerance(new Date(), expectedTimeInput);
  }

  /**
   * Checks if a time is within the tolerance window from now
   * @param timeInput Time to check
   * @returns true if within tolerance
   */
  public static isTimeWithinTolerance(timeInput: Date | number | string): boolean {
    return this.validateCurrentTimeTolerance(timeInput).isValid;
  }

  /**
   * Gets the tolerance window boundaries for a given expected time
   * @param expectedTimeInput Expected time
   * @returns Object with earliest and latest acceptable times
   */
  public static getToleranceWindow(expectedTimeInput: Date | number | string): {
    earliestAcceptable: Date;
    latestAcceptable: Date;
    expectedTime: Date;
  } | null {
    const expectedTime = this.parseTime(expectedTimeInput);
    if (!expectedTime) return null;

    const toleranceMs = this.TOLERANCE_SECONDS * 1000;
    
    return {
      earliestAcceptable: new Date(expectedTime.getTime() - toleranceMs),
      latestAcceptable: new Date(expectedTime.getTime() + toleranceMs),
      expectedTime
    };
  }

  /**
   * Validates multiple times against expected time
   * @param actualTimes Array of times to validate
   * @param expectedTime Expected time for comparison
   * @returns Array of validation results
   */
  public static validateMultipleTimes(
    actualTimes: (Date | number | string)[],
    expectedTime: Date | number | string
  ): TimeToleranceValidationResult[] {
    return actualTimes.map(time => this.validateTimeTolerance(time, expectedTime));
  }

  /**
   * Parse various time input formats into Date object
   * @param timeInput Time in various formats
   * @returns Date object or null if invalid
   */
  private static parseTime(timeInput: Date | number | string): Date | null {
    if (timeInput instanceof Date) {
      return isNaN(timeInput.getTime()) ? null : timeInput;
    }

    if (typeof timeInput === 'number') {
      // Handle both milliseconds and seconds timestamps
      const date = timeInput > 1e12 ? new Date(timeInput) : new Date(timeInput * 1000);
      return isNaN(date.getTime()) ? null : date;
    }

    if (typeof timeInput === 'string') {
      // Try parsing as ISO string
      const date = new Date(timeInput);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  /**
   * Get the current tolerance configuration
   * @returns Tolerance settings
   */
  public static getToleranceConfig(): {
    toleranceMinutes: number;
    toleranceSeconds: number;
  } {
    return {
      toleranceMinutes: this.TOLERANCE_MINUTES,
      toleranceSeconds: this.TOLERANCE_SECONDS
    };
  }
}