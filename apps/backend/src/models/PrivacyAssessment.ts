/**
 * PrivacyAssessment Model
 * 
 * @description Tracks data flow analysis and personal data identification across system components
 * @constitutional_requirement Phone number protection, business data isolation, TypeScript strict
 * @performance_target Data flow analysis within constitutional compliance limits
 */

import { z } from 'zod';

// Personal data types that require constitutional protection
export const PersonalDataTypeSchema = z.enum([
  'phone_number',      // Constitutional: Never exposed to businesses
  'transaction_data',  // Constitutional: Protected customer transaction info
  'feedback_content',  // Constitutional: Customer feedback content
  'session_data'       // Constitutional: Customer session information
]);

export type PersonalDataType = z.infer<typeof PersonalDataTypeSchema>;

// Anonymization status for privacy compliance tracking
export const AnonymizationStatusSchema = z.enum([
  'required',    // Data requires anonymization
  'applied',     // Anonymization has been applied
  'verified',    // Anonymization has been verified
  'failed'       // Anonymization process failed
]);

export type AnonymizationStatus = z.infer<typeof AnonymizationStatusSchema>;

// Risk levels for privacy assessment classification
export const RiskLevelSchema = z.enum([
  'low',       // Minimal privacy risk
  'medium',    // Moderate privacy risk
  'high',      // High privacy risk
  'critical'   // Critical privacy risk requiring immediate attention
]);

export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// System components that process personal data
export const SystemComponentSchema = z.enum([
  'customer_app',           // Mobile customer application
  'business_dashboard',     // Business web dashboard
  'admin_panel',           // Admin management interface
  'backend_api',           // Backend API services
  'ai_processing',         // AI feedback processing
  'payment_system',        // Payment processing
  'qr_verification',       // QR code verification system
  'database_storage'       // Database storage layer
]);

export type SystemComponent = z.infer<typeof SystemComponentSchema>;

// Main PrivacyAssessment schema with constitutional compliance
export const PrivacyAssessmentSchema = z.object({
  id: z.string().uuid('Assessment ID must be valid UUID'),
  
  component_name: z.string()
    .min(1, 'Component name is required')
    .max(100, 'Component name must be ≤100 characters'),
  
  // Data flow path through system components
  data_flow_path: z.array(z.string().min(1, 'Data flow step cannot be empty'))
    .min(1, 'Data flow path must contain at least one step')
    .max(20, 'Data flow path cannot exceed 20 steps'),
  
  personal_data_types: z.array(PersonalDataTypeSchema)
    .min(1, 'At least one personal data type must be specified'),
  
  anonymization_status: AnonymizationStatusSchema,
  
  anonymization_method: z.string()
    .max(200, 'Anonymization method description must be ≤200 characters')
    .optional(),
  
  verification_result: z.boolean()
    .describe('Whether anonymization verification was successful'),
  
  // Compliance score (0-100) for privacy compliance
  compliance_score: z.number()
    .min(0, 'Compliance score must be ≥0')
    .max(100, 'Compliance score must be ≤100'),
  
  risk_level: RiskLevelSchema,
  
  // Timestamps for audit trail
  assessment_date: z.string().datetime('Assessment date must be valid ISO 8601'),
  next_review_date: z.string().datetime('Next review date must be valid ISO 8601'),
  
  // Constitutional compliance fields
  affects_phone_numbers: z.boolean()
    .describe('Whether assessment involves phone number data'),
  
  cross_business_access: z.boolean()
    .describe('Whether data crosses business boundaries'),
  
  // Assessment metadata
  assessed_by: z.string().min(1, 'Assessor identification required'),
  assessment_method: z.enum(['automated', 'manual', 'hybrid']).default('automated'),
  
  // Data protection measures
  encryption_applied: z.boolean().default(false),
  access_logging_enabled: z.boolean().default(false),
  retention_period_days: z.number().min(0).optional(),
  
  // Business context for constitutional isolation
  store_id: z.string().uuid().optional(),
  business_scope_limited: z.boolean().default(true)
});

export type PrivacyAssessment = z.infer<typeof PrivacyAssessmentSchema>;

// Database entity with validation and constitutional compliance
export class PrivacyAssessmentModel {
  private data: PrivacyAssessment;

  constructor(data: unknown) {
    this.data = PrivacyAssessmentSchema.parse(data);
  }

  // Getters with constitutional compliance validation
  get id(): string {
    return this.data.id;
  }

  get componentName(): string {
    return this.data.component_name;
  }

  get dataFlowPath(): string[] {
    return [...this.data.data_flow_path]; // Defensive copy
  }

  get personalDataTypes(): PersonalDataType[] {
    return [...this.data.personal_data_types]; // Defensive copy
  }

  get anonymizationStatus(): AnonymizationStatus {
    return this.data.anonymization_status;
  }

  get anonymizationMethod(): string | undefined {
    return this.data.anonymization_method;
  }

  get verificationResult(): boolean {
    return this.data.verification_result;
  }

  get complianceScore(): number {
    return this.data.compliance_score;
  }

  get riskLevel(): RiskLevel {
    return this.data.risk_level;
  }

  get assessmentDate(): string {
    return this.data.assessment_date;
  }

  get nextReviewDate(): string {
    return this.data.next_review_date;
  }

  get affectsPhoneNumbers(): boolean {
    return this.data.affects_phone_numbers;
  }

  get crossBusinessAccess(): boolean {
    return this.data.cross_business_access;
  }

  // Constitutional compliance methods

  /**
   * Validates phone number protection (constitutional requirement)
   */
  validatePhoneNumberProtection(): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];

    // Phone numbers must never be accessible to businesses
    if (this.data.affects_phone_numbers && this.data.cross_business_access) {
      violations.push('Phone numbers cannot be accessed across business boundaries');
    }

    // Phone number data must be encrypted
    if (this.data.affects_phone_numbers && !this.data.encryption_applied) {
      violations.push('Phone number data must be encrypted');
    }

    // Phone number access must be logged
    if (this.data.affects_phone_numbers && !this.data.access_logging_enabled) {
      violations.push('Phone number access must be logged');
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }

  /**
   * Validates business data isolation (constitutional requirement)
   */
  validateBusinessDataIsolation(): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];

    // Business-specific data must be scope-limited
    if (!this.data.business_scope_limited) {
      violations.push('Business data access must be scope-limited');
    }

    // Cross-business access requires explicit justification
    if (this.data.cross_business_access && this.data.risk_level !== 'low') {
      violations.push('Cross-business access requires low risk level');
    }

    // Store ID required for business-specific assessments
    if (this.data.business_scope_limited && !this.data.store_id) {
      violations.push('Store ID required for business-scoped assessments');
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }

  /**
   * Calculates risk level based on data types and flow
   */
  calculateRiskLevel(): RiskLevel {
    let riskScore = 0;

    // Risk scoring based on personal data types
    const dataTypeRisks = {
      phone_number: 40,      // Highest risk - constitutional protection
      transaction_data: 30,  // High risk - financial data
      feedback_content: 20,  // Medium risk - customer content
      session_data: 10       // Lower risk - session information
    };

    this.data.personal_data_types.forEach(dataType => {
      riskScore += dataTypeRisks[dataType] || 0;
    });

    // Additional risk factors
    if (this.data.cross_business_access) riskScore += 25;
    if (!this.data.encryption_applied) riskScore += 20;
    if (!this.data.access_logging_enabled) riskScore += 15;
    if (this.data.data_flow_path.length > 5) riskScore += 10;

    // Risk level thresholds
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }

  /**
   * Validates anonymization effectiveness
   */
  validateAnonymization(): { effective: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check anonymization requirements
    if (this.data.personal_data_types.includes('phone_number') && 
        this.data.anonymization_status !== 'verified') {
      issues.push('Phone number data requires verified anonymization');
    }

    // Verify anonymization method is specified when applied
    if (this.data.anonymization_status === 'applied' && !this.data.anonymization_method) {
      issues.push('Anonymization method must be specified when applied');
    }

    // Check verification for high-risk data
    if (this.data.risk_level === 'critical' && !this.data.verification_result) {
      issues.push('Critical risk data requires anonymization verification');
    }

    return {
      effective: issues.length === 0,
      issues
    };
  }

  /**
   * Gets next review date based on risk level and constitutional requirements
   */
  calculateNextReviewDate(): string {
    const now = new Date();
    let daysToAdd: number;

    // Review frequency based on risk level
    switch (this.data.risk_level) {
      case 'critical':
        daysToAdd = 7;  // Weekly review for critical risk
        break;
      case 'high':
        daysToAdd = 30; // Monthly review for high risk
        break;
      case 'medium':
        daysToAdd = 90; // Quarterly review for medium risk
        break;
      case 'low':
        daysToAdd = 180; // Semi-annual review for low risk
        break;
    }

    // Constitutional requirement: Phone number assessments need more frequent review
    if (this.data.affects_phone_numbers) {
      daysToAdd = Math.min(daysToAdd, 30);
    }

    const nextReview = new Date(now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
    return nextReview.toISOString();
  }

  /**
   * Validates assessment for constitutional compliance
   */
  validateConstitutionalCompliance(): { compliant: boolean; violations: string[] } {
    const allViolations: string[] = [];

    const phoneProtection = this.validatePhoneNumberProtection();
    allViolations.push(...phoneProtection.violations);

    const businessIsolation = this.validateBusinessDataIsolation();
    allViolations.push(...businessIsolation.violations);

    const anonymization = this.validateAnonymization();
    allViolations.push(...anonymization.issues);

    // Additional constitutional validations
    if (this.data.compliance_score < 80 && this.data.affects_phone_numbers) {
      allViolations.push('Phone number assessments require compliance score ≥80');
    }

    return {
      compliant: allViolations.length === 0,
      violations: allViolations
    };
  }

  /**
   * Updates assessment with new data
   */
  update(updates: Partial<PrivacyAssessment>): PrivacyAssessmentModel {
    const updatedData = {
      ...this.data,
      ...updates
    };

    // Recalculate risk level if data changes
    if (updates.personal_data_types || updates.cross_business_access || 
        updates.encryption_applied || updates.access_logging_enabled) {
      const newModel = new PrivacyAssessmentModel(updatedData);
      updatedData.risk_level = newModel.calculateRiskLevel();
    }

    return new PrivacyAssessmentModel(updatedData);
  }

  /**
   * Converts to database representation
   */
  toDatabase(): Record<string, unknown> {
    return {
      id: this.data.id,
      component_name: this.data.component_name,
      data_flow_path: JSON.stringify(this.data.data_flow_path),
      personal_data_types: JSON.stringify(this.data.personal_data_types),
      anonymization_status: this.data.anonymization_status,
      anonymization_method: this.data.anonymization_method,
      verification_result: this.data.verification_result,
      compliance_score: this.data.compliance_score,
      risk_level: this.data.risk_level,
      assessment_date: this.data.assessment_date,
      next_review_date: this.data.next_review_date,
      affects_phone_numbers: this.data.affects_phone_numbers,
      cross_business_access: this.data.cross_business_access,
      assessed_by: this.data.assessed_by,
      assessment_method: this.data.assessment_method,
      encryption_applied: this.data.encryption_applied,
      access_logging_enabled: this.data.access_logging_enabled,
      retention_period_days: this.data.retention_period_days,
      store_id: this.data.store_id,
      business_scope_limited: this.data.business_scope_limited
    };
  }

  /**
   * Creates PrivacyAssessment from database row
   */
  static fromDatabase(row: Record<string, unknown>): PrivacyAssessmentModel {
    const data = {
      id: row.id,
      component_name: row.component_name,
      data_flow_path: JSON.parse(row.data_flow_path as string),
      personal_data_types: JSON.parse(row.personal_data_types as string),
      anonymization_status: row.anonymization_status,
      anonymization_method: row.anonymization_method,
      verification_result: row.verification_result,
      compliance_score: row.compliance_score,
      risk_level: row.risk_level,
      assessment_date: row.assessment_date,
      next_review_date: row.next_review_date,
      affects_phone_numbers: row.affects_phone_numbers,
      cross_business_access: row.cross_business_access,
      assessed_by: row.assessed_by,
      assessment_method: row.assessment_method,
      encryption_applied: row.encryption_applied,
      access_logging_enabled: row.access_logging_enabled,
      retention_period_days: row.retention_period_days,
      store_id: row.store_id,
      business_scope_limited: row.business_scope_limited
    };

    return new PrivacyAssessmentModel(data);
  }

  /**
   * Factory method for creating new assessments with constitutional compliance
   */
  static create(params: {
    componentName: string;
    dataFlowPath: string[];
    personalDataTypes: PersonalDataType[];
    assessedBy: string;
    storeId?: string;
  }): PrivacyAssessmentModel {
    const now = new Date().toISOString();
    
    // Auto-detect constitutional risk factors
    const affectsPhoneNumbers = params.personalDataTypes.includes('phone_number');
    
    const tempData: PrivacyAssessment = {
      id: crypto.randomUUID(),
      component_name: params.componentName,
      data_flow_path: params.dataFlowPath,
      personal_data_types: params.personalDataTypes,
      anonymization_status: affectsPhoneNumbers ? 'required' : 'applied',
      verification_result: false,
      compliance_score: 0, // Will be calculated
      risk_level: 'medium', // Will be recalculated
      assessment_date: now,
      next_review_date: now, // Will be recalculated
      affects_phone_numbers: affectsPhoneNumbers,
      cross_business_access: false,
      assessed_by: params.assessedBy,
      assessment_method: 'automated',
      encryption_applied: affectsPhoneNumbers, // Phone numbers require encryption
      access_logging_enabled: affectsPhoneNumbers, // Phone numbers require logging
      store_id: params.storeId,
      business_scope_limited: true
    };

    const model = new PrivacyAssessmentModel(tempData);
    
    // Calculate risk level and next review date
    const riskLevel = model.calculateRiskLevel();
    const nextReviewDate = model.calculateNextReviewDate();
    
    return model.update({
      risk_level: riskLevel,
      next_review_date: nextReviewDate,
      compliance_score: riskLevel === 'low' ? 90 : riskLevel === 'medium' ? 70 : 50
    });
  }
}

// Export for use in services and controllers
export { PrivacyAssessmentModel as default };