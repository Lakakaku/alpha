import { z } from 'zod';

// Data Protection Audit - Customer data handling throughout workflows
export const DataProtectionAuditSchema = z.object({
  audit_id: z.string().uuid(),
  audit_name: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  
  // Workflow coverage
  audited_workflows: z.array(z.object({
    workflow_name: z.enum(['qr_verification', 'feedback_collection', 'business_verification', 'payment_processing', 'ai_analysis']),
    workflow_id: z.string().uuid(),
    data_entry_points: z.array(z.string()),
    data_exit_points: z.array(z.string()),
    retention_period_days: z.number().min(0),
    audit_status: z.enum(['pending', 'in_progress', 'completed', 'failed'])
  })),
  
  // Customer data tracking
  customer_data_flows: z.array(z.object({
    data_type: z.enum(['phone_number', 'transaction_details', 'feedback_content', 'payment_info', 'location_data']),
    collection_point: z.string(),
    processing_stages: z.array(z.string()),
    storage_locations: z.array(z.string()),
    access_controls: z.array(z.string()),
    retention_policy: z.string(),
    deletion_triggers: z.array(z.string()),
    anonymization_applied: z.boolean(),
    encryption_status: z.enum(['unencrypted', 'in_transit', 'at_rest', 'end_to_end'])
  })),
  
  // Privacy protection validation
  privacy_controls: z.object({
    phone_number_masking: z.object({
      implemented: z.boolean(),
      masking_pattern: z.string(),
      business_visibility: z.enum(['none', 'masked', 'full']),
      constitutional_compliant: z.boolean()
    }),
    
    feedback_anonymization: z.object({
      pii_detection: z.boolean(),
      automatic_scrubbing: z.boolean(),
      manual_review_required: z.boolean(),
      anonymization_accuracy: z.number().min(0).max(100)
    }),
    
    transaction_data_protection: z.object({
      temporal_tolerance_minutes: z.number().min(0),
      amount_tolerance_sek: z.number().min(0),
      data_inference_risk: z.enum(['low', 'medium', 'high']),
      mitigation_measures: z.array(z.string())
    }),
    
    cross_store_anonymity: z.object({
      customer_linking_prevented: z.boolean(),
      payment_anonymity_maintained: z.boolean(),
      profile_aggregation_blocked: z.boolean()
    })
  }),
  
  // GDPR compliance tracking
  gdpr_compliance: z.object({
    data_subject_rights: z.object({
      access_request_handling: z.boolean(),
      data_export_capability: z.boolean(),
      deletion_request_processing: z.boolean(),
      consent_withdrawal_support: z.boolean()
    }),
    
    deletion_validation: z.object({
      max_response_time_hours: z.number().max(72), // Constitutional requirement
      complete_data_removal: z.boolean(),
      backup_purging: z.boolean(),
      third_party_notification: z.boolean(),
      verification_process: z.string()
    }),
    
    data_minimization: z.object({
      purpose_limitation: z.boolean(),
      retention_period_enforcement: z.boolean(),
      unnecessary_data_collection: z.boolean(),
      data_accuracy_maintenance: z.boolean()
    }),
    
    consent_management: z.object({
      explicit_consent_recorded: z.boolean(),
      consent_withdrawal_mechanism: z.boolean(),
      purpose_specific_consent: z.boolean(),
      consent_audit_trail: z.boolean()
    })
  }),
  
  // Security assessment
  security_measures: z.object({
    data_at_rest_encryption: z.boolean(),
    data_in_transit_encryption: z.boolean(),
    access_logging: z.boolean(),
    role_based_access_control: z.boolean(),
    database_rls_policies: z.boolean(),
    api_authentication: z.boolean(),
    session_management: z.boolean(),
    audit_trail_integrity: z.boolean()
  }),
  
  // Performance impact assessment
  performance_impact: z.object({
    data_protection_overhead_ms: z.number().min(0),
    encryption_performance_cost: z.number().min(0),
    anonymization_processing_time_ms: z.number().min(0),
    gdpr_compliance_overhead_percent: z.number().min(0).max(10), // Constitutional limit
    total_performance_impact: z.number().min(0).max(10)
  }),
  
  // Audit findings
  findings: z.array(z.object({
    finding_id: z.string().uuid(),
    category: z.enum(['data_leakage', 'insufficient_protection', 'gdpr_violation', 'retention_policy_breach', 'access_control_weakness']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    affected_workflows: z.array(z.string()),
    remediation_required: z.boolean(),
    constitutional_impact: z.boolean(),
    discovered_at: z.string().datetime()
  })),
  
  // Compliance scores
  compliance_scores: z.object({
    overall_protection_score: z.number().min(0).max(100),
    privacy_protection_score: z.number().min(0).max(100),
    gdpr_compliance_score: z.number().min(0).max(100),
    security_measures_score: z.number().min(0).max(100),
    constitutional_compliance_score: z.number().min(0).max(100)
  }),
  
  // Audit metadata
  audit_status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  auditor_id: z.string().uuid(),
  total_data_points_examined: z.number().min(0),
  coverage_percentage: z.number().min(0).max(100),
  audit_duration_minutes: z.number().min(0),
  next_audit_due: z.string().datetime()
});

export type DataProtectionAudit = z.infer<typeof DataProtectionAuditSchema>;

export class DataProtectionAuditModel {
  private static readonly MAX_GDPR_RESPONSE_HOURS = 72; // Constitutional requirement
  private static readonly MAX_PERFORMANCE_IMPACT = 10; // Constitutional limit: ≤10%
  
  static validateConstitutionalCompliance(audit: DataProtectionAudit): boolean {
    // Validate GDPR deletion timeline
    if (audit.gdpr_compliance.deletion_validation.max_response_time_hours > this.MAX_GDPR_RESPONSE_HOURS) {
      throw new Error(`Constitutional violation: GDPR deletion response time ${audit.gdpr_compliance.deletion_validation.max_response_time_hours}h exceeds 72-hour maximum`);
    }
    
    // Validate phone number protection
    if (!audit.privacy_controls.phone_number_masking.constitutional_compliant) {
      throw new Error('Constitutional violation: Phone number protection requirements not met');
    }
    
    // Validate performance impact
    if (audit.performance_impact.total_performance_impact > this.MAX_PERFORMANCE_IMPACT) {
      throw new Error(`Constitutional violation: Data protection overhead ${audit.performance_impact.total_performance_impact}% exceeds 10% limit`);
    }
    
    return true;
  }
  
  static validatePhoneNumberProtection(audit: DataProtectionAudit): {
    protected: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    
    // Check phone number masking implementation
    if (!audit.privacy_controls.phone_number_masking.implemented) {
      violations.push('Phone number masking not implemented');
    }
    
    // Check business visibility restrictions
    if (audit.privacy_controls.phone_number_masking.business_visibility === 'full') {
      violations.push('Businesses have full access to phone numbers - constitutional violation');
    }
    
    // Check for phone number data flows
    const phoneDataFlows = audit.customer_data_flows.filter(flow => flow.data_type === 'phone_number');
    phoneDataFlows.forEach(flow => {
      if (!flow.anonymization_applied) {
        violations.push(`Phone number flow '${flow.collection_point}' lacks anonymization`);
      }
      
      if (flow.encryption_status === 'unencrypted') {
        violations.push(`Phone number data unencrypted in flow '${flow.collection_point}'`);
      }
    });
    
    return {
      protected: violations.length === 0,
      violations
    };
  }
  
  static validateGDPRCompliance(audit: DataProtectionAudit): {
    compliant: boolean;
    violations: string[];
    risk_level: 'low' | 'medium' | 'high' | 'critical';
  } {
    const violations: string[] = [];
    
    const gdpr = audit.gdpr_compliance;
    
    // Check data subject rights
    if (!gdpr.data_subject_rights.access_request_handling) {
      violations.push('Data access requests not supported');
    }
    
    if (!gdpr.data_subject_rights.deletion_request_processing) {
      violations.push('Data deletion requests not supported');
    }
    
    if (!gdpr.data_subject_rights.data_export_capability) {
      violations.push('Data export capability not implemented');
    }
    
    // Check deletion validation
    if (!gdpr.deletion_validation.complete_data_removal) {
      violations.push('Incomplete data removal process');
    }
    
    if (!gdpr.deletion_validation.backup_purging) {
      violations.push('Backup purging not implemented');
    }
    
    // Check data minimization
    if (!gdpr.data_minimization.purpose_limitation) {
      violations.push('Purpose limitation not enforced');
    }
    
    if (!gdpr.data_minimization.retention_period_enforcement) {
      violations.push('Data retention periods not enforced');
    }
    
    // Check consent management
    if (!gdpr.consent_management.explicit_consent_recorded) {
      violations.push('Explicit consent not properly recorded');
    }
    
    if (!gdpr.consent_management.consent_withdrawal_mechanism) {
      violations.push('Consent withdrawal mechanism missing');
    }
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (violations.length > 6) riskLevel = 'critical';
    else if (violations.length > 4) riskLevel = 'high';
    else if (violations.length > 2) riskLevel = 'medium';
    
    return {
      compliant: violations.length === 0,
      violations,
      risk_level: riskLevel
    };
  }
  
  static calculateComplianceScores(audit: DataProtectionAudit): DataProtectionAudit['compliance_scores'] {
    // Privacy protection score
    const privacyControls = audit.privacy_controls;
    let privacyScore = 0;
    privacyScore += privacyControls.phone_number_masking.implemented ? 25 : 0;
    privacyScore += privacyControls.feedback_anonymization.pii_detection ? 25 : 0;
    privacyScore += privacyControls.cross_store_anonymity.customer_linking_prevented ? 25 : 0;
    privacyScore += privacyControls.transaction_data_protection.data_inference_risk === 'low' ? 25 : 0;
    
    // GDPR compliance score
    const gdprChecks = [
      audit.gdpr_compliance.data_subject_rights.access_request_handling,
      audit.gdpr_compliance.data_subject_rights.deletion_request_processing,
      audit.gdpr_compliance.deletion_validation.complete_data_removal,
      audit.gdpr_compliance.data_minimization.purpose_limitation,
      audit.gdpr_compliance.consent_management.explicit_consent_recorded
    ];
    const gdprScore = (gdprChecks.filter(Boolean).length / gdprChecks.length) * 100;
    
    // Security measures score
    const securityChecks = Object.values(audit.security_measures);
    const securityScore = (securityChecks.filter(Boolean).length / securityChecks.length) * 100;
    
    // Constitutional compliance score (heavily weighted for violations)
    let constitutionalScore = 100;
    if (audit.gdpr_compliance.deletion_validation.max_response_time_hours > this.MAX_GDPR_RESPONSE_HOURS) {
      constitutionalScore -= 40; // Major constitutional violation
    }
    if (!audit.privacy_controls.phone_number_masking.constitutional_compliant) {
      constitutionalScore -= 30; // Major constitutional violation
    }
    if (audit.performance_impact.total_performance_impact > this.MAX_PERFORMANCE_IMPACT) {
      constitutionalScore -= 20; // Performance constitutional violation
    }
    
    // Overall protection score (weighted average)
    const overallScore = (
      privacyScore * 0.25 +
      gdprScore * 0.25 +
      securityScore * 0.20 +
      constitutionalScore * 0.30
    );
    
    return {
      overall_protection_score: Math.round(overallScore),
      privacy_protection_score: Math.round(privacyScore),
      gdpr_compliance_score: Math.round(gdprScore),
      security_measures_score: Math.round(securityScore),
      constitutional_compliance_score: Math.round(constitutionalScore)
    };
  }
  
  static generateAuditPlan(workflows: string[]): Partial<DataProtectionAudit> {
    const auditPlan: Partial<DataProtectionAudit> = {
      audit_id: crypto.randomUUID(),
      audit_name: `Data Protection Audit - ${new Date().toISOString()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      
      audited_workflows: workflows.map(workflow => ({
        workflow_name: workflow as any,
        workflow_id: crypto.randomUUID(),
        data_entry_points: this.getWorkflowEntryPoints(workflow),
        data_exit_points: this.getWorkflowExitPoints(workflow),
        retention_period_days: this.getRetentionPeriod(workflow),
        audit_status: 'pending'
      })),
      
      audit_status: 'pending',
      total_data_points_examined: 0,
      coverage_percentage: 0,
      audit_duration_minutes: 0,
      next_audit_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    };
    
    return auditPlan;
  }
  
  private static getWorkflowEntryPoints(workflow: string): string[] {
    const entryPoints: Record<string, string[]> = {
      'qr_verification': ['/api/qr/scan', 'mobile_app_camera'],
      'feedback_collection': ['/api/feedback/submit', 'ai_call_system'],
      'business_verification': ['/api/business/verify', 'csv_upload'],
      'payment_processing': ['/api/payments/process', 'swish_integration'],
      'ai_analysis': ['/api/ai/analyze', 'feedback_processing']
    };
    
    return entryPoints[workflow] || [];
  }
  
  private static getWorkflowExitPoints(workflow: string): string[] {
    const exitPoints: Record<string, string[]> = {
      'qr_verification': ['database_storage', 'business_notification'],
      'feedback_collection': ['anonymized_storage', 'business_dashboard'],
      'business_verification': ['reward_calculation', 'admin_dashboard'],
      'payment_processing': ['swish_api', 'transaction_record'],
      'ai_analysis': ['analysis_report', 'recommendation_engine']
    };
    
    return exitPoints[workflow] || [];
  }
  
  private static getRetentionPeriod(workflow: string): number {
    const retentionPeriods: Record<string, number> = {
      'qr_verification': 30, // 30 days
      'feedback_collection': 365, // 1 year
      'business_verification': 90, // 3 months
      'payment_processing': 2555, // 7 years (tax requirements)
      'ai_analysis': 180 // 6 months
    };
    
    return retentionPeriods[workflow] || 90;
  }
}