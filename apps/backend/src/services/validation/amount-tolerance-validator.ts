export interface AmountToleranceValidationResult {
  isValid: boolean;
  status: 'within_tolerance' | 'too_low' | 'too_high' | 'invalid_format';
  amountDifference?: number;
  actualAmount?: number;
  expectedAmount?: number;
  toleranceRange?: {
    minimum: number;
    maximum: number;
  };
  errorMessage?: string;
}

export class AmountToleranceValidatorService {
  private static readonly TOLERANCE_SEK = 2.00;
  private static readonly MIN_AMOUNT = 0.01; // Minimum 1 öre
  private static readonly MAX_AMOUNT = 999999.99; // Reasonable max amount

  /**
   * Validates if the actual amount is within ±2 SEK of expected amount
   * @param actualAmountInput Actual amount (number or string)
   * @param expectedAmountInput Expected amount (number or string)
   * @returns Validation result with tolerance details
   */
  public static validateAmountTolerance(
    actualAmountInput: number | string,
    expectedAmountInput: number | string
  ): AmountToleranceValidationResult {
    try {
      // Parse actual amount
      const actualAmount = this.parseAmount(actualAmountInput);
      if (actualAmount === null) {
        return {
          isValid: false,
          status: 'invalid_format',
          errorMessage: 'Invalid actual amount format'
        };
      }

      // Parse expected amount
      const expectedAmount = this.parseAmount(expectedAmountInput);
      if (expectedAmount === null) {
        return {
          isValid: false,
          status: 'invalid_format',
          errorMessage: 'Invalid expected amount format'
        };
      }

      // Validate amount ranges
      if (actualAmount < this.MIN_AMOUNT) {
        return {
          isValid: false,
          status: 'invalid_format',
          errorMessage: `Amount cannot be less than ${this.MIN_AMOUNT} SEK`
        };
      }

      if (actualAmount > this.MAX_AMOUNT || expectedAmount > this.MAX_AMOUNT) {
        return {
          isValid: false,
          status: 'invalid_format',
          errorMessage: `Amount cannot exceed ${this.MAX_AMOUNT} SEK`
        };
      }

      // Calculate difference
      const amountDifference = actualAmount - expectedAmount;
      const absoluteDifference = Math.abs(amountDifference);

      // Calculate tolerance range
      const toleranceRange = {
        minimum: Math.max(expectedAmount - this.TOLERANCE_SEK, this.MIN_AMOUNT),
        maximum: expectedAmount + this.TOLERANCE_SEK
      };

      // Check if within tolerance
      if (absoluteDifference <= this.TOLERANCE_SEK) {
        return {
          isValid: true,
          status: 'within_tolerance',
          amountDifference: Number(amountDifference.toFixed(2)),
          actualAmount: Number(actualAmount.toFixed(2)),
          expectedAmount: Number(expectedAmount.toFixed(2)),
          toleranceRange: {
            minimum: Number(toleranceRange.minimum.toFixed(2)),
            maximum: Number(toleranceRange.maximum.toFixed(2))
          }
        };
      }

      // Determine if too low or too high
      const status = amountDifference < 0 ? 'too_low' : 'too_high';
      const errorMessage = status === 'too_low'
        ? `Amount is ${absoluteDifference.toFixed(2)} SEK too low (tolerance: ±${this.TOLERANCE_SEK} SEK)`
        : `Amount is ${absoluteDifference.toFixed(2)} SEK too high (tolerance: ±${this.TOLERANCE_SEK} SEK)`;

      return {
        isValid: false,
        status,
        amountDifference: Number(amountDifference.toFixed(2)),
        actualAmount: Number(actualAmount.toFixed(2)),
        expectedAmount: Number(expectedAmount.toFixed(2)),
        toleranceRange: {
          minimum: Number(toleranceRange.minimum.toFixed(2)),
          maximum: Number(toleranceRange.maximum.toFixed(2))
        },
        errorMessage
      };

    } catch (error) {
      return {
        isValid: false,
        status: 'invalid_format',
        errorMessage: error instanceof Error ? error.message : 'Unknown amount validation error'
      };
    }
  }

  /**
   * Validates multiple amounts against expected amount
   * @param actualAmounts Array of amounts to validate
   * @param expectedAmount Expected amount for comparison
   * @returns Array of validation results
   */
  public static validateMultipleAmounts(
    actualAmounts: (number | string)[],
    expectedAmount: number | string
  ): AmountToleranceValidationResult[] {
    return actualAmounts.map(amount => this.validateAmountTolerance(amount, expectedAmount));
  }

  /**
   * Checks if an amount is within the tolerance range
   * @param actualAmount Amount to check
   * @param expectedAmount Expected amount
   * @returns true if within tolerance
   */
  public static isAmountWithinTolerance(
    actualAmount: number | string,
    expectedAmount: number | string
  ): boolean {
    return this.validateAmountTolerance(actualAmount, expectedAmount).isValid;
  }

  /**
   * Gets the tolerance range for a given expected amount
   * @param expectedAmountInput Expected amount
   * @returns Object with minimum and maximum acceptable amounts
   */
  public static getToleranceRange(expectedAmountInput: number | string): {
    minimum: number;
    maximum: number;
    expectedAmount: number;
  } | null {
    const expectedAmount = this.parseAmount(expectedAmountInput);
    if (expectedAmount === null) return null;

    return {
      minimum: Number(Math.max(expectedAmount - this.TOLERANCE_SEK, this.MIN_AMOUNT).toFixed(2)),
      maximum: Number((expectedAmount + this.TOLERANCE_SEK).toFixed(2)),
      expectedAmount: Number(expectedAmount.toFixed(2))
    };
  }

  /**
   * Converts amount to öre (smallest Swedish currency unit)
   * @param amount Amount in SEK
   * @returns Amount in öre (integer)
   */
  public static toOre(amount: number | string): number | null {
    const parsedAmount = this.parseAmount(amount);
    if (parsedAmount === null) return null;
    return Math.round(parsedAmount * 100);
  }

  /**
   * Converts öre to SEK
   * @param ore Amount in öre
   * @returns Amount in SEK
   */
  public static fromOre(ore: number): number {
    return Number((ore / 100).toFixed(2));
  }

  /**
   * Formats amount for Swedish currency display
   * @param amount Amount to format
   * @param includeCurrency Whether to include "SEK" suffix
   * @returns Formatted string
   */
  public static formatSwedishAmount(amount: number | string, includeCurrency = false): string | null {
    const parsedAmount = this.parseAmount(amount);
    if (parsedAmount === null) return null;

    const formatted = parsedAmount.toFixed(2).replace('.', ',');
    return includeCurrency ? `${formatted} SEK` : formatted;
  }

  /**
   * Parse various amount input formats into number
   * @param amountInput Amount in various formats
   * @returns Number or null if invalid
   */
  private static parseAmount(amountInput: number | string): number | null {
    if (typeof amountInput === 'number') {
      return isNaN(amountInput) || !isFinite(amountInput) ? null : amountInput;
    }

    if (typeof amountInput === 'string') {
      // Clean the input: remove whitespace, currency symbols, and normalize decimal separator
      let cleaned = amountInput.trim()
        .replace(/\s/g, '')
        .replace(/SEK/gi, '')
        .replace(/kr/gi, '')
        .replace(/,/g, '.'); // Convert Swedish decimal comma to period

      // Remove any non-numeric characters except decimal point
      cleaned = cleaned.replace(/[^\d.-]/g, '');

      if (cleaned === '' || cleaned === '.') return null;

      const parsed = parseFloat(cleaned);
      return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
    }

    return null;
  }

  /**
   * Get the current tolerance configuration
   * @returns Tolerance settings
   */
  public static getToleranceConfig(): {
    toleranceSEK: number;
    minAmount: number;
    maxAmount: number;
  } {
    return {
      toleranceSEK: this.TOLERANCE_SEK,
      minAmount: this.MIN_AMOUNT,
      maxAmount: this.MAX_AMOUNT
    };
  }

  /**
   * Validates that an amount is a valid Swedish currency value
   * @param amount Amount to validate
   * @returns true if valid currency format
   */
  public static isValidSwedishAmount(amount: number | string): boolean {
    const parsed = this.parseAmount(amount);
    if (parsed === null) return false;
    
    return parsed >= this.MIN_AMOUNT && 
           parsed <= this.MAX_AMOUNT && 
           parsed === Number(parsed.toFixed(2)); // Check for at most 2 decimal places
  }
}