/**
 * Privacy and GDPR Compliance API Endpoints
 *
 * @description All privacy and GDPR compliance endpoints per privacy-compliance-api.yaml
 * @constitutional_requirement Admin-only access, 72-hour GDPR compliance, TypeScript strict
 * @performance_target <500ms for assessments, <2s for data exports
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { PrivacyAssessmentService } from '../../services/security/PrivacyAssessmentService';
import { GDPRComplianceService } from '../../services/security/GDPRComplianceService';
import { adminAuthMiddleware } from '../../middleware/admin-auth';
import { errorHandler } from '../../middleware/error-handler';
import { auditLogger } from '../../services/audit/auditLogger';

const router = Router();

// Input validation schemas
const GetPrivacyAssessmentsQuerySchema = z.object({
  component: z.string().min(1).max(100).optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional()
});

const CreatePrivacyAssessmentBodySchema = z.object({
  component_name: z.string().min(1).max(100),
  data_flow_path: z.array(z.string().min(1)).min(1).max(20),
  personal_data_types: z.array(z.enum(['phone_number', 'transaction_data', 'feedback_content', 'session_data'])).min(1),
  anonymization_method: z.string().max(200).optional(),
  store_id: z.string().uuid().optional()
});

const AnonymizationTestBodySchema = z.object({
  test_data_samples: z.array(z.string()).min(1).max(100),
  anonymization_method: z.string().min(1).max(200),
  validation_criteria: z.array(z.string()).min(1)
});

const GDPRDeletionRequestBodySchema = z.object({
  customer_identifier: z.string().min(1).max(100),
  deletion_scope: z.array(z.enum(['personal_data', 'transaction_history', 'feedback_content', 'session_data', 'all_data'])).min(1),
  legal_basis: z.string().min(1).max(500),
  urgency_level: z.enum(['standard', 'urgent']).default('standard')
});

const DataExportRequestBodySchema = z.object({
  customer_identifier: z.string().min(1).max(100),
  export_format: z.enum(['json', 'csv', 'xml']).default('json'),
  data_categories: z.array(z.enum(['personal_info', 'transaction_history', 'feedback_content', 'session_data', 'all_data'])).min(1),
  include_metadata: z.boolean().default(false)
});

const DataProtectionAuditBodySchema = z.object({
  workflow_type: z.enum(['QRVerification', 'FeedbackCollection', 'BusinessVerification', 'PaymentProcessing']),
  scope: z.enum(['component', 'full_system']).default('component'),
  target_component: z.string().min(1).max(100).optional()
});

/**
 * GET /api/privacy/assessments
 * Lists privacy assessments with filtering
 */
router.get('/assessments', adminAuthMiddleware, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const query = GetPrivacyAssessmentsQuerySchema.parse(req.query);

    await auditLogger.logPrivacyAssessmentAccess({
      admin_id: req.user?.id || 'unknown',
      action: 'list_privacy_assessments',
      component_filter: query.component,
      risk_filter: query.risk_level,
      timestamp: new Date().toISOString(),
      ip_address: req.ip
    });

    const privacyService = new PrivacyAssessmentService();
    const result = await privacyService.getAssessments(query);

    const responseTime = Date.now() - startTime;
    if (responseTime > 500) {
      console.warn(`Privacy assessments endpoint exceeded 500ms: ${responseTime}ms`);
    }

    res.status(200).json({
      assessments: result.assessments,
      pagination: {
        page: query.page || 1,
        limit: query.limit || 20,
        total: result.total_count,
        has_next: ((query.page || 1) * (query.limit || 20)) < result.total_count
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      });
    }
    throw error;
  }
});

/**
 * POST /api/privacy/assessments
 * Creates new privacy assessment
 */
router.post('/assessments', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = CreatePrivacyAssessmentBodySchema.parse(req.body);

    await auditLogger.logPrivacyAssessmentCreation({
      admin_id: req.user?.id || 'unknown',
      action: 'create_privacy_assessment',
      component_name: body.component_name,
      personal_data_types: body.personal_data_types,
      timestamp: new Date().toISOString(),
      ip_address: req.ip
    });

    const privacyService = new PrivacyAssessmentService();
    const assessment = await privacyService.createAssessment({
      ...body,
      assessed_by: req.user?.id || 'unknown'
    });

    res.status(201).json(assessment);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      });
    }
    throw error;
  }
});

/**
 * POST /api/privacy/assessments/{assessmentId}/anonymization
 * Tests data anonymization effectiveness
 */
router.post('/assessments/:assessmentId/anonymization', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const assessmentId = z.string().uuid().parse(req.params.assessmentId);
    const body = AnonymizationTestBodySchema.parse(req.body);

    await auditLogger.logAnonymizationTest({
      admin_id: req.user?.id || 'unknown',
      action: 'test_anonymization',
      assessment_id: assessmentId,
      method: body.anonymization_method,
      timestamp: new Date().toISOString(),
      ip_address: req.ip
    });

    const privacyService = new PrivacyAssessmentService();
    const result = await privacyService.testAnonymization({
      assessment_id: assessmentId,
      test_data: body.test_data_samples,
      method: body.anonymization_method,
      criteria: body.validation_criteria
    });

    res.status(200).json(result);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters or body',
        details: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      });
    }
    throw error;
  }
});

/**
 * POST /api/gdpr/deletion-requests
 * Creates GDPR deletion request with 72-hour compliance tracking
 */
router.post('/gdpr/deletion-requests', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = GDPRDeletionRequestBodySchema.parse(req.body);

    await auditLogger.logGDPRDeletionRequest({
      admin_id: req.user?.id || 'unknown',
      action: 'create_gdpr_deletion_request',
      customer_identifier: body.customer_identifier,
      deletion_scope: body.deletion_scope,
      urgency_level: body.urgency_level,
      timestamp: new Date().toISOString(),
      ip_address: req.ip
    });

    const gdprService = new GDPRComplianceService();
    const deletionRequest = await gdprService.createDeletionRequest({
      ...body,
      requested_by: req.user?.id || 'unknown'
    });

    // Constitutional requirement: 72-hour deadline
    const deadline = new Date(Date.now() + (72 * 60 * 60 * 1000));

    res.status(201).json({
      request_id: deletionRequest.id,
      status: deletionRequest.status,
      created_at: deletionRequest.request_timestamp,
      deadline: deadline.toISOString(),
      compliance_hours_remaining: 72
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      });
    }
    throw error;
  }
});

/**
 * GET /api/gdpr/deletion-requests/{requestId}
 * Gets GDPR deletion request status
 */
router.get('/gdpr/deletion-requests/:requestId', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const requestId = z.string().uuid().parse(req.params.requestId);

    const gdprService = new GDPRComplianceService();
    const request = await gdprService.getDeletionRequestStatus(requestId);

    if (!request) {
      return res.status(404).json({
        error: 'Deletion request not found',
        resource_id: requestId
      });
    }

    // Calculate compliance status
    const now = new Date();
    const requestTime = new Date(request.request_timestamp);
    const hoursElapsed = (now.getTime() - requestTime.getTime()) / (1000 * 60 * 60);
    const hoursRemaining = Math.max(0, 72 - hoursElapsed);
    const isOverdue = hoursElapsed > 72 && request.compliance_status !== 'completed';

    res.status(200).json({
      request_id: request.id,
      status: request.compliance_status,
      created_at: request.request_timestamp,
      completed_at: request.completion_timestamp,
      hours_elapsed: Math.floor(hoursElapsed),
      hours_remaining: Math.floor(hoursRemaining),
      is_overdue: isOverdue,
      constitutional_compliance: !isOverdue
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request ID format',
        details: ['requestId: Must be a valid UUID']
      });
    }
    throw error;
  }
});

/**
 * POST /api/gdpr/deletion-requests/{requestId}/verify
 * Verifies GDPR deletion completion
 */
router.post('/gdpr/deletion-requests/:requestId/verify', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const requestId = z.string().uuid().parse(req.params.requestId);

    const gdprService = new GDPRComplianceService();
    const verification = await gdprService.verifyDeletionCompletion(requestId);

    res.status(200).json(verification);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request ID format',
        details: ['requestId: Must be a valid UUID']
      });
    }
    throw error;
  }
});

/**
 * POST /api/gdpr/data-export
 * Creates customer data export request
 */
router.post('/gdpr/data-export', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = DataExportRequestBodySchema.parse(req.body);

    const gdprService = new GDPRComplianceService();
    const exportRequest = await gdprService.createDataExport({
      ...body,
      requested_by: req.user?.id || 'unknown'
    });

    res.status(202).json({
      export_id: exportRequest.id,
      status: exportRequest.status,
      estimated_completion: exportRequest.estimated_completion,
      format: body.export_format
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      });
    }
    throw error;
  }
});

/**
 * POST /api/privacy/data-protection-audit
 * Initiates comprehensive data protection audit
 */
router.post('/data-protection-audit', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = DataProtectionAuditBodySchema.parse(req.body);

    const privacyService = new PrivacyAssessmentService();
    const audit = await privacyService.initiateDataProtectionAudit({
      ...body,
      initiated_by: req.user?.id || 'unknown'
    });

    res.status(202).json({
      audit_id: audit.id,
      status: audit.status,
      workflow_type: audit.workflow_type,
      estimated_completion: audit.estimated_completion
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      });
    }
    throw error;
  }
});

/**
 * GET /api/privacy/data-protection-audit/{auditId}
 * Gets data protection audit results
 */
router.get('/data-protection-audit/:auditId', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const auditId = z.string().uuid().parse(req.params.auditId);

    const privacyService = new PrivacyAssessmentService();
    const audit = await privacyService.getDataProtectionAuditResults(auditId);

    if (!audit) {
      return res.status(404).json({
        error: 'Data protection audit not found',
        resource_id: auditId
      });
    }

    res.status(200).json(audit);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid audit ID format',
        details: ['auditId: Must be a valid UUID']
      });
    }
    throw error;
  }
});

export default router;