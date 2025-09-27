import type { 
  CustomerVerification, 
  ValidationStatus,
  PhoneValidationStatus
} from '@vocilia/types';

/**
 * CustomerVerification model for database operations
 * Represents a customer's transaction verification submission
 */
export class CustomerVerificationModel {
  public readonly id: string;
  public readonly session_id: string;
  public readonly transaction_time: string; // Time format (HH:MM)
  public readonly transaction_amount: number;
  public readonly phone_number_e164: string;
  public readonly phone_number_national: string;
  public readonly time_validation_status: ValidationStatus;
  public readonly amount_validation_status: ValidationStatus;
  public readonly phone_validation_status: PhoneValidationStatus;
  public readonly tolerance_check_time_diff: number | null;
  public readonly tolerance_check_amount_diff: number | null;
  public readonly submitted_at: Date;
  public verified_at: Date | null;

  constructor(data: CustomerVerification) {
    this.id = data.id;
    this.session_id = data.session_id;
    this.transaction_time = data.transaction_time;
    this.transaction_amount = data.transaction_amount;
    this.phone_number_e164 = data.phone_number_e164;
    this.phone_number_national = data.phone_number_national;
    this.time_validation_status = data.time_validation_status;
    this.amount_validation_status = data.amount_validation_status;
    this.phone_validation_status = data.phone_validation_status;
    this.tolerance_check_time_diff = data.tolerance_check_time_diff;
    this.tolerance_check_amount_diff = data.tolerance_check_amount_diff;
    this.submitted_at = new Date(data.submitted_at);
    this.verified_at = data.verified_at ? new Date(data.verified_at) : null;
  }

  /**
   * Check if verification is valid (all validations passed)
   */
  public isValid(): boolean {
    return (
      this.time_validation_status === 'valid' &&
      this.amount_validation_status === 'valid' &&
      this.phone_validation_status === 'valid'
    );
  }

  /**
   * Check if verification is completed successfully
   */
  public isCompleted(): boolean {
    return this.verified_at !== null && this.isValid();
  }

  /**
   * Check if verification failed
   */
  public isFailed(): boolean {
    return !this.isValid();
  }

  /**
   * Get validation summary
   */
  public getValidationSummary(): {
    timeValid: boolean;
    amountValid: boolean;
    phoneValid: boolean;
    overallValid: boolean;
  } {
    return {
      timeValid: this.time_validation_status === 'valid',
      amountValid: this.amount_validation_status === 'valid',
      phoneValid: this.phone_validation_status === 'valid',
      overallValid: this.isValid()
    };
  }

  /**
   * Get formatted phone number (E.164 format)
   */
  public getFormattedPhoneNumber(): string {
    return this.phone_number_e164;
  }

  /**
   * Get time difference in minutes from validation
   */
  public getTimeDifferenceMinutes(): number | null {
    return this.tolerance_check_time_diff;
  }

  /**
   * Get amount difference in SEK from validation
   */
  public getAmountDifferenceSEK(): number | null {
    return this.tolerance_check_amount_diff;
  }

  /**
   * Mark as verified by business
   */
  public markAsVerified(): void {
    this.verified_at = new Date();
  }

  /**
   * Check if within time tolerance (±2 minutes)
   */
  public isWithinTimeTolerance(): boolean {
    return this.time_validation_status === 'valid';
  }

  /**
   * Check if within amount tolerance (±2 SEK)
   */
  public isWithinAmountTolerance(): boolean {
    return this.amount_validation_status === 'valid';
  }

  /**
   * Check if phone number is valid Swedish mobile
   */
  public hasValidSwedishPhone(): boolean {
    return this.phone_validation_status === 'valid';
  }

  /**
   * Convert to plain object for database operations
   */
  public toObject(): CustomerVerification {
    return {
      id: this.id,
      session_id: this.session_id,
      transaction_time: this.transaction_time,
      transaction_amount: this.transaction_amount,
      phone_number_e164: this.phone_number_e164,
      phone_number_national: this.phone_number_national,
      time_validation_status: this.time_validation_status,
      amount_validation_status: this.amount_validation_status,
      phone_validation_status: this.phone_validation_status,
      tolerance_check_time_diff: this.tolerance_check_time_diff,
      tolerance_check_amount_diff: this.tolerance_check_amount_diff,
      submitted_at: this.submitted_at.toISOString(),
      verified_at: this.verified_at?.toISOString() || null
    };
  }

  /**
   * Create from database row
   */
  public static fromDatabaseRow(row: any): CustomerVerificationModel {
    return new CustomerVerificationModel({
      id: row.id,
      session_id: row.session_id,
      transaction_time: row.transaction_time,
      transaction_amount: parseFloat(row.transaction_amount),
      phone_number_e164: row.phone_number_e164,
      phone_number_national: row.phone_number_national,
      time_validation_status: row.time_validation_status,
      amount_validation_status: row.amount_validation_status,
      phone_validation_status: row.phone_validation_status,
      tolerance_check_time_diff: row.tolerance_check_time_diff,
      tolerance_check_amount_diff: row.tolerance_check_amount_diff ? parseFloat(row.tolerance_check_amount_diff) : null,
      submitted_at: row.submitted_at,
      verified_at: row.verified_at
    });
  }

  /**
   * Create new verification with validation results
   */
  public static createNew(
    sessionId: string,
    transactionTime: string,
    transactionAmount: number,
    phoneNumberE164: string,
    phoneNumberNational: string,
    timeValidationStatus: ValidationStatus,
    amountValidationStatus: ValidationStatus,
    phoneValidationStatus: PhoneValidationStatus,
    timeDiff: number | null = null,
    amountDiff: number | null = null
  ): CustomerVerificationModel {
    return new CustomerVerificationModel({
      id: '', // Will be generated by database
      session_id: sessionId,
      transaction_time: transactionTime,
      transaction_amount: transactionAmount,
      phone_number_e164: phoneNumberE164,
      phone_number_national: phoneNumberNational,
      time_validation_status: timeValidationStatus,
      amount_validation_status: amountValidationStatus,
      phone_validation_status: phoneValidationStatus,
      tolerance_check_time_diff: timeDiff,
      tolerance_check_amount_diff: amountDiff,
      submitted_at: new Date().toISOString(),
      verified_at: null
    });
  }

  /**
   * Create verification for database insertion (without ID)
   */
  public toInsertObject(): Omit<CustomerVerification, 'id'> {
    return {
      session_id: this.session_id,
      transaction_time: this.transaction_time,
      transaction_amount: this.transaction_amount,
      phone_number_e164: this.phone_number_e164,
      phone_number_national: this.phone_number_national,
      time_validation_status: this.time_validation_status,
      amount_validation_status: this.amount_validation_status,
      phone_validation_status: this.phone_validation_status,
      tolerance_check_time_diff: this.tolerance_check_time_diff,
      tolerance_check_amount_diff: this.tolerance_check_amount_diff,
      submitted_at: this.submitted_at.toISOString(),
      verified_at: this.verified_at?.toISOString() || null
    };
  }
}