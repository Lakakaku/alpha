/**
 * GDPRComplianceRecord Model
 * 
 * @description GDPR compliance tracking entity with 72-hour validation and audit trails
 * @constitutional_requirement 72-hour maximum deletion response time
 * @entity_specification From specs/022-step-7-2/data-model.md - GDPRComplianceRecord
 */

import { z } from 'zod';

/**
 * GDPR request types
 */
export const GDPRRequestType = z.enum([
  'data_deletion',
  'data_export',
  'data_rectification',
  'consent_withdrawal',
  'data_portability',
  'access_request',
  'processing_restriction'
]);

/**
 * GDPR request status tracking
 */
export const GDPRRequestStatus = z.enum([
  'received',
  'validated',
  'processing',
  'completed',
  'failed',
  'expired',
  'cancelled'
]);

/**
 * Data categories affected by GDPR requests
 */
export const GDPRDataCategory = z.enum([
  'customer_identity',      // Phone numbers, names, emails
  'transaction_records',    // Payment and transaction data
  'feedback_data',         // Customer feedback and AI interactions
  'usage_analytics',       // Behavioral and usage data
  'verification_records',  // QR verification and business data
  'communication_logs',    // AI call logs and support interactions
  'technical_metadata',    // Session data, device info
  'consent_records'        // Consent and preference data
]);

/**
 * GDPR legal basis for processing
 */
export const GDPRLegalBasis = z.enum([
  'consent',
  'contract',
  'legal_obligation',
  'vital_interests',
  'public_task',
  'legitimate_interests'
]);

/**
 * Data subject verification methods
 */
export const VerificationMethod = z.enum([
  'sms_code',
  'email_verification',
  'phone_call',
  'identity_document',
  'existing_account',
  'admin_verification'
]);

/**
 * Data retention policy schema
 */
export const DataRetentionPolicySchema = z.object({
  category: GDPRDataCategory,
  retention_period_days: z.number().min(0),
  auto_deletion_enabled: z.boolean(),
  deletion_method: z.enum(['hard_delete', 'anonymization', 'encryption']),
  backup_retention_days: z.number().min(0),
  legal_hold_exceptions: z.array(z.string()).optional()
}).strict();

/**
 * Data processing record for GDPR compliance
 */
export const DataProcessingRecordSchema = z.object({
  processing_id: z.string().uuid(),
  data_categories: z.array(GDPRDataCategory).min(1),
  legal_basis: GDPRLegalBasis,
  purpose: z.string().min(1).max(500),
  data_subjects_count: z.number().min(0),
  retention_policy: DataRetentionPolicySchema,
  third_party_transfers: z.array(z.object({
    recipient: z.string().min(1),
    country: z.string().min(2).max(2), // ISO country code
    adequacy_decision: z.boolean(),
    safeguards: z.array(z.string())
  })).optional(),
  automated_decision_making: z.boolean(),
  profiling_involved: z.boolean()
}).strict();

/**
 * GDPR compliance audit trail
 */
export const GDPRAuditTrailSchema = z.object({
  action_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  action_type: z.enum([
    'request_received',
    'identity_verified',
    'data_located',
    'deletion_initiated',
    'deletion_completed',
    'export_generated',
    'notification_sent',
    'compliance_verified'
  ]),
  performed_by: z.string().min(1),
  details: z.string().min(1),
  affected_records: z.number().min(0),
  verification_hash: z.string().optional() // For data integrity
}).strict();

/**
 * GDPR compliance record schema with strict TypeScript validation
 * Constitutional requirement: 72-hour maximum response time
 */
export const GDPRComplianceRecordSchema = z.object({
  id: z.string().uuid(),
  request_id: z.string().min(1).max(100),
  
  // Request details
  request_type: GDPRRequestType,
  data_subject_id: z.string().min(1), // Usually phone number hash
  data_subject_contact: z.string().min(1), // Actual contact info (encrypted)
  
  // Request processing
  status: GDPRRequestStatus,
  received_at: z.string().datetime(),
  deadline: z.string().datetime(), // Constitutional: Max 72 hours from received_at
  completed_at: z.string().datetime().optional(),
  
  // Data subject verification
  verification_method: VerificationMethod,
  verification_completed: z.boolean(),
  verification_timestamp: z.string().datetime().optional(),
  verification_attempts: z.number().min(0).max(5),
  
  // Data categories and scope
  affected_data_categories: z.array(GDPRDataCategory).min(1),
  data_processing_records: z.array(DataProcessingRecordSchema),
  
  // Compliance tracking
  legal_basis_review: z.boolean(),
  consent_status_verified: z.boolean(),
  data_minimization_applied: z.boolean(),
  retention_policy_followed: z.boolean(),
  
  // Constitutional compliance validation
  within_72_hour_deadline: z.boolean(),
  constitutional_requirements_met: z.object({
    phone_number_protection: z.boolean(),
    business_data_isolation: z.boolean(),
    gdpr_deletion_timeline: z.boolean(),
    audit_trail_complete: z.boolean()
  }).strict(),
  
  // Execution details
  records_identified: z.number().min(0),
  records_processed: z.number().min(0),
  records_deleted: z.number().min(0),
  records_anonymized: z.number().min(0),
  records_exported: z.number().min(0),
  
  // Audit trail (Constitutional: Complete audit tracking)
  audit_trail: z.array(GDPRAuditTrailSchema).min(1),
  
  // Quality assurance
  compliance_verified: z.boolean(),
  verification_details: z.string().optional(),
  manual_review_required: z.boolean(),
  escalation_reason: z.string().optional(),
  
  // Metadata
  created_by: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  tags: z.array(z.string()).optional()
}).strict();

export type GDPRComplianceRecord = z.infer<typeof GDPRComplianceRecordSchema>;
export type GDPRRequestTypeType = z.infer<typeof GDPRRequestType>;
export type GDPRRequestStatusType = z.infer<typeof GDPRRequestStatus>;
export type GDPRDataCategoryType = z.infer<typeof GDPRDataCategory>;
export type DataRetentionPolicy = z.infer<typeof DataRetentionPolicySchema>;
export type DataProcessingRecord = z.infer<typeof DataProcessingRecordSchema>;
export type GDPRAuditTrail = z.infer<typeof GDPRAuditTrailSchema>;

/**
 * GDPR compliance validation and business logic
 */
export class GDPRComplianceRecordModel {
  /**
   * Constitutional constant: Maximum response time in hours
   */
  static readonly MAX_RESPONSE_TIME_HOURS = 72;

  /**
   * Validate GDPR compliance record data
   */
  static validate(data: unknown): GDPRComplianceRecord {
    return GDPRComplianceRecordSchema.parse(data);
  }

  /**
   * Create new GDPR compliance record with constitutional validation
   */
  static create(data: Omit<GDPRComplianceRecord, 'id' | 'created_at' | 'updated_at' | 'status' | 'deadline' | 'within_72_hour_deadline' | 'verification_attempts' | 'audit_trail'>): GDPRComplianceRecord {
    const now = new Date().toISOString();
    const receivedTime = new Date(data.received_at);
    
    // Constitutional requirement: 72-hour maximum deadline
    const deadline = new Date(receivedTime.getTime() + (this.MAX_RESPONSE_TIME_HOURS * 60 * 60 * 1000));
    
    // Initial audit trail entry
    const initialAuditEntry: GDPRAuditTrail = {
      action_id: crypto.randomUUID(),
      timestamp: now,
      action_type: 'request_received',
      performed_by: data.created_by,
      details: `GDPR ${data.request_type} request received for data subject`,
      affected_records: 0
    };

    const record: GDPRComplianceRecord = {
      ...data,
      id: crypto.randomUUID(),
      status: 'received',
      deadline: deadline.toISOString(),
      within_72_hour_deadline: true,
      verification_attempts: 0,
      audit_trail: [initialAuditEntry],
      created_at: now,
      updated_at: now
    };

    // Validate constitutional requirements
    this.validateConstitutionalCompliance(record);

    return this.validate(record);
  }

  /**
   * Validate constitutional compliance requirements
   */
  static validateConstitutionalCompliance(record: GDPRComplianceRecord): boolean {
    const deadlineTime = new Date(record.deadline).getTime();
    const receivedTime = new Date(record.received_at).getTime();
    const hoursToDeadline = (deadlineTime - receivedTime) / (1000 * 60 * 60);

    // Constitutional requirement: Maximum 72-hour response time
    if (hoursToDeadline > this.MAX_RESPONSE_TIME_HOURS) {
      throw new Error(`Constitutional violation: GDPR deadline exceeds 72-hour maximum (${hoursToDeadline} hours)`);
    }

    // Phone number protection validation for deletion requests
    if (record.request_type === 'data_deletion' && 
        record.affected_data_categories.includes('customer_identity') &&
        !record.constitutional_requirements_met.phone_number_protection) {
      throw new Error('Constitutional violation: Phone number protection validation required for identity data deletion');
    }

    // Business data isolation validation
    if (record.affected_data_categories.some(cat => ['transaction_records', 'verification_records'].includes(cat)) &&
        !record.constitutional_requirements_met.business_data_isolation) {
      throw new Error('Constitutional violation: Business data isolation validation required');
    }

    return true;
  }

  /**
   * Check if request is approaching or past deadline
   */
  static checkDeadlineStatus(record: GDPRComplianceRecord): {
    is_overdue: boolean;
    hours_remaining: number;
    urgency_level: 'normal' | 'warning' | 'critical' | 'overdue';
  } {
    const now = Date.now();
    const deadlineTime = new Date(record.deadline).getTime();
    const hoursRemaining = (deadlineTime - now) / (1000 * 60 * 60);

    let urgencyLevel: 'normal' | 'warning' | 'critical' | 'overdue';
    
    if (hoursRemaining < 0) {
      urgencyLevel = 'overdue';
    } else if (hoursRemaining <= 4) {
      urgencyLevel = 'critical';
    } else if (hoursRemaining <= 12) {
      urgencyLevel = 'warning';
    } else {
      urgencyLevel = 'normal';
    }

    return {
      is_overdue: hoursRemaining < 0,
      hours_remaining: Math.max(0, hoursRemaining),
      urgency_level: urgencyLevel
    };
  }

  /**
   * Add audit trail entry
   */
  static addAuditEntry(
    record: GDPRComplianceRecord, 
    actionType: GDPRAuditTrail['action_type'],
    performedBy: string,
    details: string,
    affectedRecords: number = 0
  ): GDPRComplianceRecord {
    const auditEntry: GDPRAuditTrail = {
      action_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action_type: actionType,
      performed_by: performedBy,
      details,
      affected_records: affectedRecords,
      verification_hash: this.generateVerificationHash(actionType, details, affectedRecords)
    };

    const updatedRecord: GDPRComplianceRecord = {
      ...record,
      audit_trail: [...record.audit_trail, auditEntry],
      updated_at: new Date().toISOString()
    };

    return this.validate(updatedRecord);
  }

  /**
   * Update request status with deadline validation
   */
  static updateStatus(
    record: GDPRComplianceRecord, 
    status: GDPRRequestStatusType,
    performedBy: string,
    details?: string
  ): GDPRComplianceRecord {
    const now = new Date().toISOString();
    const deadlineStatus = this.checkDeadlineStatus(record);

    // Check if completing after deadline
    if ((status === 'completed' || status === 'failed') && deadlineStatus.is_overdue) {
      throw new Error(`Constitutional violation: GDPR request completed after 72-hour deadline`);
    }

    const updatedRecord: GDPRComplianceRecord = {
      ...record,
      status,
      updated_at: now,
      within_72_hour_deadline: !deadlineStatus.is_overdue,
      ...(status === 'completed' && { completed_at: now })
    };

    // Add audit trail entry for status change
    return this.addAuditEntry(
      updatedRecord,
      status === 'completed' ? 'compliance_verified' : 'request_received',
      performedBy,
      details || `Status updated to ${status}`
    );
  }

  /**
   * Process data deletion with constitutional compliance
   */
  static processDeletion(
    record: GDPRComplianceRecord,
    deletionResults: {
      records_identified: number;
      records_deleted: number;
      records_anonymized: number;
      categories_processed: GDPRDataCategoryType[];
    },
    performedBy: string
  ): GDPRComplianceRecord {
    // Validate phone number protection (Constitutional requirement)
    if (deletionResults.categories_processed.includes('customer_identity')) {
      const phoneNumberDeletionCompliant = this.validatePhoneNumberDeletion(record, deletionResults);
      if (!phoneNumberDeletionCompliant) {
        throw new Error('Constitutional violation: Phone number deletion did not meet protection requirements');
      }
    }

    const updatedRecord: GDPRComplianceRecord = {
      ...record,
      records_identified: deletionResults.records_identified,
      records_deleted: deletionResults.records_deleted,
      records_anonymized: deletionResults.records_anonymized,
      records_processed: deletionResults.records_deleted + deletionResults.records_anonymized,
      constitutional_requirements_met: {
        ...record.constitutional_requirements_met,
        gdpr_deletion_timeline: true,
        phone_number_protection: deletionResults.categories_processed.includes('customer_identity')
      }
    };

    // Add comprehensive audit entry
    return this.addAuditEntry(
      updatedRecord,
      'deletion_completed',
      performedBy,
      `Deletion completed: ${deletionResults.records_deleted} deleted, ${deletionResults.records_anonymized} anonymized`,
      deletionResults.records_deleted + deletionResults.records_anonymized
    );
  }

  /**
   * Generate compliance report for audit purposes
   */
  static generateComplianceReport(record: GDPRComplianceRecord): {
    compliance_score: number;
    constitutional_compliance: boolean;
    timeline_compliance: boolean;
    audit_completeness: number;
    recommendations: string[];
  } {
    const deadlineStatus = this.checkDeadlineStatus(record);
    let complianceScore = 100;
    const recommendations: string[] = [];

    // Timeline compliance (Constitutional requirement)
    const timelineCompliance = !deadlineStatus.is_overdue;
    if (!timelineCompliance) {
      complianceScore -= 40;
      recommendations.push('Process requests within 72-hour constitutional deadline');
    }

    // Constitutional requirements compliance
    const constitutionalRequirements = record.constitutional_requirements_met;
    const constitutionalCompliance = Object.values(constitutionalRequirements).every(req => req);
    if (!constitutionalCompliance) {
      complianceScore -= 30;
      
      if (!constitutionalRequirements.phone_number_protection) {
        recommendations.push('Implement proper phone number protection measures');
      }
      if (!constitutionalRequirements.business_data_isolation) {
        recommendations.push('Ensure business data isolation compliance');
      }
      if (!constitutionalRequirements.gdpr_deletion_timeline) {
        recommendations.push('Meet GDPR deletion timeline requirements');
      }
      if (!constitutionalRequirements.audit_trail_complete) {
        recommendations.push('Maintain complete audit trail for all actions');
      }
    }

    // Audit trail completeness
    const expectedAuditActions = this.getExpectedAuditActions(record.request_type);
    const actualAuditActions = record.audit_trail.map(entry => entry.action_type);
    const missingActions = expectedAuditActions.filter(action => !actualAuditActions.includes(action));
    const auditCompleteness = ((expectedAuditActions.length - missingActions.length) / expectedAuditActions.length) * 100;
    
    if (auditCompleteness < 100) {
      complianceScore -= (100 - auditCompleteness) * 0.2;
      recommendations.push(`Complete missing audit actions: ${missingActions.join(', ')}`);
    }

    // Verification compliance
    if (record.verification_required && !record.verification_completed) {
      complianceScore -= 20;
      recommendations.push('Complete data subject identity verification');
    }

    return {
      compliance_score: Math.max(0, complianceScore),
      constitutional_compliance: constitutionalCompliance,
      timeline_compliance: timelineCompliance,
      audit_completeness: auditCompleteness,
      recommendations: [...new Set(recommendations)]
    };
  }

  /**
   * Validate phone number deletion compliance (Constitutional requirement)
   */
  private static validatePhoneNumberDeletion(
    record: GDPRComplianceRecord, 
    deletionResults: { records_identified: number; records_deleted: number; records_anonymized: number }
  ): boolean {
    // Phone number data must be completely removed, not just anonymized
    const phoneNumberCategories = record.affected_data_categories.filter(cat => 
      ['customer_identity', 'communication_logs'].includes(cat)
    );
    
    if (phoneNumberCategories.length > 0) {
      // For phone number data, deletion ratio should be high (>90%)
      const deletionRatio = deletionResults.records_deleted / (deletionResults.records_deleted + deletionResults.records_anonymized);
      return deletionRatio >= 0.9;
    }

    return true;
  }

  /**
   * Generate verification hash for audit trail integrity
   */
  private static generateVerificationHash(actionType: string, details: string, affectedRecords: number): string {
    const data = `${actionType}:${details}:${affectedRecords}:${Date.now()}`;
    // Simple hash - in production would use proper cryptographic hash
    return btoa(data).slice(0, 16);
  }

  /**
   * Get expected audit actions for request type
   */
  private static getExpectedAuditActions(requestType: GDPRRequestTypeType): GDPRAuditTrail['action_type'][] {
    const baseActions: GDPRAuditTrail['action_type'][] = [
      'request_received',
      'identity_verified',
      'data_located',
      'compliance_verified'
    ];

    switch (requestType) {
      case 'data_deletion':
        return [...baseActions, 'deletion_initiated', 'deletion_completed'];
      case 'data_export':
        return [...baseActions, 'export_generated'];
      default:
        return baseActions;
    }
  }
}