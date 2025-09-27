import { QRDatabase } from '../../config/qr-database';
import { CustomerVerificationModel } from '../../models/customer-verification.model';
import { VerificationValidator } from '../validation-scoring';
import { DatabaseValidator } from '../../utils/database-validation';
import type { 
  CustomerVerification, 
  VerificationSubmissionRequest,
  VerificationStatus,
  ValidationResults
} from '@vocilia/types';

/**
 * Customer Verification Service
 * Handles customer transaction verification submissions and processing
 */
export class CustomerVerificationService {
  private database: QRDatabase;
  private validator: VerificationValidator;

  constructor(database?: QRDatabase, validator?: VerificationValidator) {
    this.database = database || new QRDatabase();
    this.validator = validator || new VerificationValidator();
  }

  /**
   * Submit a customer verification with validation
   */
  async submitVerification(
    sessionToken: string,
    submission: VerificationSubmissionRequest,
    expectedAmount: number
  ): Promise<CustomerVerification> {
    // Validate session token format
    if (!DatabaseValidator.validateSessionToken(sessionToken)) {
      throw new Error('Invalid session token format');
    }

    // Validate submission data
    this.validateSubmissionData(submission);

    // Perform comprehensive validation
    const validationResults = this.validator.validateSubmission(submission, expectedAmount);

    // Create verification model
    const verificationModel = CustomerVerificationModel.createNew(
      sessionToken,
      submission.transaction_time,
      submission.transaction_amount,
      submission.phone_number,
      validationResults
    );

    // Save to database
    const savedVerification = await this.database.createCustomerVerification(
      verificationModel.toCreateObject()
    );

    return savedVerification;
  }

  /**
   * Get verification by session token
   */
  async getVerification(sessionToken: string): Promise<CustomerVerification | null> {
    if (!DatabaseValidator.validateSessionToken(sessionToken)) {
      return null;
    }

    return await this.database.getCustomerVerification(sessionToken);
  }

  /**
   * Get verification by verification ID
   */
  async getVerificationById(verificationId: string): Promise<CustomerVerification | null> {
    if (!verificationId || !verificationId.match(/^[0-9a-f-]+$/)) {
      return null;
    }

    return await this.database.getCustomerVerificationById(verificationId);
  }

  /**
   * Update verification status
   */
  async updateVerificationStatus(
    verificationId: string, 
    status: VerificationStatus
  ): Promise<boolean> {
    if (!verificationId) {
      throw new Error('Verification ID is required');
    }

    return await this.database.updateVerificationStatus(verificationId, status);
  }

  /**
   * List verifications for a store
   */
  async listVerifications(
    storeId: string, 
    limit: number = 100
  ): Promise<CustomerVerification[]> {
    if (!DatabaseValidator.validateStoreId(storeId)) {
      throw new Error('Invalid store ID format');
    }

    return await this.database.getVerificationsByStore(storeId, limit);
  }

  /**
   * Get verification summary for a session
   */
  async getVerificationSummary(sessionToken: string): Promise<{
    verification: CustomerVerification | null;
    summary: {
      submitted: boolean;
      valid: boolean;
      status: VerificationStatus | null;
      validation_summary: {
        time_valid: boolean;
        amount_valid: boolean;
        phone_valid: boolean;
        overall_valid: boolean;
      } | null;
    };
  }> {
    const verification = await this.getVerification(sessionToken);

    if (!verification) {
      return {
        verification: null,
        summary: {
          submitted: false,
          valid: false,
          status: null,
          validation_summary: null
        }
      };
    }

    const verificationModel = new CustomerVerificationModel(verification);
    
    return {
      verification,
      summary: {
        submitted: true,
        valid: verificationModel.isValid(),
        status: verification.verification_status,
        validation_summary: verificationModel.getValidationSummary()
      }
    };
  }

  /**
   * Validate submission data format
   */
  private validateSubmissionData(submission: VerificationSubmissionRequest): void {
    // Validate transaction time
    if (!DatabaseValidator.validateTransactionTime(submission.transaction_time)) {
      throw new Error('Invalid transaction time format. Use HH:MM format.');
    }

    // Validate transaction amount
    if (!DatabaseValidator.validateTransactionAmount(submission.transaction_amount)) {
      throw new Error('Invalid transaction amount. Must be a positive number with max 2 decimal places.');
    }

    // Validate phone number format
    if (!DatabaseValidator.validatePhoneNumber(submission.phone_number)) {
      throw new Error('Invalid phone number format.');
    }
  }

  /**
   * Re-validate an existing verification
   */
  async revalidateVerification(
    verificationId: string,
    expectedAmount: number
  ): Promise<{
    verification: CustomerVerification;
    new_validation_results: ValidationResults;
    status_changed: boolean;
  }> {
    const verification = await this.getVerificationById(verificationId);
    if (!verification) {
      throw new Error('Verification not found');
    }

    // Perform fresh validation
    const newValidationResults = this.validator.validateSubmission({
      transaction_time: verification.transaction_time,
      transaction_amount: verification.transaction_amount,
      phone_number: verification.phone_number
    }, expectedAmount);

    // Determine new status
    const newStatus: VerificationStatus = newValidationResults.overall_valid ? 'completed' : 'failed';
    const statusChanged = verification.verification_status !== newStatus;

    // Update if status changed
    if (statusChanged) {
      await this.updateVerificationStatus(verificationId, newStatus);
    }

    return {
      verification: {
        ...verification,
        verification_status: newStatus,
        validation_results: newValidationResults
      },
      new_validation_results: newValidationResults,
      status_changed: statusChanged
    };
  }

  /**
   * Get verification statistics for a store
   */
  async getVerificationStats(storeId: string): Promise<{
    total_verifications: number;
    successful_verifications: number;
    failed_verifications: number;
    success_rate: number;
    common_failure_reasons: {
      time_failures: number;
      amount_failures: number;
      phone_failures: number;
    };
  }> {
    const verifications = await this.listVerifications(storeId, 1000); // Get more for stats

    const total = verifications.length;
    const successful = verifications.filter(v => v.verification_status === 'completed' && v.validation_results.overall_valid).length;
    const failed = total - successful;

    let timeFailures = 0;
    let amountFailures = 0;
    let phoneFailures = 0;

    verifications.forEach(verification => {
      if (!verification.validation_results.overall_valid) {
        if (verification.validation_results.time_validation.status !== 'valid') {
          timeFailures++;
        }
        if (verification.validation_results.amount_validation.status !== 'valid') {
          amountFailures++;
        }
        if (verification.validation_results.phone_validation.status !== 'valid') {
          phoneFailures++;
        }
      }
    });

    return {
      total_verifications: total,
      successful_verifications: successful,
      failed_verifications: failed,
      success_rate: total > 0 ? (successful / total) * 100 : 0,
      common_failure_reasons: {
        time_failures: timeFailures,
        amount_failures: amountFailures,
        phone_failures: phoneFailures
      }
    };
  }

  /**
   * Check if verification exists for session
   */
  async hasVerification(sessionToken: string): Promise<boolean> {
    const verification = await this.getVerification(sessionToken);
    return verification !== null;
  }

  /**
   * Get verification with enhanced details
   */
  async getVerificationWithDetails(sessionToken: string): Promise<{
    verification: CustomerVerification | null;
    details: {
      time_difference_minutes: number | null;
      amount_difference_sek: number | null;
      formatted_phone: string | null;
      is_valid: boolean;
      is_completed: boolean;
    } | null;
  }> {
    const verification = await this.getVerification(sessionToken);

    if (!verification) {
      return {
        verification: null,
        details: null
      };
    }

    const verificationModel = new CustomerVerificationModel(verification);

    return {
      verification,
      details: {
        time_difference_minutes: verificationModel.getTimeDifferenceMinutes(),
        amount_difference_sek: verificationModel.getAmountDifferenceSEK(),
        formatted_phone: verificationModel.getFormattedPhoneNumber(),
        is_valid: verificationModel.isValid(),
        is_completed: verificationModel.isCompleted()
      }
    };
  }

  /**
   * Bulk validate verifications for administrative purposes
   */
  async bulkValidateVerifications(
    storeId: string,
    expectedAmount: number
  ): Promise<{
    processed: number;
    updated: number;
    errors: Array<{ verification_id: string; error: string }>;
  }> {
    const verifications = await this.listVerifications(storeId);
    let processed = 0;
    let updated = 0;
    const errors: Array<{ verification_id: string; error: string }> = [];

    for (const verification of verifications) {
      try {
        const result = await this.revalidateVerification(verification.verification_id, expectedAmount);
        processed++;
        if (result.status_changed) {
          updated++;
        }
      } catch (error) {
        errors.push({
          verification_id: verification.verification_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      processed,
      updated,
      errors
    };
  }
}